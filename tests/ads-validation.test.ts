import test from "node:test";
import assert from "node:assert/strict";
import { isAdEligible, pickAd, pickAds } from "../lib/ads/schedule";
import type { AdView } from "../lib/ads/types";
import { SLOT_FORMATS } from "../lib/ads/formats";
import { toBrtInput } from "../lib/ads/datetime";
import { validateHttpsUrl } from "../lib/validation/url";
import { validateLead, buildLeadMessage, LEAD_INTERESTS } from "../lib/validation/lead";
import { validateAdInput } from "../lib/validation/ad";
import { buildWhatsAppUrl, whatsappNumber } from "../lib/config/contact";
import { resolveShareUrl, shareTargets } from "../lib/share";

const base: AdView = {
  id: "1", campaignName: "Campanha", advertiser: "Empresa", position: "topo", status: "ativo",
  startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-10-31T00:00:00Z",
  targetUrl: "https://empresa.com.br", altText: "Logo", desktopImageUrl: "https://cdn.exemplo.com/a.png", mobileImageUrl: null, sortOrder: 0,
  createdAt: "2026-09-30T00:00:00Z", updatedAt: "2026-09-30T00:00:00Z",
};
const now = new Date("2026-10-10T12:00:00Z");

test("anúncio ativo, no período e completo é elegível", () => assert.equal(isAdEligible(base, now), true));
test("pausado/desativado não é elegível", () => {
  assert.equal(isAdEligible({ ...base, status: "pausado" }, now), false);
  assert.equal(isAdEligible({ ...base, status: "desativado" }, now), false);
});
test("fora do período não é elegível (antes, depois, invertido, inválido)", () => {
  assert.equal(isAdEligible({ ...base, startsAt: "2026-11-01T00:00:00Z", endsAt: "2026-11-30T00:00:00Z" }, now), false);
  assert.equal(isAdEligible({ ...base, startsAt: "2026-09-01T00:00:00Z", endsAt: "2026-09-30T00:00:00Z" }, now), false);
  assert.equal(isAdEligible({ ...base, startsAt: "2026-10-31T00:00:00Z", endsAt: "2026-10-01T00:00:00Z" }, now), false);
  assert.equal(isAdEligible({ ...base, startsAt: "lixo" }, now), false);
});
test("sem imagem desktop, sem alt, destino inválido ou posição inválida => não elegível", () => {
  assert.equal(isAdEligible({ ...base, desktopImageUrl: null }, now), false);
  assert.equal(isAdEligible({ ...base, altText: "  " }, now), false);
  assert.equal(isAdEligible({ ...base, targetUrl: "javascript:alert(1)" }, now), false);
  assert.equal(isAdEligible({ ...base, targetUrl: "http://empresa.com.br" }, now), false);
  assert.equal(isAdEligible({ ...base, position: "popup" as never }, now), false);
});
test("pickAd respeita posição e devolve null sem anúncio (=> espaço oculto)", () => {
  assert.equal(pickAd([base], "rodape", now), null);
  assert.equal(pickAd([base], "topo", now)?.id, "1");
  assert.equal(pickAd([], "topo", now), null);
  assert.equal(pickAd([{ ...base, status: "pausado" }], "topo", now), null);
});
test("pickAd escolhe o mais recente", () => {
  const newer = { ...base, id: "2", createdAt: "2026-10-05T00:00:00Z" };
  assert.equal(pickAd([base, newer], "topo", now)?.id, "2");
});

test("pickAds: só os anúncios do espaço, na ordem de rotação (sortOrder, depois mais recente)", () => {
  const a = { ...base, id: "a", sortOrder: 2, createdAt: "2026-10-01T00:00:00Z" };
  const b = { ...base, id: "b", sortOrder: 1, createdAt: "2026-10-01T00:00:00Z" };
  const c = { ...base, id: "c", sortOrder: 1, createdAt: "2026-10-05T00:00:00Z" };
  const other = { ...base, id: "x", position: "rodape" as const };
  assert.deepEqual(pickAds([a, b, c, other], "topo", now).map((x) => x.id), ["c", "b", "a"]);
  assert.deepEqual(pickAds([a, b, c, other], "rodape", now).map((x) => x.id), ["x"]);
  assert.deepEqual(pickAds([{ ...a, status: "pausado" }, { ...b, endsAt: "2026-10-02T00:00:00Z" }], "topo", now), []);
});
test("pickAds: no máximo 8 anúncios por espaço", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ ...base, id: String(i), sortOrder: i }));
  assert.equal(pickAds(many, "topo", now).length, 8);
});

