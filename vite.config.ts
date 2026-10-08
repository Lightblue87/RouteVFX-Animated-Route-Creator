/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import react from '@vitejs/plugin-react';

// Strikte CSP nur im Produktions-Build (Dev-Server benötigt Inline-Skripte für HMR).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://routing.openstreetmap.de https://nominatim.openstreetmap.org",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

// Trägt alle gehashten Bundles in den Precache des Service Workers ein (Offline-Start nach Erstinstallation).
const swPrecachePlugin = (): Plugin => {
  let outDir = 'dist';
  return {
    name: 'sw-precache',
    apply: 'build',
    configResolved: (c) => {
      outDir = c.build.outDir;
    },
    writeBundle(_opts, bundle) {
      const assets = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/') && /\.(js|css)$/.test(f))
        .sort()
        .map((f) => `./${f}`);
      const buildId = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 12);
      const file = join(outDir, 'sw.js');
      const src = readFileSync(file, 'utf8');
      if (!src.includes('/*__BUILD_ASSETS__*/') || !src.includes('__BUILD_ID__')) throw new Error('sw.js placeholders missing');
      writeFileSync(file, src.replace('/*__BUILD_ASSETS__*/', assets.map((a) => JSON.stringify(a)).join(', ')).replace('__BUILD_ID__', buildId));
    },
  };
};

export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin(), swPrecachePlugin()],
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1500 },
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'tests/contracts/**/*.test.ts'],
  },
});
