import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';

const FIX = (n: string) => join(process.cwd(), 'tests/fixtures', n);

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

/** Anzahl deckender Pixel im Foto-Bereich der Vorschau (logische Koordinaten 540×960). */
async function cardPixels(page: Page): Promise<number> {
  return page.getByTestId('preview-canvas').evaluate((c: HTMLCanvasElement) => {
    const k = c.width / 540;
    const d = c.getContext('2d')!.getImageData(Math.round(180 * k), Math.round(280 * k), Math.round(180 * k), Math.round(140 * k)).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]! > 200) n++;
    return n;
  });
}

test('Fotos: Geo-Tag wird als Punkt übernommen, ohne Geo-Tag per Karte setzen, Foto erscheint im Video, bleibt nach Reload und Kopie', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Bielefeld', /Bielefeld/);
  await expect(page.getByTestId('segment')).toHaveCount(1);

  // Zwei Fotos: eines mit Geo-Tag (Hannover), eines ohne
  await page.getByTestId('photo-input').setInputFiles([FIX('photo-gps.jpg'), FIX('photo-nogps.jpg')]);
  await expect(page.getByTestId('photo-item')).toHaveCount(2);
  const sources = page.getByTestId('photo-source');
  await expect(sources.nth(0)).toContainText(/Geo-Tag|geotag/);
  await expect(sources.nth(1)).toContainText(/Noch ohne Punkt|No point yet/);
  // Kein Standort/EXIF in der gespeicherten Kopie
  const hasExif = await page.evaluate(
    () =>
      new Promise<boolean>((resolve, reject) => {
        const open = indexedDB.open('arc-local');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('blobs').objectStore('blobs').getAll();
          all.onsuccess = async () => {
            let found = false;
            for (const b of all.result as { blob: Blob }[]) {
              const buf = new Uint8Array(await b.blob.slice(0, 4096).arrayBuffer());
              const text = new TextDecoder('latin1').decode(buf);
              if (text.includes('Exif') || text.includes('GPS')) found = true;
            }
            resolve(found);
          };
        };
      }),
  );
  expect(hasExif).toBe(false);

  // Punkt für das zweite Foto per Tipp auf die Karte
  await page.getByTestId('photo-pick').nth(1).click();
  await expect(page.getByTestId('planner-map')).toHaveClass(/picking/);
  const stopsBefore = await page.getByTestId('segment').count();
  await page.getByTestId('planner-map').click({ position: { x: 120, y: 120 } });
  await expect(sources.nth(1)).toContainText(/von dir gesetzt|set by you/);
  await expect(page.getByTestId('planner-map')).not.toHaveClass(/picking/);
  expect(await page.getByTestId('segment').count()).toBe(stopsBefore); // das Tippen hat keinen Stopp angelegt

  // Foto erscheint im Video, wenn das Fahrzeug vorbeikommt
  const when = await page.getByTestId('photo-panel').getByText(/Erscheint nach etwa|Appears about/).first().textContent();
  const sec = Number(/([\d.]+) s/.exec(when ?? '')![1]);
  await page.getByTestId('tab-animate').click();
  const scrub = page.getByTestId('scrub');
  const max = Number(await scrub.getAttribute('max'));
  expect(sec * 1000).toBeLessThan(max);
  await scrub.fill(String(Math.min(max, Math.round((sec + 1.2) * 1000 / 10) * 10)));
  await expect.poll(() => cardPixels(page), { timeout: 10_000 }).toBeGreaterThan(5000);
  await scrub.fill('0');
  await expect.poll(() => cardPixels(page)).toBeLessThan(500);

  // bleibt nach Reload erhalten
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);
  await page.reload();
  await page.getByTestId('tab-route').click();
  await expect(page.getByTestId('photo-item')).toHaveCount(2);
  await expect.poll(async () => page.getByTestId('photo-item').first().locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  // Kopie des Projekts enthält die Fotos samt Bilddaten und überlebt das Löschen des Originals
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: /Zurück|Back/ }).click();
  await page.getByRole('listitem').first().getByRole('button', { name: /Duplizieren|Duplicate/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(2);
  const original = page.getByRole('listitem').filter({ hasNotText: /\(2\)/ });
  await original.getByRole('button', { name: /Löschen|Delete/ }).click();
  await expect(page.getByRole('listitem')).toHaveCount(1);
  await page.getByRole('listitem').first().getByRole('button').first().click();
  await expect(page.getByTestId('photo-item')).toHaveCount(2);
  await expect.poll(async () => page.getByTestId('photo-item').first().locator('img').evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);

  // Entfernen
  await page.getByTestId('photo-remove').first().click();
  await expect(page.getByTestId('photo-item')).toHaveCount(1);
});

test('Fotos: ungültige Dateien werden abgelehnt, das Projekt bleibt benutzbar', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await page.getByTestId('photo-input').setInputFiles({ name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByTestId('photo-message')).toContainText(/nicht unterstützt|not supported/);
  // Kein Bild (Dateikopf passt zu keinem Bildtyp), obwohl der MIME-Typ „image/jpeg“ behauptet wird
  await page.getByTestId('photo-input').setInputFiles({ name: 'kaputt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('das ist kein bild') });
  await expect(page.getByTestId('photo-message')).toContainText(/nicht unterstützt|not supported/);
  // Gültiger JPEG-Kopf, aber abgeschnittene/zerstörte Bilddaten: nicht lesbar
  const { readFileSync } = await import('node:fs');
  const cut = readFileSync(FIX('photo-nogps.jpg')).subarray(0, 220);
  await page.getByTestId('photo-input').setInputFiles({ name: 'abgeschnitten.jpg', mimeType: 'image/jpeg', buffer: cut });
  await expect(page.getByTestId('photo-message')).toContainText(/nicht gelesen|could not be read/);
  await expect(page.getByTestId('photo-item')).toHaveCount(0);
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);
});

test('Fotos: gültiges JPEG ohne MIME-Typ wird angenommen; übergroße Pixelangabe wird vor dem Dekodieren abgelehnt', async ({ page }) => {
  const { readFileSync } = await import('node:fs');
  const jpg = readFileSync(FIX('photo-gps.jpg'));
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await page.getByTestId('photo-input').setInputFiles({ name: 'IMG_0001', mimeType: '', buffer: jpg });
  await expect(page.getByTestId('photo-item')).toHaveCount(1);
  await expect(page.getByTestId('photo-source')).toContainText(/Geo-Tag|geotag/);

  // SOF auf 12000×9000 setzen (108 MP): wird anhand des Kopfes abgelehnt, ohne dass ein Bild dekodiert wird
  const big = Buffer.from(jpg);
  for (let i = 2; i + 9 < big.length; i++) {
    if (big[i] === 0xff && big[i + 1] === 0xc0) {
      big.writeUInt16BE(9000, i + 5);
      big.writeUInt16BE(12000, i + 7);
      break;
    }
  }
  await page.getByTestId('photo-input').setInputFiles({ name: 'riesig.jpg', mimeType: 'image/jpeg', buffer: big });
  await expect(page.getByTestId('photo-message')).toContainText(/zu viele Pixel|too many pixels/);
  await expect(page.getByTestId('photo-item')).toHaveCount(1);
});
