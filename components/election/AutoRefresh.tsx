"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const BASE_MS = 30_000;
// Cada visitante espera de 30 a 40 s: evita que milhares de abas peçam a página no mesmo segundo.
const JITTER_MS = 10_000;

/**
 * Atualiza os dados da página sozinha, sem recarregar nem perder a rolagem.
 * - Só atualiza com a aba visível (aba em segundo plano não gasta o servidor).
 * - Ao voltar para a aba, atualiza logo se já passou tempo suficiente.
 * - Desliga quando a apuração é final (`enabled = false`).
 * router.refresh() pede ao servidor a mesma página que ele já mantém em cache (revalidate = 30 em app/page.tsx).
 */
export function AutoRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const lastRun = useRef(Date.now());

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      lastRun.current = Date.now();
      router.refresh();
    };
    const schedule = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === "visible") run();
        schedule();
      }, BASE_MS + Math.random() * JITTER_MS);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastRun.current > BASE_MS / 2) run();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, router]);

  if (!enabled) return null;
  return <p className="text-xs text-slate-400">Esta página se atualiza sozinha a cada cerca de 30 segundos enquanto a apuração está em andamento.</p>;
}
