import type { AdPosition, AdView } from "@/lib/ads/types";
import { AdCreative } from "./AdCreative";
import { AdFrame } from "./AdFrame";
import { AdRotator } from "./AdRotator";

interface Props {
  position: AdPosition;
  /** Anúncios elegíveis deste espaço, já na ordem de rotação (ver pickAds). */
  ads: AdView[];
  intervalSeconds: number;
  className?: string;
  priority?: boolean;
}

/**
 * Espaço publicitário. REGRA: sem anúncio elegível, não renderiza NADA (sem caixa, borda, rótulo
 * "Publicidade" ou convite "Anuncie aqui"). Com anúncio, ele é sempre rotulado.
 * Um único anúncio é renderizado no servidor, sem JavaScript; dois ou mais usam o rotador.
 */
export function AdSlot({ position, ads, intervalSeconds, className = "", priority = false }: Props) {
  if (ads.length === 0) return null;
  const single = ads.length === 1 ? ads[0] : null;
  return (
    <aside aria-label="Publicidade" className={`rounded-lg border border-navy-700 bg-navy-900 p-3 text-center ${className}`}>
      <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-400">Publicidade</p>
      {single ? (
        <>
          <AdFrame position={position} ads={ads}>
            <AdCreative ad={single} priority={priority} />
          </AdFrame>
          <p className="mt-1 min-h-4 text-xs text-slate-400">Patrocinado por {single.advertiser}</p>
        </>
      ) : (
        <AdRotator position={position} ads={ads} intervalSeconds={intervalSeconds} priority={priority} />
      )}
    </aside>
  );
}
