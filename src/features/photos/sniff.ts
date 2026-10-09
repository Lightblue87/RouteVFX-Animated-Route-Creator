/**
 * Bildtyp und Pixelgröße aus dem Dateikopf – ohne zu dekodieren. So lassen sich Dateien mit leerem/ungenauem MIME-Typ
 * erkennen und überdimensionierte Bilder ablehnen, bevor der Decoder den ganzen Speicher belegt.
 */
export type ImageKind = 'jpeg' | 'png' | 'webp' | 'heic';
export interface ImageSize {
  width: number;
  height: number;
}

/** Wie viele Bytes vom Dateianfang für Erkennung und Größe genügen. */
export const SNIFF_BYTES = 1024 * 1024;

const ascii = (b: Uint8Array, at: number, s: string) => {
  if (at + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[at + i] !== s.charCodeAt(i)) return false;
  return true;
};

export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 'PNG\r\n\x1a\n')) return 'png';
  if (ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP')) return 'webp';
  if (ascii(b, 4, 'ftyp') && ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1', 'heif'].some((brand) => ascii(b, 8, brand))) return 'heic';
  return null;
}

export function readImageSize(b: Uint8Array, kind: ImageKind): ImageSize | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ok = (s: ImageSize) => (s.width > 0 && s.height > 0 && s.width < 1 << 20 && s.height < 1 << 20 ? s : null);
  try {
    if (kind === 'png') return b.length >= 24 && ascii(b, 12, 'IHDR') ? ok({ width: v.getUint32(16), height: v.getUint32(20) }) : null;
    if (kind === 'jpeg') {
      let off = 2;
      for (let n = 0; n < 256 && off + 9 <= b.length; n++) {
        if (b[off] !== 0xff) return null;
        const m = b[off + 1]!;
        if (m === 0xff) { off++; continue; } // Füllbyte
        const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
        if (isSof) return ok({ height: v.getUint16(off + 5), width: v.getUint16(off + 7) });
        if (m === 0xda || m === 0xd9) return null;
        off += 2 + v.getUint16(off + 2);
      }
      return null;
    }
    if (kind === 'webp') {
      if (ascii(b, 12, 'VP8X') && b.length >= 30) return ok({ width: 1 + (b[24]! | (b[25]! << 8) | (b[26]! << 16)), height: 1 + (b[27]! | (b[28]! << 8) | (b[29]! << 16)) });
      if (ascii(b, 12, 'VP8L') && b.length >= 25) {
        const bits = v.getUint32(21, true);
        return ok({ width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) });
      }
      if (ascii(b, 12, 'VP8 ') && b.length >= 30) return ok({ width: v.getUint16(26, true) & 0x3fff, height: v.getUint16(28, true) & 0x3fff });
      return null;
    }
    // HEIC/HEIF: größte „ispe“-Box (Bildgröße je Element; Vorschaubilder sind kleiner)
    let best: ImageSize | null = null;
    for (let i = 4; i + 16 <= b.length; i++) {
      if (b[i] === 0x69 && ascii(b, i, 'ispe')) {
        const s = ok({ width: v.getUint32(i + 8), height: v.getUint32(i + 12) });
        if (s && (!best || s.width * s.height > best.width * best.height)) best = s;
      }
    }
    return best;
  } catch {
    return null;
  }
}
