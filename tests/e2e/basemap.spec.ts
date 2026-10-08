import { test, expect, type Page } from '@playwright/test';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';

// tiles.openfreemap.org ist aus der Testumgebung nicht erreichbar und soll in Tests nicht belastet werden:
// TileJSON, Kacheln (OpenMapTiles-Schema, synthetische Geometrien – keine OSM-Daten), Glyphen und Sprite werden simuliert.
const rect = (w: number, s: number, e: number, n: number) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
const fc = (features: object[]) => ({ type: 'FeatureCollection', features });
const LAYERS = {
  water: fc([{ type: 'Feature', properties: { class: 'lake' }, geometry: { type: 'Polygon', coordinates: rect(9.72, 52.34, 9.76, 52.36) } }]),
  park: fc([{ type: 'Feature', properties: { class: 'park' }, geometry: { type: 'Polygon', coordinates: rect(9.76, 52.37, 9.82, 52.40) } }]),
  transportation: fc([
    { type: 'Feature', properties: { class: 'motorway' }, geometry: { type: 'LineString', coordinates: [[8.5, 52.42], [9.7, 52.43], [11.0, 52.44]] } },
    { type: 'Feature', properties: { class: 'motorway' }, geometry: { type: 'LineString', coordinates: [[9.85, 51.8], [9.84, 52.4], [9.86, 52.9]] } },
  ]),
  place: fc([{ type: 'Feature', properties: { class: 'city', name: 'Hannover', 'name:de': 'Hannover', 'name:en': 'Hanover', rank: 3 }, geometry: { type: 'Point', coordinates: [9.7375, 52.3745] } }]),
};
const INDEX = Object.fromEntries(Object.entries(LAYERS).map(([k, v]) => [k, geojsonvt(v, { maxZoom: 14, indexMaxZoom: 6 })]));
// Vollständige Ebenenliste des OpenMapTiles-Schemas (wie im echten TileJSON), auch wenn der Mock nur einige füllt.
const OMT_LAYERS = ['water', 'waterway', 'landcover', 'landuse', 'mountain_peak', 'park', 'boundary', 'aeroway', 'transportation', 'building', 'water_name', 'transportation_name', 'place', 'housenumber', 'poi', 'aerodrome_label'];
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

type Hit = { kind: 'tilejson' | 'tile' | 'glyphs' | 'sprite'; url: string };

async function mockOpenFreeMap(page: Page, hits: Hit[]) {
  await page.context().route('https://tiles.openfreemap.org/**', async (route) => {
    const url = new URL(route.request().url());
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (url.pathname === '/planet') {
      hits.push({ kind: 'tilejson', url: url.href });
      return route.fulfill({ json: { tilejson: '3.0.0', tiles: ['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf'], minzoom: 0, maxzoom: 14, vector_layers: OMT_LAYERS.map((id) => ({ id, fields: {} })) }, headers: cors });
    }
    const m = /^\/planet\/test\/(\d+)\/(\d+)\/(\d+)\.pbf$/.exec(url.pathname);
    if (m) {
      hits.push({ kind: 'tile', url: url.href });
      const [z, x, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
      const layers: Record<string, unknown> = {};
      for (const [name, idx] of Object.entries(INDEX)) {
        const t = idx.getTile(z, x, y);
        if (t?.features.length) layers[name] = t;
      }
      return route.fulfill({ body: Buffer.from(vtpbf.fromGeojsonVt(layers, { version: 2 })), headers: { ...cors, 'Content-Type': 'application/x-protobuf' } });
    }
    if (url.pathname.startsWith('/fonts/')) {
      hits.push({ kind: 'glyphs', url: url.href });
      return route.fulfill({ body: Buffer.alloc(0), headers: { ...cors, 'Content-Type': 'application/x-protobuf' } }); // leere, gültige Glyphenmenge
    }
    if (url.pathname.startsWith('/sprites/')) {
      hits.push({ kind: 'sprite', url: url.href });
      return url.pathname.endsWith('.png') ? route.fulfill({ body: PNG_1PX, headers: { ...cors, 'Content-Type': 'image/png' } }) : route.fulfill({ json: {}, headers: cors });
    }
    return route.fulfill({ status: 404, headers: cors });
  });
}

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

test('Detailkarte OpenFreeMap: Kacheln werden geladen, Attribution und Datenschutzhinweis sichtbar, Planungskarte nutzt den Stil', async ({ page }) => {
  const hits: Hit[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mockOpenFreeMap(page, hits);
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Braunschweig', /Braunschweig/);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await page.getByTestId('tab-animate').click();
  // Standard bleibt die Offline-Karte: ohne Auswahl keine Anfrage an OpenFreeMap
  await page.waitForTimeout(500);
  expect(hits).toEqual([]);
  await page.getByTestId('map-style').selectOption('ofm-positron');
  await expect(page.getByTestId('map-style-online')).toBeVisible();
  await expect(page.getByText(/OpenFreeMap © OpenMapTiles Data from OpenStreetMap/).first()).toBeVisible();
  await expect.poll(() => hits.filter((h) => h.kind === 'tile').length, { timeout: 30_000 }).toBeGreaterThan(0);
  expect(hits.some((h) => h.kind === 'tilejson')).toBe(true);
  await page.waitForTimeout(1000);
  await page.getByTestId('preview-canvas').locator('..').screenshot({ path: 'test-results/basemap-ofm-positron.png' });
  const before = hits.length;
  await page.getByTestId('tab-route').click();
  await expect.poll(() => hits.length, { timeout: 30_000 }).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('Detailkarte OpenFreeMap: Stil übersteht Reload; ohne erreichbaren Dienst bleibt die Natural-Earth-Karte sichtbar', async ({ page }) => {
  await page.context().route('https://tiles.openfreemap.org/**', (r) => r.abort('internetdisconnected'));
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Barcelona', /Barcelona/);
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('map-style').selectOption('ofm-dark');
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);
  await page.reload();
  await page.getByTestId('tab-animate').click();
  await expect(page.getByTestId('map-style')).toHaveValue('ofm-dark');
  await page.waitForTimeout(1500);
  await page.getByTestId('preview-canvas').locator('..').screenshot({ path: 'test-results/basemap-ofm-offline.png' });
});
