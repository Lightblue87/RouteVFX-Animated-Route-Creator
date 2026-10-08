import { describe, expect, it, vi } from 'vitest';
import { clientKey, handleRoute, parseBody, type ProxyEnv } from '../../supabase/functions/route/handler';
import { createOrsProxyProvider, ORS_ATTRIBUTION } from '../../src/adapters/routing/orsProxy';
import { createOnlineRoutingProvider } from '../../src/adapters/routing/config';
import { proxyOrigin } from '../../src/adapters/routing/proxyOrigin';
import { RoutingError } from '../../src/core/types';

const APP = 'https://app.example';
const ENV: ProxyEnv = { orsApiKey: 'secret-key', allowedOrigins: `${APP}, http://localhost:4173`, enabled: 'true', perClientDaily: 50, globalDaily: 1800, quotaSalt: 'salt' };
const BODY = { mode: 'bike', coordinates: [[9.7167, 52.367], [10.52, 52.27]], alternatives: true };
const ORS_OK = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[9.7167, 52.367], [10.0, 52.3], [10.52, 52.27]] }, properties: { summary: { distance: 65000, duration: 14000 }, segments: [{ steps: [] }] } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[9.7167, 52.367], [10.52, 52.27]] }, properties: { summary: { distance: 70000, duration: 15000 } } },
  ],
  metadata: { query: { coordinates: 'echo' } },
};
const res = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const post = (body: unknown, origin: string | null = APP, ip = '203.0.113.7') =>
  new Request('https://proj.supabase.co/functions/v1/route', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}), 'x-forwarded-for': `${ip}, 10.0.0.1` } });

function deps(orsResponse: () => Promise<Response> = async () => res(ORS_OK), allow = true) {
  const fetch = vi.fn((_url: string | URL | Request, _init?: RequestInit) => orsResponse());
  const takeQuota = vi.fn(async () => allow);
  return { fetch: fetch as unknown as typeof globalThis.fetch, takeQuota, calls: fetch, quota: takeQuota };
}

describe('Routing-Proxy (Supabase Edge Function, Handler)', () => {
  it('forwards a valid request to ORS with the server-side key and returns only geometry + summary', async () => {
    const d = deps();
    const r = await handleRoute(post(BODY), ENV, d);
    expect(r.status).toBe(200);
    expect(r.headers.get('access-control-allow-origin')).toBe(APP);
    const [url, init] = d.calls.mock.calls[0]!;
    expect(url).toBe('https://api.openrouteservice.org/v2/directions/cycling-regular/geojson');
    expect((init!.headers as Record<string, string>).Authorization).toBe('secret-key');
    expect(JSON.parse(init!.body as string)).toEqual({ coordinates: BODY.coordinates, instructions: false, alternative_routes: { target_count: 2, weight_factor: 1.6 } });
    const out = await r.json();
    expect(out.routes).toHaveLength(2);
    expect(out.routes[0]).toEqual({ coordinates: ORS_OK.features[0]!.geometry.coordinates, distanceM: 65000, durationS: 14000 });
    expect(JSON.stringify(out)).not.toContain('secret-key');
    expect(JSON.stringify(out)).not.toContain('echo'); // keine ORS-Metadaten/Anfrage-Echo
    expect(out.attribution).toBe(ORS_ATTRIBUTION);
  });
  it('rejects foreign origins, other methods, and answers CORS preflight only for allowed origins', async () => {
    const d = deps();
    expect((await handleRoute(post(BODY, 'https://evil.example'), ENV, d)).status).toBe(403);
    expect((await handleRoute(post(BODY, null), ENV, d)).status).toBe(403);
    expect((await handleRoute(new Request('https://x/route', { method: 'GET', headers: { origin: APP } }), ENV, d)).status).toBe(405);
    const pre = await handleRoute(new Request('https://x/route', { method: 'OPTIONS', headers: { origin: 'http://localhost:4173' } }), ENV, d);
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-methods')).toContain('POST');
    expect((await handleRoute(new Request('https://x/route', { method: 'OPTIONS', headers: { origin: 'https://evil.example' } }), ENV, d)).status).toBe(403);
    expect(d.calls).not.toHaveBeenCalled();
  });
  it('kill switch: disabled unless ROUTING_ENABLED=true and key + salt are set', async () => {
    for (const env of [{ ...ENV, enabled: 'false' }, { ...ENV, orsApiKey: '' }, { ...ENV, quotaSalt: '' }]) {
      const d = deps();
      expect((await handleRoute(post(BODY), env, d)).status).toBe(503);
      expect(d.calls).not.toHaveBeenCalled();
    }
  });
  it('validates input strictly (mode, 2–5 points, coordinate ranges, body size)', async () => {
    expect(parseBody(BODY)).not.toBeNull();
    for (const bad of [
      { ...BODY, mode: 'ship' },
      { ...BODY, coordinates: [[9, 52]] },
      { ...BODY, coordinates: Array.from({ length: 6 }, () => [9, 52]) },
      { ...BODY, coordinates: [[200, 52], [9, 52]] },
      { ...BODY, coordinates: [[9, 'x'], [9, 52]] },
      { ...BODY, alternatives: 'yes' },
      null,
    ]) expect(parseBody(bad)).toBeNull();
    const d = deps();
    expect((await handleRoute(post({ ...BODY, mode: 'ship' }), ENV, d)).status).toBe(400);
    expect((await handleRoute(new Request('https://x/route', { method: 'POST', body: 'not json', headers: { origin: APP } }), ENV, d)).status).toBe(400);
    expect((await handleRoute(post({ ...BODY, pad: 'x'.repeat(5000) }), ENV, d)).status).toBe(413);
    expect(d.calls).not.toHaveBeenCalled();
  });
  it('enforces quotas before calling ORS and fails closed if the quota check errors', async () => {
    const d = deps(undefined, false);
    expect((await handleRoute(post(BODY), ENV, d)).status).toBe(429);
    expect(d.calls).not.toHaveBeenCalled();
    expect(d.quota).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{32}$/), 50, 1800);
    const broken = { fetch: d.fetch, takeQuota: async () => { throw new Error('db down'); } };
    expect((await handleRoute(post(BODY), ENV, broken)).status).toBe(503);
  });
  it('does not request alternatives when via points are present (ORS limitation)', async () => {
    const d = deps();
    await handleRoute(post({ ...BODY, coordinates: [[9.7, 52.3], [10.0, 52.3], [10.5, 52.2]] }), ENV, d);
    expect(JSON.parse(d.calls.mock.calls[0]![1]!.body as string).alternative_routes).toBeUndefined();
  });
  it('maps ORS errors: no route → 422, rate limit → 429, daily quota → 503, other/invalid → 502, unreachable → 502', async () => {
    const cases: [() => Promise<Response>, number][] = [
      [async () => res({ error: { code: 2009, message: 'Route could not be found' } }, 404), 422],
      [async () => res({ error: { code: 2010 } }, 404), 422],
      [async () => res({}, 429), 429],
      [async () => res({}, 403), 503],
      [async () => res({ error: { code: 2099 } }, 500), 502],
      [async () => res({ features: [] }), 502],
      [async () => { throw new TypeError('fetch failed'); }, 502],
    ];
    for (const [r, status] of cases) expect((await handleRoute(post(BODY), ENV, deps(r))).status).toBe(status);
  });
  it('client key: salted, changes daily, does not contain the IP', async () => {
    const a = await clientKey('203.0.113.7', 'salt', new Date('2026-10-08T10:00:00Z'));
    const b = await clientKey('203.0.113.7', 'salt', new Date('2026-10-09T10:00:00Z'));
    const c = await clientKey('203.0.113.7', 'other', new Date('2026-10-08T10:00:00Z'));
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toContain('203');
  });
});

