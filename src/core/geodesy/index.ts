import type { GeoPoint } from '../types';

export const EARTH_RADIUS_M = 6_371_008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function isValidPoint(p: GeoPoint): boolean {
  return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
}

/** Großkreisdistanz (Haversine) in Metern. */
export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function lineLengthM(points: GeoPoint[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += haversineM(points[i - 1]!, points[i]!);
  return sum;
}

/** Anfangskurs (0 = Nord, im Uhrzeigersinn) in Grad. */
export function initialBearingDeg(a: GeoPoint, b: GeoPoint): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Punkte auf dem Großkreis zwischen a und b (inklusive Endpunkte).
 * Längengrade werden fortlaufend „entfaltet“ (können außerhalb ±180 liegen), damit Linien
 * über die Datumsgrenze ohne Sprung gezeichnet werden. Für Speicherung normalizeLon verwenden.
 */
export function greatCircle(a: GeoPoint, b: GeoPoint, segments = 64): GeoPoint[] {
  const φ1 = toRad(a.lat), λ1 = toRad(a.lon), φ2 = toRad(b.lat), λ2 = toRad(b.lon);
  const d = haversineM(a, b) / EARTH_RADIUS_M;
  if (d < 1e-9) return [{ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon }];
  const out: GeoPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const f = i / segments;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    out.push({ lat: toDeg(Math.atan2(z, Math.hypot(x, y))), lon: toDeg(Math.atan2(y, x)) });
  }
  out[0] = { lat: a.lat, lon: a.lon };
  out[out.length - 1] = { lat: b.lat, lon: b.lon };
  return unwrapLongitudes(out);
}

export function normalizeLon(lon: number): number {
  const l = ((((lon + 180) % 360) + 360) % 360) - 180;
  return l === -180 && lon > 0 ? 180 : l;
}

/** Entfaltet Längengrade, sodass aufeinanderfolgende Punkte nie mehr als 180° auseinanderliegen. */
export function unwrapLongitudes(points: GeoPoint[], startOffset = 0): GeoPoint[] {
  const out: GeoPoint[] = [];
  let offset = startOffset;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (i > 0) {
      const prev = points[i - 1]!;
      const diff = p.lon - prev.lon;
      if (diff > 180) offset -= 360;
      else if (diff < -180) offset += 360;
    }
    out.push({ ...p, lon: p.lon + offset });
  }
  return out;
}

export interface LineIndex {
  points: GeoPoint[];
  /** Kumulierte Distanz in Metern je Punkt. */
  cumulative: number[];
  totalM: number;
}

export function indexLine(points: GeoPoint[]): LineIndex {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1]! + haversineM(points[i - 1]!, points[i]!));
  return { points, cumulative, totalM: cumulative[cumulative.length - 1] ?? 0 };
}

/**
 * Punkt bei Distanz entlang der Linie, Teil-Linie bis dahin und lokale Fahrtrichtung.
 * Lineare Interpolation in lat/lon zwischen Stützpunkten (für dichte Geometrien ausreichend genau).
 */
export function alongLine(index: LineIndex, distanceM: number): { point: GeoPoint; headingDeg: number; segmentIndex: number } {
  const { points, cumulative, totalM } = index;
  if (points.length === 0) throw new Error('empty line');
  if (points.length === 1) return { point: points[0]!, headingDeg: 0, segmentIndex: 0 };
  const d = Math.min(Math.max(distanceM, 0), totalM);
  // binäre Suche
  let lo = 0, hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid]! <= d) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!, b = points[hi]!;
  const segLen = cumulative[hi]! - cumulative[lo]!;
  const f = segLen > 0 ? (d - cumulative[lo]!) / segLen : 0;
  const point = { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
  return { point, headingDeg: initialBearingDeg(a, b), segmentIndex: lo };
}

export function sliceLine(index: LineIndex, distanceM: number): GeoPoint[] {
  const { points } = index;
  if (distanceM <= 0) return points.slice(0, 1);
  if (distanceM >= index.totalM) return points.slice();
  const { point, segmentIndex } = alongLine(index, distanceM);
  return [...points.slice(0, segmentIndex + 1), point];
}

export interface Bounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

export function boundsOf(points: GeoPoint[]): Bounds {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLon = Math.min(minLon, p.lon);
    maxLon = Math.max(maxLon, p.lon);
  }
  return { minLat, maxLat, minLon, maxLon };
}

// Web-Mercator (Einheitsquadrat 0..1), wie MapLibre.
export function mercatorX(lon: number): number {
  return (lon + 180) / 360;
}
export function mercatorY(lat: number): number {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const s = Math.sin(toRad(clamped));
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
}
export function lonFromMercatorX(x: number): number {
  return x * 360 - 180;
}
export function latFromMercatorY(y: number): number {
  return toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y))));
}

/**
 * Reine Entsprechung von fitBounds: Zoom so, dass die Bounds mit Padding in einen Viewport
 * (CSS-Pixel, Kachelgröße 512) passen.
 */
export function fitCamera(
  b: Bounds,
  viewport: { width: number; height: number },
  paddingPx: { top: number; bottom: number; left: number; right: number },
  maxZoom = 14,
): { center: GeoPoint; zoom: number } {
  const x0 = mercatorX(b.minLon), x1 = mercatorX(b.maxLon);
  const y0 = mercatorY(b.maxLat), y1 = mercatorY(b.minLat);
  const w = Math.max(1, viewport.width - paddingPx.left - paddingPx.right);
  const h = Math.max(1, viewport.height - paddingPx.top - paddingPx.bottom);
  const dx = Math.max(x1 - x0, 1e-9), dy = Math.max(y1 - y0, 1e-9);
  const zoom = Math.min(maxZoom, Math.log2(Math.min(w / (dx * 512), h / (dy * 512))));
  const scale = 512 * 2 ** zoom;
  // Padding-Asymmetrie verschiebt das Zentrum
  const cx = (x0 + x1) / 2 + (paddingPx.right - paddingPx.left) / 2 / scale;
  const cy = (y0 + y1) / 2 + (paddingPx.bottom - paddingPx.top) / 2 / scale;
  return { center: { lat: latFromMercatorY(cy), lon: lonFromMercatorX(cx) }, zoom: Math.max(0, zoom) };
}
