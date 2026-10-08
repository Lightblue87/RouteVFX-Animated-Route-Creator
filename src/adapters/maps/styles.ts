import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { openFreeMapLayers, OPENFREEMAP } from './openfreemap';

/**
 * Capability-Matrix je Kartenstil (CLAUDE.md §7). Nur Stile mit status 'verified' und exportAllowed
 * dürfen im Export verwendet werden. Nachweise: docs/EXTERNAL_EVIDENCE.md.
 */
export interface MapStyleInfo {
  id: string;
  category: 'standard' | 'satellite' | 'hybrid' | 'terrain3d' | 'minimal';
  variant: 'light' | 'dark';
  provider: string;
  interactive: boolean;
  offlineCached: boolean;
  exportAllowed: boolean;
  allow4k: boolean;
  attribution: string;
  attributionRequired: boolean;
  supports3d: boolean;
  status: 'verified' | 'unknown' | 'blocked';
  evidence: string;
  /** Lädt Kartendaten von einem Drittanbieter (IP-Adresse + Kartenausschnitt werden übertragen). */
  online?: boolean;
}

export const MAP_STYLES: MapStyleInfo[] = [
  {
    id: 'ne-light', category: 'minimal', variant: 'light', provider: 'Natural Earth (lokal gebündelt)',
    interactive: true, offlineCached: true, exportAllowed: true, allow4k: true,
    attribution: 'Made with Natural Earth', attributionRequired: false, supports3d: false,
    status: 'verified', evidence: 'EXTERNAL_EVIDENCE.md#e04-natural-earth',
  },
  {
    id: 'ne-dark', category: 'minimal', variant: 'dark', provider: 'Natural Earth (lokal gebündelt)',
    interactive: true, offlineCached: true, exportAllowed: true, allow4k: true,
    attribution: 'Made with Natural Earth', attributionRequired: false, supports3d: false,
    status: 'verified', evidence: 'EXTERNAL_EVIDENCE.md#e04-natural-earth',
  },
  // Detailkarte: OSM-Daten über die öffentliche OpenFreeMap-Instanz (kostenlos, ohne Schlüssel; ADR-002, R-01).
  // Export erlaubt; OpenFreeMap verlangt für Video die Attribution unten (README „Attribution“).
  {
    id: 'ofm-positron', category: 'standard', variant: 'light', provider: 'OpenFreeMap (OpenStreetMap)',
    interactive: true, offlineCached: false, exportAllowed: true, allow4k: true,
    attribution: OPENFREEMAP.attribution, attributionRequired: true, supports3d: false,
    status: 'verified', evidence: 'EXTERNAL_EVIDENCE.md#e04-openfreemap', online: true,
  },
  {
    id: 'ofm-dark', category: 'standard', variant: 'dark', provider: 'OpenFreeMap (OpenStreetMap)',
    interactive: true, offlineCached: false, exportAllowed: true, allow4k: true,
    attribution: OPENFREEMAP.attribution, attributionRequired: true, supports3d: false,
    status: 'verified', evidence: 'EXTERNAL_EVIDENCE.md#e04-openfreemap', online: true,
  },
  // Weitere Kategorien (Satellit/Hybrid/3D-Gelände, Apple) sind gesperrt, bis E01–E04 geklärt sind.
];

export const getStyleInfo = (id: string): MapStyleInfo => MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]!;

const PALETTE = {
  'ne-light': { water: '#cfe3f2', land: '#f4f1ea', border: '#c9c2b4', lake: '#cfe3f2' },
  'ne-dark': { water: '#0d1b2a', land: '#1f2a36', border: '#3a4756', lake: '#0d1b2a' },
} as const;

function naturalEarthLayers(pal: { water: string; land: string; border: string; lake: string }, maxzoom?: number): LayerSpecification[] {
  const z = maxzoom === undefined ? {} : { maxzoom };
  return [
    { id: 'water', type: 'background', paint: { 'background-color': pal.water }, ...z },
    { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': pal.land, 'fill-antialias': true }, ...z },
    { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': pal.lake }, ...z },
    { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': pal.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 8, 1.2] }, ...z },
  ];
}

export type LabelLang = 'de' | 'en';

export function buildStyle(id: string, baseUrl: string, lang: LabelLang = 'de'): StyleSpecification {
  const info = getStyleInfo(id);
  const data = (f: string) => new URL(`geodata/${f}`, baseUrl).toString();
  const naturalEarth = {
    countries: { type: 'geojson' as const, data: data('countries.json'), attribution: 'Made with Natural Earth' },
    lakes: { type: 'geojson' as const, data: data('lakes.json') },
  };
  if (info.id === 'ofm-positron' || info.id === 'ofm-dark') {
    const ofm = openFreeMapLayers(info.id === 'ofm-dark' ? 'dark' : 'positron', lang);
    // Natural Earth bis Zoom 7 unter den OpenFreeMap-Ebenen: ohne Netz bleibt eine Land/Wasser-Karte sichtbar.
    // Darüber nicht, weil die groben Küstenlinien sonst neben den genauen OSM-Gewässern auffallen würden.
    // Eigene ID-Präfixe vermeiden Kollisionen mit OpenFreeMap-Layern („water“).
    const ne = naturalEarthLayers(ofm.palette, 7).map((l) => ({ ...l, id: `ne-${l.id}` }));
    return {
      version: 8,
      glyphs: OPENFREEMAP.glyphs,
      sprite: OPENFREEMAP.sprite,
      sources: { ...naturalEarth, openmaptiles: { type: 'vector', url: OPENFREEMAP.tilejson, attribution: OPENFREEMAP.attributionHtml } },
      layers: [ofm.background, ...ne, ...ofm.layers],
    };
  }
  const pal = PALETTE[info.id as keyof typeof PALETTE] ?? PALETTE['ne-light'];
  return { version: 8, sources: naturalEarth, layers: naturalEarthLayers(pal) };
}
