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
| **MapLibre + OpenFreeMap (öffentliche Instanz) (gewählt 2026-10-08)** | kostenlos, ohne Schlüssel/Limits; OSM ODbL, Stile BSD-3/CC BY 4.0 | Erlaubt mit Pflicht-Attribution „OpenFreeMap © OpenMapTiles Data from OpenStreetMap“ (E04-OpenFreeMap) | **Implementiert**, mit simuliertem Dienst verifiziert (Sandbox) |
| MapLibre + selbst gehostete OSM-PMTiles | Planet ≈ 120 GB > Freikontingente; R2 verlangt Zahlungsmethode | Erlaubt mit Attribution | Verworfen (Kosten), Code in Commit `844accc` |
| tile.openstreetmap.org | OSMF-Richtlinie verbietet Bulk/Offline-Prefetch | Nicht als Exportfarm zulässig | Ausgeschlossen |

Entscheidung: Renderer und Datenquelle sind getrennt (`src/adapters/maps/styles.ts` Capability-Matrix). Natural Earth liefert nur Länder, Küsten, Seen – für Straßen-/Stadt-Detail ist eine zweite, exportlizenzierte Quelle nötig (Risiko R-01).

**Produktentscheidung 2026-10-08 (Produktverantwortlicher), revidiert am selben Tag:** Zuerst waren selbst gehostete PMTiles gewählt. Die Umsetzung zeigte, dass der Planet (≈ 120 GB) in kein Freikontingent ohne Zahlungsmethode passt, und der Betrieb muss kostenlos bleiben. Deshalb gilt jetzt: **Detailkarte = öffentliche OpenFreeMap-Instanz** (kostenlos, ohne Schlüssel, Video-Nutzung mit Attribution ausdrücklich geregelt).
- Umsetzung: Stile `ofm-positron` (hell) und `ofm-dark` aus github.com/hyperknot/openfreemap-styles, lokal gebündelt (`src/adapters/maps/openfreemap/`, Lizenzdatei dabei); Kacheln, Glyphen und Sprites von `tiles.openfreemap.org`. Beschriftung bevorzugt in der Projektsprache (`name:de`/`name:en`). Schummerungs-Raster entfernt (zusätzlicher Dienst).
- Standard bleibt Natural Earth (offline, ohne Datenübertragung). OpenFreeMap wird nur nach ausdrücklicher Auswahl geladen; die App weist auf die Übertragung von IP-Adresse und Kartenausschnitt hin und vermerkt sie im Projekt (`privacy.usedOnlineServices`).
- Natural Earth liegt bis Zoom 7 unter den OpenFreeMap-Ebenen: ohne Netz bzw. bei Ausfall des Dienstes bleibt eine Land/Wasser-Karte; darüber eine neutrale Fläche mit Routenvektoren (CLAUDE.md §4).
- CSP: `connect-src` und `img-src` um `https://tiles.openfreemap.org` erweitert. Keine Kachel-Vorratshaltung (Service Worker ignoriert Fremd-Origins).
- Offen: Test gegen den echten Dienst, MP4-Export mit OpenFreeMap-Stil (H.264-Browser in dieser Sitzung nicht verfügbar), Gerätetests.

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
| Auto/Motorrad/Rad/Fuß | **openrouteservice über eigenen Supabase-Proxy** (wenn `VITE_ROUTING_PROXY_URL` gesetzt), sonst OSRM (FOSSGIS-Demoserver) als Prototyp – beides **nur nach Opt-in**; sonst lokale Näherung | `provider_verified` bzw. `estimated` |
| Schiff, Bahn, Bus | keine lizenzierte Datenquelle → lokale Näherung | `estimated` + Warnung |

Begründung: Kein kostenloser, für öffentliche Produktionsnutzung bestätigter Routingdienst gefunden (E05). Der FOSSGIS-Server ist ein Best-Effort-Demodienst; Bedingungen konnten in dieser Sitzung nicht abgerufen werden. Deshalb Opt-in, Drosselung (1 Anfrage/s) und gekennzeichneter Fallback. Ausstiegspfad: openrouteservice/GraphHopper (Free-Tier mit Schlüssel – Bedingungen prüfen) oder selbst gehostetes OSRM/Valhalla (Kosten → Freigabe nötig).

