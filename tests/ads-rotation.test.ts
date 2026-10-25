import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBannerDimensions, precheckBanner } from "../lib/ads/banner-rules";
import { SLOT_FORMATS, MAX_IMAGE_BYTES, DEFAULT_ROTATION_SECONDS, MIN_ROTATION_SECONDS, MAX_ROTATION_SECONDS } from "../lib/ads/formats";
import { planMove, compareAds } from "../lib/ads/order";
import { clampRotationSeconds, defaultSlotSettings, isAdPosition, parseRotationSeconds } from "../lib/ads/rotation";
import { frameFor } from "../lib/ads/frame";
import { MemoryStore } from "../lib/db/store";
import { AD_POSITIONS } from "../lib/ads/types";

test("regras de banner: todos os espaços aceitam o recomendado exato, 2× e rejeitam proporção trocada", () => {
  for (const p of AD_POSITIONS) {
    for (const spec of [SLOT_FORMATS[p].desktop, SLOT_FORMATS[p].mobile].filter((x): x is NonNullable<typeof x> => Boolean(x))) {
      assert.ok(evaluateBannerDimensions(spec, spec).ok, `${p} exato`);
      assert.ok(evaluateBannerDimensions({ width: spec.width * 2, height: spec.height * 2 }, spec).ok, `${p} 2x`);
      assert.ok(!evaluateBannerDimensions({ width: spec.height, height: spec.width }, spec).ok, `${p} invertido`);
    }
  }
});

test("regras de banner: limites de proporção (±3%) e de escala (0,6× a 3×)", () => {
  const spec = SLOT_FORMATS.topo.desktop; // 970×90
  assert.ok(evaluateBannerDimensions({ width: 970, height: 92 }, spec).ok); // ~2,2%
  assert.ok(!evaluateBannerDimensions({ width: 970, height: 100 }, spec).ok);
  assert.ok(evaluateBannerDimensions({ width: 582, height: 54 }, spec).ok); // 0,6× (proporção 10,78 ≈ 10,78)
  assert.ok(!evaluateBannerDimensions({ width: 581, height: 54 }, spec).ok);
  assert.ok(!evaluateBannerDimensions({ width: 0, height: 10 }, spec).ok);
  assert.ok(!evaluateBannerDimensions({ width: 1.5, height: 10 }, spec).ok);
});

test("pré-checagem do navegador: formato, peso, leitura e dimensões, com as mesmas mensagens do servidor", () => {
  const spec = SLOT_FORMATS.rodape.desktop;
  assert.ok(precheckBanner({ type: "image/png", size: 1000 }, { width: 728, height: 90 }, spec).ok);
  const gif = precheckBanner({ type: "image/gif", size: 1000 }, { width: 728, height: 90 }, spec);
  assert.ok(!gif.ok && gif.code === "format");
  const svg = precheckBanner({ type: "image/svg+xml", size: 1000 }, { width: 728, height: 90 }, spec);
  assert.ok(!svg.ok && svg.code === "format");
  const heavy = precheckBanner({ type: "image/jpeg", size: MAX_IMAGE_BYTES + 1 }, { width: 728, height: 90 }, spec);
  assert.ok(!heavy.ok && heavy.code === "too_heavy");
  const unreadable = precheckBanner({ type: "image/png", size: 10 }, null, spec);
  assert.ok(!unreadable.ok && unreadable.code === "unreadable");
  const ratio = precheckBanner({ type: "image/png", size: 10 }, { width: 300, height: 250 }, spec);
  assert.ok(!ratio.ok && ratio.code === "wrong_ratio");
});

