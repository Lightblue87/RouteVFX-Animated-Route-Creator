# Externe Nachweise (E01–E15)

Prüfdatum aller Einträge: **2026-10-08**. Prüfer: Claude Code (automatisiert). Verantwortlich für Freigaben: Produktverantwortliche/r (Repo-Owner).
Ergebnis: `VERIFIED` / `BLOCKED` / `UNKNOWN`.

**Einschränkung der Prüfumgebung:** Die Sandbox-Netzwerkrichtlinie blockiert u. a. `tiles.openfreemap.org`, `router.project-osrm.org`, `routing.openstreetmap.de`, `nominatim.openstreetmap.org`, `demotiles.maplibre.org`; DNS-Auflösung scheiterte für `operations.osmfoundation.org`, `openfreemap.org`, `www.fossgis.de`, `www.naturalearthdata.com`. Wo Primärquellen nicht abrufbar waren, ist das Ergebnis `UNKNOWN`, auch wenn Sekundärquellen Hinweise liefern.

| ID | Thema | Ergebnis | Fundstelle / Beleg | Konsequenz |
|---|---|---|---|---|
| E01 | Apple MapKit JS: Capture/Export animierter Videos | **BLOCKED (unbelegt)** | developer.apple.com/maps/web nennt nur Quoten. Erlaubnis zum Video-Capture nicht gefunden. Sekundär (Developer-Forum, LawInsider-Auszüge der DPLA): „Map Data may not be cached, pre-fetched, or stored … other than on a temporary and limited basis“; Logo/Links dürfen nicht entfernt werden. | Apple-Material **nicht** als Exportquelle. |
| E02 | Apple-Stile (Satellit/Hybrid/3D) im Web-SDK + Rechte | UNKNOWN | Nicht geprüft (setzt E01/E03 voraus). | Stile nur über alternative Quelle. |
| E03 | Apple Maps Zugang/Quoten | **VERIFIED (Quoten)** / Kosten UNKNOWN | https://developer.apple.com/maps/web/ : „MapKit JS provides a free daily limit of 250,000 map views and 25,000 service calls per Apple Developer Program membership.“ Snapshots: „25,000 unique requests per day“. Mitgliedschaft erforderlich (kostenpflichtig; Betrag nicht in dieser Sitzung geprüft). | Keine Apple-Pflichtabhängigkeit; Kosten nur mit deiner Freigabe. |
| E04 | Kartendaten mit Exportrecht | **Natural Earth: VERIFIED**; **OpenFreeMap: VERIFIED mit Attribution** (s. Abschnitt E04-OpenFreeMap) | Natural Earth `LICENSE.md` (Commit `ca96624a56bd078437bca8184e78163e5039ad19`): „All versions of Natural Earth raster + vector map data … are in the public domain. You may use the maps in any manner …“. OpenFreeMap: nur Sekundärquellen (kostenlos, ohne Key, Attribution „OpenFreeMap © OpenMapTiles Data from OpenStreetMap“). OSM-Tile-Policy nicht abrufbar. | Exportierbar: Natural Earth sowie OpenFreeMap (`exportAllowed: true`) mit Pflicht-Attribution in jedem Frame; ist OpenFreeMap beim Export nicht erreichbar, wird transparent auf Natural Earth ausgewichen. Alle übrigen Quellen nicht exportierbar. |
| E05 | Routinganbieter je Modus | UNKNOWN | OSRM-Wiki „API Usage Policy“ (Sekundär, gilt für alten Demoserver): keine intensive Nutzung, Attribution, echter User-Agent, Logs der Anfragen. Verweis auf FOSSGIS-Nutzungsbedingungen (nicht abrufbar). Keine lizenzierten Bahn-/Fähr-/ÖPNV-Geometrien identifiziert. | Opt-in, Drosselung, gekennzeichnete Näherung. |
| E05-ORS | openrouteservice (Standard-Plan) über eigenen Proxy | **VERIFIED (Limits, Schlüsselregel, neue API-Adresse)**; kommerzielle Nutzung UNKNOWN | ORS-FAQ (github.com/GIScience/openrouteservice `docs/frequently-asked-questions.md`, abgerufen 2026-10-08): „every HeiGIT API key belongs to one person. Thus, an API key must not be used client-side … Send any request to the HeiGIT API server-side.“; Directions-Limit „2000 requests per day“, „40 directions requests“ pro 60 s; Tageslimit → 403, Minutenlimit → 429. **Primärbeleg Limits:** HeiGIT-Dashboard des Produktverantwortlichen (Screenshot 2026-10-09): „Directions V2 2000/2000, Quota per Minute 40“. Dashboard-Hinweis: „We are deprecating the URL api.openrouteservice.org in favour of api.heigit.org“; laut Forum (ask.openrouteservice.org, Suche) neues Schema `https://api.heigit.org/openrouteservice/v2/...`, alter Host seit 27.08.2026 nur 10 % Kontingent, Abschaltung nach dem 02.11.2026. Attribution laut ToS (Suche): „© openrouteservice.org by HeiGIT \| Map data © OpenStreetMap contributors“. Speicherung von Ergebnissen: keine ausdrückliche Regel gefunden (ODbL-Daten → Attribution). openrouteservice.org selbst aus der Sandbox nicht erreichbar. | Proxy als Supabase Edge Function mit Kontingenten unter dem ORS-Limit; Attribution am Segment und im Video; kommerzielle Nutzung vor Monetarisierung klären. |
| E06 | Geocoding | Natural Earth Orte: VERIFIED; Nominatim: UNKNOWN | Nominatim-Policy (Sekundärzitate): kein clientseitiges Autocomplete, ~1 Anfrage/s. Photon: Fair-Use, Bedingungen nicht abgerufen. | Offline-Suche Standard; Nominatim nur bei Absenden + Opt-in. |
| E07 | GPX/XML + Kartenlinks | GPX: VERIFIED (eigene Tests); Kartenlinks: UNKNOWN | 9 GPX-Unit-Tests (gültig, mehrere Segmente, rte, GPX 1.0, ungültiges XML, DOCTYPE/ENTITY, Größenlimit, Koordinatenprüfung). | Kartenlinks nicht implementiert. |
| E08 | MP4/H.264/AAC im Browser | **Teilweise VERIFIED** | Chrome for Testing 141.0.7390.122 (Linux, headless): `VideoEncoder` avc1 1080×1920 und 2160×3840 bei 30/60 fps **unterstützt**; `AudioEncoder` mp4a.40.2 **nicht unterstützt**; MediaRecorder `video/mp4;codecs=avc1` unterstützt. Playwright-Chromium 141 (Open Source): **kein** H.264. iOS Safari / Android Chrome: UNKNOWN. | Nur geprüfte Profile freigeben; Gerätetest Pflicht. |
| E09 | 3-min-4K60 auf Smartphones | UNKNOWN | Keine Geräte verfügbar. Sandbox-Messungen siehe PERFORMANCE.md (nicht repräsentativ). | Profile nach Feldtest zurückstufen. |
| E10 | PWA-GPS Hintergrund | UNKNOWN | Nicht geprüft. | Nur aktive Aufzeichnung. |
| E11 | Rechte Assets (3D/Musik/SFX/Fonts) | UNKNOWN | Aktuell keine Fremd-Assets ausgeliefert (Fahrzeugsymbole selbst gezeichnet, Systemschriften). Logos aus Repo = Eigentum des Repo-Owners. | Keine Bibliothek ausliefern. |
| E12 | Hosting-/Auth-/Storage-Kosten | Supabase: **teilweise VERIFIED** (Pausierung offiziell, Limits sekundär); Rest UNKNOWN | Supabase-Doku „Project Pausing“ (Suche): Free-Projekte werden bei geringer Aktivität über 7 Tage pausiert, vorher Warn-E-Mail. Free Plan laut Drittquellen: 2 aktive Projekte, 500.000 Edge-Function-Aufrufe/Monat, keine Kreditkarte. Cloudflare R2/GitHub Pages s. COST_MODEL. | Keine Konten/Kreditkarten ohne Zustimmung; Supabase-Konto des Produktverantwortlichen vorhanden (2026-10-08). |
| E13 | Web Share mit MP4 in PWAs | UNKNOWN | Implementiert mit `navigator.canShare({files})`-Prüfung; nicht auf Geräten getestet. | Download als Fallback (verifiziert). |
| E14 | DSGVO / Drittanbieter | UNKNOWN | Online-Dienste standardmäßig aus, Opt-in mit Erklärung. Keine Tracker. | Rechtliche Prüfung vor Release. |
| E15 | Cloud-Backend (RLS, E-Mail, Löschung) | UNKNOWN | Phase 6. | V1 ohne Cloud. |

