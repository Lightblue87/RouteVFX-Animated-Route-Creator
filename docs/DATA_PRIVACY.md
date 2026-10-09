# Datenschutz und Datenflüsse

Stand: 2026-10-08 (Prototyp, keine Rechtsberatung – rechtliche Prüfung vor Release erforderlich, E14).

## Grundsätze (umgesetzt)
- Keine Konten, kein Backend, keine Telemetrie, keine Tracker, keine Cookies.
- Projekte, Routen, GPX-Daten und Audiodateien liegen ausschließlich in IndexedDB auf dem Gerät.
- Der Export (Rendern + Encodieren) läuft vollständig lokal.
- Online-Dienste sind standardmäßig **deaktiviert**.

## Datenflüsse an Dritte (nur nach Opt-in)
| Ziel | Übertragene Daten | Auslöser | Zweck |
|---|---|---|---|
| Supabase Edge Function „route“ (eigenes Projekt, wenn eingerichtet) → api.heigit.org/openrouteservice (HeiGIT gGmbH) | Verkehrsmittel, Koordinaten von Start/Wegpunkten/Ziel (6 Nachkommastellen); IP-Adresse nur bei Supabase. In der DB nur täglich wechselnder, gesalzener IP-Hash + Zähler (7 Tage). Keine Koordinaten gespeichert/geloggt; an ORS geht die IP der Function, nicht die des Nutzers | Berechnung eines Auto/Motorrad/Rad/Fuß-Abschnitts (Opt-in) | Straßenroute |
| routing.openstreetmap.de (FOSSGIS) – nur ohne eingerichteten Proxy | Koordinaten von Start/Ziel (6 Nachkommastellen), IP-Adresse, Referer | Berechnung eines Auto/Motorrad/Rad/Fuß-Abschnitts | Straßenroute |
| nominatim.openstreetmap.org (OSMF) | Suchbegriff, Sprache, IP-Adresse, Referer | Tippen auf „Online suchen“ bzw. Enter | Ortssuche |
| tiles.openfreemap.org (OpenFreeMap) | Angefragte Kacheln (→ betrachteter Kartenausschnitt), IP-Adresse, Referer; keine Stopps/Tracks, keine Cookies | Auswahl des Kartenstils „OpenFreeMap“ (mit Hinweis im UI) | Detailkarte in Vorschau, Planung und Export |

Nach erstmaliger Nutzung eines Online-Dienstes wird `privacy.usedOnlineServices = true` im Projekt vermerkt.

## Content Security Policy (Produktions-Build)
`connect-src` erlaubt nur `'self'`, `routing.openstreetmap.de`, `nominatim.openstreetmap.org`, `tiles.openfreemap.org` (letzteres auch in `img-src` für Sprites). `script-src 'self'`, `object-src 'none'`, `form-action 'none'`.

## Eigene Fotos (Stand 2026-10-09)
- Fotos werden nur lokal verarbeitet (Auswahl vom Gerät, Dekodierung im Browser) und nie hochgeladen.
- Der Aufnahmeort (EXIF-GPS, nur JPEG) wird ausschließlich gelesen, um den Punkt auf der Route vorzuschlagen. Gespeichert wird (a) eine auf höchstens 1280 px verkleinerte JPEG-Kopie **ohne Metadaten** im lokalen Blob-Speicher und (b) im Projekt nur der gewählte Punkt samt Herkunft („Geo-Tag“ oder „von Nutzer gesetzt“). Der Nutzer kann den Punkt jederzeit ändern.
- iOS entfernt beim Auswählen den Standort standardmäßig; die App weist darauf hin (Optionen → Standort) und bietet das Setzen per Karte an.
- Grenzen: höchstens 12 Fotos je Projekt, 25 MB und 60 Megapixel je Datei; SVG und andere Typen werden abgelehnt.
- Fotos sind Teil des lokalen Projekts: Duplizieren kopiert sie, Löschen des Projekts entfernt sie; nicht mehr referenzierte Bilder werden beim Öffnen eines Projekts aufgeräumt.

## Speicherung und Löschung
- Löschen eines Projekts entfernt Projekt-JSON und zugehörige Blobs in einer Transaktion.
- Hinweis in der App: Browser/OS können lokale Daten löschen; ohne Cloud kein Backup.
- `navigator.storage.persist()` wird angefragt (keine Garantie).
- Beim Verlassen des Editors wird der noch nicht bestätigte Projektstand kurzzeitig zusätzlich in `localStorage` gesichert (Schreib-Journal) und nach bestätigtem Speichern bzw. beim nächsten Start entfernt. Bleibt lokal auf dem Gerät; wird mit dem Projekt gelöscht.

## Offene Punkte vor Release
- Datenschutzerklärung/Impressum (Anbieterkennzeichnung) – abhängig vom Betreiber.
- Prüfung, ob für FOSSGIS/OSMF/OpenFreeMap Hinweise oder Vereinbarungen nötig sind (OpenFreeMap in die Datenschutzerklärung aufnehmen).
- Supabase (Auftragsverarbeitung, Region EU wählen) und HeiGIT/openrouteservice in die Datenschutzerklärung aufnehmen; AV-Vertrag mit Supabase prüfen (E14).
- GPS-Aufzeichnung (nicht implementiert): Berechtigung nur auf Nutzeraktion, Daten nur lokal.
- Mikrofon (Voice-over, nicht implementiert): nur auf Anforderung.
