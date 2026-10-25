"use client";
import { useEffect, useRef, useState } from "react";
import { resolveShareUrl, shareTargets } from "@/lib/share";

interface Props {
  /** Caminho da página (ex.: "/" ou "/transparencia"). */
  path: string;
  title: string;
  text: string;
  /** NEXT_PUBLIC_SITE_URL / domínio de produção resolvido no servidor (null se desconhecido). */
  configuredBase: string | null;
  /** true em produção: usa a URL configurada; em desenvolvimento usa a origem atual do navegador. */
  preferConfigured: boolean;
}

type Net = { key: "whatsapp" | "facebook" | "x" | "telegram" | "linkedin"; label: string; bg: string; icon: React.ReactNode };

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="currentColor">{children}</svg>
);
const NETWORKS: Net[] = [
  { key: "whatsapp", label: "WhatsApp", bg: "#25D366", icon: svg(<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3zm4.6 12.3c-.2.5-1.2 1-1.7 1-.4.1-1 .1-1.6-.1-2.700-.9-4.500-3.600-4.600-3.800-.1-.1-1.100-1.400-1.100-2.700s.7-1.900.9-2.200c.2-.2.500-.3.700-.3h.5c.2 0 .4 0 .6.500l.800 1.900c.1.200.1.300 0 .500l-.3.400-.3.400c-.1.100-.3.300-.1.600.2.300.800 1.300 1.700 2 1.100 1 2 1.300 2.300 1.400.3.100.4.100.6-.1l.8-1c.2-.3.400-.2.600-.1l1.800.9c.3.100.4.200.5.300.1.200.1.800-.1 1.300z" />) },
  { key: "facebook", label: "Facebook", bg: "#1877F2", icon: svg(<path d="M14 8h2V5h-2a4 4 0 0 0-4 4v2H8v3h2v7h3v-7h2.200l.8-3H13V9.300c0-.7.300-1.300 1-1.300z" />) },
  { key: "x", label: "X", bg: "#000000", icon: svg(<path d="M18.901 1.153h3.680l-8.040 9.190L24 22.846h-7.406l-5.800-7.584-6.638 7.584H.474l8.600-9.830L0 1.154h7.594l5.243 6.932ZM17.610 20.644h2.039L6.486 3.240H4.298Z" />) },
  { key: "telegram", label: "Telegram", bg: "#26A5E4", icon: svg(<path d="M21.500 3.200 2.800 10.400c-.9.400-.9 1.100 0 1.400l4.700 1.500 1.800 5.600c.2.600.8.800 1.300.400l2.600-2.400 4.800 3.500c.9.500 1.500.2 1.700-.8L22.900 4.600c.3-1.200-.5-1.700-1.400-1.400zM9.200 13.700l8.600-5.400c.4-.3.800-.1.500.2l-7 6.400-.3 3.100-1.800-4.300z" />) },
  { key: "linkedin", label: "LinkedIn", bg: "#0A66C2", icon: svg(<path d="M4.500 3A1.800 1.800 0 1 0 4.500 6.600 1.800 1.800 0 0 0 4.500 3zM3 8.500h3V21H3V8.500zm5.500 0h2.900v1.700c.5-.9 1.700-1.900 3.500-1.900 3.200 0 3.800 2.100 3.800 4.900V21h-3v-6.800c0-1.600 0-3.200-2-3.200s-2.200 1.500-2.200 3.100V21h-3V8.500z" />) },
];

export function ShareButton({ path, title, text, configuredBase, preferConfigured }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const copiedTimer = useRef<number | undefined>(undefined);
  const [url, setUrl] = useState<string | null>(null);
  const [canNative, setCanNative] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manual, setManual] = useState(false);

  useEffect(() => {
    const u = resolveShareUrl({ path, configuredBase, origin: window.location.origin, preferConfigured });
    setUrl(u);
    setCanNative(typeof navigator.share === "function" && (typeof navigator.canShare !== "function" || navigator.canShare({ title, text, url: u })));
  }, [path, configuredBase, preferConfigured, title, text]);

  // Nunca deixa a página sem rolagem ou um temporizador pendente se o componente sair da tela.
  useEffect(() => () => { window.clearTimeout(copiedTimer.current); document.body.style.removeProperty("overflow"); }, []);

  if (!url) return <div className="h-10" aria-hidden />;
  const links = shareTargets(url, text);

  const open = () => {
    setCopied(false);
    setManual(false);
    document.body.style.overflow = "hidden";
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  /** Mantém Tab/Shift+Tab dentro do modal (o <dialog> nativo já torna o fundo inerte; aqui o foco também não "escapa" para a interface do navegador). */
  function trapTab(e: React.KeyboardEvent<HTMLDialogElement>) {
    if (e.key !== "Tab") return;
    const items = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])") ?? []);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url as string);
        setManual(false);
        setCopied(true);
        window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCopied(false), 3000);
        return;
      }
    } catch {
      /* cai no fallback manual */
    }
    setManual(true);
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url: url as string });
      close();
    } catch {
      /* cancelado pelo usuário ou recusado pelo navegador: não é erro */
    }
  }

  return (
    <>
      <button type="button" onClick={open} className="btn" aria-haspopup="dialog">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.600 13.500 6.800 4M15.400 6.500l-6.800 4" />
        </svg>
        Compartilhar
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="share-title"
        onClose={() => { document.body.style.removeProperty("overflow"); }}
        onClick={(e) => { if (e.target === e.currentTarget) close(); }}
        onKeyDown={trapTab}
        className="w-[min(92vw,26rem)] rounded-lg border border-navy-600 bg-navy-800 p-0 text-slate-100 backdrop:bg-black/60"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="share-title" className="text-lg font-semibold">Compartilhar esta página</h2>
              <p className="mt-1 text-sm text-slate-300">Será compartilhado apenas o link público da página.</p>
            </div>
            <button type="button" onClick={close} aria-label="Fechar" className="btn -mr-2 -mt-1 h-9 w-9 shrink-0 p-0">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-2">
            {NETWORKS.map((n) => (
              <li key={n.key}>
                <a href={links[n.key]} target="_blank" rel="noopener noreferrer" className="btn w-full justify-start py-2.5">
                  <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white" style={{ backgroundColor: n.bg }}>{n.icon}</span>
                  {n.label}
                </a>
              </li>
            ))}
            {canNative && (
              <li className="col-span-2">
                <button type="button" onClick={nativeShare} className="btn w-full py-2.5">Mais opções do dispositivo…</button>
              </li>
            )}
          </ul>

          <div className="mt-4 border-t border-navy-700 pt-4">
            <label htmlFor="share-url" className="block text-sm font-medium">Link da página</label>
            <div className="mt-1 flex gap-2">
              <input
                id="share-url"
                ref={inputRef}
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="field mt-0 min-w-0 flex-1"
              />
              <button type="button" onClick={copy} className={`btn shrink-0 ${copied ? "btn-primary" : ""}`}>{copied ? "Copiado ✓" : "Copiar"}</button>
            </div>
            <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm text-signal">
              {copied ? "Link copiado para a área de transferência." : manual ? <span className="text-amber-200">Não foi possível copiar automaticamente: o link está selecionado, use Ctrl+C (ou toque e segure).</span> : ""}
            </p>
            <p className="text-xs text-slate-400">Instagram não permite compartilhar por link na web: copie o link e cole no app.</p>
          </div>
        </div>
      </dialog>
    </>
  );
}
