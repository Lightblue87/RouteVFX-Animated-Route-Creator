import { z } from 'zod';
import { lineLengthM } from '../../core/geodesy';
import { RoutingError, type GeoPoint, type RoutingProvider, type RoutingRequest, type RoutingResult } from '../../core/types';

/**
 * Routing über den eigenen Proxy (Supabase Edge Function „route“, supabase/functions/route) zu openrouteservice.
 * Der ORS-Schlüssel liegt nur im Proxy (ORS-FAQ: Schlüssel nicht clientseitig verwenden).
 * Übertragen werden nur Verkehrsmittel und Koordinaten von Start/Wegpunkten/Ziel (6 Nachkommastellen).
 */
const ProxyResponse = z.object({
  routes: z
    .array(
      z.object({
        coordinates: z.array(z.tuple([z.number(), z.number()])).min(2),
        distanceM: z.number().nonnegative(),
        durationS: z.number().nonnegative(),
      }),
    )
    .min(1),
  attribution: z.string(),
});

export const ORS_ATTRIBUTION = '© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors';
const MAX_POINTS = 5;
const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

export function createOrsProxyProvider(proxyUrl: string, fetchImpl: typeof fetch = (...a) => fetch(...a)): RoutingProvider {
  let lastCall = 0;
  return {
    id: 'ors-proxy',
    supportedModes: ['car', 'motorcycle', 'bike', 'walk'],
    requiresNetwork: true,
    async route(req: RoutingRequest, signal?: AbortSignal): Promise<RoutingResult[]> {
      if (!this.supportedModes.includes(req.mode)) throw new RoutingError('unsupported_mode', req.mode);
      const points = [req.start, ...req.via, req.end];
      if (points.length > MAX_POINTS) throw new RoutingError('invalid_response', 'too_many_points');
      // Alternativrouten haben beim Anbieter ein deutlich kleineres Distanzlimit als die Hauptroute. Lehnt er die Anfrage
      // mit Alternativen ab, wird einmal ohne Alternativen wiederholt (Hauptroute statt gerader Näherung).
      try {
        return await send(req, points, !!req.alternatives, signal);
      } catch (e) {
        if (req.alternatives && e instanceof RoutingError && (e.detail === 'upstream' || e.detail === 'too_long')) return send(req, points, false, signal);
        throw e;
      }
    },
  };

  async function send(req: RoutingRequest, points: GeoPoint[], alternatives: boolean, signal?: AbortSignal): Promise<RoutingResult[]> {
    // Client-seitige Drosselung: höchstens 1 Anfrage pro Sekunde (schont das gemeinsame Tageskontingent).
    const wait = lastCall + 1000 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    // Nach der Wartezeit: Wurde die Anfrage inzwischen abgebrochen (z. B. Einwilligung widerrufen), nichts senden.
    if (signal?.aborted) throw new RoutingError('aborted', 'aborted');
    lastCall = Date.now();
    let res: Response;
    try {
      res = await fetchImpl(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: req.mode, coordinates: points.map((p) => [round6(p.lon), round6(p.lat)]), alternatives }),
        signal,
      });
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new RoutingError('aborted', 'aborted');
      // Eine vom Browser blockierte Antwort (CORS, z. B. bei falscher ROUTING_ALLOWED_ORIGINS) ist von „offline“ nicht zu
      // unterscheiden – der Hinweis nennt deshalb beide möglichen Ursachen.
      throw new RoutingError('network', (e as Error).message, 'cors_or_offline');
    }
    if (!res.ok) {
      // Der Proxy nennt die Ursache als { error: "<code>" } – nur bekannte Kürzel übernehmen.
      const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
      const detail = typeof body?.error === 'string' && /^[a-z_]{1,32}$/.test(body.error) ? body.error : undefined;
      if (res.status === 429) throw new RoutingError('rate_limited', 'HTTP 429', detail);
      if (res.status === 422) throw new RoutingError('no_route', 'no route', detail);
      if (res.status === 503) throw new RoutingError('disabled', 'routing proxy disabled or upstream quota exhausted', detail);
      throw new RoutingError('network', `HTTP ${res.status}`, detail);
    }
    const parsed = ProxyResponse.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw new RoutingError('invalid_response', parsed.error.message);
    const warnings = req.mode === 'motorcycle' ? ['motorcycle_uses_car_profile'] : [];
    return parsed.data.routes.map((r) => {
      const geometry = r.coordinates.map(([lon, lat]) => ({ lat, lon }));
      return {
        geometry,
        distanceM: r.distanceM || lineLengthM(geometry),
        etaS: r.durationS || undefined,
        source: 'openrouteservice',
        confidence: 'provider_verified' as const,
        attribution: ORS_ATTRIBUTION,
        warnings,
      };
    });
  }
}
