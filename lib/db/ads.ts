import "server-only";
import { getStore } from "./index";
import { toAdView } from "./store";
import { isAdEligible } from "../ads/schedule";
import { defaultSlotSettings } from "../ads/rotation";
import type { AdView, SlotSettingsMap } from "../ads/types";

/** Anúncios elegíveis agora. Falha de banco => lista vazia (a página nunca quebra por causa de anúncios). */
export async function getLiveAds(now: Date = new Date()): Promise<AdView[]> {
  try {
    const store = getStore();
    if (!store) return [];
    const ads = await store.listActiveAds(now);
    return ads.map((a) => toAdView(a, store.storage)).filter((a) => isAdEligible(a, now));
  } catch {
    console.error("[ads] falha ao carregar anúncios; nenhum será exibido");
    return [];
  }
}

/** Intervalo de rotação por espaço. Falha => padrões; a página pública nunca quebra por causa disso. */
export async function getSlotRotation(): Promise<SlotSettingsMap> {
  try {
    const store = getStore();
    return store ? await store.getSlotSettings() : defaultSlotSettings();
  } catch {
    console.error("[ads] falha ao carregar intervalos de rotação; usando padrão");
    return defaultSlotSettings();
  }
}
