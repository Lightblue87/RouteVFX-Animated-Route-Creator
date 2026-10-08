import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

async function addPlace(page: Page, query: string, pick: RegExp) {
  await page.getByTestId('place-search').fill(query);
  await page.getByTestId('place-result').filter({ hasText: pick }).first().click();
}

function ffprobe(file: string) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,width,height,r_frame_rate,avg_frame_rate,nb_frames,profile:format=duration,format_name', '-of', 'json', file]);
  return JSON.parse(out.toString());
}

test('Hannover → Barcelona (Flug) als 1080p30-MP4 exportieren', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('create-project').click();
  await addPlace(page, 'Hannover', /Hanover/);
  await addPlace(page, 'Barcelona', /Barcelona/);
  await expect(page.getByTestId('segment')).toHaveCount(1);
  await page.getByTestId('segment-mode').selectOption('plane');
  await expect(page.getByTestId('segment-confidence')).toHaveText(/Großkreis|great circle/i);

  await page.getByTestId('tab-animate').click();
  await page.getByTestId('title-input').fill('Hannover → Barcelona');
  await page.getByTestId('duration').fill('4');
  await expect(page.getByTestId('save-state')).toHaveText(/Gespeichert|Saved/);

  await page.getByTestId('tab-export').click();
  await expect(page.getByTestId('profile-1080p30')).toBeEnabled();
  await page.getByTestId('profile-1080p30').check();
  const t0 = Date.now();
  await page.getByTestId('export-start').click();
  await expect(page.getByTestId('export-result')).toBeVisible({ timeout: 240_000 });
  const elapsed = Date.now() - t0;
  const summary = await page.getByTestId('export-summary').textContent();
  const download = page.waitForEvent('download');
  await page.getByTestId('export-download').click();
  const file = 'test-results/hannover-barcelona-1080p30.mp4';
  mkdirSync('test-results', { recursive: true });
  await (await download).saveAs(file);
  const probe = ffprobe(file);
  writeFileSync('test-results/hannover-barcelona-1080p30.json', JSON.stringify({ elapsedMs: elapsed, summary, probe }, null, 2));
  const v = probe.streams.find((s: { codec_type: string }) => s.codec_type === 'video');
  expect(v.codec_name).toBe('h264');
  expect(v.width).toBe(1080);
  expect(v.height).toBe(1920);
  expect(v.avg_frame_rate).toBe('30/1');
  expect(Number(v.nb_frames)).toBe(120);
  expect(Math.abs(Number(probe.format.duration) - 4)).toBeLessThan(0.1);
});
