import { greatCircle, haversineM, lineLengthM } from '../../core/geodesy';
import { RoutingError, type RoutingProvider, type RoutingRequest, type RoutingResult, type TransportMode } from '../../core/types';

/** Flug: geodätische Großkreisgeometrie. Keine Aussage über real geflogene Strecke. */
export const greatCircleProvider: RoutingProvider = {
  id: 'local-great-circle',
  supportedModes: ['plane'],
  requiresNetwork: false,
  async route(req: RoutingRequest): Promise<RoutingResult[]> {
    const pts = [req.start, ...req.via, req.end];
    const geometry = pts.slice(1).flatMap((p, i) => {
      const d = haversineM(pts[i]!, p);
      const seg = greatCircle(pts[i]!, p, Math.max(8, Math.min(256, Math.round(d / 20_000))));
      return i === 0 ? seg : seg.slice(1);
    });
    return [{
      geometry,
      distanceM: lineLengthM(geometry),
      source: 'local-great-circle',
      confidence: 'derived',
      warnings: ['great_circle_not_real_flight_path'],
    }];
  },
};

/**
 * Gekennzeichnete Näherung für Modi ohne verifizierte Datenquelle (Schiff, Bahn, Bus, oder Fallback).
 * Großkreis zwischen den Punkten; Land/Wasser-Kollision wird NICHT geprüft.
 */
export const estimatedProvider: RoutingProvider = {
  id: 'local-estimate',
  supportedModes: ['car', 'motorcycle', 'plane', 'ship', 'train', 'bike', 'walk', 'bus'],
  requiresNetwork: false,
  async route(req: RoutingRequest): Promise<RoutingResult[]> {
    const [r] = await greatCircleProvider.route({ ...req, mode: 'plane' });
    const warnings = ['estimated_geometry'];
    if (req.mode === 'ship') warnings.push('ship_land_collision_unchecked');
    if (req.mode === 'train' || req.mode === 'bus') warnings.push('no_transit_geometry');
    return [{ ...r!, source: 'local-estimate', confidence: 'estimated', warnings }];
  },
};

export function assertSupported(p: RoutingProvider, mode: TransportMode): void {
  if (!p.supportedModes.includes(mode)) throw new RoutingError('unsupported_mode', `${p.id} does not support ${mode}`);
}
