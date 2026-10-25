// Verificações HTTP contra um servidor em execução: BASE_URL=http://localhost:3000 node scripts/smoke.mjs
const base = process.env.BASE_URL ?? "http://localhost:3000";
let failed = 0;
const check = (name, ok, extra = "") => { console.log(`${ok ? "OK  " : "FAIL"} ${name}${extra ? " — " + extra : ""}`); if (!ok) failed++; };
const get = (p, init) => fetch(base + p, { redirect: "manual", ...init });

const home = await (await get("/")).text();
check("home responde 200", home.length > 1000);
const waiting = home.includes("Aguardando o início da apuração oficial");
const errored = home.includes("Não foi possível consultar a fonte oficial agora");
check("painel em estado honesto (aguardando OU erro de fonte, sem números)", waiting || errored || process.env.EXPECT_DATA === "1", waiting ? "aguardando" : errored ? "erro de fonte (sem acesso ao TSE)" : "");
check("home não contém enquete/votação comunitária", !/enquete|votar|vote/i.test(home));
const panel = home.split('id="apuracao"')[1]?.split("</section>")[0] ?? "";
if (process.env.EXPECT_DATA !== "1") check("painel sem percentuais nem votos quando não há dados", !/\d+,\d{2}%/.test(panel) && !/ votos/.test(panel));
check("sem espaço publicitário quando não há anúncio", !/Publicidade|Anuncie aqui|aria-label="Publicidade"/.test(home.replace(/<nav[\s\S]*?<\/nav>/g, "").replace(/<footer[\s\S]*?<\/footer>/g, "")));
for (const p of ["/api/poll", "/api/vote", "/enquete", "/api/admin/poll", "/api/admin/export"]) check(`${p} => 404`, (await get(p)).status === 404);
for (const p of ["/", "/transparencia", "/anuncie", "/privacidade", "/termos", "/admin", "/robots.txt", "/sitemap.xml", "/opengraph-image"]) check(`${p} => 200`, (await get(p)).status === 200);
const links = [...home.matchAll(/href="(\/[^"#]*)/g)].map((m) => m[1]).filter((h) => !h.startsWith("/_next"));
for (const l of new Set(links)) check(`link interno ${l}`, (await get(l)).status === 200);
check("POST anônimo em /api/admin/ads => 401", (await get("/api/admin/ads", { method: "POST", headers: { origin: base }, body: new FormData() })).status === 401);
check("GET /api/admin/ads => 405", (await get("/api/admin/ads")).status === 405);
const h = (await get("/")).headers;
check("cabeçalhos de segurança", h.get("content-security-policy")?.includes("frame-ancestors 'none'") && h.get("x-content-type-options") === "nosniff");
check("og:title e og:image presentes", /property="og:title"/.test(home) && /property="og:image"/.test(home), (home.match(/property="og:image" content="([^"]+)"/) ?? [])[1]);
check("twitter:image presente", /name="twitter:image"/.test(home));
process.exit(failed ? 1 : 0);
