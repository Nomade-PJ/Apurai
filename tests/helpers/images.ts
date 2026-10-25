import { crc32, deflateSync } from "node:zlib";

/** PNG real (válido e visualizável) de cor sólida. Apenas para testes e demonstração local. */
export function makePng(width: number, height: number, rgb: [number, number, number] = [46, 229, 157]): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8 bits, RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) { row[1 + x * 3] = rgb[0]; row[2 + x * 3] = rgb[1]; row[3 + x * 3] = rgb[2]; }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

/**
 * Cabeçalho JPEG mínimo (SOF0) com as dimensões armazenadas — suficiente para o inspetor.
 * `orientation` (1..8) acrescenta um segmento EXIF (APP1) com a tag de orientação, em big-endian ou little-endian.
 */
export function makeJpegHeader(width: number, height: number, opts: { orientation?: number; littleEndian?: boolean } = {}): Uint8Array {
  const sof = [0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x01, 0x01, 0x11, 0x00];
  let app1: number[] = [];
  if (opts.orientation !== undefined) {
    const le = opts.littleEndian === true;
    const u16 = (v: number) => (le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
    const u32 = (v: number) => (le ? [v & 0xff, (v >> 8) & 0xff, 0, 0] : [0, 0, (v >> 8) & 0xff, v & 0xff]);
    const tiff = [...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8), ...u16(1), ...u16(0x0112), ...u16(3), ...u32(1), ...u16(opts.orientation), 0, 0, 0, 0, 0, 0];
    const body = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff];
    app1 = [0xff, 0xe1, (body.length + 2) >> 8, (body.length + 2) & 0xff, ...body];
  }
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, ...app1, ...sof, 0xff, 0xd9]);
}

/** Cabeçalhos WebP mínimos (VP8X, VP8L, VP8). */
export function makeWebp(kind: "VP8X" | "VP8L" | "VP8", width: number, height: number): Uint8Array {
  const b = Buffer.alloc(40);
  b.write("RIFF", 0, "ascii"); b.writeUInt32LE(32, 4); b.write("WEBP", 8, "ascii");
  if (kind === "VP8X") {
    b.write("VP8X", 12, "ascii"); b.writeUInt32LE(10, 16);
    b.writeUIntLE(width - 1, 24, 3); b.writeUIntLE(height - 1, 27, 3);
  } else if (kind === "VP8L") {
    b.write("VP8L", 12, "ascii"); b.writeUInt32LE(5, 16); b[20] = 0x2f;
    b.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 21);
  } else {
    b.write("VP8 ", 12, "ascii"); b.writeUInt32LE(10, 16);
    b[23] = 0x9d; b[24] = 0x01; b[25] = 0x2a; b.writeUInt16LE(width, 26); b.writeUInt16LE(height, 28);
  }
  return new Uint8Array(b);
}
