// Baut kompakte Offline-Geodaten aus Natural Earth (gemeinfrei, siehe docs/EXTERNAL_EVIDENCE.md).
// Ausgabe: public/geodata/*.json. Reproduzierbar über festen Commit-Hash.
import { mkdir, writeFile } from 'node:fs/promises';

const NE_COMMIT = 'ca96624a56bd078437bca8184e78163e5039ad19'; // gepinnt am 2026-10-08
const BASE = `https://raw.githubusercontent.com/nvkelso/natural-earth-vector/${NE_COMMIT}/geojson`;
const OUT = new URL('../public/geodata/', import.meta.url);

const round = (n, d) => Math.round(n * 10 ** d) / 10 ** d;
function roundCoords(c, d) {
  return typeof c[0] === 'number' ? [round(c[0], d), round(c[1], d)] : c.map((x) => roundCoords(x, d));
}
// Entfernt aufeinanderfolgende Duplikate nach dem Runden.
function dedupe(geom) {
  const ring = (r) => {
    const out = [];
    for (const p of r) {
      const l = out[out.length - 1];
      if (!l || l[0] !== p[0] || l[1] !== p[1]) out.push(p);
    }
    return out.length >= 4 ? out : null;
  };
  if (geom.type === 'Polygon') {
    const rings = geom.coordinates.map(ring).filter(Boolean);
    return rings.length ? { type: 'Polygon', coordinates: rings } : null;
  }
  if (geom.type === 'MultiPolygon') {
    const polys = geom.coordinates.map((p) => p.map(ring).filter(Boolean)).filter((p) => p.length);
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null;
  }
  return geom;
}

async function get(name) {
  const res = await fetch(`${BASE}/${name}.geojson`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

async function polygons(name, file, keep, digits = 3) {
  const fc = await get(name);
  const features = fc.features
    .map((f) => {
      const g = dedupe({ ...f.geometry, coordinates: roundCoords(f.geometry.coordinates, digits) });
      return g && { type: 'Feature', properties: keep(f.properties), geometry: g };
    })
    .filter(Boolean);
  await writeFile(new URL(file, OUT), JSON.stringify({ type: 'FeatureCollection', features }));
  console.log(file, features.length);
}

await mkdir(OUT, { recursive: true });
await polygons('ne_50m_admin_0_countries', 'countries.json', (p) => ({ iso: p.ISO_A2_EH ?? p.ISO_A2, name: p.NAME }));
await polygons('ne_50m_lakes', 'lakes.json', () => ({}));

// Orte: kompakt als Array [name, lat, lon, iso, popRank, aliases]
// aliases: deutsche/englische Namensvarianten (z. B. "Hannover" für "Hanover"), durch '|' getrennt.
const places = await get('ne_10m_populated_places');
const placeRows = places.features
  .map((f) => {
    const p = f.properties;
    const aliases = [...new Set([p.NAME_DE, p.NAME_EN, p.NAMEASCII].filter((a) => a && a !== p.NAME))].join('|');
    return [p.NAME, round(p.LATITUDE, 4), round(p.LONGITUDE, 4), p.ISO_A2, p.RANK_MAX ?? 0, aliases];
  })
  .sort((a, b) => b[4] - a[4]);
await writeFile(new URL('places.json', OUT), JSON.stringify(placeRows));
console.log('places.json', placeRows.length);

// Flughäfen: [name, lat, lon, iata]
const airports = await get('ne_10m_airports');
const airportRows = airports.features
  .map((f) => [f.properties.name, round(f.geometry.coordinates[1], 4), round(f.geometry.coordinates[0], 4), f.properties.iata_code ?? ''])
  .filter((r) => r[3]);
await writeFile(new URL('airports.json', OUT), JSON.stringify(airportRows));
console.log('airports.json', airportRows.length);

// Häfen: [name, lat, lon]
const ports = await get('ne_10m_ports');
const portRows = ports.features.map((f) => [f.properties.name, round(f.geometry.coordinates[1], 4), round(f.geometry.coordinates[0], 4)]);
await writeFile(new URL('ports.json', OUT), JSON.stringify(portRows));
console.log('ports.json', portRows.length);
