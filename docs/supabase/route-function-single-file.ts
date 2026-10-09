// AUTOMATISCH ERZEUGT – nicht von Hand ändern. Quelle: supabase/functions/route/handler.ts + index.ts
// Neu erzeugen: npm run build:function-single-file
// Zum Einfügen in den Supabase-Dashboard-Editor (Edge Functions → route → index.ts).

/**
 * Routing-Proxy zu openrouteservice (ORS). Laufzeitneutral (nur Web-APIs), damit er in Deno (Supabase Edge
 * Function, siehe index.ts) läuft und in Vitest getestet werden kann.
 *
 * Warum ein Proxy: Laut ORS-FAQ darf ein HeiGIT-API-Schlüssel nicht clientseitig verwendet werden; Anfragen sollen
 * serverseitig gestellt werden (github.com/GIScience/openrouteservice docs/frequently-asked-questions.md).
 *
 * Schutz gegen Missbrauch/Kosten: Origin-Allowlist, Kill-Switch, Tages-Kontingent je Client (täglich wechselnder
 * IP-Hash) und gesamt (unter dem ORS-Tageslimit). Koordinaten werden weder gespeichert noch geloggt.
 */

export type Mode = 'car' | 'motorcycle' | 'bike' | 'walk';

export const ORS_PROFILE: Record<Mode, string> = {
  car: 'driving-car',
  motorcycle: 'driving-car', // ORS hat kein Motorradprofil – der Client kennzeichnet das (motorcycle_uses_car_profile)
  bike: 'cycling-regular',
  walk: 'foot-walking',
};

export interface ProxyEnv {
  orsApiKey: string;
  /** Kommagetrennte Liste erlaubter Origins, z. B. „https://lightblue87.github.io,http://localhost:4173“. */
  allowedOrigins: string;
  /** Nur bei „true“ aktiv – Kill-Switch. */
  enabled: string;
  perClientDaily: number;
  globalDaily: number;
  /** Geheimes Salz für den IP-Hash. */
  quotaSalt: string;
  /** Basis-URL der ORS-API; Standard: neue HeiGIT-Adresse (api.openrouteservice.org wird abgeschaltet). */
  orsBaseUrl?: string;
}

export interface ProxyDeps {
  fetch: typeof fetch;
  /** Zieht ein Kontingent; true = erlaubt. */
  takeQuota: (clientKey: string, perClient: number, global: number) => Promise<boolean>;
  now?: () => Date;
}

export interface RouteRequestBody {
  mode: Mode;
  /** [lon, lat] je Punkt, Start … Ziel, 2–5 Punkte. */
  coordinates: [number, number][];
  alternatives?: boolean;
}

export interface ProxyRoute {
  coordinates: [number, number][];
  distanceM: number;
  durationS: number;
}

export const MAX_BODY_BYTES = 4096;
export const MAX_POINTS = 5;
// HeiGIT stellt api.openrouteservice.org ein (Dashboard-Hinweis + Forum „Deprecating api.openrouteservice.org in
// favour of api.heigit.org“, 2026); neues Schema api.heigit.org/<dienst>/<version>/.
export const ORS_DEFAULT_BASE_URL = 'https://api.heigit.org/openrouteservice';
const ORS_TIMEOUT_MS = 15_000;

export function parseBody(raw: unknown): RouteRequestBody | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (typeof b.mode !== 'string' || !(b.mode in ORS_PROFILE)) return null;
  if (!Array.isArray(b.coordinates) || b.coordinates.length < 2 || b.coordinates.length > MAX_POINTS) return null;
  const coordinates: [number, number][] = [];
  for (const c of b.coordinates) {
    if (!Array.isArray(c) || c.length !== 2) return null;
    const [lon, lat] = c as unknown[];
    if (typeof lon !== 'number' || typeof lat !== 'number' || !Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null;
    coordinates.push([lon, lat]);
  }
  if (b.alternatives !== undefined && typeof b.alternatives !== 'boolean') return null;
  return { mode: b.mode as Mode, coordinates, alternatives: b.alternatives === true };
}

export function allowedOrigin(origin: string | null, allowList: string): string | null {
  if (!origin) return null;
  const list = allowList.split(',').map((s) => s.trim()).filter(Boolean);
  return list.includes(origin) ? origin : null;
}

