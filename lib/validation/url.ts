/** Aceita apenas https, sem credenciais embutidas e sem hosts locais/IP privados óbvios. */
export function validateHttpsUrl(
  input: unknown,
  maxLen = 2000,
  opts: { allowLocalHttp?: boolean } = {},
): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof input !== "string" || input.length === 0 || input.length > maxLen) return { ok: false, error: "URL inválida." };
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return { ok: false, error: "URL inválida." };
  }
  if (u.username || u.password) return { ok: false, error: "A URL não pode conter credenciais." };
  const host = u.hostname.toLowerCase();
  // Somente para testes locais fora de produção (ex.: servidor de amostra em localhost).
  if (opts.allowLocalHttp && (host === "localhost" || host === "127.0.0.1") && (u.protocol === "http:" || u.protocol === "https:")) {
    return { ok: true, url: u.toString() };
  }
  if (u.protocol !== "https:") return { ok: false, error: "A URL deve usar https." };
  if (host === "localhost" || host.endsWith(".local") || /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(":")) {
    return { ok: false, error: "Host não permitido." };
  }
  if (!host.includes(".")) return { ok: false, error: "Host inválido." };
  return { ok: true, url: u.toString() };
}
