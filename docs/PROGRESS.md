# Fortschritt und Phasenplan

## Stand 2026-10-08 – Arbeitsschritt 1 (Phase 0 + minimaler End-to-End-Prototyp)

### Geliefert
| Funktion | Status | Test |
|---|---|---|
| Projektgerüst (Vite 8, React 19, TS strict, gepinnte Versionen, Lockfile) | Verifiziert | `npm run typecheck`, `npm run build` |
| Versioniertes Projektmodell (Zod), Migrationsgerüst, Validierung vor Schreiben/nach Lesen | Verifiziert (Unit) | `tests/unit/project.test.ts` |
| Geodäsie: Haversine, Großkreis, Datumsgrenze, Linieninterpolation, reines fitBounds | Verifiziert (Unit) | `tests/unit/geodesy.test.ts` |
| Zeitmodell filmisch/proportional, Pausen, manuelle Segmentdauer, 3–180 s | Verifiziert (Unit) | `tests/unit/timeline.test.ts` |
| Deterministischer `evaluateScene` (Kamera, Linien, Fahrzeug, km, Overlays) | Verifiziert (Unit) | `tests/unit/scene.test.ts` |
| Routing-Adapter: Großkreis, gekennzeichnete Näherung, OSRM (Opt-in) | Lokal verifiziert; OSRM nur Mock | `tests/contracts/routing.test.ts` |
| Offline-Ortssuche (Natural Earth, inkl. „Hannover“, IATA) | Verifiziert (Unit + E2E) | `tests/unit/geocoding.test.ts` |
| GPX-Parser (trk/rte/wpt, Limits, XXE-Schutz) | Verifiziert (Unit); UI-Import ungetestet | `tests/unit/gpx.test.ts` |
| IndexedDB-Speicher, Autosave, Undo/Redo, Löschen mit Bestätigung, Duplizieren | Speicher verifiziert (Integration); UI teilweise (E2E-Autosave) | `tests/integration/storage.test.ts` |
| Karte: MapLibre 6 + Natural Earth hell/dunkel, offline | Verifiziert (Sandbox) | E2E + Frame-Sichtprüfung |
| 9:16-Vorschau mit Play/Scrub (gleicher Evaluator wie Export) | Implementiert | nur manuell/indirekt |
| MP4-Export WebCodecs H.264 + mediabunny, Capability-Probe, Abbruch, Rücklese-Prüfung | **1080p30 verifiziert (Sandbox)**, weitere s. RELEASE_MATRIX | `tests/e2e/export.spec.ts`, `tests/e2e/profiles.spec.ts` |
| Audio-Mix (Gain, Fades, Stumm) → AAC | Implementiert, **nicht verifiziert** (kein AAC in Sandbox) | – |
| Download / Web Share | Download verifiziert; Share ungetestet | E2E |
| DE/EN | Implementiert | Typprüfung erzwingt vollständiges EN |
| PWA: Manifest, Icons (RouteVFX), Service Worker (App-Shell + Geodaten) | Implementiert, ungetestet | – |
| CSP im Produktions-Build | Implementiert; App läuft unter CSP im E2E | E2E (Preview-Build) |

### Testergebnisse dieses Schritts
- `npm run typecheck`: ohne Fehler.
- `npx vitest run`: **8 Dateien, 51 Tests bestanden.**
- `npx playwright test` (Chrome for Testing 141, Pixel-7-Emulation, SwiftShader): siehe RELEASE_MATRIX.md.

### Ausdrücklich offen / nicht getestet
GPS-Aufzeichnung · Kartenlink-Import · Routenziehen/Geometrie-Editor · Wegpunkte-UI · Stopp-Zoom · Timeline-Keyframes · erweiterter Editor · Fotos/Clips/Logos · Voice-over · SFX/Musikbibliothek · Effekte/Übergänge · 2D-Upload/3D-Modelle · Audio im Export · Web Share · Offline-Betrieb · Reload-Persistenz im Browser · alle Gerätetests (iPhone/Android) · Accessibility-Prüfung · Admin/Cloud.

### Blocker (deine Entscheidung nötig)
1. **Kartenquelle mit Straßen/Städten (R-01):** Natural Earth ist lizenzsauber, aber grob. Optionen: (a) OSM-Vektorkacheln selbst als PMTiles auf statischem Hosting (kostenlos möglich, Lizenz ODbL mit Attribution im Video; Datengröße/Hosting-Limits zu prüfen) oder (b) OpenFreeMap-Instanz (Bedingungen müssen verifiziert werden). Apple MapKit erfordert eine kostenpflichtige Mitgliedschaft und hat keine nachgewiesene Exporterlaubnis.
2. **Routing (R-03):** FOSSGIS-Demo ist nur Best-Effort. Für öffentlichen Betrieb Anbieter mit Schlüssel (Free-Tier) oder Selbsthosting (Kosten) – Freigabe nötig.
3. **Gerätetests:** Ein iPhone und ein Android-Gerät müssen den Prototyp ausführen; ohne das bleiben alle Exportprofile auf „Sandbox“.

## Phasenplan

| Phase | Inhalt | Stand |
|---|---|---|
| 0 Compliance & Feasibility | Anbieter-/Lizenzmatrix, Codec-Probe, Spike | **Weitgehend erledigt** (Gerätemessungen offen) |
| 1 Kern/PWA | CI, i18n, Datenmodell, IndexedDB, Mobile-UI, Karte, Suche, Tippen, Wegpunkte, Auto/Fuß/Rad | **Teilweise** – CI, Wegpunkte-UI, E2E für Reload/Offline fehlen |
| 2 Alle Verkehrsmittel | GPX-UI, URL-Import, GPS, Alternativen/Drag-Edit, Provenienz, Offline-Geometrien | Teilweise (Provenienz, GPX-Parser) |
| 3 Animation/Editor | Keyframes, Zweimodus-Editor, 2D/3D-Fahrzeuge, Vorlagen | Teilweise (Evaluator, Presets, Linienstile) |
| 4 Medien/Export | Bilder/Clips, Audio-Lizenzen, Voice-over, Mixer, Effekte, Streaming-Export, Share | Teilweise (Export-Pipeline) |
| 5 Qualitäts-Gate | Release-Matrix, Geräte-/Security-/A11y-Tests | Nicht begonnen |
| 6 Cloud/Admin | Auth, Sync, RLS, Admin, Kostenkontrolle | Nicht begonnen |

### Nächste konkrete Schritte
1. CI (GitHub Actions: Typecheck + Unit-Tests; E2E mit Chrome for Testing).
2. E2E: Reload-Persistenz, GPX-Import über UI, Offline-Modus, Exportabbruch.
3. Streaming-Export (OPFS) gegen RAM-Grenze (R-06); Code-Splitting (R-12).
4. Wegpunkte-UI + manuelle Geometriekorrektur (Ent. 09/41, Szenario 3).
5. Geräte-Probe-Seite für iPhone/Android-Messungen (E08/E09/E13).
