/**
 * Valida a fonte oficial no SEU ambiente (com acesso à internet): baixa o arquivo EA20 configurado,
 * normaliza e imprime um resumo. Uso: npm run check:source   (ou: npm run check:source -- <url>)
 * 404 antes da apuração é esperado (arquivo ainda não publicado).
 */
import { ELECTION, officialDataUrl } from "../lib/config/election";
import { normalizeOfficialData } from "../lib/election-data/normalizer";

const url = process.argv[2] ?? process.env.OFFICIAL_DATA_URL ?? officialDataUrl(ELECTION);
console.log("URL:", url);
const res = await fetch(url, { headers: { accept: "application/json" } }).catch((e) => {
  console.error("Falha de rede (sem acesso à internet ou bloqueio):", (e as Error).message);
  process.exit(1);
});
console.log("HTTP:", res.status, "| etag:", res.headers.get("etag"), "| last-modified:", res.headers.get("last-modified"));
if (res.status === 404) {
  console.log("Arquivo ainda não publicado (esperado antes da apuração) OU URL/código da eleição incorretos.");
  console.log("Confira o código em https://resultados.tse.jus.br/oficial/comum/config/ele-c.json e lib/config/election.ts");
  process.exit(2);
}
if (!res.ok) process.exit(1);
const raw = await res.json();
console.log("Campos da raiz:", Object.keys(raw).join(", "));
console.log("ele/t/f/tpabr/cdabr:", raw.ele, raw.t, raw.f, raw.tpabr, raw.cdabr);
try {
  const r = normalizeOfficialData(raw, { expectedElection: ELECTION.electionCode, expectedRound: ELECTION.turno, expectedCargo: ELECTION.cargoCode, allowSimulated: true });
  if (r.kind === "waiting") console.log("RESULTADO: arquivo válido, mas sem votos computados ainda →", r.reason);
  else {
    const s = r.snapshot;
    console.log(`RESULTADO: OK. simulado=${s.simulated} final=${s.final} seções=${s.sections.counted}/${s.sections.total ?? "?"}`);
    for (const c of s.candidates) console.log(` - ${c.ballotName ?? c.name} (${c.party ?? "?"}): ${c.votes} votos, pvap=${c.percent}%`);
    if (s.simulated) console.log("ATENÇÃO: f = s (simulado). Em produção o Apuraí rejeita este arquivo.");
  }
} catch (e) {
  console.error("FORMATO NÃO RECONHECIDO:", (e as Error).message);
  process.exit(1);
}
