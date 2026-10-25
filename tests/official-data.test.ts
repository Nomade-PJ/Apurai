import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeOfficialData, parseBrDateTime, parseBrNumber, parseStoredSnapshot } from "../lib/election-data/normalizer";
import { getOfficialState, resetOfficialCache, type Fetcher, type FetchResponse, type OfficialPersistence } from "../lib/election-data/provider";
import { NormalizationError, SimulatedDataError, type OfficialSnapshot } from "../lib/election-data/types";
import { ELECTION, officialDataUrl } from "../lib/config/election";

const fx = (name: string) => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), "utf8"));
const parcial = () => fx("ea20-presidente-parcial");
const OPTS = { expectedElection: 6258, expectedRound: 2 as const, expectedCargo: 1 };
const env = process.env as Record<string, string | undefined>;

beforeEach(() => {
  resetOfficialCache();
  delete env.OFFICIAL_DATA_URL;
  delete env.OFFICIAL_ALLOW_SIMULATED;
  delete env.OFFICIAL_DATA_TTL_SECONDS;
  env.NODE_ENV = "test";
});

// ------------------------------------------------------------------ configuração / URL
test("URL do arquivo EA20 segue o padrão da especificação (dados/br/br-c0001-e<6 dígitos>-u.json)", () => {
  assert.equal(officialDataUrl(ELECTION), "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json");
  assert.equal(
    officialDataUrl({ ...ELECTION, turno: 1, electionCode: 6257 }),
    "https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json",
  );
});

// ------------------------------------------------------------------ parsers
test("parseBrNumber entende formato brasileiro e rejeita lixo", () => {
  assert.equal(parseBrNumber("50,90"), 50.9);
  assert.equal(parseBrNumber("1.234.567"), 1234567);
  assert.equal(parseBrNumber("1.234,56"), 1234.56);
  assert.equal(parseBrNumber("123"), 123);
  assert.equal(parseBrNumber(1200000), 1200000);
  assert.equal(parseBrNumber("50.9"), null);
  assert.equal(parseBrNumber("1,2,3"), null);
  assert.equal(parseBrNumber("abc"), null);
  assert.equal(parseBrNumber(""), null);
  assert.equal(parseBrNumber(undefined), null);
  assert.equal(parseBrNumber(NaN), null);
});

test("parseBrDateTime converte horário de Brasília para UTC", () => {
  assert.equal(parseBrDateTime("25/10/2026", "19:12:40"), "2026-10-25T22:12:40.000Z");
  assert.equal(parseBrDateTime("", ""), null);
  assert.equal(parseBrDateTime(1, 2), null);
});

// ------------------------------------------------------------------ normalizador EA20
test("EA20 parcial: percorre carg>agr>par>cand, ordena por votos e preserva semântica dos campos", () => {
  const r = normalizeOfficialData(parcial(), OPTS);
  assert.equal(r.kind, "results");
  if (r.kind !== "results") return;
  const s = r.snapshot;
  assert.equal(s.electionCode, 6258);
  assert.equal(s.round, 2);
  assert.equal(s.candidates.length, 2);
  assert.equal(s.candidates[0].ballotName, "ALFA TESTE");
  assert.equal(s.candidates[0].party, "PAA");
  assert.equal(s.candidates[0].votes, 1_200_000);
  assert.equal(s.candidates[0].percent, 50.89); // pvap usado como veio, sem recálculo
  assert.equal(s.candidates[1].percent, 49.11);
  assert.deepEqual(s.sections, { total: 472000, counted: 236000, percent: 50 });
  assert.equal(s.validVotes, 2_358_000);
  assert.equal(s.totalVotes, 2_500_000);
  assert.equal(s.generatedAt, "2026-10-25T22:12:40.000Z");
  assert.equal(s.totalizedAt, "2026-10-25T22:12:31.000Z");
  assert.equal(s.final, false);
  assert.equal(s.simulated, false);
});

test("EA20 final: tf=s com todas as seções => final e status oficial dos candidatos preservado", () => {
  const r = normalizeOfficialData(fx("ea20-presidente-final"), OPTS);
  assert.equal(r.kind, "results");
  if (r.kind !== "results") return;
  assert.equal(r.snapshot.final, true);
  assert.equal(r.snapshot.candidates[0].status, "Eleito");
});

test("tf=s mas seções incompletas NÃO é tratado como final", () => {
  const raw = parcial();
  raw.tf = "s";
  const r = normalizeOfficialData(raw, OPTS);
  assert.equal(r.kind === "results" && r.snapshot.final, false);
});

