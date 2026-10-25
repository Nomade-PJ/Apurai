import { NormalizationError, SimulatedDataError, type OfficialCandidate, type OfficialSnapshot } from "./types";

/**
 * Normaliza o arquivo EA20 "resultado unificado" do TSE (`br-c0001-e<eleição>-u.json`).
 * Especificação: https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/divulgacao-de-resultados/tse-ea20-arquivo-de-resultado-unificado
 *
 * Estrutura relevante: raiz { ele, t, f, tpabr, cdabr, dg, hg, dt, ht, tf, and, dv,
 *   carg[]: { cd, agr[]: { par[]: { sg, cand[]: { n, sqcand, nm, nmu, seq, e, st, vap, pvap } } } },
 *   s: { ts, st, pst }, v: { tv, vv, ... } }
 *
 * Semântica (conforme a especificação): vap = votos computados do candidato; pvap = percentual de votos
 * computados do candidato em relação aos votos votáveis concorrentes; vv = votos válidos; tv = total de
 * votos computados; f = "o" (real) ou "s" (simulado); and = "n" (sem totalização) | "p" | "f".
 * Qualquer campo essencial ausente ou inválido gera NormalizationError — nunca inventamos dados.
 */

export interface NormalizeOptions {
  expectedElection?: number;
  expectedRound?: 1 | 2;
  expectedCargo?: number;
  /** Aceita f = "s" (simulado). Somente fora de produção. */
  allowSimulated?: boolean;
}

export type NormalizeResult =
  | { kind: "results"; snapshot: OfficialSnapshot }
  /** Arquivo válido, mas sem votos computados ainda (ex.: arquivo pré-gerado zerado). NÃO é "zero votos". */
  | { kind: "waiting"; reason: string };

/**
 * Converte formato brasileiro ("1.234,56", "50,90", "1.234.567", "123") ou número JSON em número; null se inválido.
 * Formatos ambíguos (ex.: "50.9") são REJEITADOS em vez de adivinhados.
 */
export function parseBrNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.trim();
  let normalized: string;
  if (/^-?\d+(,\d+)?$/.test(s)) normalized = s.replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) normalized = s.replace(/\./g, "").replace(",", ".");
  else return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** "dd/mm/aaaa" + "HH:mm[:ss]" (horário de Brasília, UTC-3) => ISO UTC, ou null. */
export function parseBrDateTime(dg: unknown, hg: unknown): string | null {
  if (typeof dg !== "string" || typeof hg !== "string") return null;
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dg.trim());
  const h = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(hg.trim());
  if (!d || !h) return null;
  const iso = `${d[3]}-${d[2]}-${d[1]}T${h[1]}:${h[2]}:${h[3] ?? "00"}-03:00`;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

type Rec = Record<string, unknown>;
const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const nonEmpty = (v: unknown): string | null => str(v) || null;

function nonNegInt(v: unknown, label: string): number {
  const n = parseBrNumber(v);
  if (n === null || n < 0 || !Number.isInteger(n)) throw new NormalizationError(`Valor inválido em ${label}.`);
  return n;
}

function optNonNegInt(v: unknown, label: string): number | null {
  if (v === undefined || v === null || v === "") return null;
  return nonNegInt(v, label);
}

