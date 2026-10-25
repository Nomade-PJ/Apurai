import { SLOT_FORMATS } from "./formats";
import type { AdPosition } from "./types";

/**
 * Proporção do quadro de um espaço (evita deslocamento de layout ao alternar banners).
 * Em telas pequenas usa a proporção do banner de celular SE algum anúncio da rotação tiver essa versão;
 * caso contrário mantém a proporção do desktop. Os banners são exibidos com object-fit: contain.
 */
export function frameFor(position: AdPosition, ads: { mobileImageUrl: string | null }[]) {
  const f = SLOT_FORMATS[position];
  const m = f.mobile && ads.some((a) => a.mobileImageUrl) ? f.mobile : f.desktop;
  return { maxWidth: f.desktop.width, desktop: `${f.desktop.width} / ${f.desktop.height}`, mobile: `${m.width} / ${m.height}` };
}
