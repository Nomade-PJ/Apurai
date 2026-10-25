import type { AdPosition } from "./types";

export interface ImageSpec {
  width: number;
  height: number;
}

export interface SlotFormat {
  label: string;
  where: string;
  desktop: ImageSpec;
  /** null: espaço exibido apenas em telas grandes (não aceita imagem de celular). */
  mobile: ImageSpec | null;
}

/**
 * Dimensões RECOMENDADAS por espaço (px). Fonte única usada pelo servidor, pelo admin e pela página /anuncie.
 * O servidor aceita também múltiplos/variações próximas que preservem a proporção (ver lib/ads/banner-rules.ts).
 */
export const SLOT_FORMATS: Record<AdPosition, SlotFormat> = {
  topo: { label: "Banner principal", where: "Topo da página inicial, logo após o contexto da eleição.", desktop: { width: 970, height: 90 }, mobile: { width: 320, height: 100 } },
  patrocinador: { label: "Bloco do patrocinador", where: "Abaixo do painel de apuração oficial.", desktop: { width: 640, height: 120 }, mobile: { width: 320, height: 100 } },
  lateral: { label: "Bloco lateral", where: "Coluna lateral, apenas em telas grandes (desktop).", desktop: { width: 300, height: 250 }, mobile: null },
  rodape: { label: "Bloco complementar", where: "Próximo ao rodapé.", desktop: { width: 728, height: 90 }, mobile: { width: 320, height: 100 } },
};

export const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageMime = (typeof IMAGE_MIME_TYPES)[number];
export const MAX_IMAGE_BYTES = 512 * 1024;

/** Variação de proporção tolerada em relação ao formato do espaço (3%). */
export const BANNER_ASPECT_TOLERANCE = 0.03;
/** Largura aceita como fração/múltiplo da largura recomendada (0,6× a 3×). */
export const BANNER_MIN_SCALE = 0.6;
export const BANNER_MAX_SCALE = 3;

/** Rotação: padrão e limites seguros (segundos). Espelhados na migração SQL (check 4..60). */
export const DEFAULT_ROTATION_SECONDS = 8;
export const MIN_ROTATION_SECONDS = 4;
export const MAX_ROTATION_SECONDS = 60;
/** No máximo N anúncios participam da rotação de um mesmo espaço (limita peso da página). */
export const MAX_ADS_IN_ROTATION = 8;
export const IMAGE_EXT: Record<ImageMime, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export const fmtSpec = (s: ImageSpec) => `${s.width}×${s.height} px`;
