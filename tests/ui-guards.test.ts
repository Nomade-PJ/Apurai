import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guardas de regressão de código-fonte para defeitos que só aparecem no navegador (executar a partir da raiz do projeto).
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("login: o campo de senha NUNCA é `disabled` durante o envio (campo desabilitado é omitido do POST)", () => {
  const t = src("components/admin/LoginForm.tsx");
  assert.doesNotMatch(t, /disabled=\{busy\}[^>]*aria-invalid|id="password"[\s\S]{0,400}disabled=\{busy\}/);
  assert.match(t, /readOnly=\{busy\}/);
  assert.match(t, /method="post"\s+action="\/api\/admin\/login"/);
  assert.match(t, /name="password"/);
  assert.doesNotMatch(t, /localStorage|sessionStorage|document\.cookie/); // senha nunca é guardada no navegador
});

test("rotação: temporizador é limpo, pausa por visibilidade e usa elementos inertes", () => {
  const t = src("components/advertising/AdRotator.tsx");
  assert.match(t, /clearInterval/);
  assert.match(t, /visibilitychange/);
  assert.match(t, /IntersectionObserver/);
  assert.match(t, /inert=\{/);
  assert.match(t, /motion-reduce:transition-none/);
});

test("compartilhar: modal nativo, links externos seguros e URL pública vinda de resolveShareUrl", () => {
  const t = src("components/ui/ShareButton.tsx");
  assert.match(t, /showModal\(\)/);
  assert.match(t, /resolveShareUrl/);
  assert.doesNotMatch(t, /target="_blank"(?![^>]*noopener)/);
  assert.doesNotMatch(t, /localhost/);
});

test("painel: o envio de banner monta o FormData a partir do estado (não depende do input), e valida com a regra compartilhada", () => {
  const t = src("components/admin/AdAdmin.tsx");
  assert.match(t, /precheckBanner/);
  assert.match(t, /fd\.set\("desktopImage", desktop\.file\)/);
  assert.doesNotMatch(t, /dangerouslySetInnerHTML/);
});

test("rotas do admin não montam redirecionamento absoluto a partir de req.url (bloqueado pelo CSP form-action em acesso por IP/proxy)", () => {
  for (const f of ["app/api/admin/login/route.ts", "app/api/admin/logout/route.ts"]) {
    const t = src(f);
    assert.doesNotMatch(t, /NextResponse\.redirect\(/, f);
    assert.doesNotMatch(t, /new URL\([^)]*req\.url/, f);
    assert.match(t, /seeOther\(/, f);
  }
});

test("login: o formulário nunca fica preso em 'Entrando…' (rede de segurança por tempo)", () => {
  const t = src("components/admin/LoginForm.tsx");
  assert.match(t, /setTimeout\(/);
  assert.match(t, /clearTimeout/);
});
