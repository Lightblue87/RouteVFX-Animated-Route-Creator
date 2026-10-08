# Externe Nachweise (E01–E15)

Prüfdatum aller Einträge: **2026-10-08**. Prüfer: Claude Code (automatisiert). Verantwortlich für Freigaben: Produktverantwortliche/r (Repo-Owner).
Ergebnis: `VERIFIED` / `BLOCKED` / `UNKNOWN`.

**Einschränkung der Prüfumgebung:** Die Sandbox-Netzwerkrichtlinie blockiert u. a. `tiles.openfreemap.org`, `router.project-osrm.org`, `routing.openstreetmap.de`, `nominatim.openstreetmap.org`, `demotiles.maplibre.org`; DNS-Auflösung scheiterte für `operations.osmfoundation.org`, `openfreemap.org`, `www.fossgis.de`, `www.naturalearthdata.com`. Wo Primärquellen nicht abrufbar waren, ist das Ergebnis `UNKNOWN`, auch wenn Sekundärquellen Hinweise liefern.

| ID | Thema | Ergebnis | Fundstelle / Beleg | Konsequenz |
|---|---|---|---|---|
| E01 | Apple MapKit JS: Capture/Export animierter Videos | **BLOCKED (unbelegt)** | developer.apple.com/maps/web nennt nur Quoten. Erlaubnis zum Video-Capture nicht gefunden. Sekundär (Developer-Forum, LawInsider-Auszüge der DPLA): „Map Data may not be cached, pre-fetched, or stored … other than on a temporary and limited basis“; Logo/Links dürfen nicht entfernt werden. | Apple-Material **nicht** als Exportquelle. |
| E02 | Apple-Stile (Satellit/Hybrid/3D) im Web-SDK + Rechte | UNKNOWN | Nicht geprüft (setzt E01/E03 voraus). | Stile nur über alternative Quelle. |
| E03 | Apple Maps Zugang/Quoten | **VERIFIED (Quoten)** / Kosten UNKNOWN | https://developer.apple.com/maps/web/ : „MapKit JS provides a free daily limit of 250,000 map views and 25,000 service calls per Apple Developer Program membership.“ Snapshots: „25,000 unique requests per day“. Mitgliedschaft erforderlich (kostenpflichtig; Betrag nicht in dieser Sitzung geprüft). | Keine Apple-Pflichtabhängigkeit; Kosten nur mit deiner Freigabe. |
| E04 | Kartendaten mit Exportrecht | **Natural Earth: VERIFIED**; OSM/OpenFreeMap: UNKNOWN | Natural Earth `LICENSE.md` (Commit `ca96624a56bd078437bca8184e78163e5039ad19`): „All versions of Natural Earth raster + vector map data … are in the public domain. You may use the maps in any manner …“. OpenFreeMap: nur Sekundärquellen (kostenlos, ohne Key, Attribution „OpenFreeMap © OpenMapTiles Data from OpenStreetMap“). OSM-Tile-Policy nicht abrufbar. | Nur Natural Earth exportierbar. |
| E05 | Routinganbieter je Modus | UNKNOWN | OSRM-Wiki „API Usage Policy“ (Sekundär, gilt für alten Demoserver): keine intensive Nutzung, Attribution, echter User-Agent, Logs der Anfragen. Verweis auf FOSSGIS-Nutzungsbedingungen (nicht abrufbar). Keine lizenzierten Bahn-/Fähr-/ÖPNV-Geometrien identifiziert. | Opt-in, Drosselung, gekennzeichnete Näherung. |
| E06 | Geocoding | Natural Earth Orte: VERIFIED; Nominatim: UNKNOWN | Nominatim-Policy (Sekundärzitate): kein clientseitiges Autocomplete, ~1 Anfrage/s. Photon: Fair-Use, Bedingungen nicht abgerufen. | Offline-Suche Standard; Nominatim nur bei Absenden + Opt-in. |
| E07 | GPX/XML + Kartenlinks | GPX: VERIFIED (eigene Tests); Kartenlinks: UNKNOWN | 9 GPX-Unit-Tests (gültig, mehrere Segmente, rte, GPX 1.0, ungültiges XML, DOCTYPE/ENTITY, Größenlimit, Koordinatenprüfung). | Kartenlinks nicht implementiert. |
| E08 | MP4/H.264/AAC im Browser | **Teilweise VERIFIED** | Chrome for Testing 141.0.7390.122 (Linux, headless): `VideoEncoder` avc1 1080×1920 und 2160×3840 bei 30/60 fps **unterstützt**; `AudioEncoder` mp4a.40.2 **nicht unterstützt**; MediaRecorder `video/mp4;codecs=avc1` unterstützt. Playwright-Chromium 141 (Open Source): **kein** H.264. iOS Safari / Android Chrome: UNKNOWN. | Nur geprüfte Profile freigeben; Gerätetest Pflicht. |
| E09 | 3-min-4K60 auf Smartphones | UNKNOWN | Keine Geräte verfügbar. Sandbox-Messungen siehe PERFORMANCE.md (nicht repräsentativ). | Profile nach Feldtest zurückstufen. |
| E10 | PWA-GPS Hintergrund | UNKNOWN | Nicht geprüft. | Nur aktive Aufzeichnung. |
| E11 | Rechte Assets (3D/Musik/SFX/Fonts) | UNKNOWN | Aktuell keine Fremd-Assets ausgeliefert (Fahrzeugsymbole selbst gezeichnet, Systemschriften). Logos aus Repo = Eigentum des Repo-Owners. | Keine Bibliothek ausliefern. |
| E12 | Hosting-/Auth-/Storage-Kosten | UNKNOWN | Nicht geprüft; aktuell keine Dienste in Benutzung. | Keine Konten/Kreditkarten ohne Zustimmung. |
| E13 | Web Share mit MP4 in PWAs | UNKNOWN | Implementiert mit `navigator.canShare({files})`-Prüfung; nicht auf Geräten getestet. | Download als Fallback (verifiziert). |
| E14 | DSGVO / Drittanbieter | UNKNOWN | Online-Dienste standardmäßig aus, Opt-in mit Erklärung. Keine Tracker. | Rechtliche Prüfung vor Release. |
| E15 | Cloud-Backend (RLS, E-Mail, Löschung) | UNKNOWN | Phase 6. | V1 ohne Cloud. |

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

`npm install` meldete 0 bekannte Schwachstellen.

## Primärlinks für Nachprüfung
- https://developer.apple.com/maps/web/ (abgerufen)
- https://developer.apple.com/terms/ (erreichbar, Inhalt nicht ausgewertet)
- https://github.com/nvkelso/natural-earth-vector/blob/ca96624a56bd078437bca8184e78163e5039ad19/LICENSE.md (abgerufen)
- https://github.com/Project-OSRM/osrm-backend/wiki/API%20Usage%20Policy (Sekundär)
- https://www.fossgis.de/arbeitsgruppen/osm-server/nutzungsbedingungen/ (nicht abrufbar)
- https://operations.osmfoundation.org/policies/tiles/ und /nominatim/ (nicht abrufbar)
- https://github.com/Vanilagy/mediabunny/blob/main/packages/aac-encoder/README.md (abgerufen: FFmpeg-AAC als WASM)
