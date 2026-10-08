# Externe Nachweise (E01–E15)

Prüfdatum aller Einträge: **2026-10-08**. Prüfer: Claude Code (automatisiert). Verantwortlich für Freigaben: Produktverantwortliche/r (Repo-Owner).
Ergebnis: `VERIFIED` / `BLOCKED` / `UNKNOWN`.

**Einschränkung der Prüfumgebung:** Die Sandbox-Netzwerkrichtlinie blockiert u. a. `tiles.openfreemap.org`, `router.project-osrm.org`, `routing.openstreetmap.de`, `nominatim.openstreetmap.org`, `demotiles.maplibre.org`; DNS-Auflösung scheiterte für `operations.osmfoundation.org`, `openfreemap.org`, `www.fossgis.de`, `www.naturalearthdata.com`. Wo Primärquellen nicht abrufbar waren, ist das Ergebnis `UNKNOWN`, auch wenn Sekundärquellen Hinweise liefern.

| ID | Thema | Ergebnis | Fundstelle / Beleg | Konsequenz |
|---|---|---|---|---|
| E01 | Apple MapKit JS: Capture/Export animierter Videos | **BLOCKED (unbelegt)** | developer.apple.com/maps/web nennt nur Quoten. Erlaubnis zum Video-Capture nicht gefunden. Sekundär (Developer-Forum, LawInsider-Auszüge der DPLA): „Map Data may not be cached, pre-fetched, or stored … other than on a temporary and limited basis“; Logo/Links dürfen nicht entfernt werden. | Apple-Material **nicht** als Exportquelle. |
| E02 | Apple-Stile (Satellit/Hybrid/3D) im Web-SDK + Rechte | UNKNOWN | Nicht geprüft (setzt E01/E03 voraus). | Stile nur über alternative Quelle. |
| E03 | Apple Maps Zugang/Quoten | **VERIFIED (Quoten)** / Kosten UNKNOWN | https://developer.apple.com/maps/web/ : „MapKit JS provides a free daily limit of 250,000 map views and 25,000 service calls per Apple Developer Program membership.“ Snapshots: „25,000 unique requests per day“. Mitgliedschaft erforderlich (kostenpflichtig; Betrag nicht in dieser Sitzung geprüft). | Keine Apple-Pflichtabhängigkeit; Kosten nur mit deiner Freigabe. |
| E04 | Kartendaten mit Exportrecht | **Natural Earth: VERIFIED**; OSM-PMTiles (selbst gehostet): **VERIFIED mit Attribution** (s. Abschnitt E04-OSM); OpenFreeMap: UNKNOWN (nicht gewählt) | Natural Earth `LICENSE.md` (Commit `ca96624a56bd078437bca8184e78163e5039ad19`): „All versions of Natural Earth raster + vector map data … are in the public domain. You may use the maps in any manner …“. OpenFreeMap: nur Sekundärquellen (kostenlos, ohne Key, Attribution „OpenFreeMap © OpenMapTiles Data from OpenStreetMap“). OSM-Tile-Policy nicht abrufbar. | Nur Natural Earth exportierbar. |
| E05 | Routinganbieter je Modus | UNKNOWN | OSRM-Wiki „API Usage Policy“ (Sekundär, gilt für alten Demoserver): keine intensive Nutzung, Attribution, echter User-Agent, Logs der Anfragen. Verweis auf FOSSGIS-Nutzungsbedingungen (nicht abrufbar). Keine lizenzierten Bahn-/Fähr-/ÖPNV-Geometrien identifiziert. | Opt-in, Drosselung, gekennzeichnete Näherung. |
| E06 | Geocoding | Natural Earth Orte: VERIFIED; Nominatim: UNKNOWN | Nominatim-Policy (Sekundärzitate): kein clientseitiges Autocomplete, ~1 Anfrage/s. Photon: Fair-Use, Bedingungen nicht abgerufen. | Offline-Suche Standard; Nominatim nur bei Absenden + Opt-in. |
| E07 | GPX/XML + Kartenlinks | GPX: VERIFIED (eigene Tests); Kartenlinks: UNKNOWN | 9 GPX-Unit-Tests (gültig, mehrere Segmente, rte, GPX 1.0, ungültiges XML, DOCTYPE/ENTITY, Größenlimit, Koordinatenprüfung). | Kartenlinks nicht implementiert. |
| E08 | MP4/H.264/AAC im Browser | **Teilweise VERIFIED** | Chrome for Testing 141.0.7390.122 (Linux, headless): `VideoEncoder` avc1 1080×1920 und 2160×3840 bei 30/60 fps **unterstützt**; `AudioEncoder` mp4a.40.2 **nicht unterstützt**; MediaRecorder `video/mp4;codecs=avc1` unterstützt. Playwright-Chromium 141 (Open Source): **kein** H.264. iOS Safari / Android Chrome: UNKNOWN. | Nur geprüfte Profile freigeben; Gerätetest Pflicht. |
| E09 | 3-min-4K60 auf Smartphones | UNKNOWN | Keine Geräte verfügbar. Sandbox-Messungen siehe PERFORMANCE.md (nicht repräsentativ). | Profile nach Feldtest zurückstufen. |
| E10 | PWA-GPS Hintergrund | UNKNOWN | Nicht geprüft. | Nur aktive Aufzeichnung. |
| E11 | Rechte Assets (3D/Musik/SFX/Fonts) | Karten-Schriften/Sprites: **VERIFIED**; 3D/Musik/SFX: UNKNOWN | Detailkarte: Noto-Sans-Glyphen (SIL OFL 1.1, `public/basemap-assets/fonts/OFL.txt`) und Sprites (abgeleitet aus tangrams/icons, MIT, `public/basemap-assets/sprites/LICENSE-tangrams-icons.md`), Quelle github.com/protomaps/basemaps-assets README, abgerufen 2026-10-08. Sonst keine Fremd-Assets (Fahrzeugsymbole selbst gezeichnet, Systemschriften). Logos aus Repo = Eigentum des Repo-Owners. | Keine Musik-/3D-Bibliothek ausliefern. |
| E12 | Hosting-/Auth-/Storage-Kosten | PMTiles-Hosting: **teilweise VERIFIED (Sekundär-/Doku-Suche)**, Rest UNKNOWN | Cloudflare R2 (developers.cloudflare.com/r2/pricing): 10 GB-Monat Speicher, 1 Mio. Class-A-, 10 Mio. Class-B-Operationen/Monat frei, Egress kostenlos; laut Drittanleitungen verlangt R2 beim ersten Aktivieren eine **Zahlungsmethode** (nicht primär belegt). GitHub Pages (docs.github.com/…/github-pages-limits): Site ≤ 1 GB, 100 GB/Monat Bandbreite (weich), Range-Request-Unterstützung **nicht belegt**. Protomaps-Planet ≈ 120 GB (z0–15) → passt in kein geprüftes Freikontingent ohne Ausschnitt. | Kein Hosting ohne deine Freigabe (Konto/Zahlungsmethode); Detailkarte bleibt bis dahin deaktiviert. |
| E13 | Web Share mit MP4 in PWAs | UNKNOWN | Implementiert mit `navigator.canShare({files})`-Prüfung; nicht auf Geräten getestet. | Download als Fallback (verifiziert). |
| E14 | DSGVO / Drittanbieter | UNKNOWN | Online-Dienste standardmäßig aus, Opt-in mit Erklärung. Keine Tracker. | Rechtliche Prüfung vor Release. |
| E15 | Cloud-Backend (RLS, E-Mail, Löschung) | UNKNOWN | Phase 6. | V1 ohne Cloud. |

