/** Leitura central de variáveis de ambiente (somente servidor, exceto onde indicado). */
export const isProd = () => process.env.NODE_ENV === "production";

export const adminConfigured = () =>
  Boolean(process.env.ADMIN_PASSWORD_HASH) && (process.env.SESSION_SECRET ?? "").length >= 32;

/**
 * URL pública do site, sem barra final. Ordem: NEXT_PUBLIC_SITE_URL → domínio de produção da Vercel →
 * localhost (apenas fora de produção). Em produção sem nenhuma das duas, retorna null (nunca inventa host).
 */
export function siteUrl(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return isProd() ? null : "http://localhost:3000";
}

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

/** Credenciais do Supabase. A chave de serviço nunca pode ir para o navegador (sem prefixo NEXT_PUBLIC_). */
export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && !isProd())) return null;
  } catch {
    return null;
  }
  return { url: url.replace(/\/+$/, ""), serviceKey };
}

/** Armazenamento em memória: somente desenvolvimento/testes, nunca em produção. */
export const memoryStoreAllowed = () => !isProd() && process.env.ALLOW_MEMORY_STORE !== "false";
