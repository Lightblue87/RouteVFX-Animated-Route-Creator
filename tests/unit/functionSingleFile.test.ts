import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error – Node-Skript ohne Typdeklaration
import { buildSingleFile } from '../../scripts/build-function-single-file.mjs';

it('dashboard single-file version of the edge function is in sync with the sources', () => {
  const committed = readFileSync('docs/supabase/route-function-single-file.ts', 'utf8');
  expect(committed, 'npm run build:function-single-file ausführen').toBe(buildSingleFile());
  expect(committed).not.toContain("from './handler.ts'");
  expect(committed).toContain('Deno.serve(');
});
