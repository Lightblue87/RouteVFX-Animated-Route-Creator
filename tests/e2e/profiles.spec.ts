import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

// Messlauf für höhere Profile (nur wenn PROFILES gesetzt, z. B. PROFILES=1080p60,4k30,4k60).
const PROFILES = (process.env.PROFILES ?? '').split(',').filter(Boolean);
const SECONDS = Math.max(3, Number(process.env.SECONDS_PER_EXPORT ?? 3)); // Regler-Minimum 3 s

for (const profile of PROFILES) {
  test(`Export ${profile} (${SECONDS} s)`, async ({ page }) => {
    test.setTimeout(1_500_000);
    await page.goto('/');
    await page.getByTestId('create-project').click();
    for (const [q, r] of [['Hannover', /Hanover/], ['Barcelona', /Barcelona/]] as const) {
      await page.getByTestId('place-search').fill(q);
      await page.getByTestId('place-result').filter({ hasText: r }).first().click();
    }
    await expect(page.getByTestId('segment')).toHaveCount(1);
    await page.getByTestId('tab-animate').click();
    await page.getByTestId('duration').fill(String(SECONDS));
    await page.getByTestId('tab-export').click();
    await page.getByTestId(`profile-${profile}`).check();
    const t0 = Date.now();
    await page.getByTestId('export-start').click();
    await expect(page.getByTestId('export-result')).toBeVisible({ timeout: 1_400_000 });
    const elapsedMs = Date.now() - t0;
    const download = page.waitForEvent('download');
    await page.getByTestId('export-download').click();
    mkdirSync('test-results', { recursive: true });
    const file = `test-results/profile-${profile}.mp4`;
    await (await download).saveAs(file);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,profile,width,height,avg_frame_rate,nb_frames:format=duration', '-of', 'json', file]).toString());
    writeFileSync(`test-results/profile-${profile}.json`, JSON.stringify({ elapsedMs, probe }, null, 2));
    expect(probe.streams[0].codec_name).toBe('h264');
  });
}
