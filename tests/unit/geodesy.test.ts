import { describe, expect, it } from 'vitest';
import { alongLine, boundsOf, fitCamera, greatCircle, haversineM, indexLine, initialBearingDeg, lineLengthM, mercatorX, normalizeLon, sliceLine, unwrapLongitudes } from '../../src/core/geodesy';
import { BARCELONA, HANNOVER } from '../fixtures/project';

describe('geodesy', () => {
  it('haversine Hannover–Barcelona ≈ 1347 km', () => {
    expect(haversineM(HANNOVER, BARCELONA) / 1000).toBeGreaterThan(1340);
    expect(haversineM(HANNOVER, BARCELONA) / 1000).toBeLessThan(1355);
  });
  it('great circle length equals haversine and endpoints are exact', () => {
    const gc = greatCircle(HANNOVER, BARCELONA, 64);
    expect(gc).toHaveLength(65);
    expect(gc[0]).toEqual(HANNOVER);
    expect(gc[64]).toEqual(BARCELONA);
    expect(Math.abs(lineLengthM(gc) - haversineM(HANNOVER, BARCELONA))).toBeLessThan(5);
  });
  it('great circle over the antimeridian is continuous (Tokyo → Los Angeles)', () => {
    const gc = greatCircle({ lat: 35.68, lon: 139.69 }, { lat: 34.05, lon: -118.24 }, 128);
    for (let i = 1; i < gc.length; i++) expect(Math.abs(gc[i]!.lon - gc[i - 1]!.lon)).toBeLessThan(10);
    expect(gc[gc.length - 1]!.lon).toBeCloseTo(-118.24 + 360, 6);
    expect(normalizeLon(gc[gc.length - 1]!.lon)).toBeCloseTo(-118.24, 6);
  });
  it('unwrapLongitudes removes jumps', () => {
    const u = unwrapLongitudes([{ lat: 0, lon: 179 }, { lat: 0, lon: -179 }, { lat: 0, lon: -178 }]);
    expect(u.map((p) => p.lon)).toEqual([179, 181, 182]);
  });
  it('near-pole great circle stays finite', () => {
    const gc = greatCircle({ lat: 89.9, lon: 0 }, { lat: 89.9, lon: 180 }, 32);
    for (const p of gc) { expect(Number.isFinite(p.lat)).toBe(true); expect(Number.isFinite(p.lon)).toBe(true); }
  });
  it('alongLine / sliceLine are consistent', () => {
    const idx = indexLine([{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 0, lon: 2 }]);
    const half = alongLine(idx, idx.totalM / 2);
    expect(half.point.lon).toBeCloseTo(1, 6);
    expect(half.headingDeg).toBeCloseTo(90, 3);
    expect(lineLengthM(sliceLine(idx, idx.totalM / 4))).toBeCloseTo(idx.totalM / 4, 0);
    expect(alongLine(idx, -5).point).toEqual({ lat: 0, lon: 0 });
    expect(alongLine(idx, 1e12).point.lon).toBeCloseTo(2, 6);
  });
  it('bearing north/east', () => {
    expect(initialBearingDeg({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(0, 6);
    expect(initialBearingDeg({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })).toBeCloseTo(90, 6);
  });
  it('fitCamera contains the bounds within the padded viewport', () => {
    const b = boundsOf([HANNOVER, BARCELONA]);
    const vp = { width: 540, height: 960 };
    const pad = { top: 190, bottom: 210, left: 50, right: 50 };
    const { center, zoom } = fitCamera(b, vp, pad);
    const scale = 512 * 2 ** zoom;
    const px = (lon: number) => (mercatorX(lon) - mercatorX(center.lon)) * scale + vp.width / 2;
    expect(px(b.minLon)).toBeGreaterThanOrEqual(pad.left - 0.5);
    expect(px(b.maxLon)).toBeLessThanOrEqual(vp.width - pad.right + 0.5);
  });
});
