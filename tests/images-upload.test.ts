import test from "node:test";
import assert from "node:assert/strict";
import { inspectImage, checkBanner } from "../lib/validation/image";
import { createAdWithImages, deleteAdAndImages, describeFailure, moveAd, updateAdWithImages } from "../lib/ads/upload";
import { MemoryStore, MemoryStorage, SchemaPendingError, StorageError } from "../lib/db/store";
import { MAX_IMAGE_BYTES, SLOT_FORMATS } from "../lib/ads/formats";
import { makeJpegHeader, makePng, makeWebp } from "./helpers/images";
import type { AdInput } from "../lib/validation/ad";

const file = (bytes: Uint8Array, name = "b.png", type = "image/png") => new File([bytes as BlobPart], name, { type });
const input = (over: Partial<AdInput> = {}): AdInput => ({
  campaignName: "Campanha", advertiser: "Empresa", position: "topo", startsAt: "2026-10-01T00:00:00.000Z", endsAt: "2026-10-31T00:00:00.000Z",
  targetUrl: "https://empresa.com.br", altText: "Banner da empresa", ...over,
});
const topoD = SLOT_FORMATS.topo.desktop;
const topoM = SLOT_FORMATS.topo.mobile!;

test("inspectImage lê tipo e dimensões pelos bytes (PNG, JPEG, WEBP VP8X/VP8L/VP8)", () => {
  assert.deepEqual(inspectImage(makePng(970, 90)), { mime: "image/png", width: 970, height: 90 });
  assert.deepEqual(inspectImage(makeJpegHeader(300, 250)), { mime: "image/jpeg", width: 300, height: 250 });
  for (const k of ["VP8X", "VP8L", "VP8"] as const) assert.deepEqual(inspectImage(makeWebp(k, 728, 90)), { mime: "image/webp", width: 728, height: 90 }, k);
});

test("inspectImage recusa SVG, HTML, GIF e lixo mesmo com extensão/Content-Type de imagem", () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  assert.equal(inspectImage(enc('<svg xmlns="http://www.w3.org/2000/svg" width="970" height="90"><script>alert(1)</script></svg>')), null);
  assert.equal(inspectImage(enc("<html><script>alert(1)</script></html>")), null);
  assert.equal(inspectImage(enc("GIF89a\x01\x00\x01\x00")), null);
  assert.equal(inspectImage(new Uint8Array(0)), null);
  assert.equal(inspectImage(new Uint8Array([0xff, 0xd8, 0xff])), null);
});

test("checkBanner: aceita o formato exato e variações que preservam a proporção; recusa o resto com mensagem específica", () => {
  const ok = (w: number, h: number, spec = topoD) => checkBanner(makePng(w, h), spec);
  const exact = ok(970, 90);
  assert.ok(exact.ok && exact.exact && exact.note === null);
  for (const [w, h] of [[1940, 180], [2910, 270], [971, 90], [728, 67], [600, 56]] as const) {
    const r = ok(w, h);
    assert.ok(r.ok, `${w}×${h}`);
    if (r.ok) assert.match(r.note ?? "", /ajustada/);
  }
  const wrong = ok(970, 250);
  assert.ok(!wrong.ok && wrong.code === "wrong_ratio" && /970×250/.test(wrong.error) && /970×90/.test(wrong.error));
  const small = ok(400, 37);
  assert.ok(!small.ok && small.code === "too_small" && /582/.test(small.error));
  const huge = ok(3880, 360);
  assert.ok(!huge.ok && huge.code === "too_large");
  assert.ok(!checkBanner(new Uint8Array(0), topoD).ok);
  const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
  big.set(makePng(970, 90));
  const heavy = checkBanner(big, topoD);
  assert.ok(!heavy.ok && heavy.code === "too_heavy" && /KB/.test(heavy.error));
  // espaço lateral (300×250): outra proporção, regras próprias
  assert.ok(checkBanner(makePng(600, 500), SLOT_FORMATS.lateral.desktop).ok);
  assert.ok(!checkBanner(makePng(970, 90), SLOT_FORMATS.lateral.desktop).ok);
});

