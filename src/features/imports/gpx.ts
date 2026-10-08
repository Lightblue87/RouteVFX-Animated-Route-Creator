import type { GeoPoint } from '../../core/types';
import { isValidPoint, lineLengthM } from '../../core/geodesy';

export const GPX_MAX_BYTES = 15 * 1024 * 1024;
export const GPX_MAX_POINTS = 200_000;

export interface GpxTrack {
  name: string;
  points: GeoPoint[];
  distanceM: number;
  /** Nur gesetzt, wenn ALLE Punkte echte Zeitstempel haben. */
  durationS?: number;
}

export interface GpxResult {
  tracks: GpxTrack[];
  waypoints: { name: string; point: GeoPoint }[];
  warnings: string[];
}

export class GpxError extends Error {
  constructor(public readonly code: 'too_large' | 'invalid_xml' | 'not_gpx' | 'no_points' | 'too_many_points', message: string) {
    super(message);
    this.name = 'GpxError';
  }
}

/** Entfernt Steuerzeichen und kürzt; Darstellung erfolgt ausschließlich als Text (kein innerHTML). */
export function sanitizeLabel(s: string | null | undefined, max = 80): string {
  // eslint-disable-next-line no-control-regex
  return (s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function pointFrom(el: Element, warnings: Set<string>): GeoPoint | null {
  const lat = Number(el.getAttribute('lat'));
  const lon = Number(el.getAttribute('lon'));
  const p: GeoPoint = { lat, lon };
  if (!isValidPoint(p) || el.getAttribute('lat') === null || el.getAttribute('lon') === null) {
    warnings.add('invalid_coordinates_skipped');
    return null;
  }
  const ele = el.getElementsByTagName('ele')[0]?.textContent;
  if (ele != null && Number.isFinite(Number(ele))) p.altitudeM = Number(ele);
  const time = el.getElementsByTagName('time')[0]?.textContent?.trim();
  if (time) {
    const d = new Date(time);
    if (!Number.isNaN(d.getTime())) p.time = d.toISOString();
    else warnings.add('invalid_time_ignored');
  }
  return p;
}

function trackFrom(name: string, points: GeoPoint[]): GpxTrack {
  const t0 = points[0]?.time, t1 = points[points.length - 1]?.time;
  const allTimed = points.every((p) => p.time);
  const durationS = allTimed && t0 && t1 ? Math.max(0, (Date.parse(t1) - Date.parse(t0)) / 1000) : undefined;
  return { name, points, distanceM: lineLengthM(points), durationS };
}

/** Parst GPX 1.0/1.1 (trk/trkseg/trkpt, rte/rtept, wpt). Benötigt DOMParser (Browser/jsdom). */
export function parseGpx(text: string, byteLength = new TextEncoder().encode(text).length): GpxResult {
  if (byteLength > GPX_MAX_BYTES) throw new GpxError('too_large', `GPX larger than ${GPX_MAX_BYTES} bytes`);
  // DOCTYPE/Entities ablehnen (XXE/Billion-Laughs-Schutz, auch wenn DOMParser keine externen Entities lädt).
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new GpxError('invalid_xml', 'DOCTYPE/ENTITY not allowed');
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new GpxError('invalid_xml', 'XML parse error');
  const root = doc.documentElement;
  if (root.localName !== 'gpx') throw new GpxError('not_gpx', 'Root element is not <gpx>');
  const ns = root.namespaceURI;
  const warnings = new Set<string>();
  if (ns && ns !== 'http://www.topografix.com/GPX/1/1' && ns !== 'http://www.topografix.com/GPX/1/0') warnings.add('unknown_namespace');

  const tracks: GpxTrack[] = [];
  let total = 0;
  const guard = (n: number) => {
    total += n;
    if (total > GPX_MAX_POINTS) throw new GpxError('too_many_points', `More than ${GPX_MAX_POINTS} points`);
  };
  const childText = (el: Element, tag: string) => {
    for (const c of Array.from(el.children)) if (c.localName === tag) return c.textContent;
    return null;
  };

  for (const trk of Array.from(doc.getElementsByTagName('trk'))) {
    const name = sanitizeLabel(childText(trk, 'name')) || 'Track';
    const segs = Array.from(trk.getElementsByTagName('trkseg'));
    if (segs.length > 1) warnings.add('multiple_segments_joined');
    const pts = segs.flatMap((s) => Array.from(s.getElementsByTagName('trkpt')));
    guard(pts.length);
    const points = pts.map((e) => pointFrom(e, warnings)).filter((p): p is GeoPoint => p !== null);
    if (points.length >= 2) tracks.push(trackFrom(name, points));
  }
  for (const rte of Array.from(doc.getElementsByTagName('rte'))) {
    const name = sanitizeLabel(childText(rte, 'name')) || 'Route';
    const pts = Array.from(rte.getElementsByTagName('rtept'));
    guard(pts.length);
    const points = pts.map((e) => pointFrom(e, warnings)).filter((p): p is GeoPoint => p !== null);
    if (points.length >= 2) tracks.push(trackFrom(name, points));
  }
  const waypoints = Array.from(doc.getElementsByTagName('wpt'))
    .map((e) => ({ name: sanitizeLabel(childText(e, 'name')) || 'Waypoint', point: pointFrom(e, warnings) }))
    .filter((w): w is { name: string; point: GeoPoint } => w.point !== null);
  guard(waypoints.length);
  if (tracks.length === 0 && waypoints.length < 2) throw new GpxError('no_points', 'No usable track, route or waypoints');
  return { tracks, waypoints, warnings: [...warnings] };
}

/** Reduziert sehr dichte Tracks für Vorschau/Animation (Douglas-Peucker in Grad, Toleranz ~ 5 m). */
export function simplify(points: GeoPoint[], toleranceDeg = 0.00005): GeoPoint[] {
  if (points.length <= 2) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const A = points[a]!, B = points[b]!;
    let maxD = 0, idx = -1;
    const dx = B.lon - A.lon, dy = B.lat - A.lat;
    const len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const P = points[i]!;
      let t = len2 ? ((P.lon - A.lon) * dx + (P.lat - A.lat) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const d = Math.hypot(P.lon - (A.lon + t * dx), P.lat - (A.lat + t * dy));
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > toleranceDeg && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