test("intervalo de rotação: padrão, limites e validação", () => {
  assert.equal(DEFAULT_ROTATION_SECONDS, 8);
  for (const p of AD_POSITIONS) assert.equal(defaultSlotSettings()[p].rotationSeconds, DEFAULT_ROTATION_SECONDS);
  assert.deepEqual(parseRotationSeconds("8"), { ok: true, value: 8 });
  assert.deepEqual(parseRotationSeconds(String(MIN_ROTATION_SECONDS)), { ok: true, value: MIN_ROTATION_SECONDS });
  assert.deepEqual(parseRotationSeconds(String(MAX_ROTATION_SECONDS)), { ok: true, value: MAX_ROTATION_SECONDS });
  for (const bad of ["", "3", "61", "-5", "1.5", "abc", "1e2", null, undefined, 8]) assert.equal(parseRotationSeconds(bad).ok, false, String(bad));
  assert.equal(clampRotationSeconds(1), MIN_ROTATION_SECONDS);
  assert.equal(clampRotationSeconds(999), MAX_ROTATION_SECONDS);
  assert.equal(clampRotationSeconds("x"), DEFAULT_ROTATION_SECONDS);
  assert.ok(isAdPosition("topo") && !isAdPosition("popup") && !isAdPosition(undefined));
});

test("ordem: planMove troca vizinhos, renumera 1..n e devolve null nas pontas", () => {
  const g = [
    { id: "a", sortOrder: 1, createdAt: "2026-10-01T00:00:00Z" },
    { id: "b", sortOrder: 2, createdAt: "2026-10-01T00:00:00Z" },
    { id: "c", sortOrder: 3, createdAt: "2026-10-01T00:00:00Z" },
  ];
  assert.deepEqual(planMove(g, "b", "up"), [{ id: "b", sortOrder: 1 }, { id: "a", sortOrder: 2 }, { id: "c", sortOrder: 3 }]);
  assert.deepEqual(planMove(g, "b", "down"), [{ id: "a", sortOrder: 1 }, { id: "c", sortOrder: 2 }, { id: "b", sortOrder: 3 }]);
  assert.equal(planMove(g, "a", "up"), null);
  assert.equal(planMove(g, "c", "down"), null);
  assert.equal(planMove(g, "zzz", "up"), null);
  // empate de sortOrder (anúncios antigos = 0): mais recente primeiro, e a renumeração desempata
  const tie = [
    { id: "old", sortOrder: 0, createdAt: "2026-10-01T00:00:00Z" },
    { id: "new", sortOrder: 0, createdAt: "2026-10-05T00:00:00Z" },
  ];
  assert.deepEqual([...tie].sort(compareAds).map((x) => x.id), ["new", "old"]);
  assert.deepEqual(planMove(tie, "old", "up"), [{ id: "old", sortOrder: 1 }, { id: "new", sortOrder: 2 }]);
});

test("quadro do espaço: proporção do celular só quando algum anúncio da rotação tem versão de celular", () => {
  const none = frameFor("topo", [{ mobileImageUrl: null }]);
  assert.equal(none.desktop, "970 / 90");
  assert.equal(none.mobile, "970 / 90");
  const some = frameFor("topo", [{ mobileImageUrl: null }, { mobileImageUrl: "x" }]);
  assert.equal(some.mobile, "320 / 100");
  assert.equal(some.maxWidth, 970);
  const side = frameFor("lateral", [{ mobileImageUrl: "x" }]);
  assert.equal(side.mobile, "300 / 250"); // lateral não tem versão de celular
});

test("persistência (memória): intervalo por espaço e ordem sobrevivem a novas leituras; padrões sem configuração", async () => {
  const store = new MemoryStore();
  assert.equal((await store.getSlotSettings()).topo.rotationSeconds, DEFAULT_ROTATION_SECONDS);
  await store.setRotationSeconds("topo", 15);
  const s = await store.getSlotSettings();
  assert.equal(s.topo.rotationSeconds, 15);
  assert.equal(s.rodape.rotationSeconds, DEFAULT_ROTATION_SECONDS); // independente por espaço
  s.topo.rotationSeconds = 99; // a cópia devolvida não altera o armazenado
  assert.equal((await store.getSlotSettings()).topo.rotationSeconds, 15);
});
