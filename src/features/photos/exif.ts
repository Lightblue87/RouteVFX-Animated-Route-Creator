/**
 * Minimaler, sicherer EXIF-Leser nur für den Aufnahmeort (GPS) von JPEG-Dateien. Es werden ausschließlich Koordinaten
 * gelesen; alle Zugriffe sind auf den übergebenen Puffer begrenzt, Schleifen sind beschränkt. Ungültiges → null.
 * (HEIC/PNG/WebP: kein Geo-Tag lesbar → der Nutzer setzt den Punkt selbst.)
 */
export interface ExifGps {
  lat: number;
  lon: number;
}

/** Wie viele Bytes vom Dateianfang genügen (EXIF steht im ersten Segment, max. 64 KB). */
export const EXIF_READ_BYTES = 160 * 1024;

export function readExifGps(buf: ArrayBuffer): ExifGps | null {
  try {
    return parse(new DataView(buf));
  } catch {
    return null;
  }
}

function parse(v: DataView): ExifGps | null {
  if (v.byteLength < 12 || v.getUint16(0) !== 0xffd8) return null; // kein JPEG
  let off = 2;
  for (let n = 0; n < 64 && off + 4 <= v.byteLength; n++) {
    if (v.getUint8(off) !== 0xff) return null;
    const marker = v.getUint8(off + 1);
    if (marker === 0xda || marker === 0xd9) return null; // Bilddaten beginnen: kein EXIF
    const len = v.getUint16(off + 2);
    if (len < 2) return null;
    if (marker === 0xe1 && off + 10 <= v.byteLength && v.getUint32(off + 4) === 0x45786966 && v.getUint16(off + 8) === 0) {
      return parseTiff(v, off + 10, Math.min(v.byteLength, off + 2 + len));
    }
    off += 2 + len;
  }
  return null;
}

function parseTiff(v: DataView, base: number, end: number): ExifGps | null {
  if (base + 8 > end) return null;
  const order = v.getUint16(base);
  const le = order === 0x4949;
  if (!le && order !== 0x4d4d) return null;
  if (v.getUint16(base + 2, le) !== 42) return null;
  const u16 = (o: number) => (o >= base && o + 2 <= end ? v.getUint16(o, le) : null);
  const u32 = (o: number) => (o >= base && o + 4 <= end ? v.getUint32(o, le) : null);

  const ifd = (rel: number, want: (tag: number, entry: number) => void) => {
    const start = base + rel;
    const count = u16(start);
    if (count === null || count > 512) return;
    for (let i = 0; i < count; i++) want(u16(start + 2 + i * 12)!, start + 2 + i * 12);
  };

  const first = u32(base + 4);
  if (first === null) return null;
  let gpsOffset: number | null = null;
  ifd(first, (tag, entry) => {
    if (tag === 0x8825) gpsOffset = u32(entry + 8);
  });
  if (gpsOffset === null) return null;

  let latRef = '', lonRef = '';
  let lat: number | null = null, lon: number | null = null;
  const ascii = (entry: number) => (end > entry + 11 ? String.fromCharCode(v.getUint8(entry + 8)) : '');
  const dms = (entry: number): number | null => {
    if (u16(entry + 2) !== 5 || u32(entry + 4) !== 3) return null; // RATIONAL ×3
    const at = u32(entry + 8);
    if (at === null) return null;
    const parts: number[] = [];
    for (let k = 0; k < 3; k++) {
      const num = u32(base + at + k * 8);
      const den = u32(base + at + k * 8 + 4);
      if (num === null || den === null || den === 0) return null;
      parts.push(num / den);
    }
    return parts[0]! + parts[1]! / 60 + parts[2]! / 3600;
  };
  ifd(gpsOffset, (tag, entry) => {
    if (tag === 1) latRef = ascii(entry);
    else if (tag === 2) lat = dms(entry);
    else if (tag === 3) lonRef = ascii(entry);
    else if (tag === 4) lon = dms(entry);
  });
  if (lat === null || lon === null) return null;
  const la = (latRef === 'S' ? -1 : 1) * (lat as number);
  const lo = (lonRef === 'W' ? -1 : 1) * (lon as number);
  if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  if (la === 0 && lo === 0) return null; // „Null Island“ ist fast immer ein fehlender Wert
  return { lat: la, lon: lo };
}
