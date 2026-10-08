import { createStop, defaultLineStyle, newId, segmentFromResult } from '../../core/project/factory';
import type { Project, RouteSegment, Stop } from '../../core/project/schema';
import type { GeoPoint, TransportMode } from '../../core/types';
import { routeSegment, type RoutingSettings } from '../../adapters/routing/registry';
import type { GpxTrack } from '../imports/gpx';
import { simplify } from '../imports/gpx';
import { lineLengthM } from '../../core/geodesy';

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

export function updateStop(p: Project, stopId: string, patch: Partial<Pick<Stop, 'label' | 'pauseMs' | 'showLabel'>>): Project {
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
  let project = p;
  for (const { index, from, to } of missingPairs(p)) {
    const prevMode = project.journey.segments.find((s) => s.toStopId === from.id)?.mode;
    const mode: TransportMode = prevMode ?? (index === 0 ? 'car' : 'car');
    const seg = await computeSegment(from, to, mode, settings, signal, notices);
    project = { ...project, journey: { ...project.journey, segments: [...project.journey.segments, seg] } };
  }
  if (settings.onlineAllowed && project !== p) project = { ...project, privacy: { usedOnlineServices: true } };
  return { project: normalizeSegments(project), notices };
}

export async function computeSegment(from: Stop, to: Stop, mode: TransportMode, settings: RoutingSettings, signal: AbortSignal | undefined, notices: string[]): Promise<RouteSegment> {
  const { results, fallbackReason } = await routeSegment({ start: from.position, end: to.position, via: [], mode }, settings, signal);
  if (fallbackReason) notices.push(fallbackReason);
  const seg = segmentFromResult(from, to, mode, results);
  if (fallbackReason) seg.warnings = [...seg.warnings, fallbackReason];
  return seg;
}

export async function changeSegmentMode(p: Project, segId: string, mode: TransportMode, settings: RoutingSettings): Promise<{ project: Project; notices: string[] }> {
  const old = p.journey.segments.find((s) => s.id === segId);
  if (!old) return { project: p, notices: [] };
  const from = p.journey.stops.find((s) => s.id === old.fromStopId)!;
  const to = p.journey.stops.find((s) => s.id === old.toStopId)!;
  const notices: string[] = [];
  const seg = await computeSegment(from, to, mode, settings, undefined, notices);
  seg.lineStyle = { ...defaultLineStyle(mode), widthPx: old.lineStyle.widthPx };
  seg.manualDurationMs = old.manualDurationMs;
  return { project: touch({ ...p, journey: { ...p.journey, segments: p.journey.segments.map((s) => (s.id === segId ? seg : s)) } }), notices };
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
