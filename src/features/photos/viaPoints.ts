import { haversineM, indexLine, nearestOnLine, unwrapLongitudes } from '../../core/geodesy';
import type { Photo, Project, RouteSegment } from '../../core/project/schema';
import type { GeoPoint, TransportMode } from '../../core/types';
import { selectedGeometry } from '../../core/scene/evaluate';

/** Modi, für die ein Online-Routing mit Zwischenpunkten möglich ist. */
export const VIA_MODES: TransportMode[] = ['car', 'motorcycle', 'bike', 'walk'];
/** Der Routing-Proxy erlaubt 5 Punkte je Anfrage: Start + Ziel + höchstens 3 Zwischenpunkte. */
export const MAX_VIA_PER_SEGMENT = 3;
/** Zusammenfassen: 1,5 % der Gesamtroute, mindestens 300 m, höchstens 30 km. */
export const CLUSTER_FRACTION = 0.015;
export const CLUSTER_MIN_M = 300;
export const CLUSTER_MAX_M = 30_000;
/** Ein Foto zieht die Route nur dann an, wenn es nah genug am Abschnitt liegt (sonst gehört es zu einer anderen Etappe). */
export const CORRIDOR_FRACTION = 0.15;
export const CORRIDOR_MIN_M = 1_000;
export const CORRIDOR_MAX_M = 40_000;

export function clusterRadiusM(totalRouteM: number): number {
  return Math.min(CLUSTER_MAX_M, Math.max(CLUSTER_MIN_M, totalRouteM * CLUSTER_FRACTION));
}

/**
 * Fasst Punkte zusammen, die höchstens `radiusM` vom ersten Punkt der Gruppe entfernt liegen (Reihenfolge der Eingabe).
 * Stellvertreter ist der Punkt, der dem Schwerpunkt am nächsten liegt – ein echter Foto-Ort statt eines berechneten
 * Mittelpunkts, der abseits jeder Straße liegen könnte.
 */
export function clusterPoints(points: GeoPoint[], radiusM: number): { rep: GeoPoint; repIndex: number; members: number[] }[] {
  const groups: number[][] = [];
  points.forEach((p, i) => {
    const g = groups.find((m) => haversineM(points[m[0]!]!, p) <= radiusM);
    if (g) g.push(i);
    else groups.push([i]);
  });
  return groups.map((members) => {
    const lat = members.reduce((a, i) => a + points[i]!.lat, 0) / members.length;
    const lon = members.reduce((a, i) => a + points[i]!.lon, 0) / members.length;
    const c = { lat, lon };
    const best = members.reduce((b, i) => (haversineM(points[i]!, c) < haversineM(points[b]!, c) ? i : b), members[0]!);
    return { rep: { lat: points[best]!.lat, lon: points[best]!.lon }, repIndex: best, members };
  });
}

export function segmentAcceptsVia(seg: RouteSegment): boolean {
  return VIA_MODES.includes(seg.mode) && (seg.confidence === 'provider_verified' || seg.confidence === 'estimated');
}

export interface ViaPlan {
  /** Segment-ID → gewünschte Zwischenpunkte in Fahrtreihenfolge. */
  bySegment: Map<string, GeoPoint[]>;
  /** Anzahl Fotos, die in einen gemeinsamen Ort zusammengefasst wurden (Fotos − Orte). */
  merged: number;
}

/**
 * Welche Zwischenpunkte sollen die Straßenabschnitte aus den Foto-Orten bekommen?
 * Fotos werden (abhängig von der Gesamtlänge) zu Orten zusammengefasst, dann dem nächstgelegenen berechenbaren
 * Abschnitt zugeordnet, sofern sie in dessen Korridor liegen, und entlang des Abschnitts sortiert.
 */
export function planPhotoVias(p: Project): ViaPlan {
  const bySegment = new Map<string, GeoPoint[]>();
  const placed = p.photos.filter((x): x is Photo & { position: GeoPoint } => !!x.position);
  const segs = p.journey.segments.filter(segmentAcceptsVia);
  if (!placed.length || !segs.length) return { bySegment, merged: 0 };
  const total = p.journey.segments.reduce((a, s) => a + s.distanceM, 0);
  const lines = segs.map((s) => ({ seg: s, index: indexLine(unwrapLongitudes(selectedGeometry(s))) }));

  // 1) Jedes Foto einzeln dem nächstgelegenen Abschnitt zuordnen, sofern es in dessen Korridor liegt.
  const assigned = new Map<string, { pt: GeoPoint; along: number }[]>();
  for (const photo of placed) {
    let best: { id: string; d: number; along: number } | null = null;
    for (const { seg, index } of lines) {
      const n = nearestOnLine(index, photo.position);
      if (!n) continue;
      const lim = Math.min(CORRIDOR_MAX_M, Math.max(CORRIDOR_MIN_M, seg.distanceM * CORRIDOR_FRACTION));
      if (n.distanceM <= lim && (!best || n.distanceM < best.d)) best = { id: seg.id, d: n.distanceM, along: n.alongM };
    }
    if (best) assigned.set(best.id, [...(assigned.get(best.id) ?? []), { pt: photo.position, along: best.along }]);
  }

  // 2) Erst danach je Abschnitt zusammenfassen: Ein Foto außerhalb des Korridors kann gültige nicht mehr verdrängen.
  //    Mehr Orte als der Anbieter zulässt: Radius verdoppeln, bis es passt (nahe Bereiche werden zu einem Ort).
  let merged = 0;
  for (const [id, items] of assigned) {
    let radius = clusterRadiusM(total);
    let clusters = clusterPoints(items.map((x) => x.pt), radius);
    for (let i = 0; i < 6 && clusters.length > MAX_VIA_PER_SEGMENT; i++) {
      radius *= 2;
      clusters = clusterPoints(items.map((x) => x.pt), radius);
    }
    merged += items.length - clusters.length;
    bySegment.set(id, clusters.map((c) => ({ pt: c.rep, along: items[c.repIndex]!.along })).sort((a, b) => a.along - b.along).slice(0, MAX_VIA_PER_SEGMENT).map((x) => x.pt));
  }
  return { bySegment, merged };
}

const same = (a: GeoPoint[], b: GeoPoint[]) =>
  a.length === b.length && a.every((p, i) => Math.abs(p.lat - b[i]!.lat) < 1e-6 && Math.abs(p.lon - b[i]!.lon) < 1e-6);

/** Abschnitte, deren gespeicherte Zwischenpunkte nicht zu den Foto-Orten passen (Neuberechnung nötig). */
export function segmentsNeedingVia(p: Project, plan: ViaPlan = planPhotoVias(p)): { segment: RouteSegment; via: GeoPoint[] }[] {
  return p.journey.segments
    .filter(segmentAcceptsVia)
    .map((segment) => ({ segment, via: plan.bySegment.get(segment.id) ?? [] }))
    .filter(({ segment, via }) => !same(segment.via, via));
}
