import { createStop, defaultLineStyle, newId, segmentFromResult } from '../../core/project/factory';
import type { Project, RouteSegment, Stop } from '../../core/project/schema';
import type { GeoPoint, TransportMode } from '../../core/types';
import { routeSegment, type RoutingSettings } from '../../adapters/routing/registry';
import type { GpxTrack } from '../imports/gpx';
import { simplify } from '../imports/gpx';
import { greatCircle, lineLengthM, normalizeLon, unwrapLongitudes } from '../../core/geodesy';

/** Reine Mutationen am Projekt (für Undo/Redo). Segmente werden über (fromStopId,toStopId) zugeordnet. */
const touch = (p: Project): Project => ({ ...p, modifiedAt: new Date().toISOString() });

export function addStop(p: Project, point: GeoPoint, label: string): Project {
  return touch({ ...p, journey: { ...p.journey, stops: [...p.journey.stops, createStop(point, label)] } });
}

export function removeStop(p: Project, stopId: string): Project {
  return touch({
    ...p,
    journey: {
      stops: p.journey.stops.filter((s) => s.id !== stopId),
      segments: p.journey.segments.filter((s) => s.fromStopId !== stopId && s.toStopId !== stopId),
    },
  });
}

export function moveStop(p: Project, index: number, delta: -1 | 1): Project {
  const stops = [...p.journey.stops];
  const j = index + delta;
  if (j < 0 || j >= stops.length) return p;
  [stops[index], stops[j]] = [stops[j]!, stops[index]!];
  return touch({ ...p, journey: { ...p.journey, stops } });
}

export function updateStop(p: Project, stopId: string, patch: Partial<Pick<Stop, 'label' | 'pauseMs' | 'showLabel' | 'zoomIn'>>): Project {
  return touch({ ...p, journey: { ...p.journey, stops: p.journey.stops.map((s) => (s.id === stopId ? { ...s, ...patch } : s)) } });
}

export function updateSegment(p: Project, segId: string, patch: Partial<RouteSegment>): Project {
  return touch({ ...p, journey: { ...p.journey, segments: p.journey.segments.map((s) => (s.id === segId ? { ...s, ...patch } : s)) } });
}

/** Welche Stopp-Paare haben (noch) kein passendes Segment? */
export function missingPairs(p: Project): { index: number; from: Stop; to: Stop }[] {
  const out: { index: number; from: Stop; to: Stop }[] = [];
  const { stops, segments } = p.journey;
  for (let i = 0; i + 1 < stops.length; i++) {
    const from = stops[i]!, to = stops[i + 1]!;
    if (!segments.some((s) => s.fromStopId === from.id && s.toStopId === to.id)) out.push({ index: i, from, to });
  }
  return out;
}

/** Ordnet Segmente nach Stopp-Reihenfolge und verwirft verwaiste. */
export function normalizeSegments(p: Project): Project {
  const { stops, segments } = p.journey;
  const ordered: RouteSegment[] = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const s = segments.find((x) => x.fromStopId === stops[i]!.id && x.toStopId === stops[i + 1]!.id);
    if (s) ordered.push(s);
  }
  return { ...p, journey: { stops, segments: ordered } };
}

/** Berechnet fehlende Segmente. Modus: Vorgängersegment oder 'car'. Liefert Hinweise (Fallback-Gründe). */
export async function fillMissingSegments(p: Project, settings: RoutingSettings, signal?: AbortSignal): Promise<{ project: Project; notices: string[] }> {
  const notices: string[] = [];
  const usage = { online: false };
  let project = p;
  for (const { index, from, to } of missingPairs(p)) {
    const prevMode = project.journey.segments.find((s) => s.toStopId === from.id)?.mode;
    const mode: TransportMode = prevMode ?? (index === 0 ? 'car' : 'car');
    const seg = await computeSegment(from, to, mode, settings, signal, notices, usage);
    project = { ...project, journey: { ...project.journey, segments: [...project.journey.segments, seg] } };
  }
  if (usage.online) project = { ...project, privacy: { usedOnlineServices: true } };
  return { project: normalizeSegments(project), notices };
}

export async function computeSegment(from: Stop, to: Stop, mode: TransportMode, settings: RoutingSettings, signal: AbortSignal | undefined, notices: string[], usage?: { online: boolean }, via: GeoPoint[] = []): Promise<RouteSegment> {
  const { results, fallbackReason, usedOnline } = await routeSegment({ start: from.position, end: to.position, via, mode }, settings, signal);
  if (usage && usedOnline) usage.online = true;
  if (fallbackReason) notices.push(fallbackReason);
  const seg = segmentFromResult(from, to, mode, results, via);
  if (fallbackReason) seg.warnings = [...seg.warnings, fallbackReason];
  return seg;
}

/**
 * Berechnet einen Abschnitt mit neuem Verkehrsmittel. Gibt nur das neue Segment zurück; eingespielt wird es
 * über replaceSegmentIfUnchanged, damit eine langsame Routing-Antwort keine zwischenzeitlichen Änderungen überschreibt.
 */
