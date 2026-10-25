import {
  BANNER_ASPECT_TOLERANCE,
  BANNER_MAX_SCALE,
  BANNER_MIN_SCALE,
  IMAGE_MIME_TYPES,
  MAX_IMAGE_BYTES,
  fmtSpec,
  type ImageSpec,
} from "./formats";

export type BannerVerdict =
  | { ok: true; exact: boolean; note: string | null }
  | { ok: false; code: "unreadable" | "wrong_ratio" | "too_small" | "too_large" | "format" | "too_heavy"; message: string };

const ratioText = (s: ImageSpec) => (s.width / s.height).toFixed(2).replace(/\.?0+$/, "");

/**
 * Regra ÚNICA de dimensões de banner (usada no navegador e no servidor, para não haver divergência).
 * - Recomendado: exatamente o formato do espaço (ou um múltiplo dele, ex.: 2× para telas de alta densidade).
 * - Obrigatório: proporção dentro de ±3% do formato e largura entre 0,6× e 3× da recomendada.
 * A imagem é exibida com object-fit: contain num quadro com a proporção do espaço, então nunca é distorcida.
 */
export function evaluateBannerDimensions(actual: ImageSpec, expected: ImageSpec): BannerVerdict {
  const { width: w, height: h } = actual;
  if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) {
    return { ok: false, code: "unreadable", message: "Não foi possível ler as dimensões da imagem." };
  }
  if (w === expected.width && h === expected.height) return { ok: true, exact: true, note: null };

  const ratioDiff = Math.abs(w / h / (expected.width / expected.height) - 1);
  if (ratioDiff > BANNER_ASPECT_TOLERANCE) {
    return {
      ok: false,
      code: "wrong_ratio",
      message: `Proporção incorreta: a imagem tem ${w}×${h} px (${ratioText(actual)}:1) e este espaço usa ${fmtSpec(expected)} (${ratioText(expected)}:1). Envie ${fmtSpec(expected)} ou um múltiplo, como ${fmtSpec({ width: expected.width * 2, height: expected.height * 2 })}.`,
    };
  }
  const scale = w / expected.width;
  if (scale < BANNER_MIN_SCALE) {
    return {
      ok: false,
      code: "too_small",
      message: `Imagem pequena demais: ${w} px de largura. O mínimo é ${Math.ceil(expected.width * BANNER_MIN_SCALE)} px; o recomendado é ${fmtSpec(expected)}.`,
    };
  }
  if (scale > BANNER_MAX_SCALE) {
    return {
      ok: false,
      code: "too_large",
      message: `Imagem grande demais: ${w} px de largura. O máximo é ${Math.floor(expected.width * BANNER_MAX_SCALE)} px; o recomendado é ${fmtSpec(expected)}.`,
    };
  }
  return { ok: true, exact: false, note: `Será ajustada ao espaço (${fmtSpec(expected)}) mantendo a proporção.` };
}

/**
 * Pré-checagem no NAVEGADOR (antes do envio), com as mesmas regras e mensagens do servidor.
 * O servidor sempre revalida pelos bytes do arquivo; esta função só evita o envio de arquivos que seriam recusados.
 */
export function precheckBanner(meta: { type: string; size: number }, dims: ImageSpec | null, expected: ImageSpec): BannerVerdict {
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(meta.type)) {
    return { ok: false, code: "format", message: "Formato não permitido. Use PNG, JPG ou WEBP." };
  }
  if (meta.size > MAX_IMAGE_BYTES) {
    return { ok: false, code: "too_heavy", message: `Arquivo com ${Math.ceil(meta.size / 1024)} KB; o máximo é ${Math.round(MAX_IMAGE_BYTES / 1024)} KB. Comprima a imagem e tente de novo.` };
  }
  if (!dims) return { ok: false, code: "unreadable", message: "Não foi possível ler a imagem. O arquivo pode estar corrompido." };
  return evaluateBannerDimensions(dims, expected);
}
