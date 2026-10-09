import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

// Läuft nur mit einem Build, der VITE_ROUTING_PROXY_URL enthält (siehe routing-proxy.spec.ts). Der Proxy wird simuliert.
const PROXY = /\/functions\/v1\/route$/;
const FIX = (n: string) => join(process.cwd(), 'tests/fixtures', n);

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

test('Foto-Ort lenkt die Straßenroute: Zwischenpunkt wird nach Einwilligung an den Proxy gesendet', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  const toggle = page.getByTestId('online-toggle');
  test.skip(!/Supabase/.test((await toggle.locator('..').textContent()) ?? ''), 'Build ohne VITE_ROUTING_PROXY_URL');

  const bodies: { coordinates: number[][]; alternatives: boolean }[] = [];
  await page.context().route(PROXY, async (route) => {
    const req = route.request();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = req.postDataJSON() as { coordinates: number[][]; alternatives: boolean };
    bodies.push(body);
    return route.fulfill({ status: 200, headers: cors, json: { routes: [{ coordinates: body.coordinates, distanceM: 120_000, durationS: 5000 }], attribution: 'ORS' } });
  });

  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Bielefeld', /Bielefeld/);
  await toggle.check();
  await expect.poll(() => bodies.length, { timeout: 15_000 }).toBe(1);
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Anbieterroute|Provider route/);
  expect(bodies[0]!.coordinates).toHaveLength(2);

  // Foto mit Geo-Tag (bei Hannover) → Karte „Route über Foto-Orte berechnen“ erscheint, erst nach Klick wird gesendet
  await page.getByTestId('photo-input').setInputFiles(FIX('photo-gps.jpg'));
  await expect(page.getByTestId('photo-item')).toHaveCount(1);
  await expect(page.getByTestId('photo-via-card')).toBeVisible();
  expect(bodies).toHaveLength(1);
  await page.getByTestId('photo-via-apply').click();
  await expect.poll(() => bodies.length, { timeout: 15_000 }).toBe(2);
  expect(bodies[1]!.coordinates).toHaveLength(3);
  expect(bodies[1]!.alternatives).toBe(false); // mit Zwischenpunkten keine Alternativen
  // Der Zwischenpunkt ist der Foto-Ort (≈ 52.375 N)
  expect(bodies[1]!.coordinates[1]![1]).toBeCloseTo(52.375, 2);
  // Erledigt: die Karte verschwindet; Foto entfernen → Umweg muss zurückgenommen werden
  await expect(page.getByTestId('photo-via-card')).toHaveCount(0);
  await page.getByTestId('photo-remove').click();
  await expect(page.getByTestId('photo-via-card')).toBeVisible();
  await page.getByTestId('photo-via-apply').click();
  await expect.poll(() => bodies.length, { timeout: 15_000 }).toBe(3);
  expect(bodies[2]!.coordinates).toHaveLength(2);
  await expect(page.getByTestId('photo-via-card')).toHaveCount(0);
});

test('Die allgemeine Straßenberechnung sendet keine Foto-Orte (nur die eigene Aktion)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  const toggle = page.getByTestId('online-toggle');
  test.skip(!/Supabase/.test((await toggle.locator('..').textContent()) ?? ''), 'Build ohne VITE_ROUTING_PROXY_URL');

  const bodies: { coordinates: number[][] }[] = [];
  await page.context().route(PROXY, async (route) => {
    const req = route.request();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = req.postDataJSON() as { coordinates: number[][] };
    bodies.push(body);
    return route.fulfill({ status: 200, headers: cors, json: { routes: [{ coordinates: body.coordinates, distanceM: 120_000, durationS: 5000 }], attribution: 'ORS' } });
  });

  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Bielefeld', /Bielefeld/);
  await page.getByTestId('photo-input').setInputFiles(FIX('photo-gps.jpg'));
  await expect(page.getByTestId('photo-item')).toHaveCount(1);
  // Erst jetzt Einwilligung: Der Näherungsabschnitt wird berechnet – ohne Foto-Ort
  await toggle.check();
  await expect.poll(() => bodies.length, { timeout: 15_000 }).toBe(1);
  expect(bodies[0]!.coordinates).toHaveLength(2);
  // Foto-Routing bleibt eine eigene, ausdrückliche Aktion
  await expect(page.getByTestId('photo-via-card')).toBeVisible();
});
