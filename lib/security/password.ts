import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const N = 16384;
const KEYLEN = 64;

/**
 * Formato: scrypt.N.salt(b64url).hash(b64url) — sem "$", para não ser "expandido" por dotenv/Next em arquivos .env.
 * (O formato antigo com "$" continua sendo aceito na verificação.) Nunca armazene a senha em texto puro.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N });
  return `scrypt.${N}.${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const sep = stored.includes("$") ? "$" : ".";
  const parts = stored.split(sep);
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  if (!Number.isInteger(n) || n < 1024 || n > 1 << 20) return false;
  try {
    const enc = sep === "$" ? "base64" : "base64url";
    const salt = Buffer.from(parts[2], enc);
    const expected = Buffer.from(parts[3], enc);
    if (expected.length !== KEYLEN) return false;
    const actual = scryptSync(password, salt, KEYLEN, { N: n });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