## E04-OSM: Detailkarte aus selbst gehosteten OSM-PMTiles {#e04-osm-pmtiles}

Prüfdatum 2026-10-08. Entscheidung des Produktverantwortlichen: selbst gehostete PMTiles (ADR-002).

| Baustein | Lizenz / Bedingung | Beleg | Ergebnis |
|---|---|---|---|
| Kacheldaten (Protomaps-Basemap-Build aus OSM) | ODbL; sichtbare Attribution „© OpenStreetMap“ bei öffentlicher Nutzung | docs.protomaps.com/basemaps/downloads (Suche): „Tilesets are ODbL … attribute © OpenStreetMap“; Builds sollen kopiert, nicht verlinkt werden („hotlinking … discouraged“) | VERIFIED (Sekundär über Doku-Suche; Seite selbst nicht abrufbar) |
| Video als „Produced Work“ | ODbL-Hinweis, den ein Betrachter bemerkt; LWG-Entwurf 2022 für Videos: bei Karte als Hauptelement Attribution in der Kartenecke | osmfoundation.org/wiki/Licence_and_Legal_FAQ, LWG-Protokoll 2022-03-17 (Suche) | VERIFIED für „Attribution in der Ecke“ (umgesetzt: Overlay unten rechts in jedem Frame); finaler Leitlinientext für Video nicht abgerufen |
| Stil (@protomaps/basemaps 5.7.2) | Code BSD-3-Clause, Kartendesign CC0 | npm-Metadaten, Repo-README (Suche) | VERIFIED |
| Bibliothek pmtiles 4.5.0 | BSD-3-Clause | npm-Metadaten | VERIFIED |
| Schriften/Sprites | OFL 1.1 / MIT | basemaps-assets README + Lizenzdateien (abgerufen über raw.githubusercontent.com) | VERIFIED |
| Kompatibilität Stil 5.x ↔ Planet-Build v4 | laut Doku „Version 4 build compatible with @protomaps/basemaps style v4.0.0 and newer“ | Suche | UNKNOWN bis Test mit echtem Build (Sandbox erreicht build.protomaps.com nicht) |
| tile.openstreetmap.org / OSM-Vektorkacheln der OSMF | Bulk/Offline-Prefetch verboten | operations.osmfoundation.org/policies/tiles (Suche) | Nicht genutzt |

