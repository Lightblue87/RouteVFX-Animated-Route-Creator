import { z } from 'zod';
import { lineLengthM } from '../../core/geodesy';
import { RoutingError, type RoutingProvider, type RoutingRequest, type RoutingResult, type TransportMode } from '../../core/types';

/**
 * OSRM-kompatibler Adapter (Standard: FOSSGIS-Demoserver routing.openstreetmap.de).
 * Status: implementiert, NICHT live verifiziert (Sandbox blockiert den Host; Nutzungsbedingungen E05 offen).
 * Nur nach ausdrücklichem Opt-in des Nutzers verwenden (Datenübertragung an Drittanbieter).
 */
const OsrmResponse = z.object({
  code: z.string(),
  message: z.string().optional(),
  routes: z
    .array(
      z.object({
        distance: z.number(),
        duration: z.number(),
        geometry: z.object({ type: z.literal('LineString'), coordinates: z.array(z.tuple([z.number(), z.number()])).min(2) }),
      }),
    )
    .optional(),
});

const PROFILE: Partial<Record<TransportMode, { path: string; profile: string }>> = {
  car: { path: 'routed-car', profile: 'driving' },
  motorcycle: { path: 'routed-car', profile: 'driving' },
  bike: { path: 'routed-bike', profile: 'cycling' },
  walk: { path: 'routed-foot', profile: 'foot' },
};

export const OSRM_ATTRIBUTION = 'Routing: OSRM / FOSSGIS · © OpenStreetMap contributors (ODbL)';

export function createOsrmProvider(baseUrl = 'https://routing.openstreetmap.de', fetchImpl: typeof fetch = (...a) => fetch(...a)): RoutingProvider {
  let lastCall = 0;
  return {
    id: 'osrm-fossgis',
    supportedModes: ['car', 'motorcycle', 'bike', 'walk'],
    requiresNetwork: true,
    async route(req: RoutingRequest, signal?: AbortSignal): Promise<RoutingResult[]> {
      const prof = PROFILE[req.mode];
      if (!prof) throw new RoutingError('unsupported_mode', req.mode);
      // Client-seitige Drosselung: höchstens 1 Anfrage pro Sekunde.
      const wait = lastCall + 1000 - Date.now();
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      // Nach der Wartezeit: Wurde die Anfrage inzwischen abgebrochen (z. B. Einwilligung widerrufen), nichts senden.
      if (signal?.aborted) throw new RoutingError('aborted', 'aborted');
      lastCall = Date.now();
      const coords = [req.start, ...req.via, req.end].map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
      const url = `${baseUrl}/${prof.path}/route/v1/${prof.profile}/${coords}?overview=full&geometries=geojson&alternatives=${req.alternatives ? 'true' : 'false'}`;
      let res: Response;
      try {
        res = await fetchImpl(url, { signal });
      } catch (e) {
        if ((e as Error).name === 'AbortError') throw new RoutingError('aborted', 'aborted');
        throw new RoutingError('network', (e as Error).message);
      }
      if (res.status === 429) throw new RoutingError('rate_limited', 'HTTP 429');
      if (!res.ok) throw new RoutingError('network', `HTTP ${res.status}`);
      const parsed = OsrmResponse.safeParse(await res.json());
      if (!parsed.success) throw new RoutingError('invalid_response', parsed.error.message);
      if (parsed.data.code !== 'Ok' || !parsed.data.routes?.length) throw new RoutingError('no_route', parsed.data.message ?? parsed.data.code);
      const warnings = req.mode === 'motorcycle' ? ['motorcycle_uses_car_profile'] : [];
      return parsed.data.routes.map((r) => {
        const geometry = r.geometry.coordinates.map(([lon, lat]) => ({ lat, lon }));
        return {
          geometry,
          distanceM: r.distance || lineLengthM(geometry),
          etaS: r.duration,
          source: 'osrm-fossgis',
          confidence: 'provider_verified' as const,
          attribution: OSRM_ATTRIBUTION,
          warnings,
        };
      });
    },
  };
}