**Produktentscheidung 2026-10-08 (Produktverantwortlicher):** Für den öffentlichen Betrieb wird ein **Routinganbieter mit kostenlosem Kontingent und API-Schlüssel** verwendet (Kandidaten: openrouteservice, GraphHopper). Bedingungen: kein kostenpflichtiger Tarif, keine Kreditkartenpflicht ohne erneute Freigabe; Nutzungsbedingungen (Persistenz der Geometrie, Attribution, kommerzielle/öffentliche Nutzung, Schlüssel im Client vs. Proxy) und Limits werden vor Auswahl in `EXTERNAL_EVIDENCE.md` (E05/E12) belegt; harte Drosselung und Kill-Switch. FOSSGIS-OSRM bleibt bis dahin nur Opt-in-Prototyp und wird vor öffentlichem Start ersetzt.

**Umsetzung 2026-10-08:** openrouteservice (Standard-Plan, kostenlos). Die ORS-FAQ verbietet den Schlüssel im Client; deshalb ein Proxy. Auf Wunsch des Produktverantwortlichen als **Supabase Edge Function** (`supabase/functions/route`), weil Login/Nutzerdatenbank (Phase 6) ohnehin dort entstehen sollen. Alternativen: Cloudflare Worker (keine Pausierung, aber zweiter Dienst); Schlüssel je Nutzer (keine Infrastruktur, aber Hürde für Nutzer).
- Schutz: Origin-Allowlist, Kill-Switch (`ROUTING_ENABLED`), Tages-Kontingente je Client (täglich wechselnder, gesalzener IP-Hash) und gesamt (1.800 < ORS-Limit 2.000) sowie ein gleitendes Minutenlimit gesamt (30 < ORS-Limit 40, nur Zeitstempel in `routing_recent`) in Postgres (`routing_take_quota`, nur Service-Rolle), fail-closed bei DB-Fehler, Body ≤ 4 KB, 2–5 Punkte. Keine Speicherung/Protokollierung von Koordinaten.
- Client: `createOrsProxyProvider` (`src/adapters/routing/orsProxy.ts`), Auswahl in `config.ts`; Fehler → gekennzeichnete Näherung wie bisher. CSP erhält den https-Origin des Proxys zur Build-Zeit.
- Status: **Implementiert**, in der Sandbox getestet (Handler, Deno-Lauf mit simulierter DB, SQL in PGlite). **Nicht** gegen echtes Supabase/ORS getestet; Einrichtung durch den Produktverantwortlichen nach `docs/SUPABASE_ROUTING.md`.

## ADR-005 Geocoding

Offline-Suche über Natural Earth Populated Places (7.342 Orte inkl. deutscher Namen) + Flughäfen (IATA) – keine Datenübertragung. Optional Nominatim **nur** auf ausdrückliches Absenden (Richtlinie verbietet Autocomplete) und nur nach Opt-in.

## ADR-006 Lokale Persistenz

IndexedDB über `idb` 8.0.4 (ISC). Projekte als Zod-validiertes JSON (`schemaVersion`), Medien getrennt als Blobs. Validierung beim Lesen **und** vor dem Schreiben; defekte Datensätze werden gemeldet, nie gelöscht. `navigator.storage.persist()` wird beim ersten Projekt angefragt.

**Schreib-Journal (2026-10-09):** Ein E2E-Lauf unter Last deckte einen echten Datenverlust auf: Nach „Zurück“ plus sofortigem Reload/Schließen wurde die noch offene IndexedDB-Transaktion abgebrochen, die letzte Änderung fehlte (per Instrumentierung belegt: `put start`, nie `put done`). Deshalb sichert der Editor den noch nicht bestätigten Stand beim Verlassen zusätzlich **synchron** in `localStorage` (`src/adapters/storage/journal.ts`, nur Projekt-JSON, keine Blobs, ≤ 2 MB). Der nächste Seitenstart spielt es vor dem ersten Lesen ein (`recoverJournals`, einmal je Seitenstart): nur wenn das Projekt noch existiert und nicht neuer gespeichert wurde; gelöschte Projekte werden nie wiederbelebt; bei Speicherfehlern bleibt das Journal erhalten. Nach bestätigtem Schreiben wird es entfernt (nur bei identischem Stand). Grenze: Stürzt der Browser ab, bevor `localStorage` auf Datenträger geschrieben wurde, bleibt ein Restrisiko; ohne `localStorage` (blockiert/voll) gilt weiter nur der IndexedDB-Pfad.

## ADR-007 Deterministische Szene

`buildSceneModel(project)` + `evaluateScene(model, tMs)` sind reine Funktionen. Vorschau und Export verwenden denselben Evaluator und denselben Overlay-Zeichner (`src/scene/drawOverlay.ts`). Kamera-Glättung erfolgt über ein symmetrisches Zeitfenster (zustandslos), daher identische Ergebnisse bei beliebiger Seek-Reihenfolge (Unit-Test).
Logischer Viewport 540×960; Export skaliert per `pixelRatio` (2 → 1080p, 4 → 4K), damit das Framing auflösungsunabhängig ist.

