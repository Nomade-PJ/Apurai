import { NextRequest, NextResponse } from "next/server";
import { buildWhatsAppUrl } from "@/lib/config/contact";
import { getStore } from "@/lib/db";
import { isSameOrigin } from "@/lib/security/origin";
import { clientKey, rateLimit } from "@/lib/security/rate-limit";
import { buildLeadMessage, validateLead } from "@/lib/validation/lead";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

/**
 * Valida (no servidor), registra o contato (quando há persistência) e devolve o link do WhatsApp.
 * O envio da mensagem NÃO acontece aqui: a pessoa precisa confirmá-lo no próprio WhatsApp.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) return json({ message: "Origem não permitida." }, 403);
  if (!rateLimit(`lead:${clientKey(req.headers)}`, 3, 10 * 60_000)) return json({ message: "Muitos envios. Tente novamente mais tarde." }, 429);

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > 6000) return json({ message: "Requisição grande demais." }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ message: "Requisição inválida." }, 400);
  }

  const v = validateLead(body);
  if (!v.ok) {
    // Honeypot preenchido: responde como sucesso, sem gravar nada e sem link, para não orientar robôs.
    if (v.errors._spam) return json({ ok: true, saved: false, whatsappUrl: null });
    return json({ message: "Verifique os campos.", errors: v.errors }, 422);
  }

  const whatsappUrl = buildWhatsAppUrl(buildLeadMessage(v.value));

  let saved = false;
  const store = getStore();
  if (store) {
    try {
      await store.addLead(v.value);
      saved = true;
    } catch {
      console.error("[lead] falha ao gravar contato");
    }
  }

  if (!saved && !whatsappUrl) {
    return json({ message: "O formulário está temporariamente indisponível. Tente novamente mais tarde." }, 503);
  }
  return json({ ok: true, saved, whatsappUrl });
}
