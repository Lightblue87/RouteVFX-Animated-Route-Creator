import { test, expect, type Page } from '@playwright/test';

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

test('Autosave: Änderung kurz vor „Zurück“ geht nicht verloren', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await page.getByTestId('tab-animate').click();
  // Tippen und im selben Task zur Startseite wechseln – sicher innerhalb des 500-ms-Debounce
  await page.getByTestId('title-input').evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, 'Sofort zurück');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => (location.hash = ''), 0);
  });
  await expect(page.getByTestId('create-project')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Sofort zurück')).toBeVisible();
});

test('Offline: App startet nach Erstinstallation ohne Netz, Projekt bleibt bearbeitbar', async ({ page, context }) => {
  const foreign: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://localhost:4173')) foreign.push(r.url());
  });
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hanover/);
  await addPlace(page, 'Barcelona', /Barcelona/);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('segment')).toHaveCount(1);
  // Bearbeiten offline: Verkehrsmittel ändern (lokale Näherung), Titel setzen
  await page.getByTestId('segment-mode').selectOption('plane');
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Großkreis|great circle/i);
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);

  await context.setOffline(false);
  await page.reload();
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Großkreis|great circle/i);
  expect(foreign).toEqual([]);
});

test('Langsam ladende Karte zeigt danach den aktuellen Stand (Route + Einpassen)', async ({ page, context }) => {
  // Kartendaten künstlich verzögern, damit Stopps und Moduswechsel vor dem Karten-„load“ passieren.
  // context.route statt page.route: MapLibre lädt GeoJSON im Web Worker.
  await context.route('**/geodata/countries.json', async (route) => {
    await new Promise((r) => setTimeout(r, 4000));
    await route.continue();
  });
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Barcelona', /Barcelona/);
  await addPlace(page, 'Palma', /Palma/);
  await page.getByTestId('segment-mode').selectOption('ship');
  await expect(page.getByTestId('segment-mode')).toHaveValue('ship');
  await expect(page.getByTestId('planner-map')).toHaveAttribute('aria-busy', 'true');
  await page.getByTestId('segment-edit').click();
  await expect(page.getByTestId('planner-map')).toHaveAttribute('aria-busy', 'false', { timeout: 20_000 });
  // Mittelpunkt der Linie liegt nach dem Einpassen in der Kartenmitte → Ziehen muss greifen
  const box = (await page.getByTestId('planner-map').boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 40, cy - 60, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Manuell|Manually/);
});

test('Projekt duplizieren und Original löschen – Kopie bleibt erhalten', async ({ page }) => {
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('title-input').fill('Original');
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);
  await page.getByRole('button', { name: /Zurück|Back/ }).click();
  await page.getByRole('listitem').filter({ hasText: 'Original' }).getByRole('button', { name: /Duplizieren|Duplicate/ }).click();
  await expect(page.getByText('Original (2)')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: /^Original\b(?! \(2\))/ }).getByRole('button', { name: /Löschen|Delete/ }).click();
  await page.reload();
  await expect(page.getByText('Original (2)')).toBeVisible();
  await expect(page.getByRole('listitem')).toHaveCount(1);
});

test('Undo nach Stopp hinzufügen nimmt Stopp und berechnetes Segment gemeinsam zurück; Redo stellt beides her', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hannover|Hanover/);
  await addPlace(page, 'Barcelona', /Barcelona/);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await addPlace(page, 'Palma', /Palma/);
  await expect(page.getByTestId('segment')).toHaveCount(2);
  const undo = page.getByRole('button', { name: /Rückgängig|Undo/ });
  const redo = page.getByRole('button', { name: /Wiederholen|Redo/ });
  await undo.click();
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await expect(redo).toBeEnabled();
  // Kein erneutes automatisches Berechnen, das die Redo-Historie löscht
  await page.waitForTimeout(500);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await expect(redo).toBeEnabled();
  await redo.click();
  await expect(page.getByTestId('segment')).toHaveCount(2);
});

test('Autosave: Speichern wird beim Verlassen abgebrochen (Reload) – Änderung kommt aus dem Journal zurück', async ({ page }) => {
  // Simuliert den Abbruch der noch offenen IndexedDB-Transaktion beim Neuladen: Der erste Schreibvorgang mit dem
  // neuen Titel wird verschluckt (kein Erfolg, kein Fehler). Ohne synchrones Journal wäre die Änderung verloren.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('swallowed')) return; // nach dem Reload nicht erneut verschlucken
    let done = false;
    const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (!done && this.name === 'projects' && (value as { title?: string }).title === 'Sofort zurück') {
        done = true;
        sessionStorage.setItem('swallowed', '1');
        return new Promise(() => {}) as unknown as IDBRequest; // Anfrage, die nie abgeschlossen wird (idb awaitet sie)
      }
      return orig.call(this, value, key);
    };
  });
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('title-input').evaluate((el: HTMLInputElement) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    setter.call(el, 'Sofort zurück');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => (location.hash = ''), 0);
  });
  await expect(page.getByTestId('create-project')).toBeVisible();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('swallowed'))).toBe('1');
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('arc.journal.v1.')).length)).toBe(1);
  await page.reload();
  await expect(page.getByText('Sofort zurück')).toBeVisible();
  // eingespielt und Journal aufgeräumt; auch nach weiterem Reload vorhanden
  await expect.poll(() => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('arc.journal.v1.')).length)).toBe(0);
  await page.reload();
  await expect(page.getByText('Sofort zurück')).toBeVisible();
});

test('Autosave: Seite wird beendet, während das verzögerte Speichern noch läuft – Journal sichert den Stand', async ({ page }) => {
  // Das Speichern nach dem 500-ms-Debounce hängt (wird nie bestätigt), dann verlässt der Nutzer den Editor und lädt neu.
  await page.addInitScript(() => {
    if (sessionStorage.getItem('swallowed')) return; // nach dem Reload normal speichern
    const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
      if (this.name === 'projects' && (value as { title?: string }).title === 'Läuft noch') {
        sessionStorage.setItem('swallowed', '1'); // in diesem Seitenleben bleiben alle Schreibvorgänge dieses Stands offen
        return new Promise(() => {}) as unknown as IDBRequest;
      }
      return orig.call(this, value, key);
    };
  });
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('title-input').fill('Läuft noch');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('swallowed')), { timeout: 10_000 }).toBe('1'); // Debounce hat ausgelöst, Schreiben hängt
  await page.getByRole('button', { name: /Zurück|Back/ }).click();
  await expect(page.getByTestId('create-project')).toBeVisible();
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('arc.journal.v1.')).length)).toBe(1);
  await page.reload();
  await expect(page.getByText('Läuft noch')).toBeVisible();
});