export async function changeSegmentMode(p: Project, segId: string, mode: TransportMode, settings: RoutingSettings, signal?: AbortSignal, via: GeoPoint[] = []): Promise<{ base: RouteSegment; segment: RouteSegment; notices: string[]; usedOnline: boolean } | null> {
  const old = p.journey.segments.find((s) => s.id === segId);
  if (!old) return null;
  const from = p.journey.stops.find((s) => s.id === old.fromStopId)!;
  const to = p.journey.stops.find((s) => s.id === old.toStopId)!;
  const notices: string[] = [];
  const usage = { online: false };
  const seg = await computeSegment(from, to, mode, settings, signal, notices, usage, via);
  seg.lineStyle = { ...defaultLineStyle(mode), widthPx: old.lineStyle.widthPx };
  seg.manualDurationMs = old.manualDurationMs;
  return { base: old, segment: seg, notices, usedOnline: usage.online };
}

/** Vermerkt im Projekt, dass Daten an einen Online-Dienst übertragen wurden. */
export function markOnlineUsed(p: Project): Project {
  return p.privacy.usedOnlineServices ? p : { ...p, privacy: { usedOnlineServices: true } };
}

/**
 * Merkt sich je Abschnitt die zuletzt angeforderte Verkehrsmittel-Berechnung. Antworten älterer Anfragen
 * werden verworfen – unabhängig davon, in welcher Reihenfolge die Antworten eintreffen.
 */
export class LatestRequestGate {
  private seq = 0;
  private readonly latest = new Map<string, number>();
  begin(key: string): number {
    const token = ++this.seq;
    this.latest.set(key, token);
    return token;
  }
  isLatest(key: string, token: number): boolean {
    return this.latest.get(key) === token;
  }
  end(key: string, token: number): void {
    if (this.isLatest(key, token)) this.latest.delete(key);
  }
}

/**
 * Ersetzt `base` durch `next`, aber nur wenn `base` im aktuellen Projekt noch unverändert ist.
 * Wurde der Abschnitt inzwischen bearbeitet, entfernt oder neu berechnet, gewinnt die spätere Nutzeraktion.
 */
export function replaceSegmentIfUnchanged(cur: Project, base: RouteSegment, next: RouteSegment): Project {
  if (!cur.journey.segments.includes(base)) return cur;
  return touch({ ...cur, journey: { ...cur.journey, segments: cur.journey.segments.map((s) => (s === base ? next : s)) } });
}

/** GPX-Track als Stopps + aufgezeichnetes Segment anhängen. Zeiten werden nur übernommen, wenn vorhanden. */
export function appendGpxTrack(p: Project, track: GpxTrack, mode: TransportMode = 'car'): Project {
  const pts = simplify(track.points);
  const first = pts[0]!, last = pts[pts.length - 1]!;
  const stops = [...p.journey.stops];
  let fromStop = stops[stops.length - 1];
  if (!fromStop || lineLengthM([fromStop.position, first]) > 200) {
    fromStop = createStop(first, track.name);
    stops.push(fromStop);
  }
  const toStop = createStop(last, track.name);
  stops.push(toStop);
  const seg: RouteSegment = {
    id: newId(),
    fromStopId: fromStop.id,
    toStopId: toStop.id,
    mode,
    via: [],
    geometry: pts,
    geometryVersion: 1,
    source: 'gpx-import',
    confidence: 'imported_recorded',
    distanceM: track.distanceM,
    measuredTimeS: track.durationS,
    alternatives: [],
    selectedAlternative: 0,
    lineStyle: defaultLineStyle(mode),
    warnings: [],
  };
  return touch({ ...p, journey: { stops, segments: [...p.journey.segments, seg] } });
}

// ---------------------------------------------------------------------------
// Manuelle Geometriebearbeitung (anbieterunabhängig): Kontrollpunkte → verdichtete Großkreis-Polylinie.

const MAX_CONTROL_POINTS = 16;

/** Kontrollpunkte zum Bearbeiten: gespeicherte Formpunkte oder vereinfachte Geometrie (≤ 16 Punkte). */
export function controlPointsOf(seg: RouteSegment): GeoPoint[] {
  if (seg.confidence === 'manually_edited' && seg.via.length >= 2) return seg.via.map((p) => ({ lat: p.lat, lon: p.lon }));
  const g = seg.alternatives[seg.selectedAlternative]?.geometry ?? seg.geometry;
  let tol = 0.0005;
  let pts = simplify(g, tol);
  while (pts.length > MAX_CONTROL_POINTS && tol < 10) {
    tol *= 2;
    pts = simplify(g, tol);
  }
  return pts.map((p) => ({ lat: p.lat, lon: p.lon }));
}

/** Erzeugt aus Kontrollpunkten eine neue Geometrie; Distanz wird neu berechnet, Herkunft als manuell markiert. */
export function applyControlPoints(seg: RouteSegment, control: GeoPoint[]): RouteSegment {
  if (control.length < 2) throw new Error('need at least two control points');
  const geometry: GeoPoint[] = [];
  for (let i = 1; i < control.length; i++) {
    const a = control[i - 1]!, b = control[i]!;
    const n = Math.max(2, Math.min(64, Math.round(lineLengthM([a, b]) / 5_000)));
    const part = greatCircle(a, b, n).map((p) => ({ lat: p.lat, lon: normalizeLon(p.lon) }));
    geometry.push(...(i === 1 ? part : part.slice(1)));
  }
  return {
    ...seg,
    via: control,
    geometry,
    geometryVersion: seg.geometryVersion + 1,
    source: 'manual',
    confidence: 'manually_edited',
    distanceM: lineLengthM(unwrapLongitudes(geometry)),
    etaS: undefined, // Anbieter-Fahrzeit gilt für bearbeitete Geometrie nicht mehr
    alternatives: [],
    selectedAlternative: 0,
    warnings: seg.warnings.filter((w) => w !== 'estimated_geometry'),
  };
}
