import type { Project, RouteSegment, LineStyle } from '../project/schema';
import type { GeoPoint, RouteConfidence, TransportMode } from '../types';
import {
  alongLine, boundsOf, fitCamera, indexLine, latFromMercatorY, lonFromMercatorX, mercatorX, mercatorY, sliceLine, unwrapLongitudes, type LineIndex,
} from '../geodesy';
import { ease, phaseAt, planTimeline, type TimelinePlan } from '../timeline';

/** Logischer Viewport (CSS-Pixel). Export skaliert per pixelRatio, damit Framing auflösungsunabhängig bleibt. */
export const LOGICAL_VIEWPORT = { width: 540, height: 960 } as const;
const SAFE_PADDING = { top: 190, bottom: 210, left: 50, right: 50 };

export interface CameraState {
  center: GeoPoint;
  zoom: number;
  bearing: number;
  pitch: number;
}

export interface SceneLine {
  segmentIndex: number;
  mode: TransportMode;
  style: LineStyle;
  confidence: RouteConfidence;
  drawn: GeoPoint[];
  full: GeoPoint[];
}

export interface SceneState {
  tMs: number;
  totalMs: number;
  camera: CameraState;
  lines: SceneLine[];
  vehicle: { position: GeoPoint; headingDeg: number; mode: TransportMode } | null;
  stops: { position: GeoPoint; label: string; reached: boolean; isActive: boolean }[];
  distanceDoneM: number;
  distanceTotalM: number;
  progress: number;
  title: string;
  modeChange: { mode: TransportMode; opacity: number } | null;
  /** Hinweis auf nicht-verifizierte Geometrie im aktuellen Abschnitt. */
  geometryNotice: 'estimated' | 'derived' | 'manually_edited' | null;
}

/** Vorberechnetes, unveränderliches Modell. Reine Funktion von Project. */
export interface SceneModel {
  project: Project;
  plan: TimelinePlan;
  segments: { seg: RouteSegment; geometry: GeoPoint[]; index: LineIndex }[];
  overview: CameraState;
  segmentZoom: number[];
  distanceTotalM: number;
}

function selectedGeometry(s: RouteSegment): GeoPoint[] {
  const alt = s.alternatives[s.selectedAlternative];
  return alt && s.selectedAlternative > 0 ? alt.geometry : s.geometry;
}

export function buildSceneModel(project: Project): SceneModel {
  const plan = planTimeline(project);
  // Gesamte Reise fortlaufend entfalten (Datumsgrenze): Offset des vorigen Endpunkts übernehmen.
  let lastLon: number | null = null;
  const segments = project.journey.segments.map((seg) => {
    const raw = selectedGeometry(seg);
    let offset = 0;
    if (lastLon !== null) {
      offset = Math.round((lastLon - raw[0]!.lon) / 360) * 360;
    }
    const geometry = unwrapLongitudes(raw, offset);
    lastLon = geometry[geometry.length - 1]!.lon;
    return { seg, geometry, index: indexLine(geometry) };
  });
  const all = segments.flatMap((s) => s.geometry);
  const stopsPts = project.journey.stops.map((s) => s.position);
  const pts = all.length ? all : stopsPts.length ? stopsPts : [{ lat: 50, lon: 10 }];
  const ov = fitCamera(boundsOf(pts), LOGICAL_VIEWPORT, SAFE_PADDING, 10);
  const overview: CameraState = { center: ov.center, zoom: pts.length > 1 ? ov.zoom : 5, bearing: 0, pitch: 0 };
  const segmentZoom = segments.map((s) => {
    const z = fitCamera(boundsOf(s.geometry), LOGICAL_VIEWPORT, SAFE_PADDING, 12).zoom;
    // Folgekamera etwas näher als Segmentübersicht, aber nie näher als Zoom 12.
    return Math.min(12, Math.max(overview.zoom, z + 0.6));
  });
  const distanceTotalM = project.journey.segments.reduce((a, s) => a + s.distanceM, 0);
  return { project, plan, segments, overview, segmentZoom, distanceTotalM };
}

interface Progress {
  segmentIndex: number;
  fraction: number; // 0..1 entlang des aktiven Segments
}

