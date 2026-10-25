"use client";

import { useEffect, useRef, useState } from "react";

const SIZES = {
  xl: "h-28 w-20 sm:h-32 sm:w-24 text-3xl",
  md: "h-14 w-12 text-lg",
} as const;

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * Foto oficial do candidato (arquivo do TSE). Se não houver foto ou ela falhar ao carregar,
 * mostra as iniciais — o layout nunca quebra nem deixa ícone de imagem quebrada.
 */
export function CandidatePhoto({ src, name, size, ringClass }: { src: string | null; name: string; size: keyof typeof SIZES; ringClass: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A imagem vem no HTML do servidor: se ela falhar ANTES do React hidratar, o onError já passou.
  // Ao hidratar, checamos se terminou de carregar sem conteúdo e, nesse caso, caímos nas iniciais.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  const box = `shrink-0 overflow-hidden rounded-lg bg-navy-900 ring-2 ${ringClass} ${SIZES[size]}`;
  if (!src || failed) {
    return (
      <div role="img" aria-label={`Candidato ${name} (sem foto)`} className={`${box} flex items-center justify-center font-bold text-slate-300`}>
        {initials(name)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={`Foto de ${name}`}
      className={`${box} object-cover object-top`}
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
