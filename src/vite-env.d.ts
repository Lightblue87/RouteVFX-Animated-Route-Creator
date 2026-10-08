/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Öffentliche URL der selbst gehosteten OSM-PMTiles-Datei (kein Geheimnis). Leer = Detailkarte deaktiviert. */
  readonly VITE_PMTILES_URL?: string;
}
