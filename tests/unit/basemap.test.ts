import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { buildStyle, getStyleInfo, MAP_STYLES } from '../../src/adapters/maps/styles';
import { OPENFREEMAP } from '../../src/adapters/maps/openfreemap';
import { isOnlineMapReachable } from '../../src/adapters/maps/availability';

const BASE = 'https://app.example/';

describe('Detailkarte (OpenFreeMap)', () => {
  it('all generated styles pass MapLibre style validation (both label languages)', () => {
    for (const s of MAP_STYLES) for (const lang of ['de', 'en'] as const) {
      expect(validateStyleMin(buildStyle(s.id, BASE, lang) as never).map((e) => e.message), `${s.id}/${lang}`).toEqual([]);
    }
  });
  it('uses the public OpenFreeMap endpoints and no unresolved placeholders or raster services', () => {
    for (const id of ['ofm-positron', 'ofm-dark']) {
      const style = buildStyle(id, BASE);
      const json = JSON.stringify(style);
      expect(json).not.toContain('__TILEJSON_DOMAIN__');
      expect(style.sources.openmaptiles).toMatchObject({ type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
      expect(Object.values(style.sources).some((s) => s.type === 'raster')).toBe(false);
      expect(style.glyphs).toBe('https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf');
      expect(style.layers[0]!.type).toBe('background');
      expect(style.layers.filter((l) => l.type === 'background')).toHaveLength(2); // OFM-Land + NE-Wasser (bis z7)
    }
  });
  it('keeps Natural Earth underneath only up to zoom 7 (offline fallback without coarse coastlines at street level)', () => {
    const ne = buildStyle('ofm-positron', BASE).layers.filter((l) => l.id.startsWith('ne-'));
    expect(ne.map((l) => l.id)).toEqual(['ne-water', 'ne-land', 'ne-lakes', 'ne-borders']);
    for (const l of ne) expect(l.maxzoom).toBe(7);
  });
  it('prefers labels in the project language', () => {
    const style = buildStyle('ofm-positron', BASE, 'en');
    const labels = style.layers.filter((l) => JSON.stringify((l.layout as Record<string, unknown> | undefined)?.['text-field'] ?? null).includes('"name'));
    expect(labels.length).toBeGreaterThan(0);
    for (const l of labels) expect(JSON.stringify((l.layout as Record<string, unknown>)['text-field'])).toMatch(/^\["coalesce",\["get","name:en"\]/);
  });
  it('declares the attribution OpenFreeMap requires for video and marks the style as online', () => {
    expect(OPENFREEMAP.attribution).toBe('OpenFreeMap © OpenMapTiles Data from OpenStreetMap');
    for (const id of ['ofm-positron', 'ofm-dark']) {
      expect(getStyleInfo(id)).toMatchObject({ exportAllowed: true, attributionRequired: true, online: true, attribution: OPENFREEMAP.attribution });
    }
    expect(getStyleInfo('ne-light').online).toBeFalsy();
  });
  it('production CSP allows the OpenFreeMap origin', () => {
    const cfg = readFileSync(join(__dirname, '../../vite.config.ts'), 'utf8');
    expect(cfg).toMatch(/connect-src[^"]*https:\/\/tiles\.openfreemap\.org/);
  });
  it('ships the licence notices of both bundled styles (Positron and Dark Matter, BSD-3 + CC BY 4.0)', () => {
    const lic = readFileSync(join(__dirname, '../../src/adapters/maps/openfreemap/LICENSE.md'), 'utf8');
    expect(lic).toMatch(/CC BY 4\.0/);
    expect(lic).toMatch(/positron-gl-style/);
    expect(lic).toMatch(/dark-matter-gl-style/);
    expect(lic.match(/Redistributions in binary form must reproduce/g)?.length).toBeGreaterThanOrEqual(2);
  });
  it('export pre-check: reachable only if the TileJSON answers with tiles; errors and timeouts count as unreachable', async () => {
    const ok = (body: unknown, status = 200) => async () => new Response(JSON.stringify(body), { status });
    expect(await isOnlineMapReachable(ok({ tiles: ['https://tiles.openfreemap.org/planet/x/{z}/{x}/{y}.pbf'] }) as never)).toBe(true);
    expect(await isOnlineMapReachable(ok({ tiles: [] }) as never)).toBe(false);
    expect(await isOnlineMapReachable(ok({}, 503) as never)).toBe(false);
    expect(await isOnlineMapReachable((async () => { throw new TypeError('Failed to fetch'); }) as never)).toBe(false);
    const hang = ((_u: string, init: RequestInit) => new Promise((_, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as never;
    expect(await isOnlineMapReachable(hang, 20)).toBe(false);
  });
});