Technisch verifiziert (Sandbox, synthetisches Testarchiv `tests/fixtures/mini.pmtiles`, **keine echten OSM-Daten**): MapLibre lädt Kacheln ausschließlich per Range-Request (206), Stil besteht die MapLibre-Validierung, Vorschau zeigt Straßen/Gewässer/Labels und die OSM-Attribution; ohne erreichbare Datei bleibt Natural Earth darunter sichtbar.

## Lizenzen der verwendeten Bibliotheken (npm-Metadaten, 2026-10-08)

| Paket | Version | Lizenz |
|---|---|---|
| maplibre-gl | 6.13.0 | BSD-3-Clause |
| mediabunny | 1.61.3 | MPL-2.0 |
| react / react-dom | 19.3.0 | MIT |
| zod | 4.6.5 | MIT |
| idb | 8.0.4 | ISC |
| vite / vitest / @playwright/test | 8.3.4 / 5.0.3 / 1.64.0 | MIT / MIT / Apache-2.0 |
| typescript | 5.9.3 | Apache-2.0 |
| pmtiles | 4.5.0 | BSD-3-Clause |
| @protomaps/basemaps | 5.7.2 | BSD-3-Clause (Design CC0) |
| geojson-vt / vt-pbf (nur Test-Fixture) | 4.0.2 / 3.1.3 | ISC / MIT |
| @maplibre/maplibre-gl-style-spec (nur Tests) | 26.4.4 | ISC |

`npm install` meldete 0 bekannte Schwachstellen.

## Primärlinks für Nachprüfung
- https://developer.apple.com/maps/web/ (abgerufen)
- https://developer.apple.com/terms/ (erreichbar, Inhalt nicht ausgewertet)
- https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/LICENSE.md (abgerufen)
- https://github.com/Project-OSRM/osrm-backend/wiki/API%20Usage%20Policy (Sekundär)
- https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/ (nicht abrufbar)
- https://operations.osmfoundation.org/policies/tiles/ und /nominatim/ (nicht abrufbar)
- https://github.com/Vanilagy/mediabunny/blob/main/packages/aac-encoder/README.md (abgerufen: FFmpeg-AAC als WASM)
- https://docs.protomaps.com/basemaps/downloads (nur über Suche), https://docs.protomaps.com/pmtiles/cli (nur über Suche)
- https://github.com/protomaps/basemaps-assets (README + `fonts/OFL.txt` abgerufen), https://github.com/tangrams/icons/blob/master/LICENSE.md (abgerufen)
- https://developers.cloudflare.com/r2/pricing (über Suche), https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits (über Suche)
- https://osmfoundation.org/wiki/Licence_and_Legal_FAQ, https://osmfoundation.org/wiki/Attribution (über Suche)
