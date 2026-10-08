# Kostenmodell

Stand: 2026-10-08. Grundsatz: **Nullkosten beim Start**. Keine kostenpflichtigen Dienste, Konten oder Kreditkarten ohne ausdrückliche Zustimmung.

## Aktueller Prototyp: laufende Kosten = 0 €

| Kostenposition | Aktuelle Lösung | Kosten pro Einheit | Worst Case |
|---|---|---|---|
| Kartenansicht | Natural Earth, im App-Bundle (≈ 2,3 MB unkomprimiert, ≈ 0,7 MB gzip) | 0 € (gemeinfrei, kein Kachelserver) | Nur Hosting-Traffic (s. u.) |
| Detailkarte (nach Auswahl) | OpenFreeMap, öffentliche Instanz | 0 €, keine Limits laut README, kein Konto | Ausfall/Änderung der Bedingungen → Rückfall Natural Earth (R-01b) |
| Geocoding | Offline-Suche (Natural Earth) | 0 € | – |
| Geocoding online (Opt-in) | Nominatim (OSMF) | 0 €, aber Fair-Use-Richtlinie | Sperrung der IP bei Missbrauch → Fallback offline |
| Routing | Lokal (Großkreis/Näherung) | 0 € | – |
| Routing online (Opt-in) | FOSSGIS-OSRM-Demo | 0 €, Best-Effort | Sperrung/Ausfall → gekennzeichneter Fallback |
| Video-Encoding | Auf dem Gerät des Nutzers (WebCodecs) | 0 € serverseitig | Gerätelast beim Nutzer |
| Speicher | IndexedDB auf dem Gerät | 0 € | Browser-Quota des Nutzers |
| Hosting | **noch keines** (nicht veröffentlicht) | – | – |
| Backend/Auth | keines | – | – |

## Geplante Hosting-Annahme (vor Release zu verifizieren, E12)

Statisches Hosting (GitHub Pages oder Cloudflare Pages). Pro App-Erstaufruf ca. 1,1 MB (gzip: App ≈ 0,52 MB + Worker + CSS + Geodaten ≈ 0,7 MB), danach Service-Worker-Cache.
Rechenbeispiel: 10.000 Erstaufrufe/Monat ≈ 11 GB Traffic. Ob das im Free-Plan liegt, ist **nicht verifiziert** – Free-Plan-Grenzen und Missbrauchsregeln müssen vor Veröffentlichung geprüft werden.

## Kosten bei späteren Optionen (nur mit Freigabe)

| Option | Bekannte Kosten / Quoten | Verifiziert? |
|---|---|---|
| Apple MapKit JS | Apple Developer Program Mitgliedschaft (kostenpflichtig); 250.000 Map-Views + 25.000 Service-Calls/Tag frei | Quoten ja (developer.apple.com/maps/web), Mitgliedsbeitrag nein |
| Selbst gehostete OSM-Vektorkacheln (PMTiles) | Planet ≈ 120 GB (Protomaps-Doku); Cloudflare R2 frei nur 10 GB und laut Drittanleitungen mit Zahlungsmethode | Teilweise (Doku-Suche) – **verworfen**, solange Nullkosten gelten |
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
