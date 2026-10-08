// Erzeugt ein winziges, synthetisches PMTiles-v3-Archiv (Protomaps-Basemap-Schema) für Tests.
// Keine echten OSM-Daten: Geometrien sind frei erfunden (Rechtecke/Linien um Hannover), damit Tests
// offline und lizenzfrei laufen. Aufruf: node scripts/make-test-pmtiles.mjs tests/fixtures/mini.pmtiles
import { writeFileSync } from 'node:fs';
import geojsonvt from 'geojson-vt';
import vtpbf from 'vt-pbf';
import { zxyToTileId } from 'pmtiles';

const out = process.argv[2] ?? 'tests/fixtures/mini.pmtiles';
const MIN_ZOOM = 0;
const MAX_ZOOM = 8;
const BBOX = [8.5, 51.8, 11.0, 52.9]; // lon/lat, grob Region Hannover

const fc = (features) => ({ type: 'FeatureCollection', features });
const poly = (props, ring) => ({ type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring] } });
const line = (props, coords) => ({ type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } });
const point = (props, c) => ({ type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: c } });
const rect = (w, s, e, n) => [[w, s], [e, s], [e, n], [w, n], [w, s]];

const layers = {
  earth: fc([poly({ kind: 'earth' }, rect(-180, -85, 180, 85))]),
  water: fc([poly({ kind: 'water', name: 'Maschsee' }, rect(9.72, 52.34, 9.76, 52.36))]),
  landuse: fc([poly({ kind: 'park', name: 'Eilenriede' }, rect(9.76, 52.37, 9.82, 52.40))]),
  roads: fc([
    line({ kind: 'highway', ref: 'A2', min_zoom: 4 }, [[8.5, 52.42], [9.7, 52.43], [11.0, 52.44]]),
    line({ kind: 'highway', ref: 'A7', min_zoom: 4 }, [[9.85, 51.8], [9.84, 52.4], [9.86, 52.9]]),
    line({ kind: 'major', name: 'Hildesheimer Straße', min_zoom: 6 }, [[9.74, 52.37], [9.77, 52.33], [9.85, 52.25]]),
  ]),
  places: fc([
    point({ kind: 'locality', kind_detail: 'city', name: 'Hannover', 'name:de': 'Hannover', 'name:en': 'Hanover', min_zoom: 3, population_rank: 12 }, [9.7375, 52.3745]),
  ]),
};

const indexes = Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, geojsonvt(v, { maxZoom: MAX_ZOOM, indexMaxZoom: MAX_ZOOM, extent: 4096, buffer: 64 })]));

const lon2x = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

const tiles = [];
for (let z = MIN_ZOOM; z <= MAX_ZOOM; z++) {
  for (let x = lon2x(BBOX[0], z); x <= lon2x(BBOX[2], z); x++) {
    for (let y = lat2y(BBOX[3], z); y <= lat2y(BBOX[1], z); y++) {
      const tileLayers = {};
      for (const [name, idx] of Object.entries(indexes)) {
        const t = idx.getTile(z, x, y);
        if (t && t.features.length) tileLayers[name] = t;
      }
      if (!Object.keys(tileLayers).length) continue;
      tiles.push({ id: zxyToTileId(z, x, y), data: Buffer.from(vtpbf.fromGeojsonVt(tileLayers, { version: 2 })) });
    }
  }
}
tiles.sort((a, b) => a.id - b.id);

// --- PMTiles v3 schreiben (Spezifikation: github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md) ---
const varint = (arr, n) => {
  while (n >= 0x80) {
    arr.push((n % 0x80) | 0x80);
    n = Math.floor(n / 0x80);
  }
  arr.push(n);
};
const entries = [];
let offset = 0;
for (const t of tiles) {
  entries.push({ tileId: t.id, offset, length: t.data.length, runLength: 1 });
  offset += t.data.length;
}
const dir = [];
varint(dir, entries.length);
let last = 0;
for (const e of entries) { varint(dir, e.tileId - last); last = e.tileId; }
for (const e of entries) varint(dir, e.runLength);
for (const e of entries) varint(dir, e.length);
entries.forEach((e, i) => {
  const prev = entries[i - 1];
  varint(dir, i > 0 && e.offset === prev.offset + prev.length ? 0 : e.offset + 1);
});
const rootDir = Buffer.from(dir);
const metadata = Buffer.from(JSON.stringify({
  name: 'RouteVFX test fixture (synthetic, not OSM data)',
  vector_layers: Object.keys(layers).map((id) => ({ id, fields: {} })),
}));
const tileData = Buffer.concat(tiles.map((t) => t.data));

const header = Buffer.alloc(127);
header.write('PMTiles', 0, 'ascii');
header.writeUInt8(3, 7);
const rootOff = 127;
const metaOff = rootOff + rootDir.length;
const dataOff = metaOff + metadata.length;
const u64 = (pos, v) => header.writeBigUInt64LE(BigInt(v), pos);
u64(8, rootOff); u64(16, rootDir.length);
u64(24, metaOff); u64(32, metadata.length);
u64(40, 0); u64(48, 0);
u64(56, dataOff); u64(64, tileData.length);
u64(72, tiles.length); u64(80, entries.length); u64(88, tiles.length);
header.writeUInt8(1, 96); // clustered
header.writeUInt8(1, 97); // internal compression: none
header.writeUInt8(1, 98); // tile compression: none
header.writeUInt8(1, 99); // tile type: mvt
header.writeUInt8(MIN_ZOOM, 100);
header.writeUInt8(MAX_ZOOM, 101);
const e7 = (v) => Math.round(v * 1e7);
header.writeInt32LE(e7(BBOX[0]), 102); header.writeInt32LE(e7(BBOX[1]), 106);
header.writeInt32LE(e7(BBOX[2]), 110); header.writeInt32LE(e7(BBOX[3]), 114);
header.writeUInt8(6, 118);
header.writeInt32LE(e7(9.7375), 119); header.writeInt32LE(e7(52.3745), 123);

writeFileSync(out, Buffer.concat([header, rootDir, metadata, tileData]));
console.log(`${out}: ${tiles.length} tiles, ${header.length + rootDir.length + metadata.length + tileData.length} bytes`);
