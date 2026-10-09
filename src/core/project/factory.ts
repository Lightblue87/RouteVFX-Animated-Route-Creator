import { CURRENT_SCHEMA_VERSION, type LineStyle, type Project, type RouteSegment, type Stop } from './schema';
import type { GeoPoint, RoutingResult, TransportMode } from '../types';
import { lineLengthM } from '../geodesy';

export const newId = (): string => crypto.randomUUID();

export const MODE_COLORS: Record<TransportMode, string> = {
  car: '#0a84ff',
  motorcycle: '#5e5ce6',
  plane: '#ff375f',
  ship: '#30b0c7',
  train: '#ff9f0a',
  bike: '#30d158',
  walk: '#a2845e',
  bus: '#bf5af2',
};

export function defaultLineStyle(mode: TransportMode): LineStyle {
  return { kind: mode === 'plane' ? 'dashed' : 'progressive', color: MODE_COLORS[mode], widthPx: 6 };
}

export function createProject(locale: 'de' | 'en', title = ''): Project {
  const now = new Date().toISOString();
  return {
    id: newId(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    title,
    locale,
    createdAt: now,
    modifiedAt: now,
    canvas: { aspect: '9:16' },
    exportProfile: '1080p30',
    targetDurationMs: 15_000,
    timeMode: 'cinematic',
    cameraPreset: 'follow',
    mapStyleRef: 'ne-light',
    vehicleColor: '#ffffff',
    vehicleStyle: 'figure',
    overlays: {
      showTitle: true,
      showDistance: true,
      showProgress: true,
      showModeChange: true,
      showStopLabels: true,
      showEstimateNotice: true,
    },
    journey: { stops: [], segments: [] },
    privacy: { usedOnlineServices: false },
  };
}

export function createStop(position: GeoPoint, label: string): Stop {
  return { id: newId(), position: { lat: position.lat, lon: position.lon }, label: label.slice(0, 80), pauseMs: 600, showLabel: true, zoomIn: false };
}

export function segmentFromResult(from: Stop, to: Stop, mode: TransportMode, results: RoutingResult[], via: GeoPoint[] = []): RouteSegment {
  const [main, ...alts] = results;
  if (!main) throw new Error('no routing result');
  return {
    id: newId(),
    fromStopId: from.id,
    toStopId: to.id,
    mode,
    via,
    geometry: main.geometry,
    geometryVersion: 1,
    source: main.source,
    confidence: main.confidence,
    distanceM: main.distanceM || lineLengthM(main.geometry),
    etaS: main.etaS,
    alternatives: [main, ...alts].map((r) => ({ geometry: r.geometry, distanceM: r.distanceM, etaS: r.etaS })),
    selectedAlternative: 0,
    lineStyle: defaultLineStyle(mode),
    attribution: main.attribution,
    warnings: main.warnings,
  };
}