test("arquivo pré-gerado e zerado => waiting (não é 'zero votos')", () => {
  const r = normalizeOfficialData(fx("ea20-presidente-zerado"), OPTS);
  assert.equal(r.kind, "waiting");
});

test("dv = n (votação não divulgável) e and = n => waiting", () => {
  const a = parcial(); a.dv = "n";
  assert.equal(normalizeOfficialData(a, OPTS).kind, "waiting");
  const b = parcial(); b.and = "n";
  assert.equal(normalizeOfficialData(b, OPTS).kind, "waiting");
});

test("votos zerados mesmo com seções informadas => waiting", () => {
  const raw = parcial();
  for (const a of raw.carg[0].agr) { a.par[0].cand[0].vap = "0"; a.par[0].cand[0].pvap = "0,00"; }
  raw.v.tv = "0";
  assert.equal(normalizeOfficialData(raw, OPTS).kind, "waiting");
});

test("arquivo de simulado (f = s) é rejeitado por padrão; aceito só com allowSimulated e marcado", () => {
  assert.throws(() => normalizeOfficialData(fx("ea20-presidente-simulado"), OPTS), SimulatedDataError);
  const r = normalizeOfficialData(fx("ea20-presidente-simulado"), { ...OPTS, allowSimulated: true });
  assert.equal(r.kind === "results" && r.snapshot.simulated, true);
});

test("f ausente ou inválido é rejeitado (não dá para provar que é real)", () => {
  const a = parcial(); delete a.f;
  assert.throws(() => normalizeOfficialData(a, OPTS), NormalizationError);
  const b = parcial(); b.f = "x";
  assert.throws(() => normalizeOfficialData(b, OPTS), NormalizationError);
});

test("eleição, turno, abrangência e cargo errados são rejeitados", () => {
  const a = parcial(); a.ele = "6257";
  assert.throws(() => normalizeOfficialData(a, OPTS), /outra eleição/);
  const b = parcial(); b.t = "1";
  assert.throws(() => normalizeOfficialData(b, OPTS), /outro turno/);
  const c = parcial(); c.tpabr = "uf"; c.cdabr = "sp";
  assert.throws(() => normalizeOfficialData(c, OPTS), /nacional/);
  const d = parcial(); d.carg[0].cd = "0003";
  assert.throws(() => normalizeOfficialData(d, OPTS), /Cargo esperado/);
});

test("estrutura inválida gera erro, nunca números inventados", () => {
  const mut = (f: (r: ReturnType<typeof parcial>) => void) => { const r = parcial(); f(r); return r; };
  const bad = [
    null, [], {}, "x", 5,
    mut((r) => { r.carg = "x"; }),
    mut((r) => { r.carg[0].agr = []; }),
    mut((r) => { r.carg[0].agr[0].par[0].cand[0].vap = "abc"; }),
    mut((r) => { r.carg[0].agr[0].par[0].cand[0].vap = "-3"; }),
    mut((r) => { r.carg[0].agr[0].par[0].cand[0].vap = "1,5"; }),
    mut((r) => { r.carg[0].agr[0].par[0].cand[0].pvap = "150,00"; }),
    mut((r) => { r.carg[0].agr[0].par[0].cand[0].pvap = ""; }),
    mut((r) => { r.carg[0].agr[0].par[0].cand[0].nm = ""; r.carg[0].agr[0].par[0].cand[0].nmu = ""; }),
    mut((r) => { delete r.s; }),
    mut((r) => { r.s.st = "999999"; }), // mais seções totalizadas que o total
    mut((r) => { r.s.pst = "250,00"; }),
    mut((r) => { r.v.tv = "100"; }), // votos dos candidatos acima do total computado
    mut((r) => { r.v.vv = "abc"; }),
  ];
  for (const b of bad) assert.throws(() => normalizeOfficialData(b, OPTS), NormalizationError, JSON.stringify(b)?.slice(0, 80));
});

test("snapshot salvo é revalidado: simulado, outra eleição ou formato quebrado são recusados", () => {
  const r = normalizeOfficialData(parcial(), OPTS);
  assert.ok(r.kind === "results");
  const snap = r.kind === "results" ? r.snapshot : null;
  assert.ok(parseStoredSnapshot(JSON.parse(JSON.stringify(snap)), 6258));
  assert.equal(parseStoredSnapshot(JSON.parse(JSON.stringify(snap)), 6257), null);
  assert.equal(parseStoredSnapshot({ ...snap, simulated: true }, 6258), null);
  assert.equal(parseStoredSnapshot({ ...snap, candidates: [] }, 6258), null);
  assert.equal(parseStoredSnapshot("lixo", 6258), null);
});

