// Anbieterneutrale Kerntypen. Koordinaten intern immer WGS84, Distanzen in Metern, Editorzeit in Millisekunden.

export interface GeoPoint {
  lat: number;
  lon: number;
  altitudeM?: number;
  /** Echter Messzeitpunkt (ISO-8601, UTC) – nur aus Aufzeichnung/Import, niemals erfunden. */
  time?: string;
}

export const TRANSPORT_MODES = ['car', 'motorcycle', 'plane', 'ship', 'train', 'bike', 'walk', 'bus'] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const ROUTE_CONFIDENCES = ['provider_verified', 'imported_recorded', 'derived', 'estimated', 'manually_edited'] as const;
export type RouteConfidence = (typeof ROUTE_CONFIDENCES)[number];

export interface RoutingRequest {
  start: GeoPoint;
  end: GeoPoint;
  via: GeoPoint[];
  mode: TransportMode;
  alternatives?: boolean;
}

export interface RoutingResult {
  geometry: GeoPoint[];
  distanceM: number;
  etaS?: number;
  source: string;
  confidence: RouteConfidence;
  attribution?: string;
  warnings: string[];
}

export interface RoutingProvider {
  id: string;
  supportedModes: readonly TransportMode[];
  /** true, wenn der Provider Daten an einen Drittanbieter überträgt (Opt-in nötig). */
  requiresNetwork: boolean;
  route(request: RoutingRequest, signal?: AbortSignal): Promise<RoutingResult[]>;
}

export class RoutingError extends Error {
  constructor(
    public readonly code: 'network' | 'no_route' | 'unsupported_mode' | 'rate_limited' | 'invalid_response' | 'aborted' | 'disabled',
    message: string,
    /** Optionale Ursache des Anbieters/Proxys (z. B. „origin_not_allowed“), für verständliche Hinweise. */
    public readonly detail?: string,
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

export type ExportProfileId = '1080p30' | '1080p60' | '4k30' | '4k60';

export interface ExportProfile {
  id: ExportProfileId;
  width: number;
  height: number;
  fps: 30 | 60;
}

export const EXPORT_PROFILES: Record<ExportProfileId, ExportProfile> = {
  '1080p30': { id: '1080p30', width: 1080, height: 1920, fps: 30 },
  '1080p60': { id: '1080p60', width: 1080, height: 1920, fps: 60 },
  '4k30': { id: '4k30', width: 2160, height: 3840, fps: 30 },
  '4k60': { id: '4k60', width: 2160, height: 3840, fps: 60 },
};

export interface ExportCapability {
  profile: ExportProfileId;
  available: boolean;
  reason?: string;
}

export const MAX_DURATION_MS = 180_000;
export const MIN_DURATION_MS = 1_000;