export function normalizeOfficialData(raw: unknown, opts: NormalizeOptions = {}): NormalizeResult {
  if (!isRecord(raw)) throw new NormalizationError("Resposta da fonte não é um objeto JSON.");

  // --- Identificação e fase: nunca aceitar arquivo de outra eleição/turno ou simulado ---
  const phase = str(raw.f).toLowerCase();
  if (phase === "s") {
    if (!opts.allowSimulated) throw new SimulatedDataError("Arquivo marcado como simulado (f = s).");
  } else if (phase !== "o") {
    throw new NormalizationError("Campo f (fase) ausente ou inválido.");
  }
  const simulated = phase === "s";

  const ele = parseBrNumber(raw.ele);
  if (ele === null || !Number.isInteger(ele)) throw new NormalizationError("Campo ele (eleição) ausente ou inválido.");
  if (opts.expectedElection !== undefined && ele !== opts.expectedElection) throw new NormalizationError("Arquivo de outra eleição.");

  const t = parseBrNumber(raw.t);
  if (t !== 1 && t !== 2) throw new NormalizationError("Campo t (turno) ausente ou inválido.");
  if (opts.expectedRound !== undefined && t !== opts.expectedRound) throw new NormalizationError("Arquivo de outro turno.");

  if (str(raw.tpabr).toLowerCase() !== "br" || str(raw.cdabr).toLowerCase() !== "br") {
    throw new NormalizationError("Arquivo não é de abrangência nacional (Brasil).");
  }

  // --- Cargo ---
  if (!Array.isArray(raw.carg)) throw new NormalizationError("Lista de cargos (carg) ausente.");
  const cargoCode = opts.expectedCargo ?? 1;
  const carg = raw.carg.find((c) => isRecord(c) && parseBrNumber(c.cd) === cargoCode);
  if (!isRecord(carg)) throw new NormalizationError("Cargo esperado ausente no arquivo.");
  if (!Array.isArray(carg.agr)) throw new NormalizationError("Agrupamentos (agr) ausentes.");

  // --- Sinais de "apuração ainda não começou" (antes de exigir números) ---
  const andamento = str(raw.and).toLowerCase();
  if (raw.dv !== undefined && str(raw.dv).toLowerCase() === "n") {
    return { kind: "waiting", reason: "Divulgação de votação ainda não liberada pela fonte (dv = n)." };
  }
  if (andamento === "n") return { kind: "waiting", reason: "Fonte informa que não houve totalização (and = n)." };

  // --- Seções ---
  if (!isRecord(raw.s)) throw new NormalizationError("Bloco de seções (s) ausente.");
  const counted = nonNegInt(raw.s.st, "s.st");
  const sectionsTotal = optNonNegInt(raw.s.ts, "s.ts");
  const pstRaw = raw.s.pst === undefined || raw.s.pst === "" ? null : parseBrNumber(raw.s.pst);
  if (raw.s.pst !== undefined && raw.s.pst !== "" && (pstRaw === null || pstRaw < 0 || pstRaw > 100)) {
    throw new NormalizationError("Percentual de seções (s.pst) inválido.");
  }
  if (sectionsTotal !== null && counted > sectionsTotal) throw new NormalizationError("Seções totalizadas excedem o total.");

  // --- Candidatos: carg[].agr[].par[].cand[] ---
  const candidates: OfficialCandidate[] = [];
  for (const agr of carg.agr) {
    if (!isRecord(agr) || !Array.isArray(agr.par)) throw new NormalizationError("Agrupamento inválido.");
    for (const par of agr.par) {
      if (!isRecord(par) || !Array.isArray(par.cand)) throw new NormalizationError("Partido inválido.");
      for (const c of par.cand) {
        if (!isRecord(c)) throw new NormalizationError("Candidato inválido.");
        const name = str(c.nm) || str(c.nmu);
        if (!name) throw new NormalizationError("Candidato sem nome.");
        const votes = nonNegInt(c.vap, `vap de ${name}`);
        const percent = parseBrNumber(c.pvap);
        if (percent === null || percent < 0 || percent > 100) throw new NormalizationError(`Percentual (pvap) inválido para ${name}.`);
        const seq = parseBrNumber(c.seq);
        candidates.push({
          name,
          ballotName: nonEmpty(c.nmu),
          party: nonEmpty(par.sg),
          number: nonEmpty(c.n),
          sequence: seq !== null && Number.isInteger(seq) ? seq : null,
          votes,
          percent,
          status: nonEmpty(c.st),
        });
      }
    }
  }
  if (candidates.length === 0) throw new NormalizationError("Nenhum candidato no arquivo.");
  if (candidates.length > 40) throw new NormalizationError("Lista de candidatos grande demais.");

  const v = isRecord(raw.v) ? raw.v : {};
  const validVotes = optNonNegInt(v.vv, "v.vv");
  const totalVotes = optNonNegInt(v.tv, "v.tv");

  const sum = candidates.reduce((a, c) => a + c.votes, 0);
  if (totalVotes !== null && sum > totalVotes) throw new NormalizationError("Votos dos candidatos excedem o total computado.");

  // Arquivo válido porém sem votos computados (ex.: pré-gerado e zerado): NÃO é resultado.
  if (counted === 0 || sum === 0) return { kind: "waiting", reason: "Nenhuma seção totalizada ou nenhum voto computado ainda." };

  const final = (str(raw.tf).toLowerCase() === "s" || andamento === "f") && (sectionsTotal === null || counted === sectionsTotal);

  candidates.sort((a, b) => b.votes - a.votes || (a.sequence ?? 1e9) - (b.sequence ?? 1e9));

  return {
    kind: "results",
    snapshot: {
      electionCode: ele,
      round: t,
      candidates,
      sections: { total: sectionsTotal, counted, percent: pstRaw },
      validVotes,
      totalVotes,
      generatedAt: parseBrDateTime(raw.dg, raw.hg),
      totalizedAt: parseBrDateTime(raw.dt, raw.ht),
      final,
      simulated,
    },
  };
}

/** Revalida um snapshot vindo do banco (jsonb) antes de reutilizá-lo; null se não for confiável. */
export function parseStoredSnapshot(raw: unknown, expectedElection: number): OfficialSnapshot | null {
  if (!isRecord(raw) || raw.simulated !== false || raw.electionCode !== expectedElection) return null;
  if (raw.round !== 1 && raw.round !== 2) return null;
  if (!Array.isArray(raw.candidates) || raw.candidates.length === 0 || raw.candidates.length > 40) return null;
  if (!isRecord(raw.sections) || typeof raw.sections.counted !== "number" || raw.sections.counted <= 0) return null;
  for (const c of raw.candidates) {
    if (!isRecord(c) || typeof c.name !== "string" || !c.name) return null;
    if (typeof c.votes !== "number" || !Number.isInteger(c.votes) || c.votes < 0) return null;
    if (typeof c.percent !== "number" || c.percent < 0 || c.percent > 100) return null;
  }
  return raw as unknown as OfficialSnapshot;
}
