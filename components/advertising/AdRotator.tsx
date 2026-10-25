"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { clampRotationSeconds } from "@/lib/ads/rotation";
import type { AdPosition, AdView } from "@/lib/ads/types";
import { AdCreative } from "./AdCreative";
import { AdFrame } from "./AdFrame";

interface Props {
  position: AdPosition;
  ads: AdView[];
  intervalSeconds: number;
  priority?: boolean;
  /** true nas prévias do painel: sem link nos banners. */
  preview?: boolean;
}

/**
 * Alterna os anúncios de UM espaço. Regras:
 * - cada espaço tem a sua própria instância/temporizador (independentes);
 * - um único anúncio válido fica fixo (sem temporizador nem transição);
 * - o temporizador é limpo ao desmontar e ao mudar a lista/intervalo; pausa com a aba oculta, fora da tela
 *   (inclui espaços ocultos por CSS, como o lateral em celulares) e sob mouse/foco;
 * - imagem que falha ao carregar sai da rotação; sem nenhuma restante, o espaço some;
 * - a troca é um fade discreto (desligado com prefers-reduced-motion) e o tamanho do quadro nunca muda.
 */
export function AdRotator({ position, ads, intervalSeconds, priority = false, preview = false }: Props) {
  const [failed, setFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [tick, setTick] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [inView, setInView] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const playable = useMemo(() => ads.filter((a) => !failed.has(a.id)), [ads, failed]);
  const n = playable.length;
  const current = n ? tick % n : 0;
  const ms = clampRotationSeconds(intervalSeconds) * 1000;

  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [n > 0]);

  useEffect(() => {
    if (n < 2 || hovering || tabHidden || !inView) return;
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [n, hovering, tabHidden, inView, ms]);

  if (n === 0) return null;
  const active = playable[current];

  // Renderiza anterior, atual e próximo: o próximo já vem carregado e o anterior permite o fade de saída.
  const visible = new Set([(current - 1 + n) % n, current, (current + 1) % n]);
  const markFailed = (id: string) => setFailed((prev) => new Set(prev).add(id));

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocus={() => setHovering(true)}
      onBlur={() => setHovering(false)}
    >
      <AdFrame position={position} ads={playable}>
        {playable.map((ad, i) =>
          visible.has(i) ? (
            <div
              key={ad.id}
              inert={i !== current}
              aria-hidden={i !== current}
              className={`absolute inset-0 transition-opacity duration-500 motion-reduce:transition-none ${i === current ? "z-10 opacity-100" : "z-0 opacity-0"}`}
            >
              <AdCreative ad={ad} link={!preview} priority={priority && i === 0} onImageError={() => markFailed(ad.id)} />
            </div>
          ) : null,
        )}
      </AdFrame>
      <p className="mt-1 min-h-4 text-xs text-slate-400" aria-live="off">
        Patrocinado por {active.advertiser}
      </p>
    </div>
  );
}
