import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { candidatePhotoUrl, ELECTION } from "../lib/config/election";
import { normalizeOfficialData } from "../lib/election-data/normalizer";

const fixture = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), "utf8"));

test("foto: URL oficial montada com ciclo, eleição e sqcand", () => {
  assert.equal(candidatePhotoUrl("90001"), `https://resultados.tse.jus.br/oficial/ele2026/${ELECTION.electionCode}/fotos/br/90001.jpeg`);
});

test("foto: sqcand ausente ou não numérico não gera URL (nada de caminho montado a partir de texto livre)", () => {
  for (const bad of [null, undefined, "", "../x", "12/34", "12a", "1".repeat(21)]) assert.equal(candidatePhotoUrl(bad as string | null | undefined), null);
});

test("normalizador: guarda sqcand como photoId e descarta valor inválido", () => {
  const r = normalizeOfficialData(fixture("ea20-presidente-parcial.json"), { expectedElection: 6258, expectedRound: 2 });
  assert.equal(r.kind, "results");
  if (r.kind === "results") assert.deepEqual(r.snapshot.candidates.map((c) => c.photoId).sort(), ["90001", "90002"]);

  const raw = fixture("ea20-presidente-parcial.json");
  raw.carg[0].agr[0].par[0].cand[0].sqcand = "../../etc";
  const r2 = normalizeOfficialData(raw, { expectedElection: 6258, expectedRound: 2 });
  if (r2.kind === "results") assert.ok(r2.snapshot.candidates.some((c) => c.photoId === null));
});
