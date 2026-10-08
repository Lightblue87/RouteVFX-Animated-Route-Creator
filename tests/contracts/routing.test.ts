import { describe, expect, it, vi } from 'vitest';
import { createOsrmProvider } from '../../src/adapters/routing/osrm';
import { routeSegment } from '../../src/adapters/routing/registry';
import { estimatedProvider, greatCircleProvider } from '../../src/adapters/routing/local';
import { RoutingError, type RoutingProvider } from '../../src/core/types';
import { BARCELONA, HANNOVER, PALMA } from '../fixtures/project';

// Antwortform nach OSRM-HTTP-API v5 (route service). Nicht live aufgezeichnet – Sandbox blockiert den Host.
const OSRM_OK = {
  code: 'Ok',
  routes: [
    { distance: 1000, duration: 100, geometry: { type: 'LineString', coordinates: [[9.73, 52.37], [9.74, 52.38]] } },
    { distance: 1200, duration: 130, geometry: { type: 'LineString', coordinates: [[9.73, 52.37], [9.735, 52.39], [9.74, 52.38]] } },
  ],
};
const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

function contract(p: RoutingProvider) {
  it(`${p.id}: results have ≥2 finite points, distance ≥ 0, known confidence`, async () => {
    const mode = p.supportedModes[0]!;
    const res = await p.route({ start: HANNOVER, end: BARCELONA, via: [], mode });
    expect(res.length).toBeGreaterThan(0);
    for (const r of res) {
      expect(r.geometry.length).toBeGreaterThanOrEqual(2);
      for (const g of r.geometry) expect(Number.isFinite(g.lat) && Number.isFinite(g.lon)).toBe(true);
      expect(r.distanceM).toBeGreaterThanOrEqual(0);
      expect(['provider_verified', 'imported_recorded', 'derived', 'estimated', 'manually_edited']).toContain(r.confidence);
    }
  });
}

describe('routing provider contracts', () => {
  contract(greatCircleProvider);
  contract(estimatedProvider);
  contract(createOsrmProvider('https://example.invalid', () => json(OSRM_OK)));

  it('OSRM maps alternatives, attribution and lon/lat order', async () => {
    const fetchMock = vi.fn(() => json(OSRM_OK));
    const p = createOsrmProvider('https://x.test', fetchMock as unknown as typeof fetch);
    const r = await p.route({ start: HANNOVER, end: BARCELONA, via: [], mode: 'bike', alternatives: true });
    expect(r).toHaveLength(2);
    expect(r[0]!.geometry[0]).toEqual({ lat: 52.37, lon: 9.73 });
    expect(r[0]!.confidence).toBe('provider_verified');
    expect(r[0]!.attribution).toMatch(/OpenStreetMap/);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/routed-bike/route/v1/cycling/9.716700,52.367000;2.181400,41.385200');
  });
  it('OSRM flags motorcycle as car profile', async () => {
    const p = createOsrmProvider('https://x.test', () => json(OSRM_OK));
    const r = await p.route({ start: HANNOVER, end: BARCELONA, via: [], mode: 'motorcycle' });
    expect(r[0]!.warnings).toContain('motorcycle_uses_car_profile');
  });
  it('OSRM error mapping: 429, NoRoute, invalid body, unsupported mode', async () => {
    const err = async (f: () => Promise<unknown>) => { try { await f(); return 'none'; } catch (e) { return (e as RoutingError).code; } };
    expect(await err(() => createOsrmProvider('https://x', () => json({}, 429)).route({ start: HANNOVER, end: BARCELONA, via: [], mode: 'car' }))).toBe('rate_limited');
    expect(await err(() => createOsrmProvider('https://x', () => json({ code: 'NoRoute' })).route({ start: HANNOVER, end: PALMA, via: [], mode: 'car' }))).toBe('no_route');
    expect(await err(() => createOsrmProvider('https://x', () => json({ code: 'Ok', routes: [{ foo: 1 }] })).route({ start: HANNOVER, end: PALMA, via: [], mode: 'car' }))).toBe('invalid_response');
    expect(await err(() => createOsrmProvider('https://x', () => json(OSRM_OK)).route({ start: HANNOVER, end: PALMA, via: [], mode: 'ship' }))).toBe('unsupported_mode');
  });
  it('registry never calls online provider without opt-in and labels fallback as estimated', async () => {
    const fetchMock = vi.fn(() => json(OSRM_OK));
    const online = createOsrmProvider('https://x', fetchMock as unknown as typeof fetch);
    const r = await routeSegment({ start: HANNOVER, end: BARCELONA, via: [], mode: 'car' }, { onlineAllowed: false, online });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(r.results[0]!.confidence).toBe('estimated');
    expect(r.fallbackReason).toBe('online_routing_disabled');
  });
  it('registry falls back to labelled estimate on network failure', async () => {
    const online = createOsrmProvider('https://x', () => Promise.reject(new TypeError('Failed to fetch')));
    const r = await routeSegment({ start: HANNOVER, end: BARCELONA, via: [], mode: 'walk' }, { onlineAllowed: true, online });
    expect(r.results[0]!.confidence).toBe('estimated');
    expect(r.fallbackReason).toBe('network');
  });
  it('ship estimate carries land-collision warning; plane is derived', async () => {
    const ship = await routeSegment({ start: BARCELONA, end: PALMA, via: [], mode: 'ship' }, { onlineAllowed: true });
    expect(ship.results[0]!.warnings).toContain('ship_land_collision_unchecked');
    const plane = await routeSegment({ start: HANNOVER, end: BARCELONA, via: [], mode: 'plane' }, { onlineAllowed: false });
    expect(plane.results[0]!.confidence).toBe('derived');
  });
});
