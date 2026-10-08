# RouteVFX – Animated Route Creator

Mobile-first PWA, um multimodale Reisen zu planen, auf einer Karte zu animieren und als vertikales 9:16-MP4 (Instagram Stories/Reels, TikTok, YouTube Shorts) zu exportieren.

> **Status: Prototyp – nicht veröffentlicht.** Veröffentlichung erst nach bestandenen Abnahmetests (siehe `docs/ACCEPTANCE.md`, `docs/RELEASE_MATRIX.md`). Verbindliche Spezifikation: `CLAUDE.md`.

## Was funktioniert (geprüft in der Sandbox, nicht auf Geräten)
- Projekt anlegen, Orte offline suchen (Natural Earth, inkl. Flughäfen/IATA), Stopps auf Karte tippen
- Verkehrsmittel je Abschnitt (8 Modi); Flug als Großkreis, andere Modi als **gekennzeichnete Näherung** oder – nach Opt-in – über OSRM
- Deterministische Animation (Kamera folgt, km-Zähler, Wechsel-Einblendung, Fortschritt, Näherungshinweis)
- MP4-Export per WebCodecs H.264 auf dem Gerät, Rücklese-Prüfung der Datei, Download
- Lokale Speicherung in IndexedDB (Autosave, Undo/Redo), DE/EN

Vollständige Liste inkl. offener Punkte: `docs/PROGRESS.md`.

## Entwicklung
```bash
npm ci
npm run dev          # Entwicklungsserver
npm run typecheck    # TypeScript strict (App, Tests, Konfiguration)
npm test             # Unit-, Contract- und Integrationstests (Vitest)
npm run build        # Produktions-Build inkl. CSP
CHROME_PATH=/pfad/zu/chrome npm run test:e2e   # E2E inkl. echtem MP4-Export
```
Für den E2E-Export wird ein Chrome mit proprietären Codecs benötigt (z. B. *Chrome for Testing*); Playwrights Open-Source-Chromium kann kein H.264 encodieren. `ffprobe` (FFmpeg) muss installiert sein.

`npm run data:build` erzeugt `public/geodata/*` reproduzierbar aus einem gepinnten Natural-Earth-Commit.

## Architektur (Kurz)
```
src/core/        reine Logik: types, geodesy, project (Schema/Migration), timeline, scene (evaluateScene)
src/adapters/    routing, geocoding, maps (MapLibre, Stil-Matrix), encoding (WebCodecs/MP4), storage (IndexedDB)
src/features/    imports (GPX), projects (Journey-Mutationen), export (Audio-Mix)
src/scene/       Overlay-Zeichner (gemeinsam für Vorschau und Export)
src/app/         React-UI
src/i18n/        de, en
docs/            Entscheidungen, Risiken, Nachweise, Kosten, Abnahme, Fortschritt
```

## Daten & Lizenzen
- Kartendaten: [Natural Earth](https://www.naturalearthdata.com/) (gemeinfrei); optional Detailkarte über [OpenFreeMap](https://openfreemap.org) – „OpenFreeMap © OpenMapTiles Data from OpenStreetMap“ (Stile Positron/Dark Matter: BSD-3, Design CC BY 4.0; Lizenzen in `src/adapters/maps/openfreemap/LICENSE.md`)
- Bibliotheken: siehe `docs/EXTERNAL_EVIDENCE.md`
- Logos in `assets/logos/`: Eigentum des Repository-Owners
