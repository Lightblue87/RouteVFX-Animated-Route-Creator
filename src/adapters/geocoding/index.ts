import { z } from 'zod';
import type { GeoPoint } from '../../core/types';
import { sanitizeLabel } from '../../features/imports/gpx';

export interface Place {
  name: string;
  detail: string;
  point: GeoPoint;
  source: 'natural-earth' | 'nominatim' | 'coordinates';
  attribution?: string;
}

type PlaceRow = [name: string, lat: number, lon: number, iso: string, rank: number, aliases: string];
type AirportRow = [name: string, lat: number, lon: number, iata: string];

let placesPromise: Promise<PlaceRow[]> | null = null;
let airportsPromise: Promise<AirportRow[]> | null = null;

const dataUrl = (f: string) => new URL(`geodata/${f}`, document.baseURI).toString();

export function loadPlaces(): Promise<PlaceRow[]> {
  placesPromise ??= fetch(dataUrl('places.json')).then((r) => r.json() as Promise<PlaceRow[]>);
  return placesPromise;
}
export function loadAirports(): Promise<AirportRow[]> {
  airportsPromise ??= fetch(dataUrl('airports.json')).then((r) => r.json() as Promise<AirportRow[]>);
  return airportsPromise;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** "52.37, 9.73" → Koordinate */
export function parseCoordinates(q: string): GeoPoint | null {
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
}

/** Offline-Suche in Natural-Earth-Orten (gemeinfrei) und Flughäfen (IATA). Keine Netzübertragung. */
export function searchOffline(places: PlaceRow[], airports: AirportRow[], query: string, limit = 8): Place[] {
  const q = fold(query.trim());
  if (q.length < 2) return [];
  const coord = parseCoordinates(query);
  const out: Place[] = [];
  if (coord) out.push({ name: `${coord.lat.toFixed(4)}, ${coord.lon.toFixed(4)}`, detail: '', point: coord, source: 'coordinates' });
  const scored: [number, Place][] = [];
  for (const [name, lat, lon, iso, rank, aliases] of places) {
    const names = [name, ...(aliases ? aliases.split('|') : [])].map(fold);
    let score = -1;
    for (const n of names) {
      if (n === q) score = Math.max(score, 3);
      else if (n.startsWith(q)) score = Math.max(score, 2);
      else if (q.length >= 3 && n.includes(q)) score = Math.max(score, 1);
    }
    if (score >= 0) scored.push([score * 100 + rank, { name, detail: iso, point: { lat, lon }, source: 'natural-earth' }]);
  }
  for (const [name, lat, lon, iata] of airports) {
    const qi = q.toUpperCase();
    if (iata === qi || fold(name).includes(q)) scored.push([iata === qi ? 350 : 150, { name: `${name} (${iata})`, detail: '✈', point: { lat, lon }, source: 'natural-earth' }]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  for (const [, p] of scored) {
    if (out.length >= limit) break;
    out.push(p);
  }
  return out;
}

const NominatimResult = z.array(z.object({ lat: z.string(), lon: z.string(), display_name: z.string() }));

/**
 * Nominatim (OSMF). Richtlinie: kein Autocomplete, max. 1 Anfrage/s → nur auf ausdrückliches Absenden.
 * Status: implementiert, NICHT live verifiziert (Sandbox blockiert Host). Opt-in erforderlich.
 */
export async function searchNominatim(query: string, lang: string, signal?: AbortSignal): Promise<Place[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${encodeURIComponent(lang)}&q=${encodeURIComponent(query.slice(0, 200))}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = NominatimResult.parse(await res.json());
  return parsed.map((r) => {
    const [first, ...rest] = r.display_name.split(',');
    return {
      name: sanitizeLabel(first),
      detail: sanitizeLabel(rest.join(','), 120),
      point: { lat: Number(r.lat), lon: Number(r.lon) },
      source: 'nominatim' as const,
      attribution: '© OpenStreetMap contributors (ODbL), Nominatim',
    };
  });
}
