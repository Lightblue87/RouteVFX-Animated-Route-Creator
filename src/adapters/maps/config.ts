/**
 * Konfiguration der selbst gehosteten Detailkarte (OSM-Vektorkacheln als PMTiles, ADR-002).
 * Die URL ist öffentlich (kein Geheimnis) und wird zur Build-Zeit über VITE_PMTILES_URL gesetzt.
 * Ohne URL ist der Detailstil nicht verfügbar; Projekte fallen sichtbar auf Natural Earth zurück.
 */
export interface BasemapConfig {
  pmtilesUrl: string | null;
}

function fromEnv(): BasemapConfig {
  const raw = (import.meta.env.VITE_PMTILES_URL as string | undefined)?.trim();
  return { pmtilesUrl: raw ? raw : null };
}

let config: BasemapConfig = fromEnv();

export const basemapConfig = (): BasemapConfig => config;

/** Nur für Tests. */
export function _setBasemapConfig(next: Partial<BasemapConfig>): void {
  config = { ...config, ...next };
}
