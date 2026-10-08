import { test, expect, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Voraussetzung: Build mit VITE_PMTILES_URL=./test-tiles/mini.pmtiles (npm run test:e2e erledigt das).
// Das synthetische Testarchiv (keine echten OSM-Daten) wird per page.route mit echter Range-Semantik ausgeliefert.
const ARCHIVE = readFileSync('tests/fixtures/mini.pmtiles');
// Anfragen, die der Service Worker durchreicht, sieht page.route nicht – hier geht es um das Kachel-Laden selbst.
test.use({ serviceWorkers: 'block' });

async function servePmtiles(page: Page, log: { range: string; status: number }[]) {
  await page.route('**/test-tiles/mini.pmtiles', async (route: Route) => {
    const range = route.request().headers()['range'] ?? '';
    const m = /bytes=(\d+)-(\d+)/.exec(range);
    if (!m) {
      log.push({ range, status: 200 });
      return route.fulfill({ status: 200, body: ARCHIVE, headers: { 'Content-Type': 'application/octet-stream', 'Accept-Ranges': 'bytes' } });
    }
    const start = Number(m[1]);
    const end = Math.min(Number(m[2]), ARCHIVE.length - 1);
    log.push({ range, status: 206 });
    return route.fulfill({
      status: 206,
      body: ARCHIVE.subarray(start, end + 1),
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Range': `bytes ${start}-${end}/${ARCHIVE.length}`, 'Accept-Ranges': 'bytes' },
    });
  });
}

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

test('Detailkarte: OSM-Stil lädt Kacheln per Range-Request aus PMTiles und blendet die OSM-Attribution ein', async ({ page }) => {
  const log: { range: string; status: number }[] = [];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await servePmtiles(page, log);
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Braunschweig', /Braunschweig/);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('map-style').selectOption('osm-light');
  await expect(page.getByText(/OpenStreetMap contributors/).first()).toBeVisible();
  await expect(page.getByText(/nicht eingerichtet|not set up/)).toHaveCount(0);
  // Header + Verzeichnis, danach mindestens eine Kachel – alles als Teilantworten
  await expect.poll(() => log.filter((l) => l.status === 206).length, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
  expect(log.every((l) => l.status === 206)).toBe(true);
  await page.waitForTimeout(1000);
  await page.getByTestId('preview-canvas').locator('..').screenshot({ path: 'test-results/basemap-osm-light.png' });
  // Planungskarte im Routen-Tab nutzt denselben Stil
  const before = log.length;
  await page.getByTestId('tab-route').click();
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await expect.poll(() => log.length, { timeout: 30_000 }).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('Detailkarte: Stil bleibt nach Reload gespeichert; bei nicht erreichbarer Kacheldatei bleibt Natural Earth sichtbar', async ({ page }) => {
  await page.route('**/test-tiles/mini.pmtiles', (r) => r.abort('internetdisconnected'));
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Braunschweig', /Braunschweig/);
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('map-style').selectOption('osm-dark');
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);
  await page.reload();
  await page.getByTestId('tab-animate').click();
  await expect(page.getByTestId('map-style')).toHaveValue('osm-dark');
  await expect(page.getByTestId('preview-canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  await page.getByTestId('preview-canvas').locator('..').screenshot({ path: 'test-results/basemap-offline-fallback.png' });
});
