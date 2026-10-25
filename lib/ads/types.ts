export type AdPosition = "topo" | "patrocinador" | "lateral" | "rodape";
export type AdStatus = "ativo" | "pausado" | "desativado";

export const AD_POSITIONS: AdPosition[] = ["topo", "patrocinador", "lateral", "rodape"];
export const AD_STATUSES: AdStatus[] = ["ativo", "pausado", "desativado"];

/** Registro como persistido (caminhos de objeto no Storage, não URLs). */
export interface Ad {
  id: string;
  campaignName: string;
  advertiser: string;
  position: AdPosition;
  status: AdStatus;
  /** ISO 8601 */
  startsAt: string;
  /** ISO 8601 */
  endsAt: string;
  targetUrl: string;
  desktopImagePath: string | null;
  mobileImagePath: string | null;
  altText: string;
  /** Ordem dentro do espaço (menor = primeiro na rotação). */
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SlotSettings {
  /** Intervalo da rotação, em segundos. */
  rotationSeconds: number;
}
export type SlotSettingsMap = Record<AdPosition, SlotSettings>;

/** Anúncio com URLs públicas resolvidas, pronto para renderização. */
export interface AdView extends Omit<Ad, "desktopImagePath" | "mobileImagePath"> {
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
}

export interface Lead {
  id: string;
  company: string;
  contact: string;
  email: string;
  interest: string;
  message: string;
  createdAt: string;
}
