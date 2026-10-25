import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guardas de conteúdo: impedem que avisos legais importantes sejam removidos sem querer (executar na raiz do projeto).
const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("termos: política de anúncios proíbe propaganda eleitoral e cita o art. 57-C", () => {
  const t = src("app/termos/page.tsx");
  assert.match(t, /id="anuncios"/);
  assert.match(t, /Não aceitamos/);
  assert.match(t, /candidatos, partidos, federações, coligações/);
  assert.match(t, /peça voto/);
  assert.match(t, /9\.504\/1997 \(art\. 57-C\)/);
  assert.match(t, /não é propaganda eleitoral/);
});

test("formulário Anuncie, página Anuncie e transparência apontam para a política de anúncios", () => {
  for (const f of ["app/anuncie/LeadForm.tsx", "app/anuncie/page.tsx", "app/transparencia/page.tsx"]) {
    assert.match(src(f), /\/termos#anuncios/, f);
  }
  assert.match(src("app/anuncie/LeadForm.tsx"), /Não aceitamos propaganda eleitoral/);
  assert.match(src("components/admin/AdAdmin.tsx"), /não é propaganda eleitoral/);
});

test("privacidade: controlador, base legal, transferência internacional, retenção, direitos e ANPD", () => {
  const t = src("app/privacidade/page.tsx");
  assert.match(t, /NEXT_PUBLIC_OPERATOR_NAME/);
  assert.match(t, /art\. 7º, V/);
  assert.match(t, /exterior \(Estados Unidos\)/);
  assert.match(t, /12 meses/);
  assert.match(t, /art\. 18/);
  assert.match(t, /ANPD/);
});

test("a retenção prometida (12 meses) é a mesma no formulário e na documentação operacional", () => {
  assert.match(src("app/anuncie/LeadForm.tsx"), /12 meses/);
  assert.match(src("docs/SUPABASE_SETUP.md"), /interval '12 months'/);
});

test("páginas legais não prometem coisas que o site não faz (sem analytics, sem venda de dados)", () => {
  const t = src("app/privacidade/page.tsx");
  assert.match(t, /não os vendemos/);
  assert.doesNotMatch(t, /Google Analytics|Meta Pixel|Hotjar/i);
});