test("JPEG com orientação EXIF: dimensões são as exibidas pelo navegador (5..8 troca largura e altura)", () => {
  assert.deepEqual(inspectImage(makeJpegHeader(90, 970, { orientation: 6 })), { mime: "image/jpeg", width: 970, height: 90 });
  assert.deepEqual(inspectImage(makeJpegHeader(90, 970, { orientation: 8, littleEndian: true })), { mime: "image/jpeg", width: 970, height: 90 });
  for (const o of [1, 2, 3, 4]) assert.deepEqual(inspectImage(makeJpegHeader(970, 90, { orientation: o })), { mime: "image/jpeg", width: 970, height: 90 });
  assert.deepEqual(inspectImage(makeJpegHeader(970, 90, { orientation: 99 })), { mime: "image/jpeg", width: 970, height: 90 }); // inválida: ignorada
  assert.ok(checkBanner(makeJpegHeader(90, 970, { orientation: 6 }), topoD).ok);
});

test("cadastro: nasce PAUSADO, envia banners ao storage e usa caminhos por anúncio", async () => {
  const store = new MemoryStore();
  const r = await createAdWithImages(store, input(), { desktop: file(makePng(topoD.width, topoD.height)), mobile: file(makePng(topoM.width, topoM.height)) });
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.ad.status, "pausado");
  assert.equal(r.ad.sortOrder, 0);
  assert.match(r.ad.desktopImagePath ?? "", new RegExp(`^${r.ad.id}/desktop-.+\\.png$`));
  assert.match(r.ad.mobileImagePath ?? "", new RegExp(`^${r.ad.id}/mobile-.+\\.png$`));
  assert.ok((store.storage as MemoryStorage).has(r.ad.desktopImagePath!));
  assert.equal((await store.listAds()).length, 1);
});

test("cadastro: sem banner desktop, dimensões erradas, SVG ou mobile em espaço só-desktop => 422 e nada é salvo/enviado", async () => {
  const store = new MemoryStore();
  const svg = file(new TextEncoder().encode("<svg/>"), "x.png", "image/png");
  const cases: Array<[Parameters<typeof createAdWithImages>[1], Parameters<typeof createAdWithImages>[2], string]> = [
    [input(), { desktop: null, mobile: null }, "desktopImage"],
    [input(), { desktop: file(makePng(100, 100)), mobile: null }, "desktopImage"],
    [input(), { desktop: svg, mobile: null }, "desktopImage"],
    [input(), { desktop: file(makePng(topoD.width, topoD.height)), mobile: file(makePng(10, 10)) }, "mobileImage"],
    [input({ position: "lateral" }), { desktop: file(makePng(300, 250)), mobile: file(makePng(320, 100)) }, "mobileImage"],
  ];
  for (const [inp, files, field] of cases) {
    const r = await createAdWithImages(store, inp, files);
    assert.equal(r.ok, false);
    if (!r.ok) { assert.equal(r.status, 422); assert.ok(r.errors?.[field], field); }
  }
  assert.equal((await store.listAds()).length, 0);
});

test("cadastro: falha ao gravar no banco remove os arquivos já enviados", async () => {
  const store = new MemoryStore();
  store.createAd = async () => { throw new Error("db"); };
  const r = await createAdWithImages(store, input(), { desktop: file(makePng(topoD.width, topoD.height)), mobile: null });
  assert.equal(r.ok, false);
  const storage = store.storage as MemoryStorage;
  assert.equal(storage.has("x"), false);
});

