// Minimale Typen für die Test-Hilfsbibliotheken (nur zum Erzeugen synthetischer Vektorkacheln im E2E-Mock).
declare module 'geojson-vt' {
  interface Tile { features: unknown[] }
  interface Index { getTile(z: number, x: number, y: number): Tile | null }
  export default function geojsonvt(data: unknown, options?: Record<string, number>): Index;
}
declare module 'vt-pbf' {
  const vtpbf: { fromGeojsonVt(layers: Record<string, unknown>, options?: { version?: number }): Uint8Array };
  export default vtpbf;
}
