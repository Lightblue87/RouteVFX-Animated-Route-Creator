import { OPENFREEMAP } from './openfreemap';

/**
 * Prüft vor dem Export, ob der Online-Kartendienst antwortet (TileJSON abrufbar und plausibel).
 * Ohne diese Prüfung würde eine nicht ladbare Kartenquelle das Rendern blockieren (kein „idle“).
 */
export async function isOnlineMapReachable(fetchFn: typeof fetch = fetch, timeoutMs = 6000): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetchFn(OPENFREEMAP.tilejson, { signal: ac.signal, cache: 'no-store' });
    if (!r.ok) return false;
    const j = (await r.json()) as { tiles?: unknown };
    return Array.isArray(j.tiles) && j.tiles.length > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
