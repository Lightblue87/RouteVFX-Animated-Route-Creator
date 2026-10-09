import { test, expect, type Page } from '@playwright/test';

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

test('Linie bearbeiten: Karte bleibt beim Scrollen oben stehen und wird nicht überdeckt; ohne Bearbeitung scrollt sie normal weg', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Braunschweig', /Braunschweig/);
  await addPlace(page, 'Bielefeld', /Bielefeld/);
  await addPlace(page, 'Kassel', /Kassel/);
  await addPlace(page, 'Hamburg', /Hamburg/);
  await addPlace(page, 'Berlin', /Berlin/);
  await expect(page.getByTestId('segment')).toHaveCount(5);
  const map = page.getByTestId('planner-map');
  const body = page.locator('.tabbody');

  // Normal: Karte scrollt mit dem Inhalt weg
  const y0 = (await map.boundingBox())!.y;
  await body.evaluate((el) => el.scrollTo(0, 400));
  const scrolled = await body.evaluate((el) => el.scrollTop);
  expect(scrolled).toBeGreaterThan(100);
  expect((await map.boundingBox())!.y).toBeLessThan(y0 - 100);
  await body.evaluate((el) => el.scrollTo(0, 0));

  // Bearbeiten: Karte angeheftet, Hinweisleiste darunter, Liste scrollt darunter weg
  await page.getByTestId('segment-edit').first().click();
  await expect(map).toHaveClass(/editing/);
  await body.evaluate((el) => el.scrollTo(0, 600));
  await page.waitForTimeout(300);
  const box = (await map.boundingBox())!;
  const bodyBox = (await body.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(bodyBox.y - 1);
  expect(box.y).toBeLessThan(bodyBox.y + 12); // oben angeheftet
  const bar = (await page.getByTestId('edit-done').locator('..').boundingBox())!;
  expect(bar.y).toBeGreaterThanOrEqual(box.y + box.height - 1); // Leiste überlappt die Karte nicht
  // Zeichenfläche hat die neue Höhe (Karte wurde nach dem Moduswechsel angepasst)
  const canvas = (await page.locator('.planner-map canvas.maplibregl-canvas').boundingBox())!;
  expect(Math.abs(canvas.height - box.height)).toBeLessThan(4);

  // Fertig → wieder normal
  await page.getByTestId('edit-done').click();
  await expect(map).not.toHaveClass(/editing/);
});

test('Linie bearbeiten im Querformat: „Fertig“ bleibt erreichbar (Karte füllt nicht die ganze Fläche)', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Braunschweig', /Braunschweig/);
  await addPlace(page, 'Bielefeld', /Bielefeld/);
  await expect(page.getByTestId('segment')).toHaveCount(2);
  await page.getByTestId('segment-edit').first().click();
  const map = page.getByTestId('planner-map');
  await expect(map).toHaveClass(/editing/);
  const body = page.locator('.tabbody');
  // Karte darf nicht die gesamte Scrollfläche belegen und scrollt auf kurzen Bildschirmen normal mit
  const scrollH = (await body.boundingBox())!.height;
  const mapH = (await map.boundingBox())!.height;
  const barH = (await page.getByTestId('edit-done').locator('..').boundingBox())!.height;
  const sticky = await map.evaluate((el) => getComputedStyle(el).position === 'sticky');
  console.info(`Querformat: Scrollfläche ${scrollH}, Karte ${mapH}, Leiste ${barH}, sticky=${sticky}`);
  // Entweder scrollt die Karte normal mit, oder für Liste/Leiste bleibt mindestens ein Drittel der Fläche
  if (sticky) expect(scrollH - mapH - barH).toBeGreaterThan(scrollH / 3);
  await body.evaluate((el) => el.scrollTo(0, 300));
  await page.waitForTimeout(200);
  // Die Leiste klebt oben an der Scrollfläche (nicht auf halber Höhe über der Liste)
  const barBox = (await page.getByTestId('edit-done').locator('..').boundingBox())!;
  expect(barBox.y - (await body.boundingBox())!.y).toBeLessThan(8);
  // Normales Klicken (ohne force) muss gelingen – schlägt fehl, wenn die Karte die Leiste verdeckt
  await page.getByTestId('edit-done').click({ timeout: 5000 });
  await expect(map).not.toHaveClass(/editing/);
});
