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
    return heicPrimarySize(b, v);
  } catch {
    return null;
  }
}

interface Box {
  type: string;
  /** Beginn des Inhalts (hinter dem Kopf) und Ende der Box. */
  body: number;
  end: number;
}

/** Boxen eines Bereichs der Reihe nach lesen (ISO-BMFF); begrenzt und an die Bereichsgrenzen gebunden. */
function boxes(b: Uint8Array, v: DataView, from: number, to: number): Box[] {
  const out: Box[] = [];
  let off = from;
  for (let n = 0; n < 512 && off + 8 <= to; n++) {
    let size = v.getUint32(off);
    const type = String.fromCharCode(b[off + 4]!, b[off + 5]!, b[off + 6]!, b[off + 7]!);
    let head = 8;
    if (size === 1) {
      if (off + 16 > to || v.getUint32(off + 8) !== 0) break; // 64-Bit-Größe über 4 GB: nicht plausibel
      size = v.getUint32(off + 12);
      head = 16;
    } else if (size === 0) size = to - off;
    if (size < head || off + size > to) break;
    out.push({ type, body: off + head, end: off + size });
    off += size;
  }
  return out;
}

/**
 * Pixelgröße des Hauptbilds einer HEIC/HEIF-Datei über die Struktur: meta → pitm (Hauptelement) → iprp/ipma (Zuordnung
 * Element → Eigenschaften) → ipco (Eigenschaften, 1-basiert) → ispe. Beliebige Bytes im Datei-Inhalt zählen nicht.
 * Lässt sich die Größe nicht belegen (z. B. meta hinter dem gelesenen Anfang), kommt null → Datei wird nicht dekodiert.
 */
function heicPrimarySize(b: Uint8Array, v: DataView): ImageSize | null {
  const meta = boxes(b, v, 0, b.length).find((x) => x.type === 'meta');
  if (!meta || meta.body + 4 > meta.end) return null;
  const kids = boxes(b, v, meta.body + 4, meta.end); // „meta“ ist eine Full-Box: 4 Byte Version/Flags
  const pitm = kids.find((x) => x.type === 'pitm');
  const iprp = kids.find((x) => x.type === 'iprp');
  if (!pitm || !iprp || pitm.body + 6 > pitm.end) return null;
  const primary = v.getUint8(pitm.body) === 0 ? v.getUint16(pitm.body + 4) : pitm.body + 8 <= pitm.end ? v.getUint32(pitm.body + 4) : -1;
  const props = boxes(b, v, iprp.body, iprp.end);
  const ipco = props.find((x) => x.type === 'ipco');
  const ipma = props.find((x) => x.type === 'ipma');
  if (!ipco || !ipma || ipma.body + 8 > ipma.end) return null;
  const list = boxes(b, v, ipco.body, ipco.end); // Eigenschaft Nr. k (1-basiert) = list[k - 1]
  const version = v.getUint8(ipma.body);
  const wide = (v.getUint8(ipma.body + 3) & 1) === 1;
  const count = v.getUint32(ipma.body + 4);
  let off = ipma.body + 8;
  for (let i = 0; i < count && i < 4096; i++) {
    const idBytes = version < 1 ? 2 : 4;
    if (off + idBytes + 1 > ipma.end) return null;
    const id = version < 1 ? v.getUint16(off) : v.getUint32(off);
    const assoc = v.getUint8(off + idBytes);
    off += idBytes + 1;
    const step = wide ? 2 : 1;
    if (off + assoc * step > ipma.end) return null;
    for (let k = 0; k < assoc; k++) {
      const index = wide ? v.getUint16(off + k * 2) & 0x7fff : v.getUint8(off + k) & 0x7f;
      const prop = index >= 1 ? list[index - 1] : undefined;
      if (id === primary && prop?.type === 'ispe' && prop.body + 12 <= prop.end) {
        const w = v.getUint32(prop.body + 4), h = v.getUint32(prop.body + 8);
        return w > 0 && h > 0 && w < 1 << 20 && h < 1 << 20 ? { width: w, height: h } : null;
      }
    }
    off += assoc * step;
  }
  return null;
}