## E04-OpenFreeMap: Detailkarte {#e04-openfreemap}

Prüfdatum 2026-10-08. Entscheidung des Produktverantwortlichen: OpenFreeMap (öffentliche Instanz), weil der Betrieb kostenlos bleiben muss. Ein eigenes PMTiles-Hosting des Planeten (≈ 120 GB) passt in kein geprüftes Freikontingent ohne Zahlungsmethode (verworfen, Code in Commit `844accc`).

Primärquelle: `README.md` und `LICENSE.md` aus github.com/hyperknot/openfreemap (Branch `main`, abgerufen über raw.githubusercontent.com; openfreemap.org selbst ist aus der Sandbox nicht erreichbar).

| Punkt | Wortlaut / Fundstelle | Ergebnis |
|---|---|---|
| Kosten, Limits, Konto | „Using our public instance is completely free: there are no limits on the number of map views or requests. There’s no registration, no user database, no API keys, and no cookies.“ | VERIFIED |
| Video-Nutzung + Attribution | „Attribution is required. … if you are using this in printed media or video, you must add the following attribution: OpenFreeMap © OpenMapTiles Data from OpenStreetMap“ | VERIFIED – Text wird in jedem Video-Frame unten rechts eingeblendet |
| Kommerzielle Nutzung | Nur über Sekundärquelle (FAQ auf openfreemap.org: „Is commercial usage allowed? Yes.“) | UNKNOWN (Primärseite nicht abrufbar); derzeit keine kommerzielle Nutzung |
| Lizenzen Stil/Daten | Projekt MIT; OSM-Daten ODbL; OpenMapTiles-Schema BSD-3/CC BY 4.0; Positron und Dark Matter: Code BSD-3, Design CC BY 4.0; Noto Sans OFL; Maki-Icons CC0 (`src/adapters/maps/openfreemap/LICENSE.md`) | VERIFIED |
| Verfügbarkeit | Spendenfinanziert, keine SLA | Risiko R-01b: Ausfall → automatischer Rückfall auf Natural Earth bis Zoom 7, darüber neutrale Fläche + Routenvektoren |
| Offline/Vorabladen | Keine Aussage in der README | Nicht genutzt: keine Kachel-Vorratshaltung, der Service Worker cacht keine Fremd-Origins |