function progressAt(model: SceneModel, tMs: number): Progress {
  const phase = phaseAt(model.plan, tMs);
  const n = model.segments.length;
  switch (phase.kind) {
    case 'intro':
      return { segmentIndex: 0, fraction: 0 };
    case 'outro':
      return { segmentIndex: n - 1, fraction: 1 };
    case 'pause':
      return { segmentIndex: phase.stopIndex - 1, fraction: 1 };
    case 'move': {
      const f = (tMs - phase.startMs) / Math.max(1, phase.endMs - phase.startMs);
      return { segmentIndex: phase.segmentIndex, fraction: ease('easeInOut', f) };
    }
  }
}

function followTarget(model: SceneModel, tMs: number): CameraState {
  const { segmentIndex, fraction } = progressAt(model, tMs);
  const s = model.segments[segmentIndex]!;
  const { point, headingDeg } = alongLine(s.index, fraction * s.index.totalM);
  const rotate = model.project.cameraPreset === 'follow-rotate';
  let zoom = model.segmentZoom[segmentIndex]!;
  // Stopp mit „Zoom“: während der Pause näher heran (Glättung erfolgt über smoothedFollow)
  const phase = phaseAt(model.plan, tMs);
  if (phase.kind === 'pause' && model.project.journey.stops[phase.stopIndex]?.zoomIn) zoom = Math.min(13, zoom + 2);
  return { center: point, zoom, bearing: rotate ? headingDeg : 0, pitch: rotate ? 35 : 0 };
}

/** Zeitlich geglättete Kamera: Mittel über ein symmetrisches Fenster – deterministisch, ohne Zustand. */
function smoothedFollow(model: SceneModel, tMs: number): CameraState {
  const N = 9;
  const windowMs = 1400;
  let zoom = 0, bx = 0, by = 0, pitch = 0;
  for (let k = 0; k < N; k++) {
    const tt = Math.min(model.plan.totalMs, Math.max(0, tMs + (k / (N - 1) - 0.5) * windowMs));
    const c = followTarget(model, tt);
    zoom += c.zoom;
    pitch += c.pitch;
    bx += Math.cos((c.bearing * Math.PI) / 180);
    by += Math.sin((c.bearing * Math.PI) / 180);
  }
  const center = followTarget(model, tMs).center;
  const bearing = (Math.atan2(by, bx) * 180) / Math.PI;
  return { center, zoom: zoom / N, bearing, pitch: pitch / N };
}

function lerpCamera(a: CameraState, b: CameraState, f: number): CameraState {
  const ax = mercatorX(a.center.lon), ay = mercatorY(a.center.lat);
  const bx = mercatorX(b.center.lon), by = mercatorY(b.center.lat);
  let db = b.bearing - a.bearing;
  if (db > 180) db -= 360;
  if (db < -180) db += 360;
  return {
    center: { lat: latFromMercatorY(ay + (by - ay) * f), lon: lonFromMercatorX(ax + (bx - ax) * f) },
    zoom: a.zoom + (b.zoom - a.zoom) * f,
    bearing: a.bearing + db * f,
    pitch: a.pitch + (b.pitch - a.pitch) * f,
  };
}

/**
 * Übergang Übersicht ↔ Folgekamera, bei dem das Ziel (Fahrzeug) im Bild bleibt:
 * Seine Bildschirmposition wandert linear von der Übersichtsposition zur Bildmitte,
 * statt Zentrum und Zoom unabhängig zu interpolieren (sonst verlässt es zwischendurch das Bild).
 */
function blendKeepTarget(overview: CameraState, follow: CameraState, f: number): CameraState {
  const scale = (z: number) => 512 * 2 ** z;
  const zoom = overview.zoom + (follow.zoom - overview.zoom) * f;
  const ox = mercatorX(overview.center.lon), oy = mercatorY(overview.center.lat);
  const tx = mercatorX(follow.center.lon), ty = mercatorY(follow.center.lat);
  const s0 = scale(overview.zoom), sf = scale(zoom);
  const dx = (tx - ox) * s0 * (1 - f), dy = (ty - oy) * s0 * (1 - f); // Bildschirmversatz in px
  const cx = tx - dx / sf, cy = ty - dy / sf;
  const b = lerpCamera(overview, follow, f);
  return { center: { lat: latFromMercatorY(cy), lon: lonFromMercatorX(cx) }, zoom, bearing: b.bearing, pitch: b.pitch };
}