/** Täglich wechselnder, gesalzener Hash der Client-IP – nicht über Tage verknüpfbar. */
export async function clientKey(ip: string, salt: string, now: Date): Promise<string> {
  const data = new TextEncoder().encode(`${now.toISOString().slice(0, 10)}|${salt}|${ip}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}

const positiveInt = (v: number, d: number) => (Number.isInteger(v) && v > 0 ? v : d);

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('cf-connecting-ip') ?? 'unknown').trim();
}

function json(status: number, body: unknown, origin: string | null): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function handleRoute(req: Request, env: ProxyEnv, deps: ProxyDeps): Promise<Response> {
  const origin = allowedOrigin(req.headers.get('origin'), env.allowedOrigins);
  if (req.method === 'OPTIONS') {
    if (!origin) return new Response(null, { status: 403 });
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'content-type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
      },
    });
  }
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if (!origin) return json(403, { error: 'origin_not_allowed' }, null);
  if (env.enabled !== 'true' || !env.orsApiKey || !env.quotaSalt) return json(503, { error: 'disabled' }, origin);

  const len = Number(req.headers.get('content-length') ?? '0');
  if (len > MAX_BODY_BYTES) return json(413, { error: 'too_large' }, origin);
  let raw: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { error: 'too_large' }, origin);
    raw = JSON.parse(text);
  } catch {
    return json(400, { error: 'invalid_request' }, origin);
  }
  const body = parseBody(raw);
  if (!body) return json(400, { error: 'invalid_request' }, origin);

  const key = await clientKey(clientIp(req), env.quotaSalt, deps.now?.() ?? new Date());
  let allowed: boolean;
  try {
    allowed = await deps.takeQuota(key, positiveInt(env.perClientDaily, 50), positiveInt(env.globalDaily, 1800));
  } catch {
    // Ohne funktionierende Kontingentprüfung keine Weiterleitung (fail closed).
    return json(503, { error: 'quota_unavailable' }, origin);
  }
  if (!allowed) return json(429, { error: 'quota' }, origin);

  const orsBody: Record<string, unknown> = { coordinates: body.coordinates, instructions: false };
  // ORS berechnet Alternativen nur für Start/Ziel ohne Zwischenpunkte.
  if (body.alternatives && body.coordinates.length === 2) orsBody.alternative_routes = { target_count: 2, weight_factor: 1.6 };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ORS_TIMEOUT_MS);
  let res: Response;
  try {
    res = await deps.fetch(`${(env.orsBaseUrl || ORS_DEFAULT_BASE_URL).replace(/\/+$/, '')}/v2/directions/${ORS_PROFILE[body.mode]}/geojson`, {
      method: 'POST',
      headers: { Authorization: env.orsApiKey, 'Content-Type': 'application/json', Accept: 'application/geo+json' },
      body: JSON.stringify(orsBody),
      signal: ac.signal,
    });
  } catch {
    return json(502, { error: 'upstream_unreachable' }, origin);
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) return json(429, { error: 'rate_limited' }, origin);
  if (res.status === 403) return json(503, { error: 'upstream_quota' }, origin);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return json(502, { error: 'upstream_invalid' }, origin);
  }
  if (!res.ok) {
    const code = (data as { error?: { code?: number } })?.error?.code;
    if (code === 2009 || code === 2010) return json(422, { error: 'no_route' }, origin);
    return json(502, { error: 'upstream' }, origin);
  }
  const routes = toRoutes(data);
  if (!routes) return json(502, { error: 'upstream_invalid' }, origin);
  return json(200, { routes, attribution: ORS_ATTRIBUTION }, origin);
}

export const ORS_ATTRIBUTION = '© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors';

/** Reduziert die ORS-GeoJSON-Antwort auf das Nötige (keine Anweisungen, keine Metadaten mit Anfragedaten). */
export function toRoutes(data: unknown): ProxyRoute[] | null {
  const features = (data as { features?: unknown })?.features;
  if (!Array.isArray(features) || features.length === 0) return null;
  const out: ProxyRoute[] = [];
  for (const f of features) {
    const coords = (f as { geometry?: { type?: string; coordinates?: unknown } })?.geometry;
    const summary = (f as { properties?: { summary?: { distance?: unknown; duration?: unknown } } })?.properties?.summary;
    if (coords?.type !== 'LineString' || !Array.isArray(coords.coordinates) || coords.coordinates.length < 2) return null;
    const line: [number, number][] = [];
    for (const c of coords.coordinates) {
      if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') return null;
      line.push([c[0], c[1]]);
    }
    out.push({
      coordinates: line,
      distanceM: typeof summary?.distance === 'number' ? summary.distance : 0,
      durationS: typeof summary?.duration === 'number' ? summary.duration : 0,
    });
  }
  return out;
}

// ---- Einstieg (index.ts) ----
// Supabase Edge Function „route“ (Deno). Logik in handler.ts; hier nur Umgebung und Datenbank-Anbindung.
// Secrets (supabase secrets set …): ORS_API_KEY, ROUTING_ALLOWED_ORIGINS, ROUTING_ENABLED, ROUTING_QUOTA_SALT,
// optional ROUTING_PER_CLIENT_DAILY (Standard 50), ROUTING_GLOBAL_DAILY (Standard 1800, unter dem ORS-Limit 2000),
// ORS_BASE_URL (Standard https://api.heigit.org/openrouteservice).
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.

const env = (k: string, d = '') => Deno.env.get(k) ?? d;

async function takeQuota(clientKey: string, perClient: number, global: number): Promise<boolean> {
  const res = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/routing_take_quota`, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_key: clientKey, p_per_key: perClient, p_global: global }),
  });
  if (!res.ok) throw new Error(`quota rpc ${res.status}`);
  return (await res.json()) === true;
}

Deno.serve(async (req) => {
  const res = await handleRoute(
    req,
    {
      orsApiKey: env('ORS_API_KEY'),
      allowedOrigins: env('ROUTING_ALLOWED_ORIGINS'),
      enabled: env('ROUTING_ENABLED', 'false'),
      perClientDaily: Number(env('ROUTING_PER_CLIENT_DAILY', '50')),
      globalDaily: Number(env('ROUTING_GLOBAL_DAILY', '1800')),
      quotaSalt: env('ROUTING_QUOTA_SALT'),
      orsBaseUrl: env('ORS_BASE_URL'),
    },
    { fetch, takeQuota },
  );
  // Nur Status loggen – keine Koordinaten, keine IP.
  console.log(`route ${req.method} -> ${res.status}`);
  return res;
});
