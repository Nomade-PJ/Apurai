"use client";
import Link from "next/link";
import { useState } from "react";

type Errors = Record<string, string>;
type Phase = { kind: "idle" } | { kind: "sending" } | { kind: "fail"; message: string } | { kind: "done"; saved: boolean; whatsappUrl: string | null };

const inputCls = "field";

export function LeadForm({ interests }: { interests: string[] }) {
  const [errors, setErrors] = useState<Errors>({});
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(["company", "contact", "email", "interest", "message", "website"].map((k) => [k, String(fd.get(k) ?? "")]));
    setPhase({ kind: "sending" });
    setErrors({});
    try {
      const res = await fetch("/api/lead", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        const whatsappUrl: string | null = typeof body.whatsappUrl === "string" ? body.whatsappUrl : null;
        setPhase({ kind: "done", saved: Boolean(body.saved), whatsappUrl });
        // Abre o WhatsApp com a mensagem preenchida; o envio só ocorre quando a pessoa confirmar lá.
        if (whatsappUrl) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (res.status === 422 && body.errors) setErrors(body.errors);
      setPhase({ kind: "fail", message: body.message ?? "Não foi possível processar o formulário." });
    } catch {
      setPhase({ kind: "fail", message: "Falha de conexão. Tente novamente." });
    }
  }

  if (phase.kind === "done") {
    return (
      <div role="status" className="alert alert-ok space-y-3 p-4 text-slate-100">
        {phase.whatsappUrl ? (
          <>
            <p className="font-medium">Falta um passo: confirme o envio no WhatsApp.</p>
            <p className="text-sm text-slate-300">
              Tentamos abrir o WhatsApp com a mensagem pronta (se não abriu, use o botão abaixo). <strong>A mensagem ainda não foi enviada</strong>: toque em “Enviar” dentro do WhatsApp.
            </p>
            <a href={phase.whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">Abrir WhatsApp</a>
          </>
        ) : (
          <p>
            Recebemos seus dados e entraremos em contato pelo e-mail informado. (O atendimento por WhatsApp ainda não está disponível neste momento.)
          </p>
        )}
      </div>
    );
  }

  const err = (id: string) => errors[id] && <p id={`${id}-erro`} className="mt-1 text-sm text-red-300">{errors[id]}</p>;
  const a11y = (id: string) => ({ "aria-invalid": Boolean(errors[id]), "aria-describedby": errors[id] ? `${id}-erro` : undefined });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <label htmlFor="company" className="block text-sm font-medium">Empresa</label>
        <input id="company" name="company" required maxLength={120} autoComplete="organization" className={inputCls} {...a11y("company")} />
        {err("company")}
      </div>
      <div>
        <label htmlFor="contact" className="block text-sm font-medium">Nome completo</label>
        <input id="contact" name="contact" required maxLength={120} autoComplete="name" className={inputCls} {...a11y("contact")} />
        {err("contact")}
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium">E-mail</label>
        <input id="email" name="email" type="email" required maxLength={254} autoComplete="email" className={inputCls} {...a11y("email")} />
        {err("email")}
      </div>
      <div>
        <label htmlFor="interest" className="block text-sm font-medium">Tipo de anúncio de interesse</label>
        <select id="interest" name="interest" required defaultValue="" className={inputCls} {...a11y("interest")}>
          <option value="" disabled>Selecione…</option>
          {interests.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        {err("interest")}
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium">Mensagem</label>
        <textarea id="message" name="message" required rows={5} maxLength={1000} className={inputCls} {...a11y("message")} />
        {err("message")}
      </div>
      {/* Honeypot anti-spam: invisível para pessoas */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>Não preencha este campo<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      <p role="note" className="alert alert-warn">
        <strong>Não aceitamos propaganda eleitoral.</strong> Anúncios de candidatos, partidos, coligações ou campanhas, ou que peçam voto, não são vendidos aqui (Lei nº 9.504/1997, art. 57-C).
        Todo anúncio é analisado antes de ir ao ar. Veja a <Link href="/termos#anuncios" className="underline">Política de anúncios</Link>.
      </p>
      <p className="text-xs text-slate-400">
        Usamos estes dados somente para responder ao seu interesse em anunciar, com acesso restrito, e os guardamos por até 12 meses após o último contato. Ao enviar, abriremos o WhatsApp com a mensagem pronta — o envio só acontece quando você confirmar lá.
        Veja a <Link href="/privacidade" className="underline">Política de privacidade</Link>.
      </p>
      {phase.kind === "fail" && <p role="alert" className="alert alert-error">{phase.message}</p>}
      <button type="submit" disabled={phase.kind === "sending"} className="btn btn-primary px-5 py-2.5">
        {phase.kind === "sending" ? "Enviando…" : "Continuar no WhatsApp"}
      </button>
    </form>
  );
}
