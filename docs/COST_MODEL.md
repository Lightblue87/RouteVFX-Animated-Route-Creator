# Kostenmodell

Stand: 2026-10-08. Grundsatz: **Nullkosten beim Start**. Keine kostenpflichtigen Dienste, Konten oder Kreditkarten ohne ausdrückliche Zustimmung.

## Aktueller Prototyp: laufende Kosten = 0 €

| Kostenposition | Aktuelle Lösung | Kosten pro Einheit | Worst Case |
|---|---|---|---|
| Kartenansicht | Natural Earth, im App-Bundle (≈ 2,3 MB unkomprimiert, ≈ 0,7 MB gzip) | 0 € (gemeinfrei, kein Kachelserver) | Nur Hosting-Traffic (s. u.) |
| Geocoding | Offline-Suche (Natural Earth) | 0 € | – |
| Geocoding online (Opt-in) | Nominatim (OSMF) | 0 €, aber Fair-Use-Richtlinie | Sperrung der IP bei Missbrauch → Fallback offline |
| Routing | Lokal (Großkreis/Näherung) | 0 € | – |
| Routing online (Opt-in) | FOSSGIS-OSRM-Demo | 0 €, Best-Effort | Sperrung/Ausfall → gekennzeichneter Fallback |
| Video-Encoding | Auf dem Gerät des Nutzers (WebCodecs) | 0 € serverseitig | Gerätelast beim Nutzer |
| Speicher | IndexedDB auf dem Gerät | 0 € | Browser-Quota des Nutzers |
| Detailkarte (OSM-PMTiles) | Implementiert, **standardmäßig deaktiviert** (keine `VITE_PMTILES_URL`) | 0 €, solange nicht gehostet | s. Abschnitt „PMTiles-Hosting“ |
| Hosting | **noch keines** (nicht veröffentlicht) | – | – |
| Backend/Auth | keines | – | – |

## Geplante Hosting-Annahme (vor Release zu verifizieren, E12)

Statisches Hosting (GitHub Pages oder Cloudflare Pages). Pro App-Erstaufruf ca. 1,1 MB (gzip: App ≈ 0,52 MB + Worker + CSS + Geodaten ≈ 0,7 MB), danach Service-Worker-Cache.
Rechenbeispiel: 10.000 Erstaufrufe/Monat ≈ 11 GB Traffic. Ob das im Free-Plan liegt, ist **nicht verifiziert** – Free-Plan-Grenzen und Missbrauchsregeln müssen vor Veröffentlichung geprüft werden.

## PMTiles-Hosting (Detailkarte, Entscheidung 2026-10-08) – Freigabe ausstehend

Datenmenge (Protomaps-Doku, Stand Suche 2026-10-08): Planet z0–15 ≈ 120 GB; Planet z0–6 ≈ 60 MB. Faustregel der Doku: jede weitere Zoomstufe ≈ verdoppelt die Größe – daraus **geschätzt** (nicht gemessen): z0–11 ≈ 7–8 GB, z0–12 ≈ 15 GB. Regionale Extrakte (`pmtiles extract --bbox|--region`) entsprechend kleiner.

| Option | Freikontingent (belegt über Doku-Suche) | Passt? | Haken |
|---|---|---|---|
| Cloudflare R2 | 10 GB-Monat Speicher, 10 Mio. Lesezugriffe (Class B)/Monat, Egress kostenlos | Planet bis ~z11 (Schätzung) oder Region in voller Tiefe | Laut Drittanleitungen **Zahlungsmethode bei Aktivierung** nötig; darüber hinaus nutzungsabhängige Kosten → nur mit Freigabe und Budget-Alarm |
| GitHub Pages | Site ≤ 1 GB, 100 GB/Monat (weich) | Nur grobe Planet-Stufen (z0–6 ≈ 60 MB) oder kleine Region | Range-Request-Unterstützung nicht belegt; Einzeldatei-Grenzen beachten |

Lastschätzung (Annahme, nicht gemessen): Kartenansicht ≈ 20–60 Kachel-Range-Requests; 1 Export mit Kamerafahrt ≈ einige Hundert. 10 Mio. Class-B/Monat ≈ 150.000–500.000 Kartenansichten. Der Service Worker cacht **keine** Kacheln (keine Vorratshaltung).

## Kosten bei späteren Optionen (nur mit Freigabe)

| Option | Bekannte Kosten / Quoten | Verifiziert? |
|---|---|---|
| Apple MapKit JS | Apple Developer Program Mitgliedschaft (kostenpflichtig); 250.000 Map-Views + 25.000 Service-Calls/Tag frei | Quoten ja (developer.apple.com/maps/web), Mitgliedsbeitrag nein |
| Selbst gehostete OSM-Vektorkacheln (PMTiles) | s. Abschnitt „PMTiles-Hosting“ | Teilweise (Doku-Suche) |
| Routing mit API-Schlüssel (openrouteservice, GraphHopper) | Free-Tier mit Tageslimits | Nein |
| Eigener Routing-Server (OSRM/Valhalla) | VM mit viel RAM → laufende Kosten | Nein – nur mit Freigabe |
| Serverseitiges Rendering | CPU/GPU-Zeit je Video | Nein – laut CLAUDE.md gesperrt ohne Freigabe |
| Supabase o. ä. (Phase 6) | Free-Tier mit Limits, ggf. Pausierung | Nein |

## Schutzmaßnahmen im Code
- Online-Dienste standardmäßig **aus** (Opt-in-Schalter).
- OSRM-Adapter: max. 1 Anfrage/s (clientseitig), nur bei Stopp-/Modusänderung, nicht pro Tastendruck.
- Nominatim: nur bei ausdrücklichem Absenden, kein Autocomplete.
- Kein Server, der Nutzerdaten oder Renderjobs annimmt → keine Kosten durch öffentliche Last.
- Offen: Kill-Switch/Remote-Config für Online-Dienste vor öffentlicher Freigabe (Phase 5).
