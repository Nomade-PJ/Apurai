import type { NextRequest } from "next/server";
import { adminConfigured } from "../env";
import { isSameOrigin } from "./origin";
import { SESSION_COOKIE, verifySessionToken } from "./session";

/** Autorização no servidor. Sem ADMIN_PASSWORD_HASH + SESSION_SECRET (>=32), o painel fica desativado. */
export function hasAdminSession(token: string | undefined): boolean {
  return adminConfigured() && verifySessionToken(token, process.env.SESSION_SECRET ?? "");
}

export function requireAdmin(req: NextRequest, opts: { checkOrigin: boolean }): boolean {
  if (opts.checkOrigin && !isSameOrigin(req.headers)) return false;
  return hasAdminSession(req.cookies.get(SESSION_COOKIE)?.value);
}
