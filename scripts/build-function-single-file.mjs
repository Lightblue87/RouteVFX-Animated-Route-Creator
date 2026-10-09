// Erzeugt eine Einzeldatei-Version der Edge Function „route“ zum Einfügen im Supabase-Dashboard-Editor.
// Quelle bleibt supabase/functions/route/{handler,index}.ts; tests/unit/functionSingleFile.test.ts prüft Gleichstand.
import { readFileSync, writeFileSync } from 'node:fs';

export function buildSingleFile() {
  const handler = readFileSync('supabase/functions/route/handler.ts', 'utf8');
  const index = readFileSync('supabase/functions/route/index.ts', 'utf8').replace("import { handleRoute } from './handler.ts';\n", '');
  return [
    '// AUTOMATISCH ERZEUGT – nicht von Hand ändern. Quelle: supabase/functions/route/handler.ts + index.ts',
    '// Neu erzeugen: npm run build:function-single-file',
    '// Zum Einfügen in den Supabase-Dashboard-Editor (Edge Functions → route → index.ts).',
    '',
    handler.trimEnd(),
    '',
    '// ---- Einstieg (index.ts) ----',
    index.trimEnd(),
    '',
  ].join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync('docs/supabase/route-function-single-file.ts', buildSingleFile());
  console.log('docs/supabase/route-function-single-file.ts geschrieben');
}
