import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "../lib/security/session";
import { hashPassword } from "../lib/security/password";
import { resetRateLimits } from "../lib/security/rate-limit";
import { makePng } from "./helpers/images";
import { POST as adsPost } from "../app/api/admin/ads/route";
import { POST as loginPost } from "../app/api/admin/login/route";
import { POST as logoutPost } from "../app/api/admin/logout/route";
import { seeOther } from "../lib/security/redirect";
import { POST as leadPost } from "../app/api/lead/route";
import { getStore } from "../lib/db";

const env = process.env as Record<string, string | undefined>;
const SECRET = "s".repeat(40);
const HOST = "apurai.test";
const token = () => createSessionToken(SECRET);

beforeEach(() => {
  env.NODE_ENV = "test";
  env.SESSION_SECRET = SECRET;
  env.ADMIN_PASSWORD_HASH = hashPassword("senha-bem-forte-123");
  delete env.SUPABASE_URL; delete env.SUPABASE_SERVICE_ROLE_KEY;
  env.WHATSAPP_NUMBER = "5511999999999";
  resetRateLimits();
});

const adForm = (over: Record<string, string> = {}, withImage = true) => {
  const f = new FormData();
  const fields: Record<string, string> = { action: "create", campaignName: "Camp", advertiser: "Empresa", position: "topo", startsAt: "2026-10-01T00:00", endsAt: "2026-10-31T00:00", targetUrl: "https://empresa.com.br", altText: "Banner", ...over };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  if (withImage) f.set("desktopImage", new File([makePng(970, 90) as BlobPart], "b.png", { type: "image/png" }));
  return f;
};
const req = (path: string, body: BodyInit, headers: Record<string, string> = {}) =>
  new NextRequest(`https://${HOST}${path}`, { method: "POST", body, headers: { host: HOST, origin: `https://${HOST}`, ...headers } });

test("API de anúncios: anônimo, sessão adulterada ou origem estrangeira => 401, nada é criado", async () => {
  const before = (await getStore()!.listAds()).length;
  assert.equal((await adsPost(req("/api/admin/ads", adForm()))).status, 401);
  assert.equal((await adsPost(req("/api/admin/ads", adForm(), { cookie: `${SESSION_COOKIE}=${token()}x` }))).status, 401);
  assert.equal((await adsPost(req("/api/admin/ads", adForm(), { cookie: `${SESSION_COOKIE}=${token()}`, origin: "https://evil.com" }))).status, 401);
  assert.equal((await adsPost(req("/api/admin/ads", (() => { const f = new FormData(); f.set("action", "status"); f.set("id", "x"); f.set("status", "ativo"); return f; })()))).status, 401);
  assert.equal((await getStore()!.listAds()).length, before);
});

test("API de anúncios: admin autenticado cadastra (pausado), ativa e edita", async () => {
  const cookie = { cookie: `${SESSION_COOKIE}=${token()}` };
  const r = await adsPost(req("/api/admin/ads", adForm(), cookie));
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(body.ok, true);
  assert.equal(body.ad.status, "pausado");
  assert.ok(body.ad.desktopImageUrl.startsWith("data:image/png"));

  const sf = new FormData(); sf.set("action", "status"); sf.set("id", body.ad.id); sf.set("status", "ativo");
  assert.equal((await adsPost(req("/api/admin/ads", sf, cookie))).status, 200);
  assert.equal((await getStore()!.getAd(body.ad.id))?.status, "ativo");

  const uf = adForm({ action: "update", id: body.ad.id, campaignName: "Renomeada" }, false);
  const u = await adsPost(req("/api/admin/ads", uf, cookie));
  assert.equal(u.status, 200);
  assert.equal((await u.json()).ad.campaignName, "Renomeada");
});

