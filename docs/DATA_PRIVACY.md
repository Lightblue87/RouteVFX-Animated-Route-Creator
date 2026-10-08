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
| routing.openstreetmap.de (FOSSGIS) | Koordinaten von Start/Ziel (6 Nachkommastellen), IP-Adresse, Referer | Berechnung eines Auto/Motorrad/Rad/Fuß-Abschnitts | Straßenroute |
| nominatim.openstreetmap.org (OSMF) | Suchbegriff, Sprache, IP-Adresse, Referer | Tippen auf „Online suchen“ bzw. Enter | Ortssuche |

Nach erstmaliger Nutzung eines Online-Dienstes wird `privacy.usedOnlineServices = true` im Projekt vermerkt.

## Content Security Policy (Produktions-Build)
`connect-src` erlaubt nur `'self'`, `routing.openstreetmap.de`, `nominatim.openstreetmap.org`. `script-src 'self'`, `object-src 'none'`, `form-action 'none'`.

## Speicherung und Löschung
- Löschen eines Projekts entfernt Projekt-JSON und zugehörige Blobs in einer Transaktion.
- Hinweis in der App: Browser/OS können lokale Daten löschen; ohne Cloud kein Backup.
- `navigator.storage.persist()` wird angefragt (keine Garantie).

## Offene Punkte vor Release
- Datenschutzerklärung/Impressum (Anbieterkennzeichnung) – abhängig vom Betreiber.
- Prüfung, ob für FOSSGIS/OSMF Hinweise oder Vereinbarungen nötig sind.
- GPS-Aufzeichnung (nicht implementiert): Berechtigung nur auf Nutzeraktion, Daten nur lokal.
- Mikrofon (Voice-over, nicht implementiert): nur auf Anforderung.
