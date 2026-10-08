import '../adapters/maps/setup';
import { useEffect, useRef } from 'react';
import { Map as MlMap, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl';
import type { Project } from '../core/project/schema';
import { buildStyle } from '../adapters/maps/styles';
import { boundsOf, unwrapLongitudes } from '../core/geodesy';
import type { GeoPoint } from '../core/types';

/** Interaktive Planungskarte: Tippen fügt Stopp hinzu. Geschätzte Abschnitte gestrichelt. */
export function PlannerMap({ project, onTap }: { project: Project; onTap: (p: GeoPoint) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const tapRef = useRef(onTap);
  tapRef.current = onTap;
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
    map.on('click', (e: MapMouseEvent) => tapRef.current({ lat: e.lngLat.lat, lon: e.lngLat.wrap().lng }));
    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('stops', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#ffffff', 'line-width': 7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'route', type: 'line', source: 'route', filter: ['!', ['get', 'approx']], paint: { 'line-color': ['get', 'color'], 'line-width': 4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } });
      map.addLayer({ id: 'route-approx', type: 'line', source: 'route', filter: ['get', 'approx'], paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [1, 2] }, layout: { 'line-join': 'round' } });
      map.addLayer({ id: 'stops', type: 'circle', source: 'stops', paint: { 'circle-radius': 7, 'circle-color': '#ffffff', 'circle-stroke-color': '#1c1c1e', 'circle-stroke-width': 3 } });
      loaded.current = true;
      update(map, project, true);
    });
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

  return <div ref={ref} className="planner-map" role="application" aria-label="Map" data-testid="planner-map" />;
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
