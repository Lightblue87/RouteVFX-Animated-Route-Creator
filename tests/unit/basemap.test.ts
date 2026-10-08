import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PMTiles, type Source } from 'pmtiles';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { _setBasemapConfig } from '../../src/adapters/maps/config';
import { buildStyle, getStyleInfo, isStyleAvailable, MAP_STYLES } from '../../src/adapters/maps/styles';
import { pmtilesOrigin } from '../../src/adapters/maps/pmtilesOrigin';

const BASE = 'https://app.example/';
const ASSETS = join(__dirname, '../../public/basemap-assets');
const osm = (id: string) => MAP_STYLES.find((s) => s.id === id)!;

afterEach(() => _setBasemapConfig({ pmtilesUrl: null }));

describe('Detailkarte (PMTiles) – Verfügbarkeit', () => {
  it('without a configured URL the OSM styles are unavailable and fall back to Natural Earth of the same variant', () => {
    _setBasemapConfig({ pmtilesUrl: null });
    expect(isStyleAvailable(osm('osm-light'))).toBe(false);
    expect(getStyleInfo('osm-light').id).toBe('ne-light');
    expect(getStyleInfo('osm-dark').id).toBe('ne-dark');
    const style = buildStyle('osm-dark', BASE);
    expect(Object.keys(style.sources)).not.toContain('protomaps');
  });
  it('with a URL the style uses pmtiles://, same-origin glyphs/sprites and keeps Natural Earth underneath', () => {
    _setBasemapConfig({ pmtilesUrl: 'https://tiles.example.org/planet.pmtiles' });
    expect(getStyleInfo('osm-light').id).toBe('osm-light');
    const style = buildStyle('osm-light', BASE, 'de');
    const src = style.sources.protomaps as { type: string; url: string; attribution: string };
    expect(src).toMatchObject({ type: 'vector', url: 'pmtiles://https://tiles.example.org/planet.pmtiles' });
    expect(src.attribution).toMatch(/OpenStreetMap/);
    expect(style.glyphs).toBe('https://app.example/basemap-assets/fonts/{fontstack}/{range}.pbf');
    expect(style.sprite).toBe('https://app.example/basemap-assets/sprites/v4/light');
    expect(style.layers[0]!.id).toBe('ne-water');
    expect(style.layers.filter((l) => l.type === 'background')).toHaveLength(1);
    expect(style.layers.some((l) => 'source' in l && l.source === 'protomaps')).toBe(true);
  });
  it('generated styles pass MapLibre style validation (no duplicate layer ids etc.)', () => {
    for (const url of [null, 'https://tiles.example.org/x.pmtiles']) {
      _setBasemapConfig({ pmtilesUrl: url });
      for (const s of MAP_STYLES) for (const lang of ['de', 'en'] as const) {
        expect(validateStyleMin(buildStyle(s.id, BASE, lang) as never).map((e) => e.message), `${s.id}/${lang}/${url}`).toEqual([]);
      }
    }
  });
  it('relative URLs resolve against the app base', () => {
    _setBasemapConfig({ pmtilesUrl: './tiles/region.pmtiles' });
    const src = buildStyle('osm-light', 'https://app.example/sub/').sources.protomaps as { url: string };
    expect(src.url).toBe('pmtiles://https://app.example/sub/tiles/region.pmtiles');
  });
  it('OSM styles require visible attribution in the video', () => {
    for (const id of ['osm-light', 'osm-dark']) {
      expect(osm(id)).toMatchObject({ exportAllowed: true, attributionRequired: true, attribution: '© OpenStreetMap contributors' });
    }
  });
});

describe('Detailkarte – gebündelte Assets', () => {
  it('every font stack and sprite used by the style is bundled (with licence files)', () => {
    _setBasemapConfig({ pmtilesUrl: 'https://tiles.example.org/x.pmtiles' });
    const fonts = new Set<string>();
    const collect = (v: unknown): void => {
      if (Array.isArray(v)) {
        if (v.length && v.every((x) => typeof x === 'string') && v.some((x) => /^Noto /.test(x as string))) (v as string[]).forEach((f) => fonts.add(f));
        else v.forEach(collect);
      }
    };
    for (const variant of ['osm-light', 'osm-dark']) {
      for (const l of buildStyle(variant, BASE).layers) collect((l.layout as Record<string, unknown> | undefined)?.['text-font']);
      for (const suffix of ['.json', '.png', '@2x.json', '@2x.png']) expect(existsSync(join(ASSETS, `sprites/v4/${variant.slice(4)}${suffix}`))).toBe(true);
    }
    expect(fonts.size).toBeGreaterThan(0);
    for (const f of fonts) expect(existsSync(join(ASSETS, 'fonts', f, '0-255.pbf')), f).toBe(true);
    expect(readFileSync(join(ASSETS, 'fonts/OFL.txt'), 'utf8')).toMatch(/SIL Open Font License/);
    expect(readFileSync(join(ASSETS, 'sprites/LICENSE-tangrams-icons.md'), 'utf8')).toMatch(/MIT License/);
  });
});

describe('PMTiles-Testarchiv', () => {
  it('fixture is a valid PMTiles v3 archive readable by the pmtiles library', async () => {
    const buf = readFileSync(join(__dirname, '../fixtures/mini.pmtiles'));
    const source: Source = {
      getKey: () => 'mini',
      getBytes: async (offset, length) => ({ data: buf.buffer.slice(buf.byteOffset + offset, buf.byteOffset + offset + length) as ArrayBuffer }),
    };
    const p = new PMTiles(source);
    const h = await p.getHeader();
    expect(h).toMatchObject({ specVersion: 3, tileType: 1, minZoom: 0, maxZoom: 8 });
    const tile = await p.getZxy(6, 33, 21);
    expect(tile?.data.byteLength).toBeGreaterThan(0);
  });
});

describe('CSP-Origin der PMTiles-URL', () => {
  it('derives https origins, ignores relative URLs, rejects insecure schemes', () => {
    expect(pmtilesOrigin(undefined)).toBeNull();
    expect(pmtilesOrigin('./tiles/x.pmtiles')).toBeNull();
    expect(pmtilesOrigin('https://tiles.example.org/a/b.pmtiles')).toBe('https://tiles.example.org');
    expect(pmtilesOrigin('http://localhost:8080/x.pmtiles')).toBe('http://localhost:8080');
    expect(() => pmtilesOrigin('http://tiles.example.org/x.pmtiles')).toThrow();
    expect(() => pmtilesOrigin('javascript:alert(1)')).toThrow();
  });
});
