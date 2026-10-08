import { setWorkerUrl } from 'maplibre-gl';
// MapLibre 6 nutzt einen ES-Modul-Worker; Vite bündelt ihn als eigenes, gleich-originiges Asset (CSP: worker-src 'self').
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

setWorkerUrl(workerUrl);