test("edição: troca de banner remove o antigo; mudar de espaço exige novo banner; remover mobile funciona", async () => {
  const store = new MemoryStore();
  const created = await createAdWithImages(store, input(), { desktop: file(makePng(topoD.width, topoD.height)), mobile: file(makePng(topoM.width, topoM.height)) });
  assert.ok(created.ok);
  if (!created.ok) return;
  const id = created.ad.id;
  const oldDesktop = created.ad.desktopImagePath!;
  const storage = store.storage as MemoryStorage;

  const swap = await updateAdWithImages(store, id, input({ campaignName: "Nova" }), { desktop: file(makePng(topoD.width, topoD.height, [255, 0, 0])), mobile: null }, { removeMobile: false });
  assert.ok(swap.ok);
  if (swap.ok) {
    assert.equal(swap.ad.campaignName, "Nova");
    assert.notEqual(swap.ad.desktopImagePath, oldDesktop);
    assert.equal(storage.has(oldDesktop), false);
    assert.equal(storage.has(swap.ad.desktopImagePath!), true);
  }

  const move = await updateAdWithImages(store, id, input({ position: "lateral" }), { desktop: null, mobile: null }, { removeMobile: false });
  assert.equal(move.ok, false);
  if (!move.ok) assert.ok(move.errors?.desktopImage);

  const moved = await updateAdWithImages(store, id, input({ position: "lateral" }), { desktop: file(makePng(300, 250)), mobile: null }, { removeMobile: false });
  assert.ok(moved.ok);
  if (moved.ok) assert.equal(moved.ad.mobileImagePath, null); // espaço só-desktop descarta o banner de celular

  const none = await updateAdWithImages(store, "00000000-0000-4000-8000-000000000000", input(), { desktop: null, mobile: null }, { removeMobile: false });
  assert.equal(none.ok === false && none.status, 404);
});

test("status: ativar, pausar e desativar", async () => {
  const store = new MemoryStore();
  const c = await createAdWithImages(store, input(), { desktop: file(makePng(topoD.width, topoD.height)), mobile: null });
  assert.ok(c.ok);
  if (!c.ok) return;
  for (const s of ["ativo", "pausado", "desativado"] as const) {
    assert.equal(await store.setAdStatus(c.ad.id, s), true);
    assert.equal((await store.getAd(c.ad.id))?.status, s);
  }
  assert.equal(await store.setAdStatus("inexistente", "ativo"), false);
});

test("cadastro: pode já nascer ativo; cada novo anúncio vai para o fim da fila do seu espaço", async () => {
  const store = new MemoryStore();
  const mk = (over: Partial<AdInput> = {}) => createAdWithImages(store, input(over), { desktop: file(makePng(topoD.width, topoD.height)), mobile: null });
  const a = await mk({ status: "ativo" });
  const b = await mk();
  const other = await createAdWithImages(store, input({ position: "lateral" }), { desktop: file(makePng(300, 250)), mobile: null });
  assert.ok(a.ok && b.ok && other.ok);
  if (!a.ok || !b.ok || !other.ok) return;
  assert.equal(a.ad.status, "ativo");
  assert.deepEqual([a.ad.sortOrder, b.ad.sortOrder, other.ad.sortOrder], [0, 1, 0]);
});

test("erro de envio ao storage: mensagem específica (502) e nenhum registro; anúncios existentes preservados", async () => {
  const store = new MemoryStore();
  const first = await createAdWithImages(store, input({ campaignName: "Existente" }), { desktop: file(makePng(topoD.width, topoD.height)), mobile: null });
  assert.ok(first.ok);
  store.storage.upload = async () => { throw new StorageError("upload"); };
  const r = await createAdWithImages(store, input({ campaignName: "Novo" }), { desktop: file(makePng(topoD.width, topoD.height)), mobile: null });
  assert.ok(!r.ok);
  if (!r.ok) { assert.equal(r.status, 502); assert.match(r.message, /armazenamento/); }
  assert.deepEqual((await store.listAds()).map((a) => a.campaignName), ["Existente"]);
});

test("describeFailure distingue migração pendente, storage e erro genérico", () => {
  assert.equal(describeFailure(new SchemaPendingError("x")).status, 503);
  assert.match(describeFailure(new SchemaPendingError("x")).message, /migração/);
  assert.equal(describeFailure(new StorageError("x")).status, 502);
  assert.equal(describeFailure(new Error("x")).status, 500);
});