## ADR-008 Hosting (nur Test-Veröffentlichung, keine öffentliche Freigabe)

Statische Auslieferung. **Test-Veröffentlichung auf GitHub Pages (Entscheidung des Produktverantwortlichen, 2026-10-09):** zum Selbsttesten auf echten Geräten, per Hand ausgelöst (`.github/workflows/pages.yml`, nur `workflow_dispatch`, nur Branch `main`), mit `noindex`/`robots.txt` und dem App-Hinweis „Prototyp – nicht veröffentlicht“; das Projekt ist nirgends beworben oder verlinkt. Kein Geld, keine Zahlungsmethode (Pages für öffentliche Repositories kostenlos; Site ≤ 1 GB, 100 GB/Monat weich – laut GitHub-Doku über Suche, E12). Einrichtung und Rückbau: `docs/TEST_DEPLOYMENT.md`. Das ist **keine** Freigabe im Sinne von CLAUDE.md §15/§16 (Abnahmetests auf Geräten stehen aus); die Release-Matrix bleibt offen. Für den späteren echten Start sind Domain, Datenschutzerklärung/Impressum und Kill-Switch-Prüfung (Phase 5) nötig.

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
| 10 | Apple-Stile hell/dunkel/Satellit/Hybrid/3D/minimal | Teilweise (Apple blockiert E01–E04) | Natural Earth „minimal“ hell/dunkel; Standard hell/dunkel über OpenFreeMap implementiert. Satellit/Hybrid/3D gesperrt. |
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
| 23 | Konto E-Mail/Passwort | Nicht begonnen (Phase 6) | Szenario 14 am 2026-10-08 als DEFERRED_APPROVED auf Phase 6 zurückgestellt. |
| 24 | Kostenlos ohne Registrierung | Implementiert | Keine Kontofunktion vorhanden. |
| 25 | Cloud-Sync später | Nicht begonnen (Phase 6) | |
| 26 | GPS-Daten bleiben lokal | Anforderung | GPS nicht begonnen; keinerlei Uploads im Code. |
| 27 | Kostenloses Hosting | Nicht begonnen | Nicht veröffentlicht. |
| 28 | Premium vorbereiten | Nicht begonnen | |
| 29 | Admin | Nicht begonnen (Phase 6) | Szenario 14 am 2026-10-08 als DEFERRED_APPROVED auf Phase 6 zurückgestellt. |
| 30 | iPhone & Android gleichwertig | Nicht verifiziert | Keine Gerätetests möglich in Sandbox. |
| 31 | Mobile-first UI | Implementiert | Nur emuliert (Pixel 7) getestet. |
| 32 | DE + EN | Implementiert | EN-Wörterbuch typgeprüft vollständig. |
| 33 | Begründeter kostenloser Stack | Erledigt (dieses Dokument) | |
| 34 | Umfassende V1 phasenweise | Laufend | |
| 35 | Offline-Bearbeitung | Teilweise verifiziert | Service Worker precacht alle Bundles + Geodaten; Offline-E2E (Sandbox) bestanden; Geräte offen. |
| 36 | Fahrzeugbibliothek, eigene Assets | Teilweise | 8 Symbole + Farbe; Uploads/Admin nicht begonnen. |
| 37 | Reduziertes, iOS-inspiriertes Design | Implementiert | Eigene Gestaltung, keine Apple-Assets. |
| 38 | Budgets und Tests als Releasepflicht | Teilweise | PERFORMANCE.md (Entwurf), Tests vorhanden; Gerätetests offen. |
| 39 | Apple Maps bevorzugt, Alternative zulässig | Alternative aktiv | Apple blockiert (E01/E03). |
| 40 | Bei Überlastung niedrigere Qualität vorschlagen | Implementiert, teilweise | Vorschlag bei nicht unterstütztem Profil; Laufzeit-Überlastungserkennung fehlt. |
| 41 | Näherung kennzeichnen + manuell korrigieren | Teilweise verifiziert | Kennzeichnung (Badge, gestrichelt, Export-Hinweis mit Bestätigung); Linienbearbeitung per Ziehen (Unit + E2E Sandbox), Status wird `manually_edited`. |
| 42 | Filmische vs. proportionale Zeit | Verifiziert (Unit) | |
| 43 | Zunächst nur lokale Projekte | Implementiert | |
| 44 | Phasen, Tests vor Start | Eingehalten | Keine Veröffentlichung. |
