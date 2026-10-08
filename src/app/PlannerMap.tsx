import '../adapters/maps/setup';
import { useEffect, useRef } from 'react';
import { Map as MlMap, type GeoJSONSource, type MapMouseEvent, type MapTouchEvent } from 'maplibre-gl';
import type { Project } from '../core/project/schema';
import { buildStyle } from '../adapters/maps/styles';
import { boundsOf, unwrapLongitudes } from '../core/geodesy';
import type { GeoPoint } from '../core/types';

export interface GeometryEdit {
  segmentId: string;
  /** Kontrollpunkte; erster/letzter gehören zu Stopps und sind fixiert. */
  points: GeoPoint[];
  onChange: (points: GeoPoint[]) => void;
}

const HIT_RADIUS_PX = 22; // ≈ 44 px Touch-Ziel

/**
 * Interaktive Planungskarte. Ohne Bearbeitung: Tippen fügt Stopp hinzu.
 * Im Bearbeitungsmodus: Kontrollpunkte ziehen, Mittelpunkte ziehen = Punkt einfügen, Punkt antippen = entfernen.
 */
export function PlannerMap({ project, onTap, edit }: { project: Project; onTap: (p: GeoPoint) => void; edit?: GeometryEdit | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
  const editRef = useRef(edit);
  editRef.current = edit;
  const loaded = useRef(false);

  useEffect(() => {
    const map = new MlMap({
      container: ref.current!,
      style: buildStyle(project.mapStyleRef, document.baseURI),
      center: [10, 50],
      zoom: 3,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    });
    map.touchZoomRotate.disableRotation();
    map.on('click', (e: MapMouseEvent) => {
      if (editRef.current) return; // im Bearbeitungsmodus keine neuen Stopps
      tapRef.current({ lat: e.lngLat.lat, lon: e.lngLat.wrap().lng });
    });
    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('handles', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#ffffff', 'line-width': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'route', type: 'line', source: 'route', filter: ['!', ['get', 'approx']], paint: { 'line-color': ['get', 'color'], 'line-width': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'route-approx', type: 'line', source: 'route', filter: ['get', 'approx'], paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [1, 2] }, layout: { 'line-join': 'round' } });
      map.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#1c1c1e', 'circle-stroke-width': 3 } });
      map.addLayer({
        id: 'handles', type: 'circle', source: 'handles',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'kind'], 'mid'], 6, 9],
          'circle-color': ['case', ['==', ['get', 'kind'], 'mid'], 'rgba(255,255,255,0.7)', '#ffffff'],
          'circle-stroke-color': '#0a6cdf',
          'circle-stroke-width': ['case', ['==', ['get', 'kind'], 'fixed'], 0, 3],
        },
      });
      loaded.current = true;
      update(map, project, true);
      updateHandles(map, editRef.current?.points ?? null);
    });

    // Ziehen von Kontrollpunkten (Maus + Touch)
    let drag: { index: number; points: GeoPoint[]; moved: boolean } | null = null;
    const hit = (pt: { x: number; y: number }) => {
      const e = editRef.current;
      if (!e) return null;
      let best: { kind: string; index: number; d: number } | null = null;
      const consider = (kind: string, index: number, p: GeoPoint) => {
        const s = map.project([p.lon, p.lat]);
        const d = Math.hypot(s.x - pt.x, s.y - pt.y);
        if (d <= HIT_RADIUS_PX && (!best || d < best.d)) best = { kind, index, d };
      };
      e.points.forEach((p, i) => i > 0 && i < e.points.length - 1 && consider('cp', i, p));
      midpoints(e.points).forEach((p, i) => consider('mid', i, p));
      return best as { kind: string; index: number; d: number } | null;
    };
    const start = (e: MapMouseEvent | MapTouchEvent) => {
      const h = hit(e.point);
      const ed = editRef.current;
      if (!h || !ed) return;
      e.preventDefault(); // verhindert Karten-Pan
      const points = ed.points.map((p) => ({ ...p }));
      if (h.kind === 'mid') {
        points.splice(h.index + 1, 0, midpoints(ed.points)[h.index]!);
        drag = { index: h.index + 1, points, moved: true };
      } else drag = { index: h.index, points, moved: false };
    };
    const move = (e: MapMouseEvent | MapTouchEvent) => {
      if (!drag) return;
      drag.points[drag.index] = { lat: e.lngLat.lat, lon: e.lngLat.lng };
      drag.moved = true;
      updateHandles(map, drag.points, true);
    };
    const end = () => {
      if (!drag) return;
      const ed = editRef.current;
      const { points, moved, index } = drag;
      drag = null;
      if (!ed) return;
      if (!moved) {
        // Antippen ohne Bewegung entfernt einen Zwischenpunkt
        if (points.length > 2) ed.onChange(points.filter((_, i) => i !== index));
        return;
      }
      ed.onChange(points);
    };
    map.on('mousedown', start);
    map.on('touchstart', start);
    map.on('mousemove', move);
    map.on('touchmove', move);
    map.on('mouseup', end);
    map.on('touchend', end);
    map.on('touchcancel', end);

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      loaded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.mapStyleRef]);

  const prevStops = useRef(0);
  useEffect(() => {
    const map = mapRef.current;
    if (map && loaded.current) {
      update(map, project, project.journey.stops.length !== prevStops.current);
      prevStops.current = project.journey.stops.length;
    }
  }, [project]);

  useEffect(() => {
    const map = mapRef.current;
    if (map && loaded.current) updateHandles(map, edit?.points ?? null);
  }, [edit]);

  return (
    <div
      ref={ref}
      className={`planner-map${edit ? ' editing' : ''}`}
      role="application"
      aria-label="Map"
      data-testid="planner-map"
    />
  );
}

