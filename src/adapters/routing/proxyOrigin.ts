/**
 * Origin der Routing-Proxy-URL für die CSP (connect-src). Nur https (bzw. http://localhost für lokale Tests);
 * ungültige Werte brechen den Build ab. Wird von vite.config.ts zur Build-Zeit genutzt.
 */
export function proxyOrigin(url: string | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  const u = new URL(raw);
  const local = u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  if (u.protocol !== 'https:' && !local) throw new Error(`VITE_ROUTING_PROXY_URL must use https: ${raw}`);
  return u.origin;
}