test("formatos: lateral é só desktop; demais têm banner de celular", () => {
  assert.equal(SLOT_FORMATS.lateral.mobile, null);
  for (const p of ["topo", "patrocinador", "rodape"] as const) assert.ok(SLOT_FORMATS[p].mobile);
});

test("URLs: apenas https, sem credenciais e sem hosts locais", () => {
  assert.equal(validateHttpsUrl("https://exemplo.com.br/x").ok, true);
  for (const bad of ["http://exemplo.com", "javascript:alert(1)", "https://user:pw@exemplo.com", "https://localhost/x",
    "https://127.0.0.1/x", "https://intranet/x", "ftp://a.com", "", 5, "https://[::1]/", "data:text/html,x"]) {
    assert.equal(validateHttpsUrl(bad).ok, false, String(bad));
  }
  assert.equal(validateHttpsUrl("http://localhost:9/x", 2000, { allowLocalHttp: true }).ok, true);
  assert.equal(validateHttpsUrl("http://exemplo.com", 2000, { allowLocalHttp: true }).ok, false);
});

test("validação de anúncio (campanha, espaço, datas em Brasília, destino, alt)", () => {
  const good = { campaignName: "Campanha 1", advertiser: "Empresa", position: "topo", startsAt: "2026-10-01T10:00", endsAt: "2026-10-31T10:00",
    targetUrl: "https://empresa.com.br", altText: "Logo da empresa" };
  const v = validateAdInput(good);
  assert.equal(v.ok, true);
  if (v.ok) assert.equal(v.value.startsAt, "2026-10-01T13:00:00.000Z"); // datetime-local = Brasília (UTC-3)
  assert.equal(validateAdInput({ ...good, position: "popup" }).ok, false);
  assert.equal(validateAdInput({ ...good, campaignName: "" }).ok, false);
  assert.equal(validateAdInput({ ...good, endsAt: "2026-09-01T00:00" }).ok, false);
  assert.equal(validateAdInput({ ...good, targetUrl: "javascript:alert(1)" }).ok, false);
  assert.equal(validateAdInput({ ...good, status: "excluido" }).ok, false);
  assert.equal(validateAdInput({ ...good, altText: "x" }).ok, false);
});

test("validação de anúncio: nome único alimenta anunciante e texto alternativo; período padrão de 30 dias", () => {
  const t0 = new Date("2026-10-12T15:00:00Z");
  const v = validateAdInput({ campaignName: "Padaria Silva", position: "topo", targetUrl: "https://padaria.com.br" }, t0);
  assert.ok(v.ok);
  if (!v.ok) return;
  assert.equal(v.value.advertiser, "Padaria Silva");
  assert.equal(v.value.altText, "Padaria Silva");
  assert.equal(v.value.startsAt, "2026-10-12T15:00:00.000Z");
  assert.equal(v.value.endsAt, "2026-11-11T15:00:00.000Z");
  const custom = validateAdInput({ campaignName: "X Y", advertiser: "Marca", altText: "Descrição", position: "rodape", targetUrl: "https://a.com.br" }, t0);
  assert.ok(custom.ok && custom.value.advertiser === "Marca" && custom.value.altText === "Descrição");
  const withStatus = validateAdInput({ campaignName: "X Y", position: "topo", targetUrl: "https://a.com.br", status: "ativo" }, t0);
  assert.ok(withStatus.ok && withStatus.value.status === "ativo");
});

test("datetime-local de edição: ISO UTC volta para Brasília", () => {
  assert.equal(toBrtInput("2026-10-01T13:00:00.000Z"), "2026-10-01T10:00");
  assert.equal(toBrtInput("lixo"), "");
});

// ------------------------------------------------------------------ contato / WhatsApp
const goodLead = { company: "Empresa X", contact: "Maria Souza", email: "maria@empresa.com.br", interest: LEAD_INTERESTS[0], message: "Quero anunciar no portal." };

