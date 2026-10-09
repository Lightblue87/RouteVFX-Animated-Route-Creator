import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readExifGps } from '../../src/features/photos/exif';

const load = (name: string) => {
  const b = readFileSync(join(process.cwd(), 'tests/fixtures', name));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

describe('EXIF-Geo-Tag lesen', () => {
  it('liest Breite/Länge (N/E) aus einem JPEG', () => {
    const g = readExifGps(load('photo-gps.jpg'))!;
    expect(g.lat).toBeCloseTo(52 + 22 / 60 + 30 / 3600, 6);
    expect(g.lon).toBeCloseTo(9 + 44 / 60, 6);
  });
  it('beachtet Süd/West als negative Werte', () => {
    const g = readExifGps(load('photo-gps-sw.jpg'))!;
    expect(g.lat).toBeCloseTo(-(33 + 51 / 60 + 54 / 3600), 6);
    expect(g.lon).toBeCloseTo(-(70 + 39 / 60), 6);
  });
  it('liefert null ohne Geo-Tag, bei Nicht-JPEG, leer, abgeschnitten und zufälligem Müll', () => {
    expect(readExifGps(load('photo-nogps.jpg'))).toBeNull();
    expect(readExifGps(new ArrayBuffer(0))).toBeNull();
    expect(readExifGps(new TextEncoder().encode('GIF89a not a jpeg at all....').buffer as ArrayBuffer)).toBeNull();
    const ok = load('photo-gps.jpg');
    for (const n of [4, 12, 30, 60, 100, 140]) expect(() => readExifGps(ok.slice(0, n))).not.toThrow();
    const rnd = new Uint8Array(ok.slice(0)); // Zufallsbyte-Zerstörung innerhalb des EXIF-Bereichs darf nie werfen
    for (let seed = 1; seed <= 300; seed++) {
      const c = rnd.slice();
      for (let k = 0; k < 6; k++) c[(seed * 7919 + k * 104729) % Math.min(c.length, 200)] = (seed * 31 + k * 17) & 0xff;
      expect(() => readExifGps(c.buffer as ArrayBuffer)).not.toThrow();
    }
  });
});