test("falha no envio do banner de celular remove o desktop já enviado e não cria registro", async () => {
  const store = new MemoryStore();
  const real = store.storage.upload.bind(store.storage);
  let calls = 0;
  store.storage.upload = async (p, b, t) => { if (++calls === 2) throw new StorageError("upload"); await real(p, b, t); };
  const r = await createAdWithImages(store, input(), { desktop: file(makePng(topoD.width, topoD.height)), mobile: file(makePng(topoM.width, topoM.height)) });
  assert.ok(!r.ok);
  assert.equal((await store.listAds()).length, 0);
  assert.equal((store.storage as MemoryStorage).count(), 0);
});

test("remoção: apaga o registro e SÓ os arquivos do próprio anúncio", async () => {
  const store = new MemoryStore();
  const storage = store.storage as MemoryStorage;
  const a = await createAdWithImages(store, input({ campaignName: "A" }), { desktop: file(makePng(topoD.width, topoD.height)), mobile: file(makePng(topoM.width, topoM.height)) });
  const b = await createAdWithImages(store, input({ campaignName: "B" }), { desktop: file(makePng(topoD.width, topoD.height, [1, 2, 3])), mobile: null });
  assert.ok(a.ok && b.ok);
  if (!a.ok || !b.ok) return;
  assert.equal(storage.count(), 3);
  const r = await deleteAdAndImages(store, a.ad.id);
  assert.ok(r.ok);
  assert.equal(await store.getAd(a.ad.id), null);
  assert.equal(storage.has(a.ad.desktopImagePath!), false);
  assert.equal(storage.has(a.ad.mobileImagePath!), false);
  assert.equal(storage.has(b.ad.desktopImagePath!), true); // arquivo de outro anúncio intocado
  assert.equal((await store.listAds()).length, 1);
  const again = await deleteAdAndImages(store, a.ad.id);
  assert.ok(!again.ok && again.status === 404);
});

test("remoção: arquivo ainda referenciado por outro registro não é apagado", async () => {
  const store = new MemoryStore();
  const storage = store.storage as MemoryStorage;
  const a = await createAdWithImages(store, input({ campaignName: "A" }), { desktop: file(makePng(topoD.width, topoD.height)), mobile: null });
  assert.ok(a.ok);
  if (!a.ok) return;
  // cenário defensivo: outro registro aponta para o mesmo arquivo
  await store.createAd({ ...input({ campaignName: "Clone" }), status: "pausado", desktopImagePath: a.ad.desktopImagePath, mobileImagePath: null });
  assert.ok((await deleteAdAndImages(store, a.ad.id)).ok);
  assert.equal(storage.has(a.ad.desktopImagePath!), true);
});

test("ordem: mover para cima/baixo renumera o espaço e respeita as pontas", async () => {
  const store = new MemoryStore();
  const mk = async (name: string, position: AdInput["position"] = "topo") => {
    const spec = SLOT_FORMATS[position].desktop;
    const r = await createAdWithImages(store, input({ campaignName: name, position }), { desktop: file(makePng(spec.width, spec.height)), mobile: null });
    assert.ok(r.ok);
    return r.ok ? r.ad.id : "";
  };
  const [a, b, c] = [await mk("A"), await mk("B"), await mk("C")];
  const side = await mk("Lateral", "lateral");
  const names = async () => (await store.listAds()).filter((x) => x.position === "topo").sort((x, y) => x.sortOrder - y.sortOrder).map((x) => x.campaignName).join("");
  assert.equal(await names(), "ABC");
  assert.deepEqual(await moveAd(store, c, "up"), { ok: true, changed: true });
  assert.equal(await names(), "ACB");
  assert.deepEqual(await moveAd(store, a, "up"), { ok: true, changed: false }); // já é o primeiro
  assert.deepEqual(await moveAd(store, b, "down"), { ok: true, changed: false }); // já é o último
  assert.equal((await store.getAd(side))?.sortOrder, 0); // outro espaço não é afetado
  const missing = await moveAd(store, "00000000-0000-4000-8000-000000000000", "up");
  assert.ok(!missing.ok && missing.status === 404);
});
