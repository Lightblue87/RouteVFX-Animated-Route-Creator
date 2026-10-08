import type { LayerSpecification } from 'maplibre-gl';
// Stile aus github.com/hyperknot/openfreemap-styles (Positron: BSD-3 / Design CC BY 4.0; Dark: Dark Matter, dito).
// Lizenzen: ./openfreemap/LICENSE.md. Lokal gebündelt, damit sich der Stil nicht unbemerkt ändert.
import positron from './openfreemap/positron.json';
import dark from './openfreemap/dark.json';

/**
 * Öffentliche OpenFreeMap-Instanz: kostenlos, ohne Schlüssel/Registrierung/Cookies, keine Limits laut README
 * (github.com/hyperknot/openfreemap, geprüft 2026-10-08). Für Video ist die Attribution unten Pflicht.
 */
const HOST = 'https://tiles.openfreemap.org';
export const OPENFREEMAP = {
  origin: HOST,
  tilejson: `${HOST}/planet`,
  glyphs: `${HOST}/fonts/{fontstack}/{range}.pbf`,
  sprite: `${HOST}/sprites/ofm_f384/ofm`,
  attribution: 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap',
  attributionHtml:
    '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
} as const;

type RawStyle = { layers: Record<string, unknown>[] };
const RAW: Record<'positron' | 'dark', RawStyle> = { positron: positron as RawStyle, dark: dark as RawStyle };

const usesName = (v: unknown) => JSON.stringify(v ?? null).includes('"name');

/**
 * Ebenen des gebündelten OpenFreeMap-Stils für unsere Kartenquelle `openmaptiles`:
 * – ohne die Schummerungs-Rasterebene (zusätzlicher Dienst, für Animationen unnötig),
 * – Beschriftungen bevorzugt in der Projektsprache (OpenMapTiles liefert name:de / name:en).
 */
export function openFreeMapLayers(variant: 'positron' | 'dark', lang: 'de' | 'en') {
  const all = structuredClone(RAW[variant].layers) as unknown as LayerSpecification[];
  const background = all.find((l) => l.type === 'background')!;
  const layers = all
    .filter((l) => l.type !== 'background' && l.type !== 'raster')
    .map((l) => {
      const layout = (l as { layout?: Record<string, unknown> }).layout;
      if (layout && usesName(layout['text-field'])) layout['text-field'] = ['coalesce', ['get', `name:${lang}`], layout['text-field']];
      return l;
    });
  const water = (all.find((l) => l.id === 'water') as { paint?: Record<string, unknown> } | undefined)?.paint?.['fill-color'];
  const land = (background as { paint?: Record<string, unknown> }).paint?.['background-color'];
  const palette = {
    water: typeof water === 'string' ? water : '#cfe3f2',
    land: typeof land === 'string' ? land : '#f2f3f0',
    border: variant === 'dark' ? '#3a3a3c' : '#c9c9c9',
    lake: typeof water === 'string' ? water : '#cfe3f2',
  };
  return { background, layers, palette };
}
