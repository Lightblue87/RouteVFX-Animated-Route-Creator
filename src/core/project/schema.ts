import { z } from 'zod';
import { MAX_DURATION_MS, MIN_DURATION_MS, ROUTE_CONFIDENCES, TRANSPORT_MODES } from '../types';

// Versioniertes, anbieterneutrales Projektmodell. Änderungen nur über Migrationen (migrations.ts).
export const CURRENT_SCHEMA_VERSION = 1;

export const GeoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  // Entfaltete Längengrade (Datumsgrenze) sind erlaubt, aber begrenzt.
  lon: z.number().min(-540).max(540),
  altitudeM: z.number().finite().optional(),
  time: z.string().datetime({ offset: true }).optional(),
});

export const LineStyleSchema = z.object({
  kind: z.enum(['progressive', 'full', 'dashed']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  widthPx: z.number().min(1).max(40),
});

export const RouteSegmentSchema = z.object({
  id: z.string().min(1),
  fromStopId: z.string().min(1),
  toStopId: z.string().min(1),
  mode: z.enum(TRANSPORT_MODES),
  via: z.array(GeoPointSchema),
  geometry: z.array(GeoPointSchema).min(2),
  geometryVersion: z.number().int().min(1),
  source: z.string(),
  confidence: z.enum(ROUTE_CONFIDENCES),
  distanceM: z.number().min(0),
  etaS: z.number().min(0).optional(),
  measuredTimeS: z.number().min(0).optional(),
  alternatives: z.array(z.object({ geometry: z.array(GeoPointSchema).min(2), distanceM: z.number().min(0), etaS: z.number().min(0).optional() })).default([]),
  selectedAlternative: z.number().int().min(0).default(0),
  manualDurationMs: z.number().int().min(200).optional(),
  lineStyle: LineStyleSchema,
  attribution: z.string().optional(),
  warnings: z.array(z.string()).default([]),
});

export const StopSchema = z.object({
  id: z.string().min(1),
  position: GeoPointSchema,
  label: z.string().max(80),
  pauseMs: z.number().int().min(0).max(10_000),
  showLabel: z.boolean().default(true),
  zoomIn: z.boolean().default(false),
});

export const AudioSettingsSchema = z.object({
  assetId: z.string().min(1),
  fileName: z.string().max(200),
  gain: z.number().min(0).max(2),
  fadeInMs: z.number().int().min(0).max(20_000),
  fadeOutMs: z.number().int().min(0).max(20_000),
  muted: z.boolean(),
});

/** Maximale Anzahl Fotos je Projekt (Speicher, Ladezeit beim Export). */
export const MAX_PHOTOS = 12;
export const PHOTO_HOLD_MIN_MS = 1000;
export const PHOTO_HOLD_MAX_MS = 6000;

/**
 * Eigenes Foto, das im Video erscheint, wenn das Fahrzeug an `position` vorbeikommt. Das Bild liegt als verkleinerte,
 * metadatenfreie Kopie im lokalen Blob-Speicher (assetId); im Projekt steht nur der gewählte Punkt, nicht der Rohstandort.
 * `position` null = noch nicht platziert (wird im Video nicht gezeigt).
 */
export const PhotoSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1),
  fileName: z.string().max(200),
  width: z.number().int().min(1).max(8192),
  height: z.number().int().min(1).max(8192),
  position: GeoPointSchema.nullable(),
  /** Woher der Punkt stammt: Geo-Tag des Fotos oder vom Nutzer gesetzt. */
  positionSource: z.enum(['exif', 'manual']).nullable().default(null),
  caption: z.string().max(80).default(''),
  holdMs: z.number().int().min(PHOTO_HOLD_MIN_MS).max(PHOTO_HOLD_MAX_MS).default(2500),
});

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  title: z.string().max(80),
  locale: z.enum(['de', 'en']),
  createdAt: z.string().datetime(),
  modifiedAt: z.string().datetime(),
  canvas: z.object({ aspect: z.literal('9:16') }),
  exportProfile: z.enum(['1080p30', '1080p60', '4k30', '4k60']),
  targetDurationMs: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS),
  timeMode: z.enum(['cinematic', 'proportional']),
  cameraPreset: z.enum(['overview', 'follow', 'follow-rotate']),
  mapStyleRef: z.string().min(1),
  vehicleColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  /** Darstellung des Fahrzeugs: Symbol (Badge) oder 2D-Illustration von oben. Fehlt bei älteren Projekten → Symbol. */
  vehicleStyle: z.enum(['symbol', 'figure']).default('symbol'),
  overlays: z.object({
    showTitle: z.boolean(),
    showDistance: z.boolean(),
    showProgress: z.boolean(),
    showModeChange: z.boolean(),
    showStopLabels: z.boolean(),
    showEstimateNotice: z.boolean(),
  }),
  journey: z.object({
    stops: z.array(StopSchema),
    segments: z.array(RouteSegmentSchema),
  }),
  audio: AudioSettingsSchema.optional(),
  photos: z.array(PhotoSchema).max(MAX_PHOTOS).default([]),
  privacy: z.object({ usedOnlineServices: z.boolean() }),
});

export type Project = z.infer<typeof ProjectSchema>;
export type Stop = z.infer<typeof StopSchema>;
export type RouteSegment = z.infer<typeof RouteSegmentSchema>;
export type LineStyle = z.infer<typeof LineStyleSchema>;
export type AudioSettings = z.infer<typeof AudioSettingsSchema>;
export type Photo = z.infer<typeof PhotoSchema>;

export const FADE_MAX_MS = 20_000;
/** Eingabe in Sekunden → gültige Fade-Dauer in ms (Schema-Bereich), ungültige Eingaben → 0. */
export function fadeMsFromSeconds(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(FADE_MAX_MS, Math.max(0, Math.round(v * 1000)));
}

/** Prüft Konsistenz über die reine Struktur hinaus (Segmente verbinden aufeinanderfolgende Stopps). */
export function validateJourney(p: Project): string[] {
  const errors: string[] = [];
  const { stops, segments } = p.journey;
  if (stops.length >= 2 && segments.length !== stops.length - 1) errors.push('segment_count_mismatch');
  segments.forEach((s, i) => {
    if (s.fromStopId !== stops[i]?.id || s.toStopId !== stops[i + 1]?.id) errors.push(`segment_${i}_not_connected`);
  });
  return errors;
}
