import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "apurai_admin";
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createSessionToken(secret: string, nowMs = Date.now(), ttlSeconds = SESSION_TTL_SECONDS): string {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = `${exp}.${randomBytes(12).toString("base64url")}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, nowMs = Date.now()): boolean {
  if (!token || secret.length < 32) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  const a = Buffer.from(sign(payload, secret));
  const b = Buffer.from(parts[2]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(parts[0]);
  return Number.isFinite(exp) && exp * 1000 > nowMs;
}
