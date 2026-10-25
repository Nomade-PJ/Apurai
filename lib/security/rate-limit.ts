/**
 * Rate limit simples em memória (janela fixa). LIMITAÇÃO: em ambiente serverless cada instância
 * tem seu próprio contador, então é proteção de melhor esforço — não é barreira absoluta.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 5000) for (const [k, v] of buckets) if (now >= v.resetAt) buckets.delete(k);
    return true;
  }
  b.count += 1;
  return b.count <= limit;
}

export function resetRateLimits(): void {
  buckets.clear();
}

export function clientKey(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  return (xff ? xff.split(",")[0].trim() : headers.get("x-real-ip")) || "unknown";
}