test("API de anúncios: cadastro pode publicar de imediato; mover, intervalo e exclusão exigem admin e funcionam", async () => {
  const cookie = { cookie: `${SESSION_COOKIE}=${token()}` };
  const mk = async (name: string, extra: Record<string, string> = {}) => (await (await adsPost(req("/api/admin/ads", adForm({ campaignName: name, ...extra }), cookie))).json()).ad;
  const a = await mk("Primeiro", { status: "ativo" });
  const b = await mk("Segundo");
  assert.equal(a.status, "ativo");
  assert.equal(b.status, "pausado");
  const f = (fields: Record<string, string>) => { const x = new FormData(); for (const [k, v] of Object.entries(fields)) x.set(k, v); return x; };

  // anônimo não consegue nenhuma das ações
  const anonymousAttempts: Record<string, string>[] = [{ action: "move", id: b.id, direction: "up" }, { action: "rotation", position: "topo", seconds: "10" }, { action: "delete", id: b.id }];
  for (const fields of anonymousAttempts) {
    assert.equal((await adsPost(req("/api/admin/ads", f(fields)))).status, 401, fields.action);
  }
  assert.ok(await getStore()!.getAd(b.id));

  // mover
  const up = await adsPost(req("/api/admin/ads", f({ action: "move", id: b.id, direction: "up" }), cookie));
  assert.deepEqual(await up.json(), { ok: true, changed: true });
  assert.equal((await adsPost(req("/api/admin/ads", f({ action: "move", id: b.id, direction: "sideways" }), cookie))).status, 400);

  // intervalo: persiste, valida limites
  assert.equal((await adsPost(req("/api/admin/ads", f({ action: "rotation", position: "topo", seconds: "12" }), cookie))).status, 200);
  assert.equal((await getStore()!.getSlotSettings()).topo.rotationSeconds, 12);
  for (const seconds of ["1", "999", "abc", ""]) {
    const r = await adsPost(req("/api/admin/ads", f({ action: "rotation", position: "topo", seconds }), cookie));
    assert.equal(r.status, 422, seconds);
  }
  assert.equal((await adsPost(req("/api/admin/ads", f({ action: "rotation", position: "popup", seconds: "10" }), cookie))).status, 400);
  assert.equal((await getStore()!.getSlotSettings()).topo.rotationSeconds, 12);

  // exclusão: some do banco e do storage; id inválido e inexistente
  const del = await adsPost(req("/api/admin/ads", f({ action: "delete", id: b.id }), cookie));
  assert.equal(del.status, 200);
  assert.equal(await getStore()!.getAd(b.id), null);
  assert.ok(await getStore()!.getAd(a.id)); // o outro permanece
  assert.equal((await adsPost(req("/api/admin/ads", f({ action: "delete", id: b.id }), cookie))).status, 404);
  assert.equal((await adsPost(req("/api/admin/ads", f({ action: "delete", id: "../../x" }), cookie))).status, 400);
});

test("API de anúncios: banner com variação de tamanho que preserva a proporção é aceito; proporção errada recebe mensagem específica", async () => {
  const cookie = { cookie: `${SESSION_COOKIE}=${token()}` };
  const withImage = (w: number, h: number) => { const f = adForm({}, false); f.set("desktopImage", new File([makePng(w, h) as BlobPart], "b.png", { type: "image/png" })); return f; };
  assert.equal((await adsPost(req("/api/admin/ads", withImage(1940, 180), cookie))).status, 200);
  const r = await adsPost(req("/api/admin/ads", withImage(970, 250), cookie));
  assert.equal(r.status, 422);
  const body = await r.json();
  assert.match(body.errors.desktopImage, /Proporção incorreta/);
  assert.match(body.errors.desktopImage, /970×90/);
});

test("API de anúncios: validações devolvem 422 com mensagens por campo; sem banner => erro", async () => {
  const cookie = { cookie: `${SESSION_COOKIE}=${token()}` };
  const bad = await adsPost(req("/api/admin/ads", adForm({ targetUrl: "javascript:alert(1)", position: "popup" }), cookie));
  assert.equal(bad.status, 422);
  const b = await bad.json();
  assert.ok(b.errors.targetUrl && b.errors.position);
  const noImg = await adsPost(req("/api/admin/ads", adForm({}, false), cookie));
  assert.equal(noImg.status, 422);
  assert.ok((await noImg.json()).errors.desktopImage);
  const id = new FormData(); id.set("action", "status"); id.set("id", "../../x"); id.set("status", "ativo");
  assert.equal((await adsPost(req("/api/admin/ads", id, cookie))).status, 400);
});

test("API de anúncios: sem painel configurado nenhuma sessão vale", async () => {
  delete env.ADMIN_PASSWORD_HASH;
  assert.equal((await adsPost(req("/api/admin/ads", adForm(), { cookie: `${SESSION_COOKIE}=${token()}` }))).status, 401);
});

test("login: senha errada redireciona sem cookie; correta define cookie HttpOnly + SameSite=Strict (+Secure em produção)", async () => {
  const f = (pw: string) => { const x = new FormData(); x.set("password", pw); return x; };
  const wrong = await loginPost(req("/api/admin/login", f("errada")));
  assert.equal(wrong.status, 303);
  assert.ok(!wrong.headers.get("set-cookie"));
  const ok = await loginPost(req("/api/admin/login", f("senha-bem-forte-123")));
  const c = ok.headers.get("set-cookie") ?? "";
  assert.match(c, /HttpOnly/i); assert.match(c, /SameSite=strict/i); assert.doesNotMatch(c, /Secure/i);
  env.NODE_ENV = "production";
  const prod = await loginPost(req("/api/admin/login", f("senha-bem-forte-123")));
  assert.match(prod.headers.get("set-cookie") ?? "", /Secure/i);
  assert.equal((await loginPost(req("/api/admin/login", f("senha-bem-forte-123"), { origin: "https://evil.com" }))).status, 403);
});

