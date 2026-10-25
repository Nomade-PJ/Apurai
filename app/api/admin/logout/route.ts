import { NextRequest, NextResponse } from "next/server";
import { isProd } from "@/lib/env";
import { isSameOrigin } from "@/lib/security/origin";
import { seeOther } from "@/lib/security/redirect";
import { SESSION_COOKIE } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) return new NextResponse("Origem não permitida.", { status: 403 });
  const res = seeOther("/admin");
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: isProd(), path: "/", maxAge: 0 });
  return res;
}
