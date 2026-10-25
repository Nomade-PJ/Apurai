import { ELECTION, officialDataUrl, type ElectionConfig } from "../config/election";
import { isProd } from "../env";
import { validateHttpsUrl } from "../validation/url";
import { normalizeOfficialData, parseStoredSnapshot } from "./normalizer";
import { NormalizationError, SimulatedDataError, type OfficialSnapshot, type OfficialState } from "./types";

const TIMEOUT_MS = 8000;
const MAX_BYTES = 2_000_000;
/** O TSE bloqueia IPs com muitos 404: enquanto o arquivo não existe, consultamos com menos frequência. */
const WAITING_MIN_INTERVAL_MS = 60_000;

export interface FetchResponse {
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}
export type Fetcher = (url: string, init: { signal: AbortSignal; headers: Record<string, string> }) => Promise<FetchResponse>;

/** Persistência opcional do último resultado validado (ex.: Supabase). */
export interface OfficialPersistence {
  load(electionCode: number): Promise<{ snapshot: unknown; fetchedAt: string } | null>;
  save(rec: { electionCode: number; round: 1 | 2; snapshot: OfficialSnapshot; sourceGeneratedAt: string | null }): Promise<void>;
}

export interface ProviderOptions {
  now?: number;
  fetcher?: Fetcher;
  persist?: OfficialPersistence | null;
  election?: ElectionConfig;
}

interface GoodEntry {
  snapshot: OfficialSnapshot;
  fetchedAt: number;
}

interface Cache {
  lastGood: GoodEntry | null;
  lastAttemptAt: number;
  /** "ok": última consulta trouxe resultados; "waiting": arquivo ausente/sem votos; "failed": erro. */
  lastOutcome: "ok" | "waiting" | "failed" | null;
  etag: string | null;
  triedPersisted: boolean;
  inflight: Promise<void> | null;
}

const fresh = (): Cache => ({ lastGood: null, lastAttemptAt: 0, lastOutcome: null, etag: null, triedPersisted: false, inflight: null });
let cache: Cache = fresh();

export function resetOfficialCache(): void {
  cache = fresh();
}

function ttlMs(): number {
  const s = Number(process.env.OFFICIAL_DATA_TTL_SECONDS ?? 20);
  return Math.max(10, Number.isFinite(s) ? s : 20) * 1000;
}

const allowSimulated = () => !isProd() && process.env.OFFICIAL_ALLOW_SIMULATED === "true";

/** URL da fonte: OFFICIAL_DATA_URL (se definida) ou a URL derivada da configuração da eleição. */
export function resolveSourceUrl(election: ElectionConfig): { ok: true; url: string } | { ok: false } {
  const override = process.env.OFFICIAL_DATA_URL?.trim();
  if (!override) return { ok: true, url: officialDataUrl(election) };
  const r = validateHttpsUrl(override, 2000, { allowLocalHttp: !isProd() });
  return r.ok ? { ok: true, url: r.url } : { ok: false };
}

function sameSnapshot(a: OfficialSnapshot, b: OfficialSnapshot): boolean {
  return a.generatedAt === b.generatedAt && a.totalizedAt === b.totalizedAt && a.sections.counted === b.sections.counted;
}

