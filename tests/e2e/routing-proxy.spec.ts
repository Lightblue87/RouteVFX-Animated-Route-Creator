import { test, expect, type Page } from '@playwright/test';

// Läuft nur mit einem Build, der VITE_ROUTING_PROXY_URL enthält (der Hinweis am Online-Schalter nennt dann Supabase):
//   VITE_ROUTING_PROXY_URL=https://<ref>.supabase.co/functions/v1/route npm run build && npx playwright test routing-proxy
// Die Function selbst wird simuliert (Sandbox erreicht supabase.co nicht); das Antwortformat entspricht dem
// echten Live-Test des Produktverantwortlichen (Hannover → Braunschweig, Auto, 68.488,5 m, 3.058,7 s).
const PROXY = /\/functions\/v1\/route$/;
const ATTRIBUTION = '© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors';

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

test('Online-Routing über den Supabase-Proxy: Anbieterroute mit Attribution, Fallback bei Fehlern', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  const toggle = page.getByTestId('online-toggle');
  test.skip(!/Supabase/.test((await toggle.locator('..').textContent()) ?? ''), 'Build ohne VITE_ROUTING_PROXY_URL');

  const requests: { origin: string | undefined; body: { mode: string; coordinates: number[][]; alternatives: boolean } }[] = [];
  let mode: 'ok' | 'quota' = 'ok';
  await page.context().route(PROXY, async (route) => {
    const req = route.request();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    requests.push({ origin: req.headers()['origin'], body: req.postDataJSON() });
    if (mode === 'quota') return route.fulfill({ status: 429, json: { error: 'quota' }, headers: cors });
    const [a, b] = req.postDataJSON().coordinates as number[][];
    return route.fulfill({
      status: 200,
      headers: cors,
      json: { routes: [{ coordinates: [a, [(a![0]! + b![0]!) / 2, (a![1]! + b![1]!) / 2 + 0.05], b], distanceM: 68488.5, durationS: 3058.7 }], attribution: ATTRIBUTION },
    });
  });

  // Ohne Zustimmung geht nichts an den Proxy: gekennzeichnete Schätzung
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Braunschweig', /Braunschweig/);
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Geschätzt|Estimated/);
  expect(requests).toEqual([]);

  // Mit Zustimmung: der bereits vorhandene Näherungsabschnitt wird nachträglich über den Proxy berechnet …
  await toggle.check();
  await expect.poll(() => requests.length, { timeout: 15_000 }).toBe(1);
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Anbieterroute|Provider route/);
  // … und ein neuer Abschnitt ebenfalls
  await addPlace(page, 'Bielefeld', /Bielefeld/);
  await expect(page.getByTestId('segment')).toHaveCount(2);
  await expect.poll(() => requests.length, { timeout: 15_000 }).toBe(2);
  expect(requests[0]!.body.mode).toBe('car');
  expect(requests[0]!.body.coordinates).toHaveLength(2);
  expect(requests[0]!.body.coordinates.flat().every((v) => typeof v === 'number')).toBe(true);
  const second = page.getByTestId('segment').nth(1);
  await expect(second.getByTestId('segment-confidence')).toHaveText(/Anbieterroute|Provider route/);
  await expect(second).toContainText('openrouteservice.org by HeiGIT');

  // Moduswechsel Fuß → neue Anfrage; Kontingent erschöpft (429) → gekennzeichnete Schätzung, Projekt bleibt benutzbar
  mode = 'quota';
  await second.getByTestId('segment-mode').selectOption('walk');
  await expect(second.getByTestId('segment-confidence')).toHaveText(/Geschätzt|Estimated/);
  expect(requests).toHaveLength(3);
  expect(requests[2]!.body.mode).toBe('walk');
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);
});

test('Hinweis-Karte: Straßenroute per Knopf, konkrete Fehlerursache, erneuter Versuch', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  const toggle = page.getByTestId('online-toggle');
  test.skip(!/Supabase/.test((await toggle.locator('..').textContent()) ?? ''), 'Build ohne VITE_ROUTING_PROXY_URL');

  let fail = true;
  let calls = 0;
  await page.context().route(PROXY, async (route) => {
    const req = route.request();
    const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    calls++;
    // Wie der Browser bei falscher Origin: Preflight ohne CORS-Header → Anfrage scheitert, kein lesbarer Body.
    if (fail) return route.abort('failed');
    const [a, b] = req.postDataJSON().coordinates as number[][];
    return route.fulfill({ status: 200, headers: cors, json: { routes: [{ coordinates: [a, [(a![0]! + b![0]!) / 2, (a![1]! + b![1]!) / 2 + 0.05], b], distanceM: 68488.5, durationS: 3058.7 }], attribution: ATTRIBUTION } });
  });

  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Braunschweig', /Braunschweig/);
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Geschätzt|Estimated/);
  expect(calls).toBe(0);

  // Hinweis mit Knopf; Klick erlaubt Online-Dienst und berechnet nach – hier mit möglicher Fehlerursache
  await page.getByTestId('compute-roads').click();
  await expect(toggle).toBeChecked();
  await expect(page.getByTestId('segment')).toContainText(/ROUTING_ALLOWED_ORIGINS/);
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Geschätzt|Estimated/);

  // Ursache behoben → erneuter Versuch liefert die Anbieterroute
  fail = false;
  await page.getByTestId('compute-roads').click();
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Anbieterroute|Provider route/);
  await expect(page.getByTestId('compute-roads')).toHaveCount(0);
});
