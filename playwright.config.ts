import { defineConfig, devices } from '@playwright/test';

// Für H.264-Export wird ein Chrome-Build mit proprietären Codecs benötigt (Chrome for Testing).
// Pfad über CHROME_PATH setzen; Playwrights Open-Source-Chromium kann kein H.264 encodieren.
const executablePath = process.env.CHROME_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 300_000,
  expect: { timeout: 30_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['Pixel 7'],
    launchOptions: {
      executablePath,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
    acceptDownloads: true,
  },
  webServer: { command: 'npx vite preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
});
