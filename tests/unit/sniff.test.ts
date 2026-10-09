import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readImageSize, sniffImage } from '../../src/features/photos/sniff';

const fixture = (n: string) => new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures', n)));
const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

/** ISO-BMFF-Box aus Typ und Inhalt. */
const box = (type: string, ...content: (string | number[] | Uint8Array)[]) => {
  const body = Uint8Array.from(content.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : [...p])));
  return bytes(u32(8 + body.length), type, [...body]);
};
const ispe = (w: number, h: number) => box('ispe', u32(0), u32(w), u32(h));
/** HEIC mit Hauptelement `primary`; Eigenschaft 1 = 160×120 (Vorschau), 2 = 8064×6048 (Hauptbild). */
function buildHeic(o: { primary: number; primaryIdx: 1 | 2; decoy?: boolean; metaFirst?: boolean }) {
  const ipco = box('ipco', ispe(160, 120), ispe(8064, 6048));
  const ipma = box('ipma', [0, 0, 0, 0], u32(2), [0, 1, 1, 0x80 | o.primaryIdx], [0, 2, 1, 0x01]); // Element 1 → primaryIdx, Element 2 → Eigenschaft 1
  const meta = box('meta', u32(0), box('pitm', [0, 0, 0, 0], [0, o.primary]), box('iprp', ipco, ipma));
  const ftyp = box('ftyp', 'heic', u32(0), 'mif1');
  const decoy = box('free', 'ispe', u32(0), u32(10), u32(10)); // täuschende Bytes außerhalb der Struktur
  return o.decoy ? bytes([...ftyp], [...decoy], [...meta]) : bytes([...ftyp], [...meta]);
}

describe('Bildtyp und Größe aus dem Dateikopf', () => {
  it('erkennt JPEG samt Größe (echte Datei) – unabhängig vom MIME-Typ', () => {
    const b = fixture('photo-gps.jpg');
    expect(sniffImage(b)).toBe('jpeg');
    expect(readImageSize(b, 'jpeg')).toEqual({ width: 96, height: 64 });
  });
  it('liest PNG, WebP (VP8X, VP8L, VP8) und HEIC (größte ispe)', () => {
    const png = bytes([0x89], 'PNG\r\n\x1a\n', u32(13), 'IHDR', u32(4000), u32(3000));
    expect(sniffImage(png)).toBe('png');
    expect(readImageSize(png, 'png')).toEqual({ width: 4000, height: 3000 });
    const vp8x = bytes('RIFF', u32(0), 'WEBP', 'VP8X', u32(10), [0, 0, 0, 0], [0x9f, 0x0f, 0], [0xff, 0x0b, 0]); // 4000×3072
    expect(readImageSize(vp8x, 'webp')).toEqual({ width: 4000, height: 3072 });
    const bits = (999 | (499 << 14)) >>> 0; // 1000×500
    const vp8l = bytes('RIFF', u32(0), 'WEBP', 'VP8L', u32(5), [0x2f], [bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >>> 24) & 255]);
    expect(readImageSize(vp8l, 'webp')).toEqual({ width: 1000, height: 500 });
    const vp8 = bytes('RIFF', u32(0), 'WEBP', 'VP8 ', u32(10), [0, 0, 0], [0x9d, 0x01, 0x2a], [0x40, 0x06], [0xb0, 0x04]); // 1600×1200
    expect(readImageSize(vp8, 'webp')).toEqual({ width: 1600, height: 1200 });
    const heic = buildHeic({ primary: 1, primaryIdx: 2 });
    expect(sniffImage(heic)).toBe('heic');
    expect(readImageSize(heic, 'heic')).toEqual({ width: 8064, height: 6048 });
  });
  it('HEIC: folgt der Struktur (Hauptelement → Eigenschaft), ignoriert täuschende ispe-Bytes und beweist sonst nichts', () => {
    expect(readImageSize(buildHeic({ primary: 1, primaryIdx: 2, decoy: true }), 'heic')).toEqual({ width: 8064, height: 6048 });
    expect(readImageSize(buildHeic({ primary: 1, primaryIdx: 1, decoy: true }), 'heic')).toEqual({ width: 160, height: 120 });
    expect(readImageSize(buildHeic({ primary: 2, primaryIdx: 2 }), 'heic')).toEqual({ width: 160, height: 120 }); // Element 2 → Eigenschaft 1
    expect(readImageSize(buildHeic({ primary: 9, primaryIdx: 2 }), 'heic')).toBeNull(); // Hauptelement ohne Zuordnung
    // nur die täuschenden Bytes, keine Struktur → nicht belegbar
    const fake = bytes([...box('ftyp', 'heic', u32(0), 'mif1')], [...box('free', ispe(10, 10))]);
    expect(readImageSize(fake, 'heic')).toBeNull();
    // abgeschnitten (meta unvollständig) → nicht belegbar, kein Fehler
    const ok = buildHeic({ primary: 1, primaryIdx: 2 });
    for (const n of [0, 8, 20, 40, 60, ok.length - 10]) expect(readImageSize(ok.slice(0, n), 'heic')).toBeNull();
    for (let seed = 1; seed <= 200; seed++) {
      const c = ok.slice();
      for (let k = 0; k < 6; k++) c[(seed * 7919 + k * 104729) % c.length] = (seed * 31 + k * 17) & 255;
      expect(() => readImageSize(c, 'heic')).not.toThrow();
    }
  });
  it('erkennt Überdimensioniertes am Kopf, ohne zu dekodieren', () => {
    const b = fixture('photo-gps.jpg').slice();
    // SOF0 suchen und auf 12000×9000 (108 MP) setzen
    for (let i = 2; i + 9 < b.length; i++) {
      if (b[i] === 0xff && b[i + 1] === 0xc0) {
        b[i + 5] = 9000 >> 8; b[i + 6] = 9000 & 255; b[i + 7] = 12000 >> 8; b[i + 8] = 12000 & 255;
        break;
      }
    }
    expect(readImageSize(b, 'jpeg')).toEqual({ width: 12000, height: 9000 });
  });
  it('lehnt Fremdes ab: SVG, Text, leer, abgeschnitten; wirft nie', () => {
    expect(sniffImage(bytes('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(bytes('GIF89a'))).toBeNull();
    expect(sniffImage(new Uint8Array(0))).toBeNull();
    const ok = fixture('photo-gps.jpg');
    for (const n of [0, 1, 3, 10, 40, 100]) expect(() => readImageSize(ok.slice(0, n), 'jpeg')).not.toThrow();
    for (const k of ['png', 'webp', 'heic'] as const) expect(readImageSize(new Uint8Array(5), k)).toBeNull();
    for (let seed = 1; seed <= 200; seed++) {
      const c = ok.slice();
      for (let k = 0; k < 8; k++) c[(seed * 7919 + k * 104729) % Math.min(c.length, 300)] = (seed * 31 + k * 17) & 255;
      expect(() => readImageSize(c, 'jpeg')).not.toThrow();
    }
  });
});