Technisch verifiziert (Sandbox, OpenFreeMap **simuliert** mit synthetischen Kacheln im OpenMapTiles-Schema – keine OSM-Daten): Stil besteht die MapLibre-Validierung, Kacheln/TileJSON/Glyphen/Sprite werden nur nach Auswahl des Stils angefragt, Attribution und Datenschutzhinweis sichtbar, Planungskarte nutzt den Stil, Rückfall ohne Dienst. **Nicht** gegen den echten Dienst getestet (Sandbox blockiert tiles.openfreemap.org).

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
| geojson-vt / vt-pbf / @maplibre/maplibre-gl-style-spec (nur Tests) | 4.0.2 / 3.1.3 / 26.4.4 | ISC / MIT / ISC |

`npm install` meldete 0 bekannte Schwachstellen.

## Primärlinks für Nachprüfung
- https://developer.apple.com/maps/web/ (abgerufen)
- https://developer.apple.com/terms/ (erreichbar, Inhalt nicht ausgewertet)
- https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/LICENSE.md (abgerufen)
- https://github.com/Project-OSRM/osrm-backend/wiki/API%20Usage%20Policy (Sekundär)
- https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/ (nicht abrufbar)
- https://operations.osmfoundation.org/policies/tiles/ und /nominatim/ (nicht abrufbar)
- https://github.com/Vanilagy/mediabunny/blob/main/packages/aac-encoder/README.md (abgerufen: FFmpeg-AAC als WASM)
- https://github.com/hyperknot/openfreemap (README, LICENSE.md abgerufen), https://github.com/hyperknot/openfreemap-styles (README, styles/positron, styles/dark abgerufen)
- https://developers.cloudflare.com/r2/pricing, https://docs.protomaps.com/basemaps/downloads (über Suche; Grundlage der verworfenen PMTiles-Option)
