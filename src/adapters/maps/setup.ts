import { addProtocol, setWorkerUrl } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
// MapLibre 6 nutzt einen ES-Modul-Worker; Vite bündelt ihn als eigenes, gleich-originiges Asset (CSP: worker-src 'self').
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
// pmtiles:// – liest Vektorkacheln per HTTP-Range-Request aus einer einzelnen, statisch gehosteten Datei.
addProtocol('pmtiles', new Protocol().tile);
