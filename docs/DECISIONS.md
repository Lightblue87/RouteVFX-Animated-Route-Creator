# Entscheidungen (ADR) und Entscheidungsregister

Stand: 2026-10-08 · Phase 0 (Compliance & Feasibility) + minimaler End-to-End-Prototyp

**Statusbegriffe** (verbindlich in allen Dokumenten):
`Anforderung` (nur beschlossen) · `Implementiert` (Code vorhanden, nicht ausreichend getestet) · `Verifiziert` (automatisiert/messbar geprüft, Umgebung angegeben) · `Teilweise verifiziert` · `Blockiert` (externer Nachweis fehlt/negativ) · `Nicht begonnen`.

> Wichtig: „Verifiziert“ bezieht sich in diesem Stand ausschließlich auf die **Sandbox** (Linux, headless Chrome for Testing 141, Software-WebGL/SwiftShader). Kein einziger Punkt ist auf einem realen iPhone oder Android-Gerät geprüft.

---

## ADR-001 Anwendungsrahmen

| Option | Bewertung |
|---|---|
| **React 19 + Vite 8 + TypeScript strict (gewählt)** | Großes Ökosystem, schnelle Builds, statisch hostbar, keine Laufzeitkosten. |
| Svelte/SvelteKit | Kleinere Bundles; weniger verbreitete Bibliotheken für Timeline-UI. |
| Native (Swift/Kotlin) bzw. Capacitor | Bester Zugriff auf Encoder/GPS-Hintergrund, aber Store-Gebühren/Konten (Kosten) und doppelte Entwicklung; widerspricht PWA-Vorgabe. Ausstiegspfad, falls E08/E10 negativ. |

Versionen exakt gepinnt (`package.json` ohne `^`, `package-lock.json`). TypeScript 5.9.3 statt 7.x, weil Ökosystem (Vitest/Vite-Typen) auf 5.x getestet ist.

## ADR-002 Karten-Renderer und Kartendaten

| Option | Lizenz/Kosten | Export ins Video | Status |
|---|---|---|---|
| **MapLibre GL JS 6.13.0 + Natural Earth (lokal gebündelt) (gewählt für Prototyp)** | BSD-3-Clause; Daten gemeinfrei | Erlaubt (gemeinfrei), offline, 4K ohne Kachelserver | Verifiziert (Lizenz, Export in Sandbox) |
| Apple MapKit JS | Apple Developer Program nötig (kostenpflichtig, Betrag nicht in dieser Sitzung geprüft); 250.000 Map-Views + 25.000 Service-Calls/Tag frei | **Unklar** – keine Erlaubnis für Video-Capture gefunden (E01) | Blockiert |
| MapLibre + OSM-Vektorkacheln (OpenFreeMap / selbst gehostete PMTiles) | ODbL-Daten mit Attribution; OpenFreeMap-Bedingungen nicht abrufbar | Voraussichtlich mit Attribution, **nicht verifiziert** (E04) | Unbekannt – nächster Kandidat |
| tile.openstreetmap.org | OSMF-Richtlinie verbietet Bulk/Offline-Prefetch | Nicht als Exportfarm zulässig | Ausgeschlossen |

Entscheidung: Renderer und Datenquelle sind getrennt (`src/adapters/maps/styles.ts` Capability-Matrix). Natural Earth liefert nur Länder, Küsten, Seen – für Straßen-/Stadt-Detail ist eine zweite, exportlizenzierte Quelle nötig (Risiko R-02).

## ADR-003 Videoexport

| Option | Bewertung |
|---|---|
| **WebCodecs `VideoEncoder` (H.264) + mediabunny 1.61.3 (MP4-Muxer, MPL-2.0) (gewählt)** | Frame-genau, deterministisch, kein Echtzeitzwang, MP4 nativ. In Sandbox verifiziert. |
| MediaRecorder auf Canvas-Stream | Echtzeitgebunden (Ruckler bei langsamen Geräten), nicht frame-genau; MP4 nicht überall. Nur Fallback-Kandidat. |
| ffmpeg.wasm (x264) | GPL-Lizenzfolgen, sehr langsam/ speicherintensiv auf Mobilgeräten. Nicht gewählt. |
| Serverseitiges Rendering | Kosten + Datenschutz; laut CLAUDE.md nur mit separater Freigabe. Nicht aktiviert. |

mediabunny steht unter MPL-2.0 (Datei-Copyleft): Nutzung unverändert unproblematisch; Änderungen an mediabunny-Dateien müssten veröffentlicht werden.
Audio: AAC über WebCodecs `AudioEncoder`; **in der Sandbox nicht verfügbar** (Linux-Chrome kann kein AAC encodieren) → Audio-Export dort nicht verifizierbar. Kandidat `@mediabunny/aac-encoder` (FFmpeg-AAC als WASM, Lizenz ungeprüft) nicht eingebunden.

