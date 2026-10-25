import type { CSSProperties, ReactNode } from "react";
import { frameFor } from "@/lib/ads/frame";
import type { AdPosition } from "@/lib/ads/types";

/**
 * Quadro com a proporção do espaço (definida em CSS, ver .ad-frame em globals.css).
 * Reserva a altura antes de a imagem carregar e mantém o tamanho ao alternar banners (sem deslocamento de layout).
 */
export function AdFrame({ position, ads, children, className = "" }: { position: AdPosition; ads: { mobileImageUrl: string | null }[]; children: ReactNode; className?: string }) {
  const r = frameFor(position, ads);
  const style = { maxWidth: r.maxWidth, "--ad-ar-d": r.desktop, "--ad-ar-m": r.mobile } as CSSProperties;
  return (
    <div className={`ad-frame ${className}`} style={style}>
      {children}
    </div>
  );
}
