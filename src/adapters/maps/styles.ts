import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { layers as protomapsLayers, namedFlavor } from '@protomaps/basemaps';
import { basemapConfig } from './config';

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
  /** Benötigt eine Betreiber-Konfiguration (z. B. PMTiles-URL); ohne sie ist der Stil nicht auswählbar. */
  requires?: 'pmtiles';
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
  // Detailkarte: OSM-Daten (ODbL) im Protomaps-Basemap-Schema, als PMTiles selbst gehostet (ADR-002, R-01).
  // Export erlaubt mit sichtbarer Attribution im Video; Schriften OFL, Sprites MIT (public/basemap-assets).
  {
    id: 'osm-light', category: 'standard', variant: 'light', provider: 'OpenStreetMap (PMTiles, selbst gehostet)',
    interactive: true, offlineCached: false, exportAllowed: true, allow4k: true,
    attribution: '© OpenStreetMap contributors', attributionRequired: true, supports3d: false,
    status: 'verified', evidence: 'EXTERNAL_EVIDENCE.md#e04-osm-pmtiles', requires: 'pmtiles',
  },
  {
    id: 'osm-dark', category: 'standard', variant: 'dark', provider: 'OpenStreetMap (PMTiles, selbst gehostet)',
    interactive: true, offlineCached: false, exportAllowed: true, allow4k: true,
    attribution: '© OpenStreetMap contributors', attributionRequired: true, supports3d: false,
    status: 'verified', evidence: 'EXTERNAL_EVIDENCE.md#e04-osm-pmtiles', requires: 'pmtiles',
  },
  // Weitere Kategorien (Satellit/Hybrid/3D-Gelände, Apple) sind gesperrt, bis E01–E04 geklärt sind.
];

/** Ist der Stil in dieser Installation nutzbar (Konfiguration vorhanden)? */
export function isStyleAvailable(s: MapStyleInfo): boolean {
  return s.requires === 'pmtiles' ? basemapConfig().pmtilesUrl !== null : true;
}

/**
 * Stilinfo für eine Projekt-Referenz. Ist der Stil hier nicht verfügbar (z. B. keine PMTiles-URL), wird die
 * Natural-Earth-Variante gleicher Helligkeit geliefert – Vorschau, Export und Attribution bleiben konsistent.
 */
export function getStyleInfo(id: string): MapStyleInfo {
  const s = MAP_STYLES.find((x) => x.id === id) ?? MAP_STYLES[0]!;
  if (isStyleAvailable(s)) return s;
  return MAP_STYLES.find((x) => x.id === (s.variant === 'dark' ? 'ne-dark' : 'ne-light'))!;
}

const PALETTE = {
  'ne-light': { water: '#cfe3f2', land: '#f4f1ea', border: '#c9c2b4', lake: '#cfe3f2' },
  'ne-dark': { water: '#0d1b2a', land: '#1f2a36', border: '#3a4756', lake: '#0d1b2a' },
} as const;

function naturalEarthLayers(pal: { water: string; land: string; border: string; lake: string }): LayerSpecification[] {
  return [
    { id: 'water', type: 'background', paint: { 'background-color': pal.water } },
    { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': pal.land, 'fill-antialias': true } },
    { id: 'lakes', type: 'fill', source: 'lakes', paint: { 'fill-color': pal.lake } },
    { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': pal.border, 'line-width': ['interpolate', ['linear'], ['zoom'], 2, 0.4, 8, 1.2] } },
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
  const url = basemapConfig().pmtilesUrl;
  if (info.requires === 'pmtiles' && url) {
    const flavor = namedFlavor(info.variant);
    // Natural Earth liegt darunter: Ohne Netz (Kacheln fehlen) bleibt eine neutrale Land/Wasser-Karte sichtbar.
    // Eigene Präfixe: Protomaps nutzt dieselben Layer-IDs (z. B. „water“), doppelte IDs machen den Stil ungültig.
    const ne = naturalEarthLayers({ water: flavor.water, land: flavor.earth, border: flavor.boundaries, lake: flavor.water }).map((l) => ({ ...l, id: `ne-${l.id}` }));
    // Glyphen/Sprites liegen gleich-originig (CSP, offline); Platzhalter {fontstack}/{range} dürfen nicht URL-kodiert werden.
    const assets = new URL('basemap-assets/', baseUrl).toString();
    const osm = (protomapsLayers('protomaps', flavor, { lang }) as LayerSpecification[]).filter((l) => l.type !== 'background');
    return {
      version: 8,
      glyphs: `${assets}fonts/{fontstack}/{range}.pbf`,
      sprite: `${assets}sprites/v4/${info.variant}`,
      sources: {
        ...naturalEarth,
        protomaps: { type: 'vector', url: `pmtiles://${new URL(url, baseUrl).toString()}`, attribution: '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>' },
      },
      layers: [...ne, ...osm],
    };
  }
  const pal = PALETTE[info.id as keyof typeof PALETTE] ?? PALETTE['ne-light'];
  return { version: 8, sources: naturalEarth, layers: naturalEarthLayers(pal) };
}
