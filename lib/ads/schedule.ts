import { AD_POSITIONS, type AdPosition, type AdView } from "./types";
import { MAX_ADS_IN_ROTATION } from "./formats";
import { compareAds } from "./order";
import { validateHttpsUrl } from "../validation/url";

/**
 * Elegibilidade para exibição pública: status ativo, dentro do período, destino https válido,
 * imagem de desktop presente, texto alternativo e posição válidos.
 */
export function isAdEligible(ad: AdView, now: Date = new Date()): boolean {
  if (ad.status !== "ativo") return false;
  if (!AD_POSITIONS.includes(ad.position)) return false;
  if (!ad.desktopImageUrl || !ad.altText.trim()) return false;
  if (!validateHttpsUrl(ad.targetUrl).ok) return false;
  const start = Date.parse(ad.startsAt);
  const end = Date.parse(ad.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  const t = now.getTime();
  return t >= start && t <= end;
}

/**
 * Anúncios elegíveis de UM espaço, na ordem de rotação (sortOrder, depois mais recente).
 * Cada espaço usa somente os anúncios associados a ele. Lista vazia => o espaço NÃO deve ser renderizado.
 */
export function pickAds(ads: AdView[], position: AdPosition, now: Date = new Date()): AdView[] {
  return ads
    .filter((a) => a.position === position && isAdEligible(a, now))
    .sort(compareAds)
    .slice(0, MAX_ADS_IN_ROTATION);
}

/** Primeiro anúncio da rotação (ou null). */
export function pickAd(ads: AdView[], position: AdPosition, now: Date = new Date()): AdView | null {
  return pickAds(ads, position, now)[0] ?? null;
}