async function attempt(url: string, election: ElectionConfig, now: number, fetcher: Fetcher, persist: OfficialPersistence | null) {
  cache.lastAttemptAt = now;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { accept: "application/json", "user-agent": "Apurai/1.0 (+resultados)" };
    if (cache.etag && cache.lastGood) headers["if-none-match"] = cache.etag;
    const res = await fetcher(url, { signal: controller.signal, headers });

    if (res.status === 304 && cache.lastGood) {
      cache.lastGood = { snapshot: cache.lastGood.snapshot, fetchedAt: now };
      cache.lastOutcome = "ok";
      return;
    }
    if (res.status === 404) {
      // Normal antes da apuração: o arquivo só passa a existir quando o TSE o publica.
      cache.lastOutcome = "waiting";
      return;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = await res.text();
    if (text.length > MAX_BYTES) throw new NormalizationError("Resposta grande demais.");
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new NormalizationError("Resposta da fonte não é JSON válido.");
    }
    const result = normalizeOfficialData(json, {
      expectedElection: election.electionCode,
      expectedRound: election.turno,
      expectedCargo: election.cargoCode,
      allowSimulated: allowSimulated(),
    });
    if (result.kind === "waiting") {
      cache.lastOutcome = "waiting";
      return;
    }
    const prev = cache.lastGood?.snapshot ?? null;
    cache.lastGood = { snapshot: result.snapshot, fetchedAt: now };
    cache.etag = res.headers.get("etag");
    cache.lastOutcome = "ok";
    if (persist && !result.snapshot.simulated && (!prev || !sameSnapshot(prev, result.snapshot))) {
      try {
        await persist.save({ electionCode: election.electionCode, round: election.turno, snapshot: result.snapshot, sourceGeneratedAt: result.snapshot.generatedAt });
      } catch {
        console.error("[official-data] não foi possível salvar o último resultado validado");
      }
    }
  } catch (e) {
    cache.lastOutcome = "failed";
    const kind = e instanceof SimulatedDataError ? "dados simulados rejeitados" : e instanceof NormalizationError ? "formato inesperado" : "falha de rede/tempo esgotado";
    // Log técnico sem dados pessoais nem a URL completa.
    console.warn(`[official-data] falha na coleta: ${kind}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Coleta centralizada com cache: visitantes nunca consultam a origem diretamente.
 * Em falha, mantém o último resultado VALIDADO marcado como "stale" (com horário) em vez de inventar números.
 * Estados: ok | stale | waiting (ainda sem dados oficiais válidos) | error | not_configured.
 */
export async function getOfficialState(opts: ProviderOptions = {}): Promise<OfficialState> {
  const now = opts.now ?? Date.now();
  const election = opts.election ?? ELECTION;
  const label = process.env.OFFICIAL_DATA_LABEL?.trim() || `${election.cargo} — ${election.turno}º turno (TSE)`;

  const src = resolveSourceUrl(election);
  if (!src.ok) {
    return { status: "not_configured", snapshot: null, fetchedAt: null, sourceLabel: label, sourceUrl: null, message: "A fonte oficial está mal configurada." };
  }
  const url = src.url;
  const persist = opts.persist ?? null;

  // Reaproveita o último resultado validado salvo (ex.: após reinício da instância), sempre revalidado.
  if (!cache.lastGood && !cache.triedPersisted && persist) {
    cache.triedPersisted = true;
    try {
      const stored = await persist.load(election.electionCode);
      const snap = stored ? parseStoredSnapshot(stored.snapshot, election.electionCode) : null;
      const at = stored ? Date.parse(stored.fetchedAt) : NaN;
      if (snap && Number.isFinite(at)) cache.lastGood = { snapshot: snap, fetchedAt: at };
    } catch {
      console.error("[official-data] não foi possível ler o último resultado salvo");
    }
  }

  const interval = cache.lastOutcome === "waiting" ? Math.max(ttlMs(), WAITING_MIN_INTERVAL_MS) : ttlMs();
  const due = cache.lastOutcome === null || now - cache.lastAttemptAt >= interval;
  if (due) {
    if (!cache.inflight) {
      const fetcher: Fetcher = opts.fetcher ?? ((u, init) => fetch(u, init) as unknown as Promise<FetchResponse>);
      cache.inflight = attempt(url, election, now, fetcher, persist).finally(() => {
        cache.inflight = null;
      });
    }
    await cache.inflight;
  }

  const good = cache.lastGood;
  const base = { sourceLabel: label, sourceUrl: url };
  if (good && cache.lastOutcome === "ok") {
    return { ...base, status: "ok", snapshot: good.snapshot, fetchedAt: new Date(good.fetchedAt).toISOString(), message: null };
  }
  if (good) {
    return {
      ...base,
      status: "stale",
      snapshot: good.snapshot,
      fetchedAt: new Date(good.fetchedAt).toISOString(),
      message: "Não foi possível atualizar agora. Exibindo o último resultado validado, que pode estar desatualizado.",
    };
  }
  if (cache.lastOutcome === "waiting") {
    return { ...base, status: "waiting", snapshot: null, fetchedAt: null, message: "Aguardando o início da apuração oficial" };
  }
  return {
    ...base,
    status: "error",
    snapshot: null,
    fetchedAt: null,
    message: "Não foi possível consultar a fonte oficial agora. Nenhum número é exibido sem dados oficiais válidos.",
  };
}
