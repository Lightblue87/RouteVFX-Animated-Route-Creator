import type { Project, RouteSegment, LineStyle } from '../project/schema';
import type { GeoPoint, RouteConfidence, TransportMode } from '../types';
import {
  alongLine, boundsOf, fitCamera, indexLine, nearestOnLine, latFromMercatorY, lonFromMercatorX, mercatorX, mercatorY, sliceLine, unwrapLongitudes, type LineIndex,
} from '../geodesy';
import { ease, phaseAt, planTimeline, type TimelinePlan } from '../timeline';

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Sanfter Verlauf 0→1 (Spitzentempo nur 1,5× des Durchschnitts, statt 3× bei kubischem Easing). */
const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;

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
  /** Gerade sichtbares Foto (höchstens eins zugleich). */
  photo: { photoId: string; caption: string; width: number; height: number; opacity: number; progress: number } | null;
}

/** Zeitfenster, in dem ein Foto im Video erscheint (aus der Position des Fotos relativ zur Route). */
export interface PhotoMoment {
  photoId: string;
  startMs: number;
  endMs: number;
  /** Abstand des Fotopunkts zur Route (zur Warnung in der Oberfläche). */
  distanceToRouteM: number;
}

export const PHOTO_FADE_MS = 350;

/** Vorberechnetes, unveränderliches Modell. Reine Funktion von Project. */
export interface SceneModel {
  project: Project;
  plan: TimelinePlan;
  segments: { seg: RouteSegment; geometry: GeoPoint[]; index: LineIndex }[];
  overview: CameraState;
  segmentZoom: number[];
  distanceTotalM: number;
  photoMoments: PhotoMoment[];
}

export function selectedGeometry(s: RouteSegment): GeoPoint[] {
  const alt = s.alternatives[s.selectedAlternative];
  return alt && s.selectedAlternative > 0 ? alt.geometry : s.geometry;
}

interface RouteGeometry {
  segments: SceneModel['segments'];
  overview: CameraState;
  segmentZoom: number[];
  /** Foto-Projektionen auf die Route, je Punkt einmal berechnet (Fotos ändern sich oft, die Route selten). */
  projections: Map<string, { distanceM: number; segIdx: number; alongM: number } | null>;
}

// Die Geometrie hängt nur von der Reise ab. Projekte sind unveränderlich, `journey` ist deshalb ein stabiler Schlüssel:
// Beschriftungs- oder Dauer-Änderungen an Fotos berechnen weder Linienindizes noch Fotoprojektionen neu.
const geometryCache = new WeakMap<Project['journey'], RouteGeometry>();

function routeGeometry(project: Project): RouteGeometry {
  const hit = geometryCache.get(project.journey);
  if (hit) return hit;
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
  const g: RouteGeometry = { segments, overview, segmentZoom, projections: new Map() };
  geometryCache.set(project.journey, g);
  return g;
}

export function buildSceneModel(project: Project): SceneModel {
  const plan = planTimeline(project);
  const { segments, overview, segmentZoom, projections } = routeGeometry(project);
  const distanceTotalM = project.journey.segments.reduce((a, s) => a + s.distanceM, 0);
  const photoMoments = schedulePhotos(project, plan, segments, projections);
  return { project, plan, segments, overview, segmentZoom, distanceTotalM, photoMoments };
}

/** Umkehrung von smooth(): Zeitanteil u mit smooth(u) = f (Bisektion, monoton). */
function invSmooth(f: number): number {
  let lo = 0, hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (smooth(mid) < f) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Wann kommt das Fahrzeug an einem Foto vorbei? Der Fotopunkt wird auf die nächstgelegene Stelle der Route abgebildet;
 * der Zeitpunkt ergibt sich aus dem Fortschritt dort. Fotos werden nacheinander gezeigt (kein Überlappen).
 */
function schedulePhotos(project: Project, plan: TimelinePlan, segments: { index: LineIndex }[], cache: RouteGeometry['projections']): PhotoMoment[] {
  const found: { photoId: string; at: number; hold: number; distanceToRouteM: number }[] = [];
  const moves = plan.phases.filter((p) => p.kind === 'move');
  for (const photo of project.photos) {
    if (!photo.position) continue;
    const key = `${photo.position.lat},${photo.position.lon}`;
    let b = cache.get(key);
    if (b === undefined) {
      b = null;
      segments.forEach((s, i) => {
        const hit = nearestOnLine(s.index, photo.position!);
        if (hit && (!b || hit.distanceM < b.distanceM - 1e-6)) b = { distanceM: hit.distanceM, segIdx: i, alongM: hit.alongM };
      });
      cache.set(key, b);
    }
    const mv = b ? moves[b.segIdx] : undefined;
    if (!b || !mv) continue;
    const f = segments[b.segIdx]!.index.totalM > 0 ? b.alongM / segments[b.segIdx]!.index.totalM : 0;
    found.push({ photoId: photo.id, at: mv.startMs + invSmooth(Math.min(1, Math.max(0, f))) * (mv.endMs - mv.startMs), hold: photo.holdMs, distanceToRouteM: b.distanceM });
  }
  found.sort((a, b) => a.at - b.at);
  const GAP_MS = 150;
  const limit = plan.totalMs - 100;
  // Voller Anzeigedauer wegen: Spätestmöglicher Start rückwärts vom Videoende, damit mehrere Fotos am Ende gemeinsam
  // Platz finden. Passt ein Foto auch dann nicht (Start vor dem Ende des vorigen), entfällt es – nie verkürzt.
  let items = found;
  for (;;) {
    const latest: number[] = [];
    for (let i = items.length - 1; i >= 0; i--) latest[i] = (i === items.length - 1 ? limit : latest[i + 1]! - GAP_MS) - items[i]!.hold;
    const out: PhotoMoment[] = [];
    let cursor = 0;
    let dropped = -1;
    for (let i = 0; i < items.length; i++) {
      const startMs = Math.min(Math.max(items[i]!.at, cursor), latest[i]!);
      if (startMs < cursor) {
        dropped = i;
        break;
      }
      const endMs = startMs + items[i]!.hold;
      out.push({ photoId: items[i]!.photoId, startMs, endMs, distanceToRouteM: items[i]!.distanceToRouteM });
      cursor = endMs + GAP_MS;
    }
    if (dropped < 0) return out;
    items = items.filter((_, i) => i !== dropped);
  }
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
      return { segmentIndex: phase.segmentIndex, fraction: smooth(f) };
    }
  }
}

