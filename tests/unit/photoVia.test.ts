import { describe, expect, it } from 'vitest';
import { clusterPoints, clusterRadiusM, planPhotoVias, segmentsNeedingVia, MAX_VIA_PER_SEGMENT } from '../../src/features/photos/viaPoints';
import { createProject, defaultLineStyle } from '../../src/core/project/factory';
import type { Project, Photo, RouteSegment } from '../../src/core/project/schema';

const line = (a: [number, number], b: [number, number], n = 50) =>
  Array.from({ length: n + 1 }, (_, i) => ({ lat: a[0] + ((b[0] - a[0]) * i) / n, lon: a[1] + ((b[1] - a[1]) * i) / n }));

function proj(photos: [number, number][], opts: Partial<RouteSegment> = {}): Project {
  const base = createProject('de');
  const geometry = line([52, 9], [52, 19]); // ~685 km
  const seg: RouteSegment = {
    id: 's1', fromStopId: 'a', toStopId: 'b', mode: 'car', via: [], geometry, geometryVersion: 1, source: 'ors', confidence: 'provider_verified',
    distanceM: 685_000, alternatives: [], selectedAlternative: 0, lineStyle: defaultLineStyle('car'), warnings: [], ...opts,
  };
  const ph = (p: [number, number], i: number): Photo => ({ id: `p${i}`, assetId: `a${i}`, fileName: 'x.jpg', width: 10, height: 10, position: { lat: p[0], lon: p[1] }, positionSource: 'exif', caption: '', holdMs: 2500 });
  return { ...base, journey: { stops: [], segments: [seg] }, photos: photos.map(ph) };
}

describe('Foto-Orte als Routen-Zwischenpunkte', () => {
  it('Clusterradius wächst mit der Routenlänge, mit Ober- und Untergrenze', () => {
    expect(clusterRadiusM(1_000)).toBe(300);
    expect(clusterRadiusM(200_000)).toBe(3_000);
    expect(clusterRadiusM(10_000_000)).toBe(30_000);
  });

  it('fasst nahe Punkte zusammen; Stellvertreter ist ein echter Foto-Ort', () => {
    const pts = [{ lat: 52, lon: 10 }, { lat: 52.001, lon: 10.001 }, { lat: 52.002, lon: 10 }, { lat: 53, lon: 12 }];
    const c = clusterPoints(pts, 1_000);
    expect(c).toHaveLength(2);
    expect(c[0]!.members).toEqual([0, 1, 2]);
    expect(pts).toContainEqual(c[0]!.rep);
  });

  it('viele Fotos im selben Bereich einer langen Route ergeben einen einzigen Zwischenpunkt', () => {
    // 5 Fotos innerhalb ~2 km, Radius bei 685 km = 10 km
    const p = proj([[52.05, 12], [52.055, 12.004], [52.06, 12.002], [52.052, 12.01], [52.058, 12.006]]);
    const plan = planPhotoVias(p);
    expect(plan.bySegment.get('s1')).toHaveLength(1);
    expect(plan.merged).toBe(4);
  });

  it('auf einer kurzen Route bleiben dieselben Fotos getrennte Orte', () => {
    const p = proj([[52.0005, 12], [52.0005, 12.04]], { distanceM: 8_000, geometry: line([52, 11.96], [52, 12.08]) });
    expect(planPhotoVias(p).bySegment.get('s1')).toHaveLength(2);
  });

  it('sortiert die Zwischenpunkte in Fahrtrichtung', () => {
    const p = proj([[52.1, 16], [52.1, 11], [52.1, 14]]);
    const v = planPhotoVias(p).bySegment.get('s1')!;
    expect(v.map((x) => x.lon)).toEqual([11, 14, 16]);
  });

  it('Fotos weit abseits des Abschnitts lenken die Route nicht um', () => {
    const p = proj([[48, 12]]); // ~450 km südlich
    expect(planPhotoVias(p).bySegment.size).toBe(0);
  });

  it('begrenzt die Zwischenpunkte je Abschnitt (Anbieterlimit) durch größere Orte', () => {
    const p = proj([[52.1, 10], [52.1, 12], [52.1, 14], [52.1, 16], [52.1, 18]]);
    const v = planPhotoVias(p).bySegment.get('s1')!;
    expect(v.length).toBeLessThanOrEqual(MAX_VIA_PER_SEGMENT);
    expect(v.length).toBeGreaterThan(0);
  });

  it('ignoriert Fotos ohne Ort sowie Flug-, bearbeitete und aufgezeichnete Abschnitte', () => {
    expect(planPhotoVias(proj([[52.1, 12]], { mode: 'plane' })).bySegment.size).toBe(0);
    expect(planPhotoVias(proj([[52.1, 12]], { confidence: 'manually_edited' })).bySegment.size).toBe(0);
    expect(planPhotoVias(proj([[52.1, 12]], { confidence: 'imported_recorded' })).bySegment.size).toBe(0);
    const p = proj([[52.1, 12]]);
    p.photos[0]!.position = null;
    expect(planPhotoVias(p).bySegment.size).toBe(0);
  });

  it('meldet Abschnitte nur, wenn die gespeicherten Zwischenpunkte abweichen', () => {
    const p = proj([[52.1, 12]]);
    const need = segmentsNeedingVia(p);
    expect(need).toHaveLength(1);
    const applied = { ...p, journey: { ...p.journey, segments: [{ ...p.journey.segments[0]!, via: need[0]!.via }] } };
    expect(segmentsNeedingVia(applied)).toHaveLength(0);
    // Foto entfernt → der Umweg muss wieder verschwinden
    expect(segmentsNeedingVia({ ...applied, photos: [] })).toHaveLength(1);
  });
});

import { changeSegmentMode } from '../../src/features/projects/journey';
import type { RoutingRequest, RoutingProvider } from '../../src/core/types';

describe('Neuberechnung mit Zwischenpunkten', () => {
  it('sendet die Foto-Orte als via an den Dienst und speichert sie im Abschnitt', async () => {
    const base = proj([[52.1, 12]]);
    const stops = [
      { id: 'a', position: { lat: 52, lon: 9 }, label: 'A', pauseMs: 0, showLabel: true, zoomIn: false },
      { id: 'b', position: { lat: 52, lon: 19 }, label: 'B', pauseMs: 0, showLabel: true, zoomIn: false },
    ];
    const p = { ...base, journey: { ...base.journey, stops } };
    const seen: RoutingRequest[] = [];
    const online: RoutingProvider = {
      id: 'fake', supportedModes: ['car'], requiresNetwork: true,
      async route(req) {
        seen.push(req);
        return [{ geometry: [req.start, ...req.via, req.end], distanceM: 1, source: 'fake', confidence: 'provider_verified', warnings: [] }];
      },
    };
    const via = planPhotoVias(p).bySegment.get('s1')!;
    const r = await changeSegmentMode(p, 's1', 'car', { onlineAllowed: true, online }, undefined, via);
    expect(seen[0]!.via).toEqual(via);
    expect(r!.segment.via).toEqual(via);
    expect(r!.segment.geometry).toContainEqual(via[0]);
  });
});
