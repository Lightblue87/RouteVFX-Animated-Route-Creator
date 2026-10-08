import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

// Führt die echte Supabase-Migration in einem eingebetteten Postgres (PGlite) aus.
const MIGRATION = readFileSync(join(__dirname, '../../supabase/migrations/20261008220000_routing_quota.sql'), 'utf8');

async function setup() {
  const db = new PGlite();
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(MIGRATION);
  const take = async (k: string, per: number, glob: number) =>
    (await db.query<{ ok: boolean }>('select public.routing_take_quota($1, $2, $3) as ok', [k, per, glob])).rows[0]!.ok;
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
    expect(await priv(`select has_function_privilege('anon', 'public.routing_take_quota(text,integer,integer)', 'execute') as x`)).toBe(false);
    expect(await priv(`select has_function_privilege('authenticated', 'public.routing_take_quota(text,integer,integer)', 'execute') as x`)).toBe(false);
    expect(await priv(`select has_function_privilege('service_role', 'public.routing_take_quota(text,integer,integer)', 'execute') as x`)).toBe(true);
    expect(await priv(`select has_table_privilege('anon', 'public.routing_usage', 'select') as x`)).toBe(false);
  }, 30_000);
});
