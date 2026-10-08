import type { StyleSpecification } from 'maplibre-gl';

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
  // Weitere Kategorien (Standard/Satellit/Hybrid/3D-Gelände, Apple) sind gesperrt, bis E01–E04 geklärt sind.
];

export const getStyleInfo = (id: string): MapStyleInfo => MAP_STYLES.find((s) => s.id === id) ?? MAP_STYLES[0]!;

const PALETTE = {
  'ne-light': { water: '#cfe3f2', land: '#f4f1ea', border: '#c9c2b4', lake: '#cfe3f2' },
  'ne-dark': { water: '#0d1b2a', land: '#1f2a36', border: '#3a4756', lake: '#0d1b2a' },
} as const;

export function buildStyle(id: string, baseUrl: string): StyleSpecification {
  const pal = PALETTE[id as keyof typeof PALETTE] ?? PALETTE['ne-light'];
  const data = (f: string) => new URL(`geodata/${f}`, baseUrl).toString();
  return {
    version: 8,
    sources: {
      countries: { type: 'geojson', data: data('countries.json'), attribution: 'Made with Natural Earth' },
      lakes: { type: 'geojson', data: data('lakes.json') },
    },
    layers: [
      { id: 'water', type: 'background', paint: { 'background-color': pal.water } },
      { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': pal.land, 'fill-antialias': true } },
      { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': pal.lake } },
      { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': pal.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 8, 1.2] } },
    ],
  };
}
