# Anbieter und Schnittstellen

Stand: 2026-10-08. Nachweise: `EXTERNAL_EVIDENCE.md`. Alle Anbieter sind hinter Schnittstellen gekapselt; das Projektformat ist anbieterneutral (WGS84, Meter, Millisekunden, `source`/`confidence`/`attribution` je Segment).

| Baustein | Schnittstelle | Implementierungen | Netz? | Status |
|---|---|---|---|---|
| Routing | `RoutingProvider` (`src/core/types.ts`) | `greatCircleProvider`, `estimatedProvider` (`src/adapters/routing/local.ts`), `createOsrmProvider` (`osrm.ts`), Auswahl in `registry.ts` | OSRM ja (Opt-in) | lokal verifiziert; OSRM nur Contract-Test mit Mock |
| Geocoding | `searchOffline`, `searchNominatim` (`src/adapters/geocoding`) | Natural Earth Orte/Flughäfen; Nominatim | Nominatim ja (Opt-in) | offline verifiziert; Nominatim ungetestet |
| Kartenstile | `MapStyleInfo` Capability-Matrix (`src/adapters/maps/styles.ts`), Konfiguration `src/adapters/maps/config.ts` | `ne-light`, `ne-dark`; `osm-light`, `osm-dark` (PMTiles, nur mit `VITE_PMTILES_URL`) | OSM-Stile: Range-Requests an den eigenen Kachel-Host | NE verifiziert; OSM mit synthetischem Testarchiv verifiziert (Sandbox), echter Build/Hosting offen |
| Renderer | `MapLibreSceneRenderer` | MapLibre GL JS 6.13.0 | nein | verifiziert (Sandbox) |
| Encoder | `probeCapabilities`, `exportMp4` (`src/adapters/encoding`) | WebCodecs + mediabunny | nein | 1080p30 verifiziert (Sandbox) |
| Speicher | `src/adapters/storage/idb.ts` | IndexedDB (`idb`) | nein | Integrationstests |

## Pflichtangaben (Attribution)
- Natural Earth: nicht erforderlich, freiwillig „Made with Natural Earth“ – wird im Video unten rechts eingeblendet.
- OSRM/OSM: „Routing: OSRM / FOSSGIS · © OpenStreetMap contributors (ODbL)“ – wird automatisch in die Video-Attribution übernommen, sobald ein Segment aus OSRM stammt; außerdem in der Segmentliste angezeigt.
- Nominatim: „© OpenStreetMap contributors (ODbL), Nominatim“ (gespeichert am Suchergebnis).
- Detailkarte (OSM-PMTiles): „© OpenStreetMap contributors“ – in jedem Video-Frame unten rechts, in der Vorschau und als Hinweis im Animations-Tab; MapLibre-Attribution mit Link auf openstreetmap.org/copyright in der Planungskarte. Schriften (OFL) und Sprites (MIT) mit Lizenzdateien in `public/basemap-assets/`.

## Rate-Limits im Client
| Anbieter | Limit im Code |
|---|---|
| OSRM | ≤ 1 Anfrage/s, nur bei Segmentänderung |
| Nominatim | nur auf Absenden; keine Autovervollständigung |

## Bekannte Lücken
- Browser können keinen eigenen `User-Agent` setzen; OSRM-/Nominatim-Richtlinien verlangen Identifikation (Referer wird gesendet). Vor Release mit Betreibern klären oder eigenen Proxy (Kosten!) bzw. Anbieter mit Schlüssel verwenden.
- Bahn/Schiff/ÖPNV: kein Anbieter.
