import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readImageSize, sniffImage } from '../../src/features/photos/sniff';

const fixture = (n: string) => new Uint8Array(readFileSync(join(process.cwd(), 'tests/fixtures', n)));
const bytes = (...parts: (string | number[])[]) =>
  Uint8Array.from(parts.flatMap((p) => (typeof p === 'string' ? [...p].map((c) => c.charCodeAt(0)) : p)));
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];

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
    const heic = bytes(u32(24), 'ftyp', 'heic', u32(0), 'mif1', u32(20), 'ispe', u32(0), u32(160), u32(120), u32(20), 'ispe', u32(0), u32(8064), u32(6048));
    expect(sniffImage(heic)).toBe('heic');
    expect(readImageSize(heic, 'heic')).toEqual({ width: 8064, height: 6048 });
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
