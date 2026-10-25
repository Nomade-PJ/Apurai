import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, isProd } from "@/lib/env";
import { isSameOrigin } from "@/lib/security/origin";
import { verifyPassword } from "@/lib/security/password";
import { seeOther } from "@/lib/security/redirect";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/security/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Redirecionamento relativo (ver lib/security/redirect.ts): não depende do host visto pelo servidor. */
const back = (msg: string) => seeOther(`/admin?msg=${msg}`);

export async function POST(req: NextRequest) {
  if (!adminConfigured()) return new NextResponse("Painel desativado.", { status: 404 });
  if (!isSameOrigin(req.headers)) return new NextResponse("Origem não permitida.", { status: 403 });
  if (!rateLimit(`login:${clientKey(req.headers)}`, 5, 10 * 60_000)) return back("limite");

  const form = await req.formData().catch(() => null);
  const password = form?.get("password");
  if (typeof password !== "string" || password.length > 200) return back("login_invalido");

  if (!verifyPassword(password, process.env.ADMIN_PASSWORD_HASH ?? "")) return back("login_invalido");

  const res = seeOther("/admin");
  res.cookies.set(SESSION_COOKIE, createSessionToken(process.env.SESSION_SECRET ?? ""), {
    httpOnly: true, sameSite: "strict", secure: isProd(), path: "/", maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
