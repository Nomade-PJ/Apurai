import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AdAdmin, type AdRow } from "@/components/admin/AdAdmin";
import { LoginForm } from "@/components/admin/LoginForm";
import { defaultSlotSettings } from "@/lib/ads/rotation";
import { isAdEligible } from "@/lib/ads/schedule";
import { getStore } from "@/lib/db";
import { toAdView } from "@/lib/db/store";
import { getOfficialStateServer } from "@/lib/election-data/server";
import { adminConfigured } from "@/lib/env";
import { whatsappNumber } from "@/lib/config/contact";
import { hasAdminSession } from "@/lib/security/admin-guard";
import { SESSION_COOKIE } from "@/lib/security/session";

export const metadata: Metadata = { title: "Administração", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  login_invalido: "Senha incorreta.",
  limite: "Muitas tentativas. Aguarde alguns minutos.",
};

const STATUS_TEXT: Record<string, string> = {
  ok: "oficial, atualizado",
  stale: "último resultado validado (atrasado)",
  waiting: "aguardando início da apuração",
  error: "erro temporário na consulta",
  not_configured: "fonte mal configurada",
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const sp = await searchParams;
  const msg = sp.msg && MESSAGES[sp.msg] ? MESSAGES[sp.msg] : null;

  // Sem autenticação configurada o painel permanece desativado (nunca aberto).
  if (!adminConfigured()) {
    return (
      <div className="max-w-xl space-y-2">
        <h1 className="text-2xl font-bold">Painel desativado</h1>
        <p className="text-slate-300">Configure <code>ADMIN_PASSWORD_HASH</code> e <code>SESSION_SECRET</code> (mínimo de 32 caracteres) no servidor para habilitar. Veja o README.</p>
      </div>
    );
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!hasAdminSession(token)) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="card w-full max-w-sm space-y-5 p-6 sm:p-8">
          <div className="space-y-1 text-center">
            <span aria-hidden className="mx-auto mb-3 block h-8 w-8 rounded bg-signal" />
            <h1 className="text-xl font-bold">Administração</h1>
            <p className="text-sm text-slate-300">Digite a senha para continuar.</p>
          </div>
          <LoginForm error={msg} />
        </div>
      </div>
    );
  }

  const store = getStore();
  const now = new Date();
  const [official, ads, leads, slots] = await Promise.all([
    getOfficialStateServer(),
    store ? store.listAds().catch(() => null) : null,
    store ? store.listLeads().catch(() => null) : null,
    store ? store.getSlotSettings() : defaultSlotSettings(),
  ]);
  const rows: AdRow[] = store && ads ? ads.map((a) => { const v = toAdView(a, store.storage); return { ...v, live: isAdEligible(v, now) }; }) : [];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Administração</h1>
        <form method="post" action="/api/admin/logout"><button className="btn">Sair</button></form>
      </div>

      {!store && <p role="alert" className="alert alert-warn">Supabase não configurado: anúncios, contatos e cache de resultados estão desativados.</p>}
      {store?.kind === "memory" && <p role="alert" className="alert alert-warn">Armazenamento EM MEMÓRIA (somente desenvolvimento): os dados somem ao reiniciar.</p>}
      {!whatsappNumber() && <p role="alert" className="alert alert-warn">WHATSAPP_NUMBER não configurado: o formulário “Anuncie” não consegue abrir o WhatsApp.</p>}

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Fonte oficial</h2>
        <p>Estado: <strong>{STATUS_TEXT[official.status] ?? official.status}</strong>{official.fetchedAt ? ` — última atualização válida ${new Date(official.fetchedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}</p>
        {official.message && <p className="text-sm text-slate-300">{official.message}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Anúncios</h2>
        <p className="text-xs text-slate-400">Métricas de impressões e cliques ainda não são coletadas (não inventamos números). Espaços sem anúncio elegível ficam totalmente ocultos no site.</p>
        {store && ads === null ? <p role="alert" className="text-red-300">Não foi possível carregar os anúncios.</p> : <AdAdmin ads={rows} settings={slots} canWrite={Boolean(store)} />}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-semibold">Contatos comerciais{leads ? ` (${leads.length})` : ""}</h2>
        <ul className="space-y-2 text-sm">
          {(leads ?? []).map((l) => (
            <li key={l.id} className="rounded border border-navy-600 bg-navy-800 p-3">
              <strong>{l.company}</strong> — {l.contact} — {l.email} — <em>{l.interest}</em>
              <p className="mt-1 whitespace-pre-wrap text-slate-300">{l.message}</p>
            </li>
          ))}
          {leads && leads.length === 0 && <li className="text-slate-300">Nenhum contato recebido.</li>}
        </ul>
      </section>
    </div>
  );
}