## ADR-004 Routing

| Modus | Quelle | Vertrauensstufe |
|---|---|---|
| Flug | lokal, Großkreis | `derived` |
| Auto/Motorrad/Rad/Fuß | OSRM (FOSSGIS-Demoserver) **nur nach Opt-in**; sonst lokale Näherung | `provider_verified` bzw. `estimated` |
| Schiff, Bahn, Bus | keine lizenzierte Datenquelle → lokale Näherung | `estimated` + Warnung |

Begründung: Kein kostenloser, für öffentliche Produktionsnutzung bestätigter Routingdienst gefunden (E05). Der FOSSGIS-Server ist ein Best-Effort-Demodienst; Bedingungen konnten in dieser Sitzung nicht abgerufen werden. Deshalb Opt-in, Drosselung (1 Anfrage/s) und gekennzeichneter Fallback. Ausstiegspfad: openrouteservice/GraphHopper (Free-Tier mit Schlüssel – Bedingungen prüfen) oder selbst gehostetes OSRM/Valhalla (Kosten → Freigabe nötig).

## ADR-005 Geocoding

Offline-Suche über Natural Earth Populated Places (7.342 Orte inkl. deutscher Namen) + Flughäfen (IATA) – keine Datenübertragung. Optional Nominatim **nur** auf ausdrückliches Absenden (Richtlinie verbietet Autocomplete) und nur nach Opt-in.

## ADR-006 Lokale Persistenz

IndexedDB über `idb` 8.0.4 (ISC). Projekte als Zod-validiertes JSON (`schemaVersion`), Medien getrennt als Blobs. Validierung beim Lesen **und** vor dem Schreiben; defekte Datensätze werden gemeldet, nie gelöscht. `navigator.storage.persist()` wird beim ersten Projekt angefragt.

## ADR-007 Deterministische Szene

`buildSceneModel(project)` + `evaluateScene(model, tMs)` sind reine Funktionen. Vorschau und Export verwenden denselben Evaluator und denselben Overlay-Zeichner (`src/scene/drawOverlay.ts`). Kamera-Glättung erfolgt über ein symmetrisches Zeitfenster (zustandslos), daher identische Ergebnisse bei beliebiger Seek-Reihenfolge (Unit-Test).
Logischer Viewport 540×960; Export skaliert per `pixelRatio` (2 → 1080p, 4 → 4K), damit das Framing auflösungsunabhängig ist.

## ADR-008 Hosting (noch nicht veröffentlicht)

Statische Auslieferung (z. B. GitHub Pages oder Cloudflare Pages). Aktuelle Free-Plan-Grenzen **nicht** in dieser Sitzung verifiziert (E12). Keine Veröffentlichung vor Abnahme (CLAUDE.md §15/§16).

## ADR-009 Branding

Repository `RouteVFX-Animated-Route-Creator` mit Logo-Assets → App-Name „RouteVFX“, PWA-Icons aus `assets/logos/routevfx-icon.png` abgeleitet. Arbeitstitel laut CLAUDE.md bleibt „Animated Route Creator“ als Untertitel.

---

## Entscheidungsregister – Umsetzungsstand der 44 Nutzerentscheidungen

