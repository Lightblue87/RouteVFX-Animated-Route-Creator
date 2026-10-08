# Anbieter und Schnittstellen

Stand: 2026-10-08. Nachweise: `EXTERNAL_EVIDENCE.md`. Alle Anbieter sind hinter Schnittstellen gekapselt; das Projektformat ist anbieterneutral (WGS84, Meter, Millisekunden, `source`/`confidence`/`attribution` je Segment).

| Baustein | Schnittstelle | Implementierungen | Netz? | Status |
|---|---|---|---|---|
| Routing | `RoutingProvider` (`src/core/types.ts`) | `greatCircleProvider`, `estimatedProvider` (`src/adapters/routing/local.ts`), `createOrsProxyProvider` (`orsProxy.ts`, über Supabase Edge Function `supabase/functions/route`), `createOsrmProvider` (`osrm.ts`, Prototyp), Auswahl in `config.ts`/`registry.ts` | ORS-Proxy bzw. OSRM (Opt-in) | lokal verifiziert; ORS-Proxy: Handler-, Deno- und SQL-Tests mit Mocks, live ungetestet |
| Geocoding | `searchOffline`, `searchNominatim` (`src/adapters/geocoding`) | Natural Earth Orte/Flughäfen; Nominatim | Nominatim ja (Opt-in) | offline verifiziert; Nominatim ungetestet |
| Kartenstile | `MapStyleInfo` Capability-Matrix (`src/adapters/maps/styles.ts`, `openfreemap.ts`) | `ne-light`, `ne-dark`; `ofm-positron`, `ofm-dark` (OpenFreeMap) | OpenFreeMap ja (nach Stilauswahl) | NE verifiziert; OpenFreeMap mit simuliertem Dienst verifiziert (Sandbox), echter Dienst ungetestet |
| Renderer | `MapLibreSceneRenderer` | MapLibre GL JS 6.13.0 | nein | verifiziert (Sandbox) |
| Encoder | `probeCapabilities`, `exportMp4` (`src/adapters/encoding`) | WebCodecs + mediabunny | nein | 1080p30 verifiziert (Sandbox) |
| Speicher | `src/adapters/storage/idb.ts` | IndexedDB (`idb`) | nein | Integrationstests |

## Pflichtangaben (Attribution)
- Natural Earth: nicht erforderlich, freiwillig „Made with Natural Earth“ – wird im Video unten rechts eingeblendet.
- OSRM/OSM: „Routing: OSRM / FOSSGIS · © OpenStreetMap contributors (ODbL)“ – wird automatisch in die Video-Attribution übernommen, sobald ein Segment aus OSRM stammt; außerdem in der Segmentliste angezeigt.
- Nominatim: „© OpenStreetMap contributors (ODbL), Nominatim“ (gespeichert am Suchergebnis).
- openrouteservice: „© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors“ – am Segment gespeichert und automatisch in die Video-Attribution übernommen.
- OpenFreeMap: „OpenFreeMap © OpenMapTiles Data from OpenStreetMap“ – laut OpenFreeMap-README für Video Pflicht; in jedem Video-Frame unten rechts, in der Vorschau, als Hinweis im Animations-Tab und (mit Links) im MapLibre-Attributionsfeld der Planungskarte.

## Rate-Limits im Client
| Anbieter | Limit im Code |
|---|---|
| ORS-Proxy | Client ≤ 1 Anfrage/s; Proxy: 50/Client/Tag, 1.800/Tag gesamt (unter ORS 2.000), ORS selbst 40/min |
| OSRM | ≤ 1 Anfrage/s, nur bei Segmentänderung |
| Nominatim | nur auf Absenden; keine Autovervollständigung |

## Bekannte Lücken
- Browser können keinen eigenen `User-Agent` setzen; OSRM-/Nominatim-Richtlinien verlangen Identifikation (Referer wird gesendet). Vor Release mit Betreibern klären oder eigenen Proxy (Kosten!) bzw. Anbieter mit Schlüssel verwenden.
- Bahn/Schiff/ÖPNV: kein Anbieter.
