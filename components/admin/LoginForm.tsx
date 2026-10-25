"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Formulário de acesso ao painel. Continua sendo um POST nativo para /api/admin/login (funciona até sem JavaScript);
 * o JavaScript só adiciona estado de carregamento e o botão de mostrar/ocultar senha, que altera apenas o `type`
 * do campo: a senha não é guardada nem enviada a lugar nenhum além do envio normal do formulário.
 * Durante o envio o campo fica `readOnly` (e NÃO `disabled`): campos desabilitados são omitidos do POST.
 */
export function LoginForm({ error }: { error: string | null }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stalled, setStalled] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  // Ao voltar pelo histórico (cache de página) o botão não pode ficar travado em "Entrando…".
  useEffect(() => {
    const reset = () => {
      window.clearTimeout(timer.current);
      setBusy(false);
    };
    window.addEventListener("pageshow", reset);
    return () => {
      window.removeEventListener("pageshow", reset);
      window.clearTimeout(timer.current);
    };
  }, []);

  // Rede de segurança: se a navegação não acontecer (resposta bloqueada ou lenta), destrava o formulário e avisa.
  function onSubmit() {
    setStalled(false);
    setBusy(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setBusy(false);
      setStalled(true);
    }, 8000);
  }
  const message = error ?? (stalled ? "A resposta demorou ou foi bloqueada. Tente novamente." : null);

  return (
    <form method="post" action="/api/admin/login" onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="password" className="block text-sm font-medium">Senha</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            required
            maxLength={200}
            autoComplete="current-password"
            autoFocus={Boolean(message)}
            autoCapitalize="none"
            spellCheck={false}
            readOnly={busy}
            aria-invalid={Boolean(message)}
            aria-describedby="login-msg"
            className="field pr-11"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 mt-1 grid w-10 place-items-center rounded-r-md text-slate-300 hover:text-signal"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {show ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.600 6.100A9.800 9.800 0 0 1 12 6c5 0 8.500 4 9.500 6a14 14 0 0 1-2.600 3.300M6.600 6.700A14 14 0 0 0 2.500 12c1 2 4.500 6 9.500 6 1.600 0 3-.4 4.200-1" />
                  <path d="M9.900 9.900a3 3 0 0 0 4.200 4.200" />
                </>
              ) : (
                <>
                  <path d="M2.500 12C3.500 10 7 6 12 6s8.500 4 9.500 6c-1 2-4.500 6-9.500 6s-8.500-4-9.500-6z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        {/* Altura reservada (cabe um alerta de até 2 linhas em telas estreitas): a mensagem não empurra o botão. */}
        <div id="login-msg" className="min-h-[4.25rem] pt-2" aria-live="assertive">
          {message && <p role="alert" className="alert alert-error py-2">{message}</p>}
        </div>
      </div>
      <button type="submit" disabled={busy} className="btn btn-primary w-full py-2.5 text-base">
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