// ------------------------------------------------------------------ provider
const res = (status: number, body: unknown = "", etag: string | null = null): FetchResponse => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (n: string) => (n.toLowerCase() === "etag" ? etag : null) },
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});
const okFetcher: Fetcher = async () => res(200, parcial(), '"v1"');
const failFetcher: Fetcher = async () => { throw new Error("rede"); };

test("provider: consulta a URL EA20 derivada da configuração", async () => {
  let asked = "";
  await getOfficialState({ now: 1_000_000, fetcher: async (u) => { asked = u; return res(200, parcial()); } });
  assert.equal(asked, "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json");
});

test("provider: sucesso => ok com horário da coleta", async () => {
  const st = await getOfficialState({ now: 1_000_000, fetcher: okFetcher });
  assert.equal(st.status, "ok");
  assert.ok(st.fetchedAt);
  assert.equal(st.snapshot?.candidates.length, 2);
});

test("provider: 404 (arquivo ainda não publicado) => waiting 'Aguardando o início da apuração oficial', sem snapshot", async () => {
  const st = await getOfficialState({ now: 1_000_000, fetcher: async () => res(404) });
  assert.equal(st.status, "waiting");
  assert.equal(st.snapshot, null);
  assert.equal(st.message, "Aguardando o início da apuração oficial");
});

test("provider: arquivo zerado => waiting (nunca zeros como resultado)", async () => {
  const st = await getOfficialState({ now: 1_000_000, fetcher: async () => res(200, fx("ea20-presidente-zerado")) });
  assert.equal(st.status, "waiting");
  assert.equal(st.snapshot, null);
});

test("provider: enquanto aguarda, consulta no máximo 1x por minuto (evita bloqueio por 404 repetidos)", async () => {
  let calls = 0;
  const f: Fetcher = async () => { calls++; return res(404); };
  await getOfficialState({ now: 1_000_000, fetcher: f });
  await getOfficialState({ now: 1_030_000, fetcher: f });
  assert.equal(calls, 1);
  await getOfficialState({ now: 1_061_000, fetcher: f });
  assert.equal(calls, 2);
});

test("provider: falha sem dado anterior => error, sem snapshot", async () => {
  for (const f of [failFetcher, async () => res(500), async () => res(200, "<html>erro</html>"), async () => res(200, "{}")]) {
    resetOfficialCache();
    const st = await getOfficialState({ now: 1_000_000, fetcher: f });
    assert.equal(st.status, "error");
    assert.equal(st.snapshot, null);
  }
});

test("provider: falha depois de sucesso => stale com último resultado validado", async () => {
  await getOfficialState({ now: 1_000_000, fetcher: okFetcher });
  const st = await getOfficialState({ now: 1_000_000 + 120_000, fetcher: failFetcher });
  assert.equal(st.status, "stale");
  assert.equal(st.snapshot?.candidates.length, 2);
  assert.equal(st.fetchedAt, new Date(1_000_000).toISOString()); // horário do resultado, não da falha
  assert.match(st.message ?? "", /desatualizado/);
});

test("provider: após resultado válido, arquivo zerado/404 vira stale (não apaga o resultado)", async () => {
  await getOfficialState({ now: 1_000_000, fetcher: okFetcher });
  const st = await getOfficialState({ now: 1_000_000 + 120_000, fetcher: async () => res(404) });
  assert.equal(st.status, "stale");
  assert.ok(st.snapshot);
});

test("provider: cache evita nova consulta dentro do TTL e 304 renova o horário sem reprocessar", async () => {
  let calls = 0;
  const seen: Array<string | undefined> = [];
  const f: Fetcher = async (_u, init) => { calls++; seen.push(init.headers["if-none-match"]); return calls === 1 ? res(200, parcial(), '"v1"') : res(304); };
  await getOfficialState({ now: 5_000_000, fetcher: f });
  await getOfficialState({ now: 5_005_000, fetcher: f });
  assert.equal(calls, 1);
  const st = await getOfficialState({ now: 5_060_000, fetcher: f });
  assert.equal(calls, 2);
  assert.equal(seen[1], '"v1"');
  assert.equal(st.status, "ok");
  assert.equal(st.fetchedAt, new Date(5_060_000).toISOString());
});