/** Fahrtrichtung als Sehne über ±halbe Bildbreite: Kurven kleiner als der Bildausschnitt drehen die Karte nicht. */
function smoothedHeadingDeg(index: LineIndex, distanceM: number, zoom: number, latDeg: number): number {
  const mPerPx = (EARTH_CIRCUMFERENCE_M * Math.cos((latDeg * Math.PI) / 180)) / (512 * 2 ** zoom);
  const half = 0.5 * LOGICAL_VIEWPORT.width * mPerPx;
  const a = alongLine(index, Math.max(0, distanceM - half));
  const b = alongLine(index, Math.min(index.totalM, distanceM + half));
  if (a.point.lat === b.point.lat && a.point.lon === b.point.lon) return alongLine(index, distanceM).headingDeg;
  return mapBearingDeg(a.point, b.point);
}

/** Richtung der Sehne so, wie sie auf der (Mercator-)Karte erscheint: 0° = Norden oben, im Uhrzeigersinn. */
export function mapBearingDeg(a: GeoPoint, b: GeoPoint): number {
  const dx = mercatorX(b.lon) - mercatorX(a.lon);
  const dySouth = mercatorY(b.lat) - mercatorY(a.lat); // Mercator-Y wächst nach Süden
  return ((Math.atan2(dx, -dySouth) * 180) / Math.PI + 360) % 360;
}

function followTarget(model: SceneModel, tMs: number): CameraState {
  const { segmentIndex, fraction } = progressAt(model, tMs);
  const s = model.segments[segmentIndex]!;
  const distance = fraction * s.index.totalM;
  const { point } = alongLine(s.index, distance);
  const rotate = model.project.cameraPreset === 'follow-rotate';
  // Mischung aus weit und nah: Auf langen Strecken ist die Kamera am Anfang und Ende (Start, Stopps, Ziel) näher dran,
  // dazwischen weit gefasst, damit Straßenverlauf und Fortschritt lesbar bleiben. Kurze Strecken bleiben unverändert.
  const far = model.segmentZoom[segmentIndex]!;
  const boost = Math.min(3, Math.max(0, Math.log2(s.index.totalM / 1000 / 120)));
  const nearWeight = 1 - smooth(Math.min(fraction, 1 - fraction) / 0.18);
  let zoom = Math.min(12.5, far + boost * nearWeight);
  // Stopp mit „Zoom“: während der Pause näher heran (Glättung erfolgt über smoothedFollow)
  const phase = phaseAt(model.plan, tMs);
  if (phase.kind === 'pause' && model.project.journey.stops[phase.stopIndex]?.zoomIn) zoom = Math.min(13, zoom + 2);
  return { center: point, zoom, bearing: rotate ? smoothedHeadingDeg(s.index, distance, zoom, point.lat) : 0, pitch: rotate ? 35 : 0 };
}

/** Zeitlich geglättete Kamera: Mittel über ein symmetrisches Fenster – deterministisch, ohne Zustand. */
function smoothedFollow(model: SceneModel, tMs: number): CameraState {
  const N = 13;
  const windowMs = Math.min(2400, model.plan.totalMs * 0.2);
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
  // Längerer, gleichmäßiger Zoom statt Sprung: Einblendung über Intro + bis zu 2,6 s, Ausblendung beginnt etwas früher.
  const inEnd = intro.endMs + Math.min(2600, totalMs * 0.18);
  if (tMs < inEnd) return blendKeepTarget(model.overview, follow, smooth(tMs / Math.max(1, inEnd)));
  const outStart = Math.max(inEnd, outro.startMs - Math.min(1200, totalMs * 0.08));
  if (tMs > outStart) return blendKeepTarget(model.overview, follow, 1 - smooth((tMs - outStart) / Math.max(1, outro.endMs - outStart)));
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
      distanceDoneM: 0, distanceTotalM: 0, progress: tMs / model.plan.totalMs, title: p.title, modeChange: null, geometryNotice: null, photo: null,
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

  let photo: SceneState['photo'] = null;
  const moment = model.photoMoments.find((m) => tMs >= m.startMs && tMs < m.endMs);
  const shown = moment ? p.photos.find((x) => x.id === moment.photoId) : undefined;
  if (moment && shown) {
    const fade = Math.min(PHOTO_FADE_MS, (moment.endMs - moment.startMs) / 2);
    photo = {
      photoId: shown.id,
      caption: shown.caption,
      width: shown.width,
      height: shown.height,
      opacity: smooth(Math.min((tMs - moment.startMs) / fade, (moment.endMs - tMs) / fade)),
      progress: (tMs - moment.startMs) / (moment.endMs - moment.startMs),
    };
  }

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
    photo,
  };
}
