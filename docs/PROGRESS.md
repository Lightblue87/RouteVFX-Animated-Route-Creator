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
| Manuelle Linienkorrektur (Kontrollpunkte ziehen/einfügen/entfernen) | Verifiziert (Unit + E2E Sandbox, Maus) | `project.test.ts`, `core.spec.ts` |
| Zoom und Pause am Zwischenstopp | Verifiziert (Unit) | `scene.test.ts` |
| Kamera-Übergang hält Fahrzeug im Bild; Label-Kollisionsvermeidung | Verifiziert (Unit + Frame-Sichtprüfung) | `scene.test.ts` |
| Code-Splitting (Start-JS 105 KB gzip) | Verifiziert (Build) | `npm run build` |
| CI-Workflow (Typecheck, Tests, Build, Audit) | Verifiziert (GitHub Actions grün) | `.github/workflows/ci.yml` |
| Offline-Start nach Erstinstallation (SW-Precache aller gehashten Bundles, `ignoreVary`) | Verifiziert (E2E Sandbox, 10/10 unter Last) | `robustness.spec.ts` |
| Autosave-Flush beim Verlassen (Zurück, Reload, Hintergrund) | Verifiziert (E2E Sandbox) | `robustness.spec.ts` |
| Race-Fixes: verspätete Routing-Antwort überschreibt keine Bearbeitung; spät geladene Karte zeigt aktuellen Stand | Verifiziert (Unit + E2E) | `project.test.ts`, `robustness.spec.ts` |
| DE/EN | Implementiert | Typprüfung erzwingt vollständiges EN |
| PWA: Manifest, Icons (RouteVFX), Service Worker (App-Shell + Geodaten) | Implementiert, ungetestet | – |
| CSP im Produktions-Build | Implementiert; App läuft unter CSP im E2E | E2E (Preview-Build) |

### Testergebnisse dieses Schritts
- `npm run typecheck`: ohne Fehler.
- `npx vitest run`: **9 Dateien, 62 Tests bestanden.**
- `npx playwright test` (Chrome for Testing 141, Pixel-7-Emulation, SwiftShader): **14 E2E-Tests bestanden** – Export 1080p30/1080p60/4k30/4k60 (je ffprobe-geprüft), Reload-Persistenz, GPX-UI inkl. Ablehnung, Exportabbruch, Szenario 2 (multimodales Video), Linienkorrektur, Offline-Start, Autosave-Flush, langsam ladende Karte, Duplizieren inkl. Medienkopie.
- `npm audit --audit-level=high`: 0 Funde.

### Bekannte kleine Mängel (offen)
- Fahrzeugsymbol kann Ortslabel verdecken.
- Ortsnamen aus Natural Earth erscheinen in der englischen Form („Hanover“), auch bei deutscher Oberfläche.
- Sehr kurze Abschnitte (z. B. Stadt → Flughafen) zeigen auf Natural Earth kaum Kartendetails (R-01).

### Ausdrücklich offen / nicht getestet
GPS-Aufzeichnung · Kartenlink-Import · Service-Worker-Update-Ablauf · Re-Routing über Ziehpunkte (online) · Routing-Wegpunkte-UI · Touch-Ziehen auf echten Geräten · Timeline-Keyframes · erweiterter Editor · Fotos/Clips/Logos · Voice-over · SFX/Musikbibliothek · Effekte/Übergänge · 2D-Upload/3D-Modelle · Audio im Export · Web Share · Offline-Betrieb · Reload-Persistenz im Browser · alle Gerätetests (iPhone/Android) · Accessibility-Prüfung · Admin/Cloud.

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
2. E2E: Hintergrund-Abbruch, Service-Worker-Update.
3. Streaming-Export (OPFS) gegen RAM-Grenze (R-06).
4. Timeline-Editor mit Kamera-/Text-Keyframes (Ent. 13/14, Szenario 6).
5. Geräte-Probe-Seite für iPhone/Android-Messungen (E08/E09/E13).