function cameraAt(model: SceneModel, tMs: number): CameraState {
  if (model.segments.length === 0 || model.project.cameraPreset === 'overview') return model.overview;
  const { phases, totalMs } = model.plan;
  const intro = phases[0]!;
  const outro = phases[phases.length - 1]!;
  const follow = smoothedFollow(model, tMs);
  // Weicher Übergang Übersicht → Folgekamera (Intro + erste Bewegungssekunde) und zurück (Outro).
  const inEnd = intro.endMs + Math.min(1500, totalMs * 0.1);
  if (tMs < inEnd) return blendKeepTarget(model.overview, follow, ease('easeInOut', tMs / Math.max(1, inEnd)));
  if (tMs > outro.startMs) return blendKeepTarget(model.overview, follow, 1 - ease('easeInOut', (tMs - outro.startMs) / Math.max(1, outro.endMs - outro.startMs)));
  return follow;
}

/**
 * Zentraler, reiner Zeitbezug: gleiche Eingabe → gleicher Zustand. Vorschau und Export nutzen ausschließlich diese Funktion.
 */
export function evaluateScene(model: SceneModel, tMsRaw: number): SceneState {
  const p = model.project;
  const tMs = Math.min(Math.max(tMsRaw, 0), model.plan.totalMs);
  const stopsBase = p.journey.stops.map((s) => ({ position: s.position, label: s.label, reached: false, isActive: false }));
  if (model.segments.length === 0) {
    return {
      tMs, totalMs: model.plan.totalMs, camera: model.overview, lines: [], vehicle: null, stops: stopsBase,
      distanceDoneM: 0, distanceTotalM: 0, progress: tMs / model.plan.totalMs, title: p.title, modeChange: null, geometryNotice: null,
    };
  }
  const { segmentIndex, fraction } = progressAt(model, tMs);
  let distanceDoneM = 0;
  const lines: SceneLine[] = model.segments.map((s, i) => {
    const f = i < segmentIndex ? 1 : i > segmentIndex ? 0 : fraction;
    distanceDoneM += s.seg.distanceM * f;
    const drawn = s.seg.lineStyle.kind === 'full' ? s.geometry : f <= 0 ? [] : sliceLine(s.index, f * s.index.totalM);
    return { segmentIndex: i, mode: s.seg.mode, style: s.seg.lineStyle, confidence: s.seg.confidence, drawn, full: s.geometry };
  });
  const active = model.segments[segmentIndex]!;
  const { point, headingDeg } = alongLine(active.index, fraction * active.index.totalM);

  // Stopps in entfalteten Koordinaten (passend zu Linien)
  const stops = stopsBase.map((s, i) => {
    const segForStop = i === 0 ? model.segments[0] : model.segments[i - 1];
    const pos = i === 0 ? segForStop!.geometry[0]! : segForStop ? segForStop.geometry[segForStop.geometry.length - 1]! : s.position;
    const reached = i === 0 || i - 1 < segmentIndex || (i - 1 === segmentIndex && fraction >= 1);
    return { ...s, position: pos, reached, isActive: reached && i === segmentIndex + (fraction >= 1 ? 1 : 0) };
  });

  // Verkehrsmittelwechsel-Einblendung: 1,8 s ab Segmentbeginn, wenn Modus wechselt.
  let modeChange: SceneState['modeChange'] = null;
  const phase = phaseAt(model.plan, tMs);
  if (phase.kind === 'move') {
    const prev = model.segments[phase.segmentIndex - 1];
    const since = tMs - phase.startMs;
    if ((phase.segmentIndex === 0 || (prev && prev.seg.mode !== active.seg.mode)) && since < 1800) {
      modeChange = { mode: active.seg.mode, opacity: since < 1400 ? Math.min(1, since / 250) : 1 - (since - 1400) / 400 };
    }
  }
  const conf = active.seg.confidence;
  const geometryNotice = conf === 'estimated' || conf === 'derived' || conf === 'manually_edited' ? conf : null;

  return {
    tMs,
    totalMs: model.plan.totalMs,
    camera: cameraAt(model, tMs),
    lines,
    vehicle: { position: point, headingDeg, mode: active.seg.mode },
    stops,
    distanceDoneM,
    distanceTotalM: model.distanceTotalM,
    progress: tMs / model.plan.totalMs,
    title: p.title,
    modeChange,
    geometryNotice,
  };
}
