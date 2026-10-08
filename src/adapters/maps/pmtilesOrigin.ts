/**
 * Origin der selbst gehosteten PMTiles-Datei für die CSP (connect-src). Relative URLs liegen gleich-originig
 * ('self' genügt → null). Nur HTTPS bzw. http://localhost für lokale Tests – keine beliebigen Schemata.
 * Wird von vite.config.ts zur Build-Zeit genutzt; ungültige Werte brechen den Build ab.
 */
export function pmtilesOrigin(url: string | undefined): string | null {
  const raw = url?.trim();
  if (!raw || !/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  const u = new URL(raw);
  const local = u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  if (u.protocol !== 'https:' && !local) throw new Error(`VITE_PMTILES_URL must use https: ${raw}`);
  return u.origin;
}
