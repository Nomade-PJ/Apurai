import { evaluateBannerDimensions } from "../ads/banner-rules";
import { IMAGE_EXT, MAX_IMAGE_BYTES, type ImageMime, type ImageSpec } from "../ads/formats";

export interface ImageInfo {
  mime: ImageMime;
  width: number;
  height: number;
}

/** Orientação EXIF (1..8) de um segmento APP1; null se ausente/ inválida. Navegadores aplicam essa rotação ao exibir. */
function exifOrientation(b: Uint8Array, start: number, end: number): number | null {
  if (end - start < 14 || end > b.length) return null;
  const sig = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  if (!sig.every((v, i) => b[start + i] === v)) return null;
  const t = start + 6;
  const little = b[t] === 0x49 && b[t + 1] === 0x49;
  const big = b[t] === 0x4d && b[t + 1] === 0x4d;
  if (!little && !big) return null;
  const u16 = (o: number) => (little ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) =>
    little ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  if (t + 8 > end || u16(t + 2) !== 42) return null;
  const ifd = t + u32(t + 4);
  if (ifd + 2 > end) return null;
  const n = u16(ifd);
  for (let i = 0; i < n; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > end) return null;
    if (u16(e) === 0x0112) {
      const v = u16(e + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** Lê tipo e dimensões a partir dos BYTES (assinatura), sem confiar em extensão nem Content-Type do cliente. */
export function inspectImage(b: Uint8Array): ImageInfo | null {
  const u16be = (o: number) => (b[o] << 8) | b[o + 1];
  const u32be = (o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const u16le = (o: number) => b[o] | (b[o + 1] << 8);
  const u24le = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  const ascii = (o: number, s: string) => s.split("").every((ch, i) => b[o + i] === ch.charCodeAt(0));

  // PNG
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, "PNG") && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a && ascii(12, "IHDR")) {
    return { mime: "image/png", width: u32be(16), height: u32be(20) };
  }

  // JPEG (dimensões como o navegador exibe: a orientação EXIF 5..8 troca largura e altura)
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    let orientation: number | null = null;
    while (o + 4 <= b.length) {
      if (b[o] !== 0xff) return null;
      let marker = b[o + 1];
      while (marker === 0xff && o + 2 < b.length) { o++; marker = b[o + 1]; } // preenchimento
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { o += 2; continue; }
      if (marker === 0xd9) return null;
      const len = u16be(o + 2);
      if (len < 2) return null;
      if (marker === 0xe1 && orientation === null) orientation = exifOrientation(b, o + 4, Math.min(o + 2 + len, b.length));
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) {
        if (o + 9 > b.length) return null;
        const height = u16be(o + 5);
        const width = u16be(o + 7);
        return orientation !== null && orientation >= 5 ? { mime: "image/jpeg", width: height, height: width } : { mime: "image/jpeg", width, height };
      }
      o += 2 + len;
    }
    return null;
  }

  // WebP (RIFF....WEBP)
  if (b.length >= 30 && ascii(0, "RIFF") && ascii(8, "WEBP")) {
    if (ascii(12, "VP8X")) return { mime: "image/webp", width: u24le(24) + 1, height: u24le(27) + 1 };
    if (ascii(12, "VP8L") && b[20] === 0x2f) {
      const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0;
      return { mime: "image/webp", width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (ascii(12, "VP8 ") && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) {
      return { mime: "image/webp", width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    }
  }
  return null;
}

export type ImageCheck =
  | { ok: true; info: ImageInfo; ext: string; exact: boolean; note: string | null }
  | { ok: false; error: string; code: string };

/** Valida tamanho, tipo (PNG/JPEG/WEBP; SVG recusado) e dimensões conforme a regra única do espaço. */
export function checkBanner(bytes: Uint8Array, expected: ImageSpec): ImageCheck {
  if (bytes.byteLength === 0) return { ok: false, code: "empty", error: "Arquivo vazio." };
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { ok: false, code: "too_heavy", error: `Arquivo com ${Math.ceil(bytes.byteLength / 1024)} KB; o máximo é ${Math.round(MAX_IMAGE_BYTES / 1024)} KB. Comprima a imagem e tente de novo.` };
  }
  const info = inspectImage(bytes);
  if (!info) return { ok: false, code: "format", error: "Formato não permitido. Use PNG, JPG ou WEBP (o conteúdo do arquivo é verificado, não só a extensão)." };
  const verdict = evaluateBannerDimensions({ width: info.width, height: info.height }, expected);
  if (!verdict.ok) return { ok: false, code: verdict.code, error: verdict.message };
  return { ok: true, info, ext: IMAGE_EXT[info.mime], exact: verdict.exact, note: verdict.note };
}
