import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { buildStyle, getStyleInfo, MAP_STYLES } from '../../src/adapters/maps/styles';
import { OPENFREEMAP } from '../../src/adapters/maps/openfreemap';

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
  it('ships the licence file of the bundled styles', () => {
    expect(readFileSync(join(__dirname, '../../src/adapters/maps/openfreemap/LICENSE.md'), 'utf8')).toMatch(/CC BY 4\.0/);
  });
});
