import type { ImageSpec } from "./formats";

export type FitMode = "contain" | "cover";

export interface FitRects {
  /** Área da imagem de origem a desenhar. */
  sx: number; sy: number; sw: number; sh: number;
  /** Destino no quadro final. */
  dx: number; dy: number; dw: number; dh: number;
}

/**
 * Calcula como encaixar uma imagem num quadro de proporção diferente (função pura, usada pelo ajuste automático do painel).
 * - contain ("Encaixar"): a imagem inteira aparece, centralizada; o que sobra nas laterais/topo é preenchido com uma cor.
 * - cover ("Preencher"): o quadro é preenchido por completo e as bordas excedentes da imagem são recortadas (centro preservado).
 */
export function computeFit(src: ImageSpec, dst: ImageSpec, mode: FitMode): FitRects {
  if (mode === "contain") {
    const s = Math.min(dst.width / src.width, dst.height / src.height);
    const dw = Math.max(1, Math.round(src.width * s));
    const dh = Math.max(1, Math.round(src.height * s));
    return { sx: 0, sy: 0, sw: src.width, sh: src.height, dx: Math.round((dst.width - dw) / 2), dy: Math.round((dst.height - dh) / 2), dw, dh };
  }
  const s = Math.max(dst.width / src.width, dst.height / src.height);
  const sw = dst.width / s;
  const sh = dst.height / s;
  return { sx: (src.width - sw) / 2, sy: (src.height - sh) / 2, sw, sh, dx: 0, dy: 0, dw: dst.width, dh: dst.height };
}

/** Resolução de saída: 2× (telas nítidas) só se a origem tem pixels suficientes; senão o tamanho recomendado. */
export function outputSize(source: ImageSpec, spec: ImageSpec, allowDouble = true): ImageSpec {
  const k = allowDouble && source.width >= spec.width * 2 ? 2 : 1;
  return { width: spec.width * k, height: spec.height * k };
}

/** Média de cores [r,g,b] (0–255) como "#rrggbb"; sem amostras => branco. */
export function averageColorHex(samples: [number, number, number][]): string {
  if (samples.length === 0) return "#ffffff";
  const avg = [0, 1, 2].map((i) => Math.round(samples.reduce((a, c) => a + c[i], 0) / samples.length));
  return "#" + avg.map((v) => Math.min(255, Math.max(0, v)).toString(16).padStart(2, "0")).join("");
}
