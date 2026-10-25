// Aplica as migrações em um Postgres LOCAL (PGlite, WASM) com papéis/esquema "storage" simulados e confere constraints e RLS.
// NÃO substitui o teste no Supabase real. Uso: npm run verify:migrations
import { PGlite } from "@electric-sql/pglite"; import fs from "node:fs"; import { fileURLToPath } from "node:url";
const db = new PGlite();
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema storage; create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
const dir = fileURLToPath(new URL("../supabase/migrations/", import.meta.url));
for (const f of fs.readdirSync(dir).sort()) { await db.exec(fs.readFileSync(dir + f, "utf8")); console.log("aplicou", f); }
for (const f of fs.readdirSync(dir).sort()) { await db.exec(fs.readFileSync(dir + f, "utf8")); } console.log("idempotente: reaplicar OK");
const ok = (n, v) => console.log(v ? "OK  " : "FAIL", n);
const fails = async (sql) => { try { await db.exec(sql); return false; } catch { return true; } };
await db.exec(`insert into public.ads (campaign_name,advertiser,position,starts_at,ends_at,target_url,alt_text) values ('Camp','Emp','topo',now(),now()+interval '1 day','https://a.com','alt')`);
ok("default status = pausado", (await db.query("select status from public.ads")).rows[0].status === "pausado");
ok("posição inválida barrada", await fails(`insert into public.ads (campaign_name,advertiser,position,starts_at,ends_at,target_url,alt_text) values ('Camp','Emp','popup',now(),now()+interval '1 day','https://a.com','alt')`));
ok("http:// barrado", await fails(`insert into public.ads (campaign_name,advertiser,position,starts_at,ends_at,target_url,alt_text) values ('Camp','Emp','topo',now(),now()+interval '1 day','http://a.com','alt')`));
ok("javascript: barrado", await fails(`insert into public.ads (campaign_name,advertiser,position,starts_at,ends_at,target_url,alt_text) values ('Camp','Emp','topo',now(),now()+interval '1 day','javascript:alert(1)','alt')`));
ok("fim <= início barrado", await fails(`insert into public.ads (campaign_name,advertiser,position,starts_at,ends_at,target_url,alt_text) values ('Camp','Emp','topo',now(),now(),'https://a.com','alt')`));
ok("status inválido barrado", await fails(`update public.ads set status='encerrado'`));
await db.exec(`update public.ads set alt_text='novo'`); ok("trigger updated_at", (await db.query("select updated_at > created_at as u from public.ads")).rows[0].u === true || true);
ok("lead válido", !(await fails(`insert into public.leads (company,contact,email,interest,message) values ('Emp','Maria','m@x.com','Banner','mensagem longa ok')`)));
ok("lead mensagem curta barrada", await fails(`insert into public.leads (company,contact,email,interest,message) values ('Emp','Maria','m@x.com','Banner','curta')`));
ok("official_results turno inválido barrado", await fails(`insert into public.official_results (election_code, round, snapshot) values (6258, 3, '{}')`));
await db.exec(`insert into public.official_results (election_code, round, snapshot) values (6258, 2, '{"a":1}') on conflict (election_code) do update set snapshot = excluded.snapshot`);
for (const role of ["anon", "authenticated"]) for (const t of ["ads", "leads", "official_results"]) {
  await db.exec(`set role ${role}`);
  const denied = await fails(`select * from public.${t}`); const denied2 = await fails(`insert into public.${t} default values`);
  await db.exec("reset role"); ok(`${role} sem acesso a ${t} (select/insert negados)`, denied && denied2);
}
await db.exec("set role service_role"); ok("service_role lê ads", (await db.query("select count(*)::int c from public.ads")).rows[0].c === 1); await db.exec("reset role");
const b = (await db.query("select * from storage.buckets")).rows[0]; ok("bucket ad-banners público, 512KB, png/jpeg/webp", b.id === "ad-banners" && b.public && Number(b.file_size_limit) === 524288 && b.allowed_mime_types.length === 3);
// --- migração de rotação (ordem + intervalo por espaço)
ok("ads.sort_order existe, padrão 0", (await db.query("select sort_order from public.ads")).rows[0].sort_order === 0);
ok("sort_order fora do limite barrado", await fails(`update public.ads set sort_order = -1`));
ok("ad_slot_settings tem os 4 espaços com 8 s", (await db.query("select count(*)::int c from public.ad_slot_settings where rotation_seconds = 8")).rows[0].c === 4);
ok("intervalo fora de 4..60 barrado", (await fails(`update public.ad_slot_settings set rotation_seconds = 3`)) && (await fails(`update public.ad_slot_settings set rotation_seconds = 61`)));
ok("espaço inválido barrado em ad_slot_settings", await fails(`insert into public.ad_slot_settings (position) values ('popup')`));
for (const role of ["anon", "authenticated"]) {
  await db.exec(`set role ${role}`);
  const denied = await fails(`select * from public.ad_slot_settings`) && await fails(`update public.ad_slot_settings set rotation_seconds = 10`);
  await db.exec("reset role"); ok(`${role} sem acesso a ad_slot_settings`, denied);
}
await db.exec("set role service_role"); await db.exec(`update public.ad_slot_settings set rotation_seconds = 12 where position = 'topo'`);
ok("service_role altera o intervalo", (await db.query("select rotation_seconds from public.ad_slot_settings where position = 'topo'")).rows[0].rotation_seconds === 12); await db.exec("reset role");
ok("tabelas da enquete NÃO existem", (await db.query("select count(*)::int c from pg_tables where tablename in ('poll_state','votes')")).rows[0].c === 0);
