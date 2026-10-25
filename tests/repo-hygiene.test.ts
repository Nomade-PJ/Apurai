import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(n)) continue;
    const p = join(dir, n);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}
const files = walk(root);
const src = files.filter((f) => /\.(ts|tsx|mjs|json|css|sql|example)$/.test(f) && !f.includes("package-lock") && !f.includes("/tests/"));
const read = (f: string) => readFileSync(f, "utf8");

test("enquete removida: sem rotas, componentes, serviços, tabelas ou menu", () => {
  for (const p of ["app/api/poll", "app/api/vote", "app/api/admin/poll", "app/api/admin/export", "components/community-poll", "lib/poll", "app/enquete"]) {
    assert.equal(existsSync(join(root, p)), false, p);
  }
  const bad = /enquete|community-?poll|poll_state|\/api\/vote|\/api\/poll|POLL_HASH_SECRET|apurai_voted/i;
  for (const f of src) {
    if (f.endsWith("README.md") || f.includes("/scripts/")) continue;
    assert.doesNotMatch(f.endsWith(".sql") ? read(f).replace(/--.*$/gm, "") : read(f), bad, f);
  }
});

test("Neon removido: sem dependência, import, variável ou menção operacional", () => {
  const pkg = read(join(root, "package.json"));
  assert.doesNotMatch(pkg, /neon/i);
  assert.doesNotMatch(read(join(root, "package-lock.json")), /@neondatabase/);
  for (const f of src) assert.doesNotMatch(read(f), /neon/i, f);
});

test("sem dados fictícios de candidatos no código de produção", () => {
  for (const f of src) assert.doesNotMatch(read(f), /Candidato [AB] \(demonstra|DEMO_MODE|MockElectionData|Flávio|\bLula\b/i, f);
});

test("sem segredos: nada de .env real, chaves JWT/postgres ou service role em NEXT_PUBLIC_*", () => {
  assert.equal(files.some((f) => /\.env(\.local|\.production)?$/.test(f)), false);
  for (const f of files.filter((x) => /\.(ts|tsx|mjs|md|json|sql|example)$/.test(x) && !x.includes("package-lock"))) {
    const t = read(f);
    assert.doesNotMatch(t, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, `JWT em ${f}`);
    assert.doesNotMatch(t, /postgres(ql)?:\/\/[^\s:]+:[^\s@]+@/, `string de conexão em ${f}`);
    assert.doesNotMatch(t, /sb_secret_[A-Za-z0-9]/, `chave secreta em ${f}`);
    assert.doesNotMatch(t, /NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET|PASSWORD|KEY)/, `NEXT_PUBLIC_ sensível em ${f}`);
  }
  const gi = read(join(root, ".gitignore"));
  for (const p of [".env", ".env.local", ".env*.local", "node_modules", ".next"]) assert.ok(gi.includes(p), p);
});

test("chave de serviço só é lida em módulo de servidor", () => {
  for (const f of src) {
    if (read(f).includes("process.env.SUPABASE_SERVICE_ROLE_KEY")) assert.ok(/lib\/env\.ts$/.test(f), f);
  }
  for (const f of files.filter((x) => x.endsWith(".tsx"))) {
    const t = read(f);
    if (/^["']use client["']/.test(t)) assert.doesNotMatch(t, /process\.env\.(?!NEXT_PUBLIC_)/, `client lê env privada: ${f}`);
  }
});

test("next.config: devIndicators desativado e CSP presente", () => {
  const c = read(join(root, "next.config.mjs"));
  assert.match(c, /devIndicators:\s*false/);
  assert.match(c, /Content-Security-Policy/);
});

test("migrações: RLS ativo e sem policies públicas; sem tabelas da enquete", () => {
  const dir = join(root, "supabase/migrations");
  const sql = readdirSync(dir).map((n) => read(join(dir, n))).join("\n").replace(/--.*$/gm, "");
  for (const t of ["ads", "leads", "official_results"]) assert.match(sql, new RegExp(`alter table public\\.${t}\\s+enable row level security`, "i"));
  assert.doesNotMatch(sql, /create policy/i);
  assert.doesNotMatch(sql, /poll_state|create table[^;]*votes|drop (table|schema)/i);
});

test("navegação: todos os links internos do menu/rodapé apontam para rotas existentes", () => {
  const nav = [...read(join(root, "components/layout/Header.tsx")).matchAll(/href: "([^"#]+)/g), ...read(join(root, "components/layout/Footer.tsx")).matchAll(/href="([^"#]+)/g)].map((m) => m[1]);
  assert.ok(nav.length >= 6);
  for (const h of nav) {
    const dir = h === "/" ? "app/page.tsx" : `app${h}/page.tsx`;
    assert.ok(existsSync(join(root, dir)), `${h} -> ${dir}`);
  }
});