test("formulário comercial valida campos obrigatórios, e-mail, interesse, tamanho e honeypot", () => {
  assert.equal(validateLead(goodLead).ok, true);
  assert.equal(validateLead({ ...goodLead, email: "invalido" }).ok, false);
  assert.equal(validateLead({ ...goodLead, message: "curta" }).ok, false);
  assert.equal(validateLead({ ...goodLead, message: "x".repeat(1001) }).ok, false);
  assert.equal(validateLead({ ...goodLead, company: "" }).ok, false);
  assert.equal(validateLead({ ...goodLead, contact: "A" }).ok, false);
  assert.equal(validateLead({ ...goodLead, interest: "outro" }).ok, false);
  assert.equal(validateLead({ ...goodLead, website: "http://spam" }).ok, false);
  assert.equal(validateLead(null).ok, false);
});

test("mensagem do WhatsApp é organizada e o link wa.me codifica o texto", () => {
  const v = validateLead({ ...goodLead, message: "Olá & bem-vindo? 100% sim #1\nlinha 2" });
  assert.ok(v.ok);
  if (!v.ok) return;
  const msg = buildLeadMessage(v.value);
  for (const part of ["Empresa: Empresa X", "Nome: Maria Souza", "E-mail: maria@empresa.com.br", `Interesse: ${LEAD_INTERESTS[0]}`, "Mensagem: Olá & bem-vindo?"]) assert.ok(msg.includes(part), part);
  const url = buildWhatsAppUrl(msg, "5511999999999");
  assert.ok(url?.startsWith("https://wa.me/5511999999999?text="));
  const encoded = url!.split("?text=")[1];
  assert.equal(decodeURIComponent(encoded), msg);
  assert.ok(!/[ \n&#]/.test(encoded)); // sem caracteres que quebrem a query string
});

test("número do WhatsApp: somente dígitos válidos; sem configuração => null (nunca inventado)", () => {
  assert.equal(whatsappNumber({}), null);
  assert.equal(whatsappNumber({ WHATSAPP_NUMBER: "" }), null);
  assert.equal(whatsappNumber({ WHATSAPP_NUMBER: "abc" }), null);
  assert.equal(whatsappNumber({ WHATSAPP_NUMBER: "123" }), null);
  assert.equal(whatsappNumber({ WHATSAPP_NUMBER: "+55 (11) 99999-9999" }), "5511999999999");
  assert.equal(buildWhatsAppUrl("oi", null), null);
});

// ------------------------------------------------------------------ compartilhamento
test("URL de compartilhamento: absoluta, usa a base configurada em produção e a origem local em dev", () => {
  assert.equal(resolveShareUrl({ path: "/", configuredBase: "https://apurai.com.br", origin: "http://localhost:3000", preferConfigured: true }), "https://apurai.com.br/");
  assert.equal(resolveShareUrl({ path: "/transparencia", configuredBase: "https://apurai.com.br", origin: "http://localhost:3000", preferConfigured: false }), "http://localhost:3000/transparencia");
  assert.equal(resolveShareUrl({ path: "anuncie", configuredBase: null, origin: "https://x.app", preferConfigured: true }), "https://x.app/anuncie");
});
test("links de compartilhamento: WhatsApp, Facebook, X, Telegram e LinkedIn (sem Instagram)", () => {
  const t = shareTargets("https://apurai.com.br/", "Veja & compartilhe");
  assert.ok(t.whatsapp.startsWith("https://wa.me/?text="));
  assert.ok(t.facebook.includes(encodeURIComponent("https://apurai.com.br/")));
  assert.ok(t.x.startsWith("https://x.com/intent/post?") && t.x.includes("url="));
  assert.ok(t.telegram.startsWith("https://t.me/share/url?url=") && t.telegram.includes("text="));
  assert.ok(t.linkedin.startsWith("https://www.linkedin.com/sharing/share-offsite/?url=") && t.linkedin.includes(encodeURIComponent("https://apurai.com.br/")));
  assert.deepEqual(Object.keys(t).sort(), ["facebook", "linkedin", "telegram", "whatsapp", "x"]);
  for (const link of Object.values(t)) assert.ok(link.startsWith("https://"));
});