test("provider: simulado é rejeitado em produção MESMO com OFFICIAL_ALLOW_SIMULATED=true", async () => {
  env.NODE_ENV = "production";
  env.OFFICIAL_ALLOW_SIMULATED = "true";
  const st = await getOfficialState({ now: 1, fetcher: async () => res(200, fx("ea20-presidente-simulado")) });
  assert.equal(st.status, "error");
  assert.equal(st.snapshot, null);
});

test("provider: simulado só é aceito fora de produção com a flag explícita, e não é persistido", async () => {
  env.OFFICIAL_ALLOW_SIMULATED = "true";
  const saved: unknown[] = [];
  const persist: OfficialPersistence = { load: async () => null, save: async (r) => { saved.push(r); } };
  const st = await getOfficialState({ now: 1, fetcher: async () => res(200, fx("ea20-presidente-simulado")), persist });
  assert.equal(st.status, "ok");
  assert.equal(st.snapshot?.simulated, true);
  assert.equal(saved.length, 0);
});

test("provider: grava o resultado validado e o reutiliza (revalidado) após reinício quando a fonte falha", async () => {
  const saved: Array<{ snapshot: OfficialSnapshot; electionCode: number }> = [];
  const persist: OfficialPersistence = { load: async () => null, save: async (r) => { saved.push(r); } };
  await getOfficialState({ now: 1_000_000, fetcher: okFetcher, persist });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].electionCode, 6258);

  resetOfficialCache(); // simula instância nova
  const stored = { snapshot: JSON.parse(JSON.stringify(saved[0].snapshot)), fetchedAt: new Date(900_000).toISOString() };
  const st = await getOfficialState({ now: 2_000_000, fetcher: failFetcher, persist: { load: async () => stored, save: async () => undefined } });
  assert.equal(st.status, "stale");
  assert.equal(st.fetchedAt, new Date(900_000).toISOString());
});

test("provider: snapshot salvo de outra eleição ou simulado é ignorado", async () => {
  const r = normalizeOfficialData(parcial(), OPTS);
  const snap = r.kind === "results" ? r.snapshot : null;
  for (const bad of [{ ...snap, electionCode: 6257 }, { ...snap, simulated: true }]) {
    resetOfficialCache();
    const st = await getOfficialState({
      now: 2_000_000,
      fetcher: failFetcher,
      persist: { load: async () => ({ snapshot: JSON.parse(JSON.stringify(bad)), fetchedAt: new Date(1).toISOString() }), save: async () => undefined },
    });
    assert.equal(st.status, "error");
    assert.equal(st.snapshot, null);
  }
});

test("provider: falha do banco de persistência não derruba a apuração", async () => {
  const persist: OfficialPersistence = { load: async () => { throw new Error("db"); }, save: async () => { throw new Error("db"); } };
  const st = await getOfficialState({ now: 1_000_000, fetcher: okFetcher, persist });
  assert.equal(st.status, "ok");
});

test("provider: OFFICIAL_DATA_URL inválida => not_configured; http em produção é recusada; override https é usado", async () => {
  env.OFFICIAL_DATA_URL = "ftp://x";
  assert.equal((await getOfficialState({ now: 1, fetcher: okFetcher })).status, "not_configured");
  env.OFFICIAL_DATA_URL = "http://inseguro.example/dados.json";
  assert.equal((await getOfficialState({ now: 1, fetcher: okFetcher })).status, "not_configured");
  env.NODE_ENV = "production";
  env.OFFICIAL_DATA_URL = "http://localhost:9999/x.json";
  assert.equal((await getOfficialState({ now: 1, fetcher: okFetcher })).status, "not_configured");
  env.NODE_ENV = "test";
  env.OFFICIAL_DATA_URL = "https://espelho.exemplo.gov.br/arquivo.json";
  let asked = "";
  const st = await getOfficialState({ now: 1, fetcher: async (u) => { asked = u; return res(200, parcial()); } });
  assert.equal(asked, "https://espelho.exemplo.gov.br/arquivo.json");
  assert.equal(st.status, "ok");
});

test("provider: requisições simultâneas compartilham a mesma consulta", async () => {
  let calls = 0;
  const slow: Fetcher = async () => { calls++; await new Promise((r) => setTimeout(r, 20)); return res(200, parcial()); };
  const [a, b, c] = await Promise.all([1, 2, 3].map(() => getOfficialState({ now: 1_000_000, fetcher: slow })));
  assert.equal(calls, 1);
  assert.equal(a.status, "ok"); assert.equal(b.status, "ok"); assert.equal(c.status, "ok");
});
