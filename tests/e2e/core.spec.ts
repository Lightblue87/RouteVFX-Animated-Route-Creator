import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

test('Projekt bleibt nach Reload erhalten (lokal, ohne Konto)', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hanover/);
  await addPlace(page, 'Barcelona', /Barcelona/);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('title-input').fill('Reload-Test');
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);
  await page.reload();
  await expect(page.getByTestId('tab-route')).toBeVisible();
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await page.goto('/');
  await expect(page.getByText('Reload-Test')).toBeVisible();
});

test('GPX über die UI importieren; ungültige Datei wird abgelehnt ohne Absturz', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await page.getByTestId('gpx-input').setInputFiles({ name: 'bad.gpx', mimeType: 'application/gpx+xml', buffer: Buffer.from('<gpx><trk><name><script>alert(1)</script>') });
  await expect(page.getByRole('status').filter({ hasText: /GPX/ })).toContainText(/invalid_xml/);
  await page.getByTestId('gpx-input').setInputFiles('tests/fixtures/sample.gpx');
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Aufgezeichnet|Recorded/);
});

test('Export lässt sich abbrechen, Projekt bleibt unverändert', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hanover/);
  await addPlace(page, 'Barcelona', /Barcelona/);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await page.getByTestId('tab-export').click();
  await page.getByTestId('profile-1080p30').check();
  await page.getByTestId('export-start').click();
  await expect(page.getByTestId('export-progress')).toContainText(/Rendering frame|Rendere Frame/, { timeout: 60_000 });
  await page.getByTestId('export-cancel').click();
  await expect(page.getByTestId('export-error')).toContainText(/canceled|abgebrochen/i);
  await page.getByTestId('tab-route').click();
  await expect(page.getByTestId('segment')).toHaveCount(1);
});

test('Szenario 2: multimodal Hannover → HAJ → Barcelona → Palma als MP4', async ({ page }) => {
  test.setTimeout(900_000);
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hanover/);
  await addPlace(page, '52.4611, 9.6851', /52\.4611/);
  await addPlace(page, 'Barcelona', /Barcelona/);
  await addPlace(page, 'Palma', /Palma/);
  await expect(page.getByTestId('segment')).toHaveCount(3);
  await page.getByTestId('segment-mode').nth(1).selectOption('plane');
  await expect(page.getByTestId('segment-confidence').nth(1)).toHaveText(/Großkreis|great circle/i);
  await page.getByTestId('segment-mode').nth(2).selectOption('ship');
  await expect(page.getByTestId('segment-mode').nth(2)).toHaveValue('ship');
  await expect(page.getByTestId('segment-confidence').nth(2)).toHaveText(/Geschätzt|Estimated/);
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('title-input').fill('Hannover → Palma');
  await page.getByTestId('duration').fill('8');
  await page.getByText(/Follow \+ heading|Folgen \+ Fahrtrichtung/).click();
  await page.getByTestId('tab-export').click();
  await page.getByTestId('profile-1080p30').check();
  await page.getByTestId('export-start').click();
  await expect(page.getByTestId('export-result')).toBeVisible({ timeout: 840_000 });
  const download = page.waitForEvent('download');
  await page.getByTestId('export-download').click();
  mkdirSync('test-results', { recursive: true });
  const file = 'test-results/scenario2-multimodal.mp4';
  await (await download).saveAs(file);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,nb_frames:format=duration', '-of', 'json', file]).toString());
  writeFileSync('test-results/scenario2-multimodal.json', JSON.stringify(probe, null, 2));
  expect(probe.streams[0].codec_name).toBe('h264');
  expect(Number(probe.streams[0].nb_frames)).toBe(240);
});

test('Szenario 3 (Teil): geschätzte Schiffsroute per Ziehen korrigieren, Distanz folgt', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Barcelona', /Barcelona/);
  await addPlace(page, 'Palma', /Palma/);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await page.getByTestId('segment-mode').selectOption('ship');
  // Moduswechsel ist asynchron: warten, bis der Schiffsabschnitt tatsächlich übernommen ist
  await expect(page.getByTestId('segment-mode')).toHaveValue('ship');
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Geschätzt|Estimated/);
  const before = await page.getByTestId('segment').locator('span.small').first().textContent();
  await page.getByTestId('segment-edit').click();
  // erst ziehen, wenn die Karte geladen und auf die Route eingepasst ist
  await expect(page.getByTestId('planner-map')).toHaveAttribute('aria-busy', 'false');
  const box = (await page.getByTestId('planner-map').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy - 60, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Manuell|Manually/);
  const after = await page.getByTestId('segment').locator('span.small').first().textContent();
  expect(after).not.toBe(before);
  await page.getByTestId('edit-done').click();
});