test("login/logout: o redirecionamento usa Location RELATIVO, mesmo que req.url mostre outro host (acesso por IP em next dev, proxies)", async () => {
  const IP = "192.168.100.18:3000";
  // Simula o Next vendo "localhost" em req.url enquanto o navegador usou o IP da rede (Host/Origin).
  const viaIp = (path: string, body: BodyInit) => new NextRequest(`http://localhost:3000${path}`, { method: "POST", body, headers: { host: IP, origin: `http://${IP}` } });
  const f = (pw: string) => { const x = new FormData(); x.set("password", pw); return x; };
  const wrong = await loginPost(viaIp("/api/admin/login", f("errada")));
  assert.equal(wrong.status, 303);
  assert.equal(wrong.headers.get("location"), "/admin?msg=login_invalido");
  const ok = await loginPost(viaIp("/api/admin/login", f("senha-bem-forte-123")));
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.get("location"), "/admin");
  assert.ok((ok.headers.get("set-cookie") ?? "").includes(SESSION_COOKIE));
  const out = await logoutPost(viaIp("/api/admin/logout", new FormData()));
  assert.equal(out.headers.get("location"), "/admin");
  for (const r of [wrong, ok, out]) assert.doesNotMatch(r.headers.get("location") ?? "", /^https?:|localhost/);
});

test("seeOther: só aceita caminhos relativos do próprio site (sem open redirect)", () => {
  assert.equal(seeOther("/admin").headers.get("location"), "/admin");
  assert.equal(seeOther("/admin?msg=x").status, 303);
  for (const bad of ["//evil.com", "https://evil.com", "evil.com", "/\\evil.com", "/a\r\nSet-Cookie: x=1", ""]) assert.throws(() => seeOther(bad), bad);
});

test("login: limita tentativas (rate limit)", async () => {
  const f = () => { const x = new FormData(); x.set("password", "errada"); return x; };
  const hdr = { "x-forwarded-for": "9.9.9.9" };
  for (let i = 0; i < 5; i++) await loginPost(req("/api/admin/login", f(), hdr));
  const r = await loginPost(req("/api/admin/login", f(), hdr));
  assert.match(r.headers.get("location") ?? "", /msg=limite/);
});

const leadBody = { company: "Empresa X", contact: "Maria Souza", email: "maria@empresa.com.br", interest: "Banner principal (topo)", message: "Quero anunciar no portal." };
const leadReq = (b: unknown, headers: Record<string, string> = {}) => req("/api/lead", JSON.stringify(b), { "content-type": "application/json", ...headers });

test("lead: valida no servidor, grava e devolve link wa.me; não afirma que foi enviado", async () => {
  const r = await leadPost(leadReq(leadBody));
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.saved, true);
  assert.ok(b.whatsappUrl.startsWith("https://wa.me/5511999999999?text="));
  assert.ok(decodeURIComponent(b.whatsappUrl).includes("Empresa: Empresa X"));
  assert.ok((await getStore()!.listLeads()).some((l) => l.email === "maria@empresa.com.br"));
});

test("lead: sem número configurado não inventa link; inválido => 422; origem errada => 403; honeypot não grava", async () => {
  delete env.WHATSAPP_NUMBER;
  const noNum = await (await leadPost(leadReq(leadBody, { "x-forwarded-for": "1.1.1.1" }))).json();
  assert.equal(noNum.whatsappUrl, null);
  env.WHATSAPP_NUMBER = "5511999999999";
  assert.equal((await leadPost(leadReq({ ...leadBody, email: "x" }, { "x-forwarded-for": "2.2.2.2" }))).status, 422);
  assert.equal((await leadPost(leadReq(leadBody, { origin: "https://evil.com" }))).status, 403);
  const n = (await getStore()!.listLeads()).length;
  const spam = await (await leadPost(leadReq({ ...leadBody, website: "http://spam" }, { "x-forwarded-for": "3.3.3.3" }))).json();
  assert.equal(spam.whatsappUrl, null);
  assert.equal((await getStore()!.listLeads()).length, n);
});

test("lead: rate limit e payload grande", async () => {
  const h = { "x-forwarded-for": "4.4.4.4" };
  for (let i = 0; i < 3; i++) await leadPost(leadReq(leadBody, h));
  assert.equal((await leadPost(leadReq(leadBody, h))).status, 429);
  assert.equal((await leadPost(leadReq({ ...leadBody, message: "x".repeat(7000) }, { "x-forwarded-for": "5.5.5.5" }))).status, 413);
});

test("lead: em produção sem Supabase e sem WhatsApp => 503 (nunca memória)", async () => {
  env.NODE_ENV = "production"; delete env.WHATSAPP_NUMBER;
  (globalThis as { __apuraiStore?: unknown }).__apuraiStore = undefined;
  assert.equal(getStore(), null);
  assert.equal((await leadPost(leadReq(leadBody, { "x-forwarded-for": "6.6.6.6" }))).status, 503);
  env.NODE_ENV = "test";
  (globalThis as { __apuraiStore?: unknown }).__apuraiStore = undefined;
});