describe('ORS-Proxy-Adapter (Client)', () => {
  const H = { lat: 52.367, lon: 9.7167 }, B = { lat: 52.27, lon: 10.52 };
  it('sends mode + rounded [lon,lat] points and maps routes to provider_verified results with attribution', async () => {
    const fetchMock = vi.fn(async () => res({ routes: [{ coordinates: [[9.7167, 52.367], [10.52, 52.27]], distanceM: 65000, durationS: 14000 }], attribution: ORS_ATTRIBUTION }));
    const p = createOrsProxyProvider('https://proj.supabase.co/functions/v1/route', fetchMock as unknown as typeof fetch);
    const r = await p.route({ start: { lat: 52.3670000001, lon: 9.7167 }, end: B, via: [], mode: 'motorcycle', alternatives: true });
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({ mode: 'motorcycle', coordinates: [[9.7167, 52.367], [10.52, 52.27]], alternatives: true });
    expect(r[0]).toMatchObject({ distanceM: 65000, etaS: 14000, source: 'openrouteservice', confidence: 'provider_verified', attribution: ORS_ATTRIBUTION });
    expect(r[0]!.geometry[0]).toEqual({ lat: 52.367, lon: 9.7167 });
    expect(r[0]!.warnings).toContain('motorcycle_uses_car_profile');
  });
  it('maps proxy errors to RoutingError codes (labelled fallback in the registry)', async () => {
    const err = async (status: number, body: unknown = {}) => {
      const p = createOrsProxyProvider('https://x', (async () => res(body, status)) as unknown as typeof fetch);
      try { await p.route({ start: H, end: B, via: [], mode: 'car' }); return 'none'; } catch (e) { return (e as RoutingError).code; }
    };
    expect(await err(429)).toBe('rate_limited');
    expect(await err(422)).toBe('no_route');
    expect(await err(503)).toBe('disabled');
    expect(await err(500)).toBe('network');
    expect(await err(200, { routes: [] })).toBe('invalid_response');
  });
  it('rejects unsupported modes without a request', async () => {
    const fetchMock = vi.fn();
    const p = createOrsProxyProvider('https://x', fetchMock as unknown as typeof fetch);
    await expect(p.route({ start: H, end: B, via: [], mode: 'ship' })).rejects.toMatchObject({ code: 'unsupported_mode' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('uses the proxy when configured, otherwise the FOSSGIS OSRM prototype', () => {
    expect(createOnlineRoutingProvider('https://proj.supabase.co/functions/v1/route').id).toBe('ors-proxy');
    expect(createOnlineRoutingProvider('').id).toBe('osrm-fossgis');
  });
  it('CSP origin of the proxy URL: https only', () => {
    expect(proxyOrigin(undefined)).toBeNull();
    expect(proxyOrigin('https://proj.supabase.co/functions/v1/route')).toBe('https://proj.supabase.co');
    expect(() => proxyOrigin('http://proj.supabase.co/functions/v1/route')).toThrow();
  });
});