function midpoints(points: GeoPoint[]): GeoPoint[] {
  const out: GeoPoint[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    out.push({ lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 });
  }
  return out;
}

function updateHandles(map: MlMap, points: GeoPoint[] | null, dragging = false) {
  const src = map.getSource('handles') as GeoJSONSource | undefined;
  if (!src) return;
  if (!points) {
    src.setData({ type: 'FeatureCollection', features: [] });
    return;
  }
  const pt = (p: GeoPoint, kind: string) => ({ type: 'Feature' as const, properties: { kind }, geometry: { type: 'Point' as const, coordinates: [p.lon, p.lat] } });
  const features = [
    ...points.map((p, i) => pt(p, i === 0 || i === points.length - 1 ? 'fixed' : 'cp')),
    ...(dragging ? [] : midpoints(points).map((p) => pt(p, 'mid'))),
  ];
  src.setData({ type: 'FeatureCollection', features });
}

function update(map: MlMap, p: Project, fit: boolean) {
  const features = p.journey.segments.map((s) => {
    const g = (s.selectedAlternative > 0 ? s.alternatives[s.selectedAlternative]?.geometry : undefined) ?? s.geometry;
    return {
      type: 'Feature' as const,
      properties: { color: s.lineStyle.color, approx: s.confidence === 'estimated' },
      geometry: { type: 'LineString' as const, coordinates: unwrapLongitudes(g).map((q) => [q.lon, q.lat]) },
    };
  });
  (map.getSource('route') as GeoJSONSource).setData({ type: 'FeatureCollection', features });
  (map.getSource('stops') as GeoJSONSource).setData({
    type: 'FeatureCollection',
    features: p.journey.stops.map((s) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [s.position.lon, s.position.lat] } })),
  });
  const pts = p.journey.segments.length ? p.journey.segments.flatMap((s) => unwrapLongitudes(s.geometry)) : p.journey.stops.map((s) => s.position);
  if (fit && pts.length) {
    const b = boundsOf(pts);
    if (pts.length === 1) map.jumpTo({ center: [pts[0]!.lon, pts[0]!.lat], zoom: 6 });
    else map.fitBounds([[b.minLon, b.minLat], [b.maxLon, b.maxLat]], { padding: 40, duration: 0, maxZoom: 10 });
  }
}
