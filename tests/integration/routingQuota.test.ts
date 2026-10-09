import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// Führt alle echten Supabase-Migrationen in Reihenfolge in einem eingebetteten Postgres (PGlite) aus.
const DIR = join(__dirname, '../../supabase/migrations');
const MIGRATIONS = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort().map((f) => readFileSync(join(DIR, f), 'utf8'));

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role;');
  for (const m of MIGRATIONS) await db.exec(m);
  const take = async (k: string, per: number, glob: number, minute?: number) =>
    (await db.query<{ ok: boolean }>('select public.routing_take_quota($1, $2, $3, $4) as ok', [k, per, glob, minute ?? null])).rows[0]!.ok;
  return { db, take };
}

describe('Supabase-Migration: Routing-Kontingente', () => {
  it('enforces the per-client and the global daily limit', async () => {
    const { take } = await setup();
    const perClient = [];
    for (let i = 0; i < 4; i++) perClient.push(await take('a', 3, 10));
    expect(perClient).toEqual([true, true, true, false]);
    const global = [];
    for (let i = 0; i < 9; i++) global.push(await take(`k${i}`, 3, 10));
    expect(global.filter(Boolean)).toHaveLength(7); // 3 von „a“ + 7 = 10
  }, 30_000);
  it('purges counters older than 7 days (data minimisation)', async () => {
    const { db, take } = await setup();
    await db.exec(`insert into routing_usage values (current_date - 8, 'old', 5)`);
    await take('z', 3, 100);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from routing_usage where client_key = 'old'`)).rows[0]!.n).toBe(0);
  }, 30_000);
  it('only the service role may use the function; anon/authenticated cannot read the table', async () => {
    const { db } = await setup();
    const priv = async (sql: string) => (await db.query<{ x: boolean }>(sql)).rows[0]!.x;
    const fn = 'public.routing_take_quota(text,integer,integer,integer)';
    expect(await priv(`select has_function_privilege('anon', '${fn}', 'execute') as x`)).toBe(false);
    expect(await priv(`select has_function_privilege('authenticated', '${fn}', 'execute') as x`)).toBe(false);
    expect(await priv(`select has_function_privilege('service_role', '${fn}', 'execute') as x`)).toBe(true);
    expect(await priv(`select has_table_privilege('anon', 'public.routing_usage', 'select') as x`)).toBe(false);
    expect(await priv(`select has_table_privilege('anon', 'public.routing_recent', 'select') as x`)).toBe(false);
    expect(await priv(`select has_table_privilege('authenticated', 'public.routing_recent', 'select') as x`)).toBe(false);
  }, 30_000);

  it('enforces a rolling per-minute limit across all clients; rejected requests do not use up the daily quota', async () => {
    const { db, take } = await setup();
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await take(`c${i}`, 50, 1800, 3)); // verschiedene Clients, Minutenlimit 3
    expect(results).toEqual([true, true, true, false, false]);
    expect((await db.query<{ n: number }>('select coalesce(sum(count),0)::int as n from routing_usage')).rows[0]!.n).toBe(3);
    // gleitendes Fenster: Zeitstempel älter als 60 s zählen nicht mehr
    await db.exec(`update routing_recent set ts = now() - interval '61 seconds'`);
    expect(await take('c9', 50, 1800, 3)).toBe(true);
    // knapp innerhalb des Fensters zählt noch
    await db.exec(`update routing_recent set ts = now() - interval '59 seconds'`);
    expect(await take('c10', 50, 1800, 1)).toBe(false);
  }, 30_000);
  it('backwards compatible: the three-parameter call (older deployed function) works without a minute limit', async () => {
    const { db } = await setup();
    for (let i = 0; i < 6; i++) {
      const r = await db.query<{ ok: boolean }>('select public.routing_take_quota($1, $2, $3) as ok', [`k${i}`, 50, 1800]);
      expect(r.rows[0]!.ok).toBe(true);
    }
    const fns = await db.query<{ n: number }>(`select count(*)::int as n from pg_proc where proname = 'routing_take_quota'`);
    expect(fns.rows[0]!.n).toBe(1); // keine mehrdeutige Überladung
  }, 30_000);
  it('purges old minute timestamps (data minimisation)', async () => {
    const { db, take } = await setup();
    await db.exec(`insert into routing_recent values (now() - interval '11 minutes')`);
    await take('z', 50, 1800, 30);
    expect((await db.query<{ n: number }>('select count(*)::int as n from routing_recent')).rows[0]!.n).toBe(1);
  }, 30_000);
});