| ID | Entscheidung (Kurz) | Status | Nachweis / Bemerkung |
|---|---|---|---|
| 01 | Öffentlich nutzbar, Premium später | Nicht begonnen (Release) | Keine Veröffentlichung vor Gate. |
| 02 | Manuelle Planung zentral, GPS ergänzend | Teilweise verifiziert / GPS nicht begonnen | E2E: Ortssuche → Stopps → Segment. |
| 03 | 9:16 für Story/Reels/TikTok/Shorts | Verifiziert (Sandbox) | ffprobe 1080×1920. |
| 04 | Export wählt geeignete Methode | Teilweise implementiert | Capability-Probe je Profil + Vorschlag; nur eine Exportmethode (WebCodecs). |
| 05 | Ortssuche, Tippen, Ziehen, GPX, Kartenlink | Teilweise | Ortssuche verifiziert; Tippen implementiert (ungetestet); GPX verifiziert (Unit + E2E); Linie ziehen verifiziert (E2E Sandbox); Kartenlink nicht begonnen. |
| 06 | 8 Verkehrsmittel | Implementiert | Alle wählbar; Geometriequalität siehe 07. |
| 07 | Möglichst reale Straßen/Bahn/Schiff | Blockiert (E05) | Straße nur mit Opt-in-OSRM (live ungetestet); Bahn/Schiff geschätzt + markiert. |
| 08 | Stopps mit Pause/Zoom/Text/Wechsel | Teilweise verifiziert | Pause, Label, Moduswechsel-Overlay, Zoom am Stopp (Unit); Stopp-spezifische Texte über Label. |
| 09 | Alternativrouten, Wegpunkte | Teilweise | Alternativauswahl (nur Mock-getestet); Wegpunkte im Modell, keine UI. |
| 10 | Apple-Stile hell/dunkel/Satellit/Hybrid/3D/minimal | Blockiert (E01–E04) | Nur Natural Earth „minimal“ hell/dunkel. |
| 11 | Symbol / 2D / 3D-Fahrzeug | Teilweise | Eigene Vektor-Symbole; 2D-Upload und 3D nicht begonnen. |
| 12 | Linie fortlaufend/vollständig/gestrichelt | Implementiert, teilweise verifiziert | Gestrichelt im Export sichtbar geprüft. |
| 13 | Kamera-Presets + manuelle Keyframes | Teilweise | Übersicht, Folgen, Folgen+Fahrtrichtung, Auto-Zoom; Keyframes nicht begonnen. |
| 14 | Vollwertige Timeline mit Keyframes | Nicht begonnen | Nur manuelle Segmentdauer. |
| 15 | Einblendungen | Teilweise | Titel, Orte, km aktuell/gesamt, Wechsel, Fortschritt; Reisezeit/Datum/Bilder/Logos nicht begonnen. |
| 16 | Assistent + erweiterter Editor | Teilweise | Einfacher Assistent (Animation-Tab); Timeline-Editor nicht begonnen. |
| 17 | Musik, Bibliothek, SFX, Voice-over, Fades | Teilweise / nicht verifiziert | Eigene Datei + Gain/Fades/Stumm implementiert; AAC in Sandbox nicht verfügbar; Bibliothek/SFX/Voice-over nicht begonnen. |
| 18 | Übergänge, Effekte, Vorlagen | Nicht begonnen | |
| 19 | FHD/4K, 30/60 FPS | Teilweise verifiziert | Siehe PERFORMANCE.md / RELEASE_MATRIX.md. |
| 20 | Max. 3 Minuten | Verifiziert (Unit) | Schema lehnt > 180 s ab. |
| 21 | Lokal ohne Konto | Teilweise verifiziert | IndexedDB-Integrationstests + E2E Reload. |
| 22 | Download, Share-Sheet; keine öffentlichen Links | Download verifiziert; Share implementiert, ungetestet (E13) | |
| 23 | Konto E-Mail/Passwort | Nicht begonnen (Phase 6) | |
| 24 | Kostenlos ohne Registrierung | Implementiert | Keine Kontofunktion vorhanden. |
| 25 | Cloud-Sync später | Nicht begonnen (Phase 6) | |
| 26 | GPS-Daten bleiben lokal | Anforderung | GPS nicht begonnen; keinerlei Uploads im Code. |
| 27 | Kostenloses Hosting | Nicht begonnen | Nicht veröffentlicht. |
| 28 | Premium vorbereiten | Nicht begonnen | |
| 29 | Admin | Nicht begonnen (Phase 6) | |
| 30 | iPhone & Android gleichwertig | Nicht verifiziert | Keine Gerätetests möglich in Sandbox. |
| 31 | Mobile-first UI | Implementiert | Nur emuliert (Pixel 7) getestet. |
| 32 | DE + EN | Implementiert | EN-Wörterbuch typgeprüft vollständig. |
| 33 | Begründeter kostenloser Stack | Erledigt (dieses Dokument) | |
| 34 | Umfassende V1 phasenweise | Laufend | |
| 35 | Offline-Bearbeitung | Implementiert, ungetestet | Service Worker + gebündelte Geodaten. |
| 36 | Fahrzeugbibliothek, eigene Assets | Teilweise | 8 Symbole + Farbe; Uploads/Admin nicht begonnen. |
| 37 | Reduziertes, iOS-inspiriertes Design | Implementiert | Eigene Gestaltung, keine Apple-Assets. |
| 38 | Budgets und Tests als Releasepflicht | Teilweise | PERFORMANCE.md (Entwurf), Tests vorhanden; Gerätetests offen. |
| 39 | Apple Maps bevorzugt, Alternative zulässig | Alternative aktiv | Apple blockiert (E01/E03). |
| 40 | Bei Überlastung niedrigere Qualität vorschlagen | Implementiert, teilweise | Vorschlag bei nicht unterstütztem Profil; Laufzeit-Überlastungserkennung fehlt. |
| 41 | Näherung kennzeichnen + manuell korrigieren | Teilweise verifiziert | Kennzeichnung (Badge, gestrichelt, Export-Hinweis mit Bestätigung); Linienbearbeitung per Ziehen (Unit + E2E Sandbox), Status wird `manually_edited`. |
| 42 | Filmische vs. proportionale Zeit | Verifiziert (Unit) | |
| 43 | Zunächst nur lokale Projekte | Implementiert | |
| 44 | Phasen, Tests vor Start | Eingehalten | Keine Veröffentlichung. |
