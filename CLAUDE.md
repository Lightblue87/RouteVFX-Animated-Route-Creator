# CLAUDE.md — Animated Route Creator

> Verbindliche Produkt- und Entwicklungsanweisung für Claude Code. Sprache dieser Projektanweisung: Deutsch. Stand: 2026-10-08. Status: Spezifikation nach sieben Interviewrunden, technische Nachweise teils offen.

## 0. Arbeitsauftrag an Claude Code

Entwickle eine öffentlich nutzbare, mobile-first Progressive Web App (PWA), mit der Menschen multimodale Reisen planen oder aufzeichnen, auf einer Karte animieren, in einem Editor gestalten und als 9:16-MP4 für Instagram Stories/Reels, TikTok und YouTube Shorts exportieren können. Zielplattformen iPhone und Android gleichwertig. Deutsch und Englisch ab Start. Entwicklung in nachprüfbaren Phasen; **keine öffentliche Freigabe vor bestandenen Abnahmetests**. Produktumfang vollständig spezifizieren, auch wenn einzelne Features erst in späteren Phasen implementiert werden. Kostenloser Betrieb beim Start ist eine harte Zielvorgabe; keine kostenpflichtigen Dienste ohne ausdrückliche Freigabe.

**Unverhandelbare Arbeitsregeln:**
1. Lese vor jeder Implementierung die gesamte `CLAUDE.md`; pflege `docs/DECISIONS.md`, `docs/RISKS.md`, `docs/PROGRESS.md`, `docs/EXTERNAL_EVIDENCE.md` und `docs/ACCEPTANCE.md`. Stelle keine als erledigt dar, deren Funktion nicht getestet wurde.
2. Unterscheide in jeder Dokumentation zwischen **Anforderung**, **Implementierung**, **verifiziert**, **teilweise verifiziert**, **blockiert** und **nicht begonnen**. Keine fingierten API-Fähigkeiten, Messwerte, Nutzerzahlen, Browser-Kompatibilitäten oder Lizenzfreigaben.
3. Prüfe und dokumentiere aktuelle offizielle APIs, Lizenzbedingungen, Tarife und Browserverhalten vor Provider-Entscheidungen. Fixiere Bibliotheksversionen reproduzierbar. Generiere keine geheime Konfiguration ins Repository.
4. Implementiere vertikale, funktionierende End-to-End-Slices statt leere Oberflächen, Mock-Buttons oder unverbundene Platzhalter als fertig zu deklarieren.
5. Halte Routing-Provider, Karten-Darstellung, Animation, Export, Speicher und Cloud hinter separaten Schnittstellen. **Kein Vendor-Lock-in im Projektdateiformat.**
6. Besteht ein externer Nachweis nicht, implementiere einen klar ausgewiesenen Alternativpfad bzw. sperre die Funktion mit verständlicher Erklärung. Keine stillschweigende Näherung als echte Route und keine willkürliche Qualitätszusage.
7. Mobile-First und Touch-Bedienung sind Pflicht, Desktop optional nutzbar. iOS und Android erhalten funktional gleichwertige Kernabläufe, auch falls die verwendeten Exportmethoden variieren.
8. Kein serverseitiger Upload privater GPS-Tracks, Bilder, Audio- oder Videodateien ohne ausdrückliche, informierte Aktion. Keine unbegrenzten API-Aufrufe oder Renderjobs auf öffentliche Kosten.

## 1. Produktdefinition und Geltungsbereich

**Name (Arbeitstitel):** Animated Route Creator. **Kernnutzen:** Aus Start/Ziel/Wegpunkten, GPX oder GPS-Aufzeichnung eine nachvollziehbare Route erstellen; Verkehrsmittel je Reiseabschnitt auswählen; realistische Geometrie und elegante 2D-/3D-Animationen darstellen; animierte Kamera, Musik, Texte, Fotos, Clips und Audiotracks auf einer Timeline steuern; MP4 exportieren.

**Zielnutzer:** Privatpersonen, Reisende, Auto-/Motorrad-Communities, Travel-Creators. Öffentlich zugänglich. Alle kostenlosen Funktionen ohne Konto; Premium-Berechtigungen nur für eingeloggte Nutzer, Geschäftsmodell später. Keine Wasserzeichenpflicht beschlossen, keine Export-Paywall beschlossen.

**Nicht als zugesichert behandeln:** verlässliche GPS-Hintergrundaufzeichnung bei gesperrtem iPhone; realistische Schiff-/Bahn-Trassen weltweit ohne geeignete Daten; Apple-Kartenmaterial im MP4; garantiertes 4K/60-FPS-Encoding auf beliebigen Smartphones; Offline-Verfügbarkeit lizenzierter Drittanbieter-Kacheln; direktes automatisches Posting in Instagram/TikTok.

**Output:** ausschließlich vertikales 9:16 als Produktvorgabe der Version 1, 1080×1920 oder 2160×3840, 30 oder 60 FPS, maximal **180 Sekunden**. Exportschaltfläche muss bei nicht unterstützten Kombinationen sichere niedrigere Profile anbieten; keine unerfüllbaren Profile versprechen. MP4 ist Pflichtziel, nicht WebM als unbemerkter Ersatz. Nutzer können auf dem Gerät speichern, die Web Share API / native Teilen-Funktion sofern unterstützt aufrufen sowie unterstütztes Teilen zu Plattformen nutzen; **keine** unbestätigte Direktveröffentlichung im Namen des Nutzers.

## 2. Verbindliches Entscheidungsregister — alle 44 Nutzerentscheidungen

Die folgenden Einträge sind Produktwünsche, keine bereits bewiesenen technischen Fähigkeiten. Bei Konflikt gilt die **spätere** speziellere Entscheidung vor einer früheren allgemeineren.

| ID | Verbindliche Nutzerentscheidung |
|---|---|
| 01 | Öffentlich nutzbar; mögliche spätere Premium-Funktionen. |
| 02 | Manuelle Routenplanung zentral; GPS-Aufzeichnung ergänzend. |
| 03 | Ausgabe für Story, Reels, TikTok und Shorts in 9:16. |
| 04 | Export wählt automatisch geeignete Methode. |
| 05 | Route durch Ortssuche, Karten-Tippen, Ziehen, GPX oder technisch möglichen Kartenlink-Import. |
| 06 | Auto, Motorrad, Flugzeug, Schiff/Fähre, Bahn, Fahrrad, Fußweg, Bus/ÖPNV. |
| 07 | Möglichst reale Straßen-, Bahn- und Schifffahrtsrouten. |
| 08 | Zwischenstopp individuell mit Pause, Zoom, Text und Verkehrsmittelwechsel. |
| 09 | Alternative Straßenrouten und Wegpunkte zur präzisen Korrektur. |
| 10 | Apple-Karte hell/dunkel, Satellit, Hybrid, 3D-Gelände, minimalistisch — abhängig von Lizenz/Renderer. |
| 11 | Verkehrsmittel als Symbol, 2D-Illustration oder 3D-Modell wählbar. |
| 12 | Linien pro Strecke: fortlaufend zeichnen, vollständig anzeigen, gestrichelt. |
| 13 | Statische Übersicht, Follow-Cam, Auto-Zoom, Fahrtrichtungsrotation, cinematic Perspektiven, manuelle Kamera-Keyframes. |
| 14 | Vollwertige Timeline mit Keyframes und Geschwindigkeitssteuerung. |
| 15 | Einblendungen: Ort, Start/Ziel, km gesamt/aktuell, Reise-/Fahrzeit, Verkehrsmittelwechsel, Datum/Uhrzeit, eigene Texte/Bilder/Logos, Fortschritt. |
| 16 | Einfacher Assistent **und** erweiterter Timeline-Editor. |
| 17 | Eigene Musik, lizenzfreie Musikbibliothek, Verkehrsmittel-SFX, Voice-over, Pegel/Fades, stummes Video. |
| 18 | Weiche Übergänge, animierte Titel/Kilometer, Fotos/Clips, Motion-Blur/Speed-Effekte, Designvorlagen. |
| 19 | Full HD und 4K mit 30/60 FPS als wählbare Zielprofile, sofern unterstützt. |
| 20 | Maximal drei Minuten Video. |
| 21 | Lokal ohne Konto; optionale Cloud-Synchronisation später. |
| 22 | MP4 herunterladen, iPhone-/Geräte-Share-Sheet, Social-Media-Teilen soweit möglich; **keine** öffentlichen Videolinks und **kein** eigenständiger Projekt-Dateiexport als beschlossene V1-Funktion. |
| 23 | Konto mit E-Mail/Passwort. |
| 24 | Alle kostenlosen Funktionen ohne Registrierung, Premium später nur mit Konto. |
| 25 | Spätere Cloud-Synchronisation von Routen/Wegpunkten/Modi, Animation/Timeline/Design, eigenen Vorlagen/Presets; keine Medien-/MP4-Synchronisation beschlossen. |
| 26 | GPS-Daten bleiben lokal, außer bei explizit ausgelöstem Cloud-Upload. |
| 27 | Zunächst kostenloses Hosting und Betrieb. |
| 28 | Premium architektonisch vorbereiten; Modell offen. |
| 29 | Admin: Nutzer sperren/verwalten, Kartendesigns/Musik/Modelle/Vorlagen pflegen, Nutzung/Export/Verbrauch, Kosten-/Nutzungslimits. |
| 30 | iPhone und Android gleichwertig. |
| 31 | Native-artige, übersichtliche Mobile-first-UI. |
| 32 | Deutsch und Englisch von Anfang an. |
| 33 | Claude wählt nach begründetem Kosten-/Lizenzvergleich geeigneten kostenlosen Stack. |
| 34 | Möglichst umfassende V1 einschließlich 4K, 3D, Audio; phasenweise Entwicklung, nur belegbar funktionierende Features veröffentlichen. |
| 35 | Offline-Projektbearbeitung einschließlich gespeicherter Routengeometrien. |
| 36 | Verkehrsmittelbibliothek, eigene 2D-Bilder, eigene 3D-Modelle, Farben/Designs, kuratierte Modelle über Admin. |
| 37 | Modernes, reduziertes, iOS-inspiriertes Design. |
| 38 | Performance-Budgets, Export-, Sicherheits- und Gerätetests als Releasepflicht. |
| 39 | Apple Maps bevorzugt; alternative Kartendarstellung für Export/Sonderfunktionen zulässig. |
| 40 | Bei Geräteüberlastung niedrigere Exportqualität vorschlagen statt blind fehlschlagen. |
| 41 | Fehlt echte Route: angenäherte Geometrie **kennzeichnen** und manuelle Korrektur ermöglichen. |
| 42 | Umschaltbare filmische und proportional-reale Zeitverteilung. |
| 43 | **Zunächst ausschließlich gerätespezifische lokale Projekte; Cloud später.** Diese spätere Entscheidung konkretisiert 21/25; kein geräteübergreifender Projekttransfer in V1 voraussetzen. |
| 44 | Gesamtscope spezifizieren, in Phasen umsetzen, erst nach Funktionstests öffentlich starten. |

**Konfliktauflösung:** 21/25 beschreiben die spätere optionale Cloud; 43 bestimmt die **V1-Priorität lokale Projekte**, ohne Cloud vor dem ersten Release zu verlangen. 34 ist kein Auftrag, ungeprüft alle High-End-Funktionen als produktionsreif zu behaupten; 44 macht getestete, nachvollziehbare Funktionalität zur Veröffentlichungsvoraussetzung. 22 schließt die nicht gewählten öffentlichen Freigabelinks und eigenständigen Projekttransfer-Dateien aus dem vereinbarten Scope aus. 10 ist gestalterisches Ziel, durch 39 und Drittanbieterrechte begrenzt.

## 3. Architekturprinzipien und geeigneter Stack

Claude hat Wahlfreiheit. Führe zuerst eine kurze Architecture Decision Record (ADR) mit 2–3 Alternativen pro kritischem Baustein, geschätzten Freikontingenten, Limitierungen, Lizenzstatus, Ausstiegspfad und mobilem Ressourcenbedarf. **Präferenz als Ausgangspunkt, nicht als Vorgabe:** TypeScript strict, React/Vite oder vergleichbare schlanke PWA, Routing/MapLibre-Adapter und MapKit-JS-Adapter, IndexedDB mit bewährter Wrapper-Library, Service Worker, Web Workers, WebGL/Three.js bzw. vergleichbar für 3D, Zod/JSON-Schema, i18n, Vitest/Playwright, cloud-hosted statische Frontend-Assets. Backend/Auth/Admin später nur so viel wie nötig (z. B. Supabase), nicht für lokale Kernfunktionen.

### Logische Module

- `app-shell`: PWA, Routing innerhalb der UI, Installation, i18n, Design, Error Boundaries.
- `project-core`: versioniertes Projektmodell, Validatoren, Migrations, Undo/Redo, Autosave.
- `geocoding`: Ortssuche, Debouncing, Quellen, Attribution, Limits.
- `route-planner`: Routenplanung, Alternativen, Intermediates, Geometrie, Routenqualität.
- `route-import`: GPX und unterstützte, eindeutig spezifizierte URL-Formate.
- `gps-recording`: Browser-Geolocation, Berechtigungszustand, Trackqualität.
- `map-adapters`: Apple-MapKit-JS-Vorschau (nur falls geklärt), unabhängiger exportfähiger Renderer.
- `scene-engine`: deterministische Szene, Kamera, Linien, Overlays, 2D-/3D-Fahrzeuge.
- `timeline-engine`: Zeit, Keyframes, Easing, Segmentdauer, Tracks.
- `media-engine`: Audio, Voice-over, Bild/Video, Schnitt, Mix, SFX.
- `export-engine`: Capability Detection, Renderframes, Encoder, Audio-Mux, MP4, Abort/Progress.
- `local-storage`: IndexedDB, Blob-Store, Recovery, Quotas, Migration, lokale Löschung.
- `cloud-sync` (später): Opt-in, Auth, RLS, Konflikte, DSGVO-Löschung.
- `admin` (später/Release nach Backend): RBAC, Moderation, Assetkatalog, Quotas.
- `observability`: lokale Fehlerdiagnostik, privacy-preserving optional Analytics.

### Schnittstellen (Beispiele, nicht endgültige APIs)

```ts
interface GeoPoint { lat: number; lon: number; altitudeM?: number; }
type TransportMode = 'car'|'motorcycle'|'plane'|'ship'|'train'|'bike'|'walk'|'bus';
type RouteConfidence = 'provider_verified'|'imported_recorded'|'derived'|'estimated'|'manually_edited';
interface RoutingRequest { start: GeoPoint; end: GeoPoint; via: GeoPoint[]; mode: TransportMode; preferences?: Record<string, unknown>; }
interface RoutingResult { geometry: GeoPoint[]; alternatives?: GeoPoint[][]; distanceM: number; etaS?: number; source: string; confidence: RouteConfidence; attribution?: string; warnings: string[]; }
interface RoutingProvider { id: string; supportedModes: TransportMode[]; route(request: RoutingRequest, signal?: AbortSignal): Promise<RoutingResult[]>; }
interface MapRenderer { id: string; supportedStyles(): Promise<string[]>; loadScene(scene: RenderScene): Promise<void>; renderFrameAt(ms: number, width: number, height: number): Promise<ImageBitmap | OffscreenCanvas>; dispose(): void; }
interface ExportCapability { profile: '1080p30'|'1080p60'|'4k30'|'4k60'; available: boolean; reason?: string; }
```

Ergänze geeignete echte Typen, generische IDs, Fehlerklassen, Test Doubles, cancellation und Runtime-Validierung. Verwende nur vom aktuellen Provider tatsächlich erlaubte Daten in `RoutingResult`, insbesondere keine unerlaubte Persistenz abgeleiteter Kartenanbieter-Daten.

## 4. Datenmodell und lokale Persistenz

Versioniertes, anbieterneutrales Datenmodell. Trenne projektbezogene Medien-Binärdaten von JSON-Metadaten. Geokoordinaten intern immer WGS84 (`lat/lon`), Distanz Meter, Zeit Millisekunden im Editor bzw. UTC/Zeitzone für reale Ereignisse. Speichere Providerherkunft, Lizenz-/Attributionstatus und Genauigkeit.

Pflichtentitäten:

1. `Project`: UUID, schemaVersion, title, locale, created/modified, canvas 9:16, fps, targetDurationMs <= 180000, exportProfile, mapStyleRef, globalTheme, offlineState, assetRefs, privacyState.
2. `Journey`: geordnete `RouteSegment[]`, `Stop[]`, Verlauf von Verkehrsmittelwechseln, Summenmetadaten, geographische bounds.
3. `RouteSegment`: ID, start/end, via/shapePoints, `mode`, `geometry`, source/provider, geometryVersion, confidence, distanceM, etaS?, measuredTimeS?, selectedAlternative, manualOverrides, lineStyle, vehicleAssetID, sceneEffects.
4. `Stop`: Position, Bezeichnung, Aufenthalts-/Pausenzeit, Kamera- und Labelaktionen, Anschluss-Verkehrsmittel, Zeitzone/Datenqualität.
5. `Track` und `Keyframe`: Typ (`camera`, `route`, `vehicle`, `text`, `image`, `video`, `audio`, `effect`), start/end, keyframes, interpolator, easing, z-order, enabled, lock, muted.
6. `CameraKeyframe`: center/bearing/pitch/zoom und zeitliche Interpolation; no-jump handling über Datumsgrenze/180. Meridian.
7. `MediaAsset`: hash, typ/MIME, source, storedBlobKey, ownership, size/dimensions/duration, duration in edit, objectURL-Lebenszyklus, optional copyright metadata.
8. `VehicleAsset`: Built-in SVG/2D/GLB/glTF, Maßstab, Orientierung, Farbanpassung, Lizenz, version, uploadOrigin, Materialsettings.
9. `Preset`: styles, timeline templates, defaults, renderer capability requirements, localization, asset dependencies.
10. `GPSRecording`: Punkte mit Zeit, Genauigkeit, Geschwindigkeit optional, Pausen, Filter und Qualitätsstatus; stets lokal bei Erfassung.
11. `ExportJob`: Profil, start/finish/cancel state, warnings, tatsächlich erreichte Qualität, Encoder/Muxer-Detail, Fehlerprotokoll ohne sensible Inhalte.
12. `User`, `ProjectSyncMetadata`, `AdminAsset`, `UsageCounter`, `FeatureEntitlement` erst bei Implementierung von Cloud/Auth/Admin.

Persistenzanforderungen: IndexedDB-Transaktionen, Autosave mit Debounce, idempotente Migrations, Datenvalidierung beim Lesen, LRU nur für **wegwerfbare Caches**, niemals stilles Löschen von Nutzerdaten; Quota-Fehler darstellen. Lokales Projekt kann ohne Netz geöffnet und mit vorhandener Geometrie bearbeitet werden. Wenn Kartenkacheln fehlen, neutrale Offline-Hintergrundfläche und Routen-Vektoren anzeigen. **Kein in Version 1 beschlossener Projektdatei-Export/-Import**; falls Wiederherstellungsproblem, als späteren Änderungsantrag dokumentieren, nicht ohne Beschluss als Feature einführen.

## 5. Nutzerabläufe und mobile UI/UX

### Kernscreens

- Landing: „Route erstellen“, „Meine Projekte“, Beispiele/Vorlagen, Login optional, Sprache DE/EN.
- Projektstart: Manuelle Eingabe / Karten-Punkte / GPX / GPS / unterstützte Kartenlinks.
- Routenplanung: Ortssuche, Start/Ziel, reorderbare Stopps, pro Abschnitt Verkehrsmittel, Kartentipp, Route ziehen, Alternativen, Distanz/Dauer und Hinweis auf Näherungen.
- Einfacher Animationsassistent: Kartendesign, Fahrzeug-Icon, Animationsstil, Dauer, Kamera-Preset, Titel, Musik, Vorschau.
- Erweiterter Editor: vertikale 9:16-Vorschau, mehrspurige horizontal scrollbare Timeline, Keyframe-Marker, Track Inspector, Undo/Redo, Touch-Targets, präzise Werteingabe, Scrubbing, Play/Pause, Segmentauswahl, Zoom.
- Export: Qualität/FPS, voraussichtliche Grenzen und Speicherwarnung, Fortschritt/Abbruch, Ergebnis ansehen, MP4 sichern / native Freigabe.
- Lokale Projekte: Duplizieren, Umbenennen, Löschen mit Bestätigung, Speichern-Status, Wiederherstellung.
- Account: Login/Registrierung/Passwort vergessen bei späterer Backend-Integration; kein Loginzwang für lokal kostenlose Funktionen.
- Admin: getrennt geroutete, RBAC-geschützte Oberfläche sobald Backend bereitsteht; nicht mit bloßem Client-Flag absichern.

Design: zurückhaltend und iOS-inspiriert, **keine** kopierte Apple-Oberfläche/Apple-Assets; klare Hierarchie, Bottom Sheets, Bottom Navigation, Edge-Safe-Areas, responsives Layout, visuelle Status-/Fehlermeldungen, Dark/Light nur wenn sinnvoll. Mehrfingergesten dürfen nicht unbeabsichtigt Timeline-Keyframes ändern. Mindest-Touchflächen ca. 44 CSS px, WCAG-Orientierung, Kontrast, Screenreader-Semantik und Reduced Motion für UI (Export-Animation separat). Alle Labels/Fehler auch Englisch; Entfernungsanzeige standardmäßig km, internationale Einheiten später erweiterbar.

## 6. Planung, multimodale Routen und Datenqualität

Segmentmodell **nicht** pro gesamter Reise nur einen `mode`. Jeder Modus eigene Routenerzeugung:

- **Auto/Motorrad:** geeignetes Routing auf Straßen; Alternativen, via points, Snap-to-road nur bei nachgewiesener Datenqualität. Motorrad nicht unbemerkt Auto-Routing gleichsetzen: fehlende spezialisierte Parameter offenlegen.
- **Fahrrad/Zu Fuß:** geeignete Fahrrad-/Fußwegroutingprofile; keine motorisierten Straßen erzwingen.
- **Bus/ÖPNV und Bahn:** wenn GTFS/Transit-/Rail-Geometrie verlässlich lizenziert vorhanden, anwenden; ansonsten deutlich gekennzeichnete abgeleitete/geschätzte Geometrie. Fahrplandaten und Infrastrukturverlauf unterscheiden.
- **Flugzeug:** geodätische Großkreisgeometrie zwischen passenden Flughäfen oder Start/Ziel-Koordinaten; optional manuelle Flugpfadkontrolle. Keine Zusage realer geflogener Strecke, solange keine echten Trackdaten. Antimeridian und Polnähe korrekt behandeln.
- **Schiff/Fähre:** recherchierter, lizenzierter Fähr-/Schifffahrtskorridor bevorzugt; andernfalls Geometrie unter Beachtung von Land/Wasser soweit zulässige Daten vorhanden. Keine direkte Linie durch Land als „echte Schiffsroute“ darstellen; bei fehlender Kollisionsprüfung unmissverständlich markieren und editierbar lassen.
- **GPS:** aktive Browser-Ortung mit expliziter Berechtigung, Punkt-Deduplikation, Präzisionsschwellen, Pausen/Resume, Verlust-Signalisierung, lokalem Track-Speichern. iOS-Hintergrund-Lock-Zuverlässigkeit **nicht** behaupten; im UI klare Einschränkung.

Wegpunkt = lenkt Weg; Zwischenstopp = Reiseereignis/Anker mit Animation, Pause, ggf. Moduswechsel. Einzelne Abschnitte umordnen, teilen, verbinden, löschen. Manuelle Geometrieänderungen müssen unabhängig vom ursprünglichen Routingprovider funktionieren. Routenlänge nach Geometrie neu berechnen, gemessene/geplante/geschätzte Dauer getrennt halten. Zeitstempel eines GPX dürfen niemals frei erfunden werden.

**Geometrie-Vertrauensstufen in UI/Export:** `provider_verified` (anbieterberechnete Route, nicht automatische Ground-Truth-Garantie), `imported_recorded`, `derived`, `estimated`, `manually_edited`. Geschätzte Routen standardmäßig in UI visuell unterscheidbar und optional sichtbarer Hinweis im Export; klare Bestätigung, wenn Nutzer diesen Overlay aus dem Video entfernen will. Keine Falschbehauptung „Originalroute“.

**GPX:** Unterstützung sinnvoller GPX-Varianten (`trk`, `rte`, `wpt`, mehrere Segmente), Namespace/Schema-Prüfung, Dateigrößenlimit, ungültige XML sicher ablehnen, Extent-/Koordinatenvalidierung, Zeit- und Elevation optional, Benutzer kann importierte Spur schneiden und ein Verkehrsmittel zuweisen. Kartenlinks: explizite Whitelist geprüfter Apple-/Google-/anderer Formate; URL-Parsing darf niemals willkürlich Ziele/Stopps erfinden. Nicht unterstützter Link zeigt freundliche Fehlermeldung mit alternativer Eingabe.

## 7. Kartenengine, Stile und Lizenz-Gates

**Präferenz Apple Maps im Editor**, soweit rechtlich, technisch und budgetär verfügbar. **Alternative exportfähige Engine ausdrücklich zulässig**, z. B. MapLibre GL JS mit separat lizenzierter Karten-/Terrain-/Satelliten-Datenquelle. MapLibre-Bibliothekslizenz ist **nicht** dasselbe wie Lizenz für Tiles, Satellitenbilder, Gebäude- und Terrainschichten. Kartenquellen, Geocoding, Routing und Renderer dürfen unabhängig voneinander wechseln, soweit Verträge die abgeleitete Datennutzung erlauben.

Pflichtstile als Produktwunsch: Standard hell, Standard dunkel, Satellit, Hybrid, 3D-Gelände und minimalistische Darstellung (fachlich fünf Kategorien mit Hell/Dunkel-Ausprägung). Für jeden Stil Capability-Matrix: interactive, offline_cached, export_allowed, 4k_allowed, attribution_required, 3d_supported, provider_price/rate_limit, status + Nachweislink.

**Explizite Sperre:** Apple-Karteninhalte, -Satellitenbilder, Logos und Snapshots nur dann für Export, Aufzeichnung, Offline-Persistenz oder Durchreichen in Dritt-Renderer verwenden, wenn aktuelle verbindliche Bedingungen das eindeutig erlauben. Keine Capturing-Hacks, Screenshot-Loops oder Attribution-Entfernung zur Umgehung von Nutzungsrechten. Andernfalls für Export auf eine sauber lizenzierte Quelle wechseln und den Unterschied in der Vorschau kennzeichnen.

**OSM-Regel:** OpenStreetMap-Daten haben eigene Lizenz/Attribution; offizielle `tile.openstreetmap.org`- und OSM-Vector-Tile-Endpunkte nicht als massenhaft vorabladbare/offline-Kartenquelle oder unbegrenzte Export-Farm verwenden. Tile-Server-Richtlinien einhalten. Kartenattribution in UI und, soweit verlangt, im exportierten Video korrekt sichtbar. Keine Lizenzinformationen ausblenden.

## 8. Szenen-, Kamera- und Animations-Engine

Ein zentraler, deterministischer Zeitbezug: `evaluateScene(project, tMs)` liefert **reine**, reproduzierbare Scene-State-Daten. Vorschau und Offline-Rendering konsumieren denselben Zustand; zeitabhängige UI-Timer oder Framerate-Effekte dürfen den Export nicht verändern. Animationsfortschritt aus segmentbasiertem Easing und Zeitverteilung, nicht nur aus Framezählern ableiten. Externe Kartendaten vor Renderstart validieren und entsprechend Lizenz zulässig verfügbar machen.

**Routenlinie:** vollständig, progressive Zeichnung, gestrichelt; Strichfarbe, Breite, Deckkraft, Fortschritt, Kurveninterpolation, Markierung von Stops. Antimeridian-Splits, keine visuellen Sprünge am Kartenumbruch.

**Fahrzeuge:** Built-in SVG/2D, GlTF/GLB (lizenzierte Assets), eigene hochgeladene 2D-Bilder und 3D-Modelle, individuelle Farben. Modell muss entlang Tangenten/Heading folgen; Rotation, Scale, Animations-Pivot, technische Größenlimits. Fallback-Symbol, falls WebGL, Speicher oder Asset defekt. Niemals unbekannte Scriptdateien aus Assets ausführen. Keine ungeprüften Fahrzeugmarken-/Urheberrechte mitliefern.

**Kamera:** fixe Übersicht, Follow-Cam, auf Start/Stop/Ziel abgestimmter Auto-Zoom, Fahrtrichtungsbearing, cinematic Presets, eigene Zeit-Keyframes für center/zoom/pitch/bearing; Easing, Kollisionsbehandlung von Overlays mit Safe Areas. Bei Karte/Datenquelle ohne 3D echten 3D-Look nicht vortäuschen; 2D-Fallback. Perspektivenwechsel reproduzierbar.

**Zeitmodi:** (A) filmisch: automatisch ausgewogene Zeiten pro Segment nach Mindestdauer, Stopps, Beschleunigungsprofil und manuellen Einstellungen; (B) proportional: Abschnitte proportional zu tatsächlichen/gültig geschätzten Reisezeiten. Bei unbekannten Zeiten keine Scheingenauigkeit: Schätzung kennzeichnen oder Nutzer um Dauer bitten. Timeline kann die Dauer pro Segment und Keyframes jederzeit bearbeiten; Gesamtdauer maximal 180 s. Keine negativen Werte, Null-Längen oder Out-of-range Keyframes.

**Overlays:** dynamische Start-/Ziel-Labels, Entfernung aktuell/gesamt, Uhrzeit/Datum wenn valide, Verkehrsmittel, Fortschritt, eigene Texte/Bilder/Logos; Vorlagen. Alle Parameter lokalisierbar, positionierbar, zeitlich anbindbar. Kilometerzähler folgt animiertem Streckenfortschritt, echte/geplante/geschätzte Zeit nicht vermischen.

## 9. Timeline-Editor und Medien

Tracktypen: Route/Vehicle, Kamera, Text/Counter, Bild/Logo, Video-Overlay, Sound/Music/Voice, Effekt/Transition. Ein- und ausblendbar, draggable, trimbar, zeitlich skalierbar; Keyframe-Easing; korrekte Z-Reihenfolge. Auf kleinen Displays: bottom-sheet-basiertes Eigenschaftenpanel, Snap-to-Keyframe, Zoom in Timeline, haptikfreier visueller Feedback, Undo/Redo mit stabiler Projektgeschichte.

**Audio:** vom Gerät importierbare Dateien und Web-Aufnahme für Voice-over nach expliziter Mikrofongenehmigung; Hintergrundmusikbibliothek nur mit eindeutig dokumentierten Weiterverwendungsrechten; SFX nur mit Rechteklärung; Spuren trimmen, Gain, Fades, stumm schalten, Audio-Mix synchron exportieren. Musiklizenzen müssen ausdrücklich Verteilung als Bestandteil von Social-Media-Videos ermöglichen; „royalty-free“ allein ist kein Nachweis. Audio-Projekte funktionieren offline nach lokalem Import. Kein Upload außer explizit gewählt.

**Video-/Bild-Overlays:** lokale Medienimport-Freigabe, Upload-/Decodinglimits, Dateigrößen und Formate prüfen, Vorschaubilder, zentrierte Crops und Transformationswerte, berechenbare Framepositionen. Wenn lokale Videocodecs nicht decodierbar sind, begründete Fehlermeldung und unterstützte Alternative. Keine Remote-Asset-Abhängigkeit bei Export, die durch CORS oder Lizenz die Renderpipeline blockiert.

**Effekte:** weiche Crossfades/Wipes, Motion-Blur- und Geschwindigkeitseffekte, animierte Titel und Counter, Presets. Animationen nach Möglichkeit GPU-beschleunigen, aber für Encoder deterministisch berechenbar halten.

## 10. Videoexport-Pipeline: MP4, FHD/4K, 30/60 FPS

**Output-Matrix:** 1080×1920 ×30/60; 2160×3840 ×30/60; 1–180 s. Container MP4, audiovisuelle Synchronität, für Social-Media-Ziele kompatibles Videoprofil (z. B. H.264, Audio AAC wo zulässig und technisch verfügbar). Codec, Rate, Farbraum, Tonspur und tatsächliche FPS im Ergebnis auslesbar validieren. 3 min 4K/60 = 10.800 Frames — kein implizites Speicher-Vollpuffern dieser Frames.

Pipeline: 1) Preflight zu Karte/Asset/Lizenzen und Daten, 2) Capability Probe des konkreten Browsers/Geräts über reale Codec-/Encoder- und Memory-Checks, 3) passende Profile anbieten, 4) Frames sequenziell/gebatcht mit maximal begrenztem Buffer erzeugen, 5) Video-Encoding und Audio-Encoding/Mux synchron durchführen, 6) MP4-Datenintegrität und Laufzeit prüfen, 7) optional native Share Sheet, sonst Download. Der Export muss abbrechbar sein und temporäre Ressourcen freigeben; Fortschritt nur zeigen, wenn sinnvoll ermittelbar.

**Stufenmodell:** (a) clientseitiges Encoding über nachweislich unterstützte APIs und Container-Muxer; (b) weiterer lokaler Fallback nur nach Gerätestress-Test und Lizenzprüfung; (c) serverseitiges Rendering ist **nicht automatisch verfügbar** und darf im kostenlosen Betrieb nur nach separater Kosten-/Datenschutzfreigabe aktiviert werden. Kein kostenloser Cloud-Render ohne harte Limits und Budgetschutz. MP4-Endprodukt vor allem auf realen iOS-Safari-PWAs und Android-Chrome-PWAs testen. `MediaRecorder`, `WebCodecs` und WebGL-Canvas-Aufnahme sind nicht unter allen Browsern/Codecs/Content-Security-Konstellationen identisch; echte Feature Detection, keine UA-Vermutung.

**Fallback UX:** Bei nicht unterstütztem 4K60 4K30 oder 1080p60/30 nach gemessener Fähigkeit anbieten. Nichts herunterskalieren oder FPS reduzieren, ohne den Nutzer transparent über den tatsächlich gewählten Exportmodus zu informieren. Renderfehler mit Diagnosecode; lokale Projekte bleiben unversehrt. Nur wenn Export tatsächlich nicht möglich ist, sauber blockieren.

**Exporttests:** Dauer, Video-/Audiocodec, Auflösung, Framerate, Dateilesbarkeit, Ton-Bild-Sync, genau passender Frame bei konkreter Timelinezeit, Stopps, Fonts/Emojis, Varianten mit/ohne Ton, GPX, Multi-Modal-Wechsel, Antimeridian, Orientation-/Speicherwarnung, Navigation weg während Export, Offlineszenario.

## 11. PWA, Offline, Installation und GPS

HTTPS, valides Web App Manifest, installierbare Icons/Splash nach Plattformmöglichkeit, Update-Mechanik für Service Worker, Offline-App-Shell, offline erreichbare lokale Projekte, keine automatische Löschung beim Versionswechsel. Kein aggressives Precache großer Medien oder Drittanbieter-Kacheln. Internetabhängige Ortssuche, Routing und neue Kartenkacheln sind klar als online gekennzeichnet. Vorhandene erlaubterweise gespeicherte Routengeometrie und Assets bleiben offline bearbeitbar. Hintergrund-GPS auf iOS ausdrücklich als Best-Effort mit Warnung, nicht als verlässlich versprechen.

## 12. Accounts, Datenschutz, Cloud (spätere Phase)

**V1:** vollständig ohne Konto nutzbarer kostenfreier editor-/export-relevanter Kern; lokale Projekte; keine automatische Cloud. Datenschutz-Copy muss erklären, dass Browser-/App-Daten durch den Nutzer oder das Betriebssystem gelöscht werden können und ohne Cloud kein geräteübergreifender Backup garantiert ist.

**Vorbereitete Cloud-Phase:** E-Mail/Passwort, verifizierte E-Mail, Reset, Session-Schutz, Delete Account, export/delete personal data, klar abgegrenzte pro-Nutzer-Projekte. Sync nur nach explizitem Opt-in; Routen, Modus, Timeline, Design, Presets; Medien/MP4 sind ausdrücklich nicht in den vereinbarten Sync-Daten enthalten. GPS-Aufzeichnung nicht automatisch hochladen: bei Sync betroffener Tracks Einzelbestätigung mit Zweck, Umfang und Widerrufs-/Löschweg. Rollen `guest`, `user`, `premium`, `admin`; Premium als Feature Flag/Entitlement statt hardcoded Zahlungen.

**Sicherheitsregeln:** serverseitiges RBAC/RLS (nicht nur Frontend), autorisierte Zugriffe pro Projekt, CSRF je nach Authmodell, geeignete Session/Cookie-Konfiguration, CSP, XSS-Schutz, Rate-Limits, passwortlose Admin-Eskalation verhindern, keine sensiblen Secrets im Client oder Log, sichere Datei-/XML-Prüfung, Quotas für Import, Mikrofon nur on demand, Drittanbieter-Aufruftransparenz und erforderliche Informationspflichten gemäß DSGVO. Keine nicht notwendigen Tracker und keine ungewollte Geolokalisierungsfreigabe.

## 13. Admin und Kostenkontrolle

Admin-Modul darf nicht öffentlich zur Verwaltung offen sein. Sobald Accounts/Backend eingerichtet sind:

- Nutzerliste, Anzeigen minimaler erforderlicher Kontodaten, Sperren/Entsperren und Audit-Trail; Sicherheitsrichtlinien für Admin-Authentifizierung.
- Asset-Katalog für SVG/2D/3D, Musik/SFX, Karten-Style-Presets, Freigabe vor Publikation, Asset-Lizenzen/Attribution, Versionierung, Rollback.
- Aggregierte Nutzungskennzahlen: Projekte/Exports (nur soweit messbar), Provider-Calls, Fehler/Performance, Verbrauch und Quoten; datensparsam, transparent. Bei lokalem Gast-Export sind vollständige zentrale Statistiken ohne Telemetrie **nicht** verfügbar – nicht behaupten.
- Editierbare harte Limits für externe API-Nutzung, Requests pro Nutzer/IP je nach Datenschutz, Assets, Dateigrößen, Renderjobs; Warnstufen und Kill Switch. Optional keine Export-Telemetrie durch Gastgeräte standardmäßig.
- Freemium-Feature-Flags ohne vorzeitige Bezahlschranken im kostenlosen Kern.

**Kostenregel:** Starte mit Null-budget Hosting, sofern aktuell verifiziert. Der Betrieb muss in dokumentierten Freikontingenten bleiben. Schreibe `docs/COST_MODEL.md` mit Kosten je Kartenview/Geocode/Routing/Tiles/API Call/Storage/Transfer/CPU-Render und Worst-Case-Szenarien. Jede externe Nutzung mit Limits, Debouncing, Caching nur soweit lizenziert und exakter Abbruchlogik; kein automatischer „pay-as-you-go“ ohne explizites Okay. Apple-Entwicklerzugang/MapKit-Berechtigung und andere möglicherweise zahlungspflichtige Voraussetzungen separat ausweisen; **kostenlose API-Quoten sind nicht gleich kostenloser Zugang**.

## 14. Performance-, Accessibility- und Security-Budgets

Vor erstem Vertical Slice realistische Budgets anhand echter Mittelklasse-iPhones und -Android-Geräte festlegen und in `docs/PERFORMANCE.md` dokumentieren: App-Shell Download, TTI/interaktive Bedienbarkeit, Speicherverhalten, 30-FPS-Editorziel bei komplexen Szenen, Timeline-Seek-Latenz, maximale Importdatei, 3D-Polycount, Render-Peak-Memory, Exportzeit (gemessen, keine garantierte Konstante), Energie-/Thermallimits. Zu kleine Geräte müssen robust degraden statt abstürzen. Keine willkürlichen festen Grenzwerte ohne Messung als bereits erfüllt melden.

Zwingend: sichere Content Security Policy; Sanitization von GPX-Titeln/Labels und eigenen Texten; Bilder/GLB/Dateien auf MIME + Inhalt + Ressourcengrenzen prüfen; keine remote executable scripts aus Modelldaten; Dependency Auditing und Lockfile; Overlay-Text gegen HTML-Injection sichern; SSRF verhindern falls serverseitiger URL-Import später realisiert. Accessibility: Kontraste, Fokus, Touch-Ziele, Tastaturgrundbedienung, VoiceOver/TalkBack, Reduced Motion für UI.

## 15. Teststrategie und verbindliche Release-Gates

**Testpyramide:** TypeScript-Lint/Typecheck; pure Unit-Tests für Geometrie, Zeitmodell, Projekt-Migrations, KPI-Formeln, Geodäsie, Stopps, Antimeridian, Datenqualität; Contract-Tests für Routing-, Map- und Exportadapter; Integrationstests IndexedDB/Asset-Loading/Undo/Redo; E2E im mobilen Viewport; Geräte-Feldtests physisch auf aktuellem iPhone (Safari im Browser und installierte PWA) sowie Android (Chrome und installierte PWA); Accessibility und Security; manuell visuell geprüfte Videoexporte.

**Mindest-Akzeptanzszenarien:**

1. Gast startet ohne Konto Projekt Hannover→Barcelona per Ortssuche, fügt Stopps und Wegpunkte hinzu, wählt Alternativroute, speichert und öffnet lokal wieder.
2. Gast erstellt multimodal Hannover→Flughafen→Barcelona→Palma mit Auto/Flugzeug/Schiff, pro Segment getrennte Animation, Wechsel-Overlay, Reiserichtungs-Kamera; geschätzter Wasserweg klar markiert.
3. Gast zieht eine Straßenroute und korrigiert eine geschätzte Schiffsroute manuell; Entfernung und Animation folgen bearbeiteter Geometrie.
4. GPX mit Tracks/Wegpunkten/Zeiten importieren, ungültiges GPX sicher ablehnen, ohne App-Absturz und ohne XSS.
5. Offline nach Projektanlage: gespeicherte Routengeometrie und Assets bearbeiten, keine nicht lizenzierten Tiles laden, danach ohne Datenverlust online weiterarbeiten.
6. Timeline: Kamera-/Text-Keyframes an verschiedenen Positionen, 60/120/180 Sekunden, schnelle Seek-Wiederholungen ergeben dieselben visuellen Zustände.
7. Animation testet Symbol, 2D, 3D-Asset; kaputtes GLB führt zu sauberem Fallback; eigene Farben und Orientierung funktionieren.
8. Upload Foto, kurzer Videoclip, Musik und Voice-over; Audio-Fades im exportierten MP4 hörbar, ohne Ton exportiertes MP4 spielt ebenfalls.
9. Render mindestens 1080p/30 FPS als belastbare Mindestanforderung auf definierten Zielgeräten, korrektes MP4 inkl. Abspieltest und nativer Freigabe; 1080p60/4K30/4K60 einzeln testen und nur bei Nachweis aktivieren. Nicht erfüllte Wunschprofile im Release-Report ausdrücklich benennen und nicht fälschlich abhaken.
10. Export-Abbruch, Hintergrundwechsel/Unterbrechung, fehlender Speicher und nicht verfügbare Codec-Profile zeigen hilfreiche UI, Projekt bleibt erhalten.
11. Lokale Projekte bleiben nach normalem Reload/Installationsstart erhalten und werden nicht bei App-Update migrierungsbedingt zerstört.
12. Englisch/Deutsch durchgängige UI und Fehlermeldungen, iPhone/Android gleichwertiger Kernablauf.
13. Keinerlei unerlaubtes Apple-Kartenmaterial im Export; rechtlich korrekte Attribution und nachvollziehbarer Rendererwechsel.
14. Wenn Backend/Admin aktiviert: Login/Logout/Reset, RLS, keine Cross-User-Projektdaten, Sperrwirkung serverseitig, Admin-Audit, Cost-Kill-Switch getestet.

**Freigabematrix:** Status je Anforderung `PASS`, `FAIL`, `BLOCKED_EXTERNAL`, `DEFERRED_APPROVED`, mit Geräten, Softwareversionen, Medien-Hash/Testartefakt und Datum. Keine Veröffentlichung bei fehlender Funktion, die als V1-Pflicht markiert ist, es sei denn Produktverantwortlicher genehmigt explizit eng begrenzte Scopeänderung. Besonders 4K/3D/Audio nicht als fertig deklarieren, bevor ihr tatsächlich getesteter Pfad verfügbar ist. Kein Tool- oder CI-Pass ersetzt Feldtest bei mobilen Videos.

## 16. Entwicklungsphasen und Definition of Done

**Phase 0 — Compliance & Feasibility (muss zuerst):** Anbieter- und Lizenzmatrix, Apple-MapKit-JS-Zugang/Exportfrage, freie Quellen, Routingmodi, Geräte-Codecs und MP4-Muxer, 4K-Probe, Gratis-Hosting-Sicherheit. Liefere funktionierende Minimal-Spikes auf Zielgeräten mit Messungen und Dokumentation. Blocker melden statt überspringen.

**Phase 1 — Kern/PWA:** Repository, CI, i18n DE/EN, Datenmodell, IndexedDB, Save/Recovery, mobile UI, Kartenvorschau, Ortssuche, Planen per Karte, Wegpunkte, Auto-/Fuß-/Rad-Routen; mindestens ein nachvollziehbar lizenzierter Renderer. Noch keine öffentliche Veröffentlichung.

**Phase 2 — Alle Verkehrsmittel/Routing:** GPX, URL-Import wo möglich, GPS-Best-Effort, Alternative/Drag-Edit, Flug/Schiff/Bahn/Bus/Motorrad, Provenienz und Näherungswarnung, Offline-Geometrien. Messbare E2E-Beispiele.

**Phase 3 — Animation/Editor:** Scene Evaluator, Line-Stile, Stopps, automatische Kamera, manuelle Keyframes, filmischer/realer Zeitmodus, Zweimodus-Editor (Assistent/Timeline), 2D-Vehicles und erste 3D-Modelle, Style-Templates.

**Phase 4 — Medien/Export:** lokale Bilder/Videos/Logos, Audio-Bibliothek mit gesicherten Lizenzen, Voice-over, Mixer, Effekte; MP4 Exportpipeline; 1080p-Profile zuverlässig, High-End-Profile nach Capability/Stress-Test; teilen/speichern.

**Phase 5 — Qualitäts- & Veröffentlichungs-Gate:** komplette interne Release-Matrix, Device-/Security-/Performance-Tests, Rechteprüfung, Accessibility, Quoten und Nullkosten-Check. Erst jetzt öffentliche Freigabe, und nur nach expliziter Freigabe aller vereinbarten v1-Pflichten oder dokumentiert genehmigter Ausnahmen.

**Phase 6 — Cloud/Freemium/Admin (nach lokalem V1-Kern oder dann, wenn für öffentlichen Betrieb notwendig):** E-Mail/Passwort, bewusst aktivierte Synchronisation nur vereinbarter Daten, RLS, Löschung, Admin, Kostenkontrolle, Feature-Flags. Die Admin-Anforderungen bleiben im Gesamtscope, auch wenn lokale V1 ohne Accounts startet; jede frühe Admin-Bedienung ohne Backend entsprechend auf verwaltbare statische Assets/Policies beschränken und **nicht** als Nutzerverwaltung ausgeben.

**Definition of Done pro Feature:** End-to-End-Nutzung, Reproduzierbarkeit, Fehlerzustände, Unit-/Integration-/Gerätetest je Relevanz, DE+EN, Accessibility, dokumentierte Quelle/Lizenz, Performance nicht regressiv, kein ungeklärter Datenabfluss, Status im Fortschrittsbericht. „UI vorhanden“ allein ist nie done.

## 17. Ungeklärte externe Nachweise — getrennte Pflichtliste

Für **jeden** Nachweis: offizieller Primärlink, Prüfdatum, geltende Version/Vertrag/Tarif, konkrete getestete Geräte, Fundstelle/Zitat bzw. Vertragspunkt, Ergebnis `VERIFIED / BLOCKED / UNKNOWN`, Konsequenz/Fallback und Verantwortlicher. Änderungen in `docs/EXTERNAL_EVIDENCE.md` pflegen. Diese Punkte sind aktuell **nicht als gelöst** anzusehen:

| ID | Offener externer Nachweis | Konsequenz solange ungeklärt |
|---|---|---|
| E01 | Apple MapKit JS / Web Snapshots / Maps-Material: Lizenz zum dynamischen Capture, Export und Veröffentlichen animierter Social Videos inkl. Attribution. | Apple-Material nicht als Videoexportquelle aktivieren. |
| E02 | Apple-Kartenstyles, 3D/Globe/Satellit/Hybrid auf iOS und Android im gewählten SDK und deren Nutzungsrechte. | Fehlende Styles nur im geeigneten Alternativrenderer anbieten. |
| E03 | Apple Maps Account-/Tokenvoraussetzungen, tatsächliche freie Quoten, Limits, Missbrauchsschutz, Bedingungen und optionaler Mitgliedsbeitrag. | Ohne verifizierten kostenlosen Zugang keine Apple-Abhängigkeit als zwingende MVP-Pflicht. |
| E04 | Kartendaten-/Tile-/Satelliten-/Terrainanbieter erlaubt Videoexport, Offlinecache, Rendering in 4K, öffentliche Social-Veröffentlichung und gegebenenfalls kommerzielle Nutzung. | Nur ausdrücklich freigegebene Styles zur exportierbaren Auswahl. |
| E05 | Anbieter und Lizenzen für Straßen-, Motorrad-, Rad-, Fuß-, Bahn-/ÖPNV-, Fähren-/Schiffrouten; realistische Regionenabdeckung und Limits. | Herkunft, Genauigkeit und Näherungen ausweisen; editierbare Ersatzpfade. |
| E06 | Kartensuch-/Geocoding-Anbieter: Speicherung von Ergebnissen/Koordinaten, freie Quoten, Attribution, mobile Browsing-Policies. | Nur rechtlich zulässige Cache- und Suchfunktion. |
| E07 | GPX/XML-Parsing & konkrete Kartenlinkformate mit robusten Testfällen und API-/ToS-Konformität. | Unsupported-Formate ablehnen, kein blindes Scraping. |
| E08 | MP4-Encoding, H.264/AAC bzw. alternatives social-kompatibles Profil, WebCodecs/MediaRecorder/Wasms/Encoder/Muxer in aktuellen iOS-/Android-Browsern. | Nur nachweislich funktionierende Exportprofile aktivieren. |
| E09 | 3-Minuten 4K/60 bei repräsentativen Smartphones inkl. RAM, Thermals, Speicher, Dateiabschluss, Audio-Sync und Share Sheet. | Auf getestete kleinere Profile zurückstufen; Transparenzpflicht. |
| E10 | PWA GPS in Browser/App, Verhalten bei Screen Lock, Background und Berechtigungswechsel auf beiden Plattformen. | Nur aktive Best-Effort-Aufzeichnung versprechen. |
| E11 | 3D-Assets, Musik, Sounds, Schriften und Kartensymbole: Rechte auch für Nutzer-Videoexport/Social-Kommerz und Markenverwendung. | Nicht freigegebene Assets nicht ausliefern. |
| E12 | Hosting-/Auth-/Storage-/Build-/Traffic-/Routingkosten: aktuelle Free-Plans, Limits, Abuse-/Kill-Switch-Fähigkeit, Exit-Szenario. | Keine Kosten oder Konto-/Kreditkartenpflicht ohne Zustimmung. |
| E13 | Native Share API auf installierten iOS-/Android-PWAs und Übergabe von MP4-Dateien an Zielapps. | Download als belastbaren Fallback anbieten. |
| E14 | Privacy/DSGVO und Karten-/Geodaten-Übertragungen an Drittanbieter, AV-Verträge wo erforderlich, Einwilligungs-/Informationspflichten. | Datenübertragungen minimieren; kritische Integrationen bis Klärung sperren. |
| E15 | Cloud-Backend inklusive RLS, E-Mail-Zustellung, Konto-Löschung und Admin-Rollen später unter freien Limits. | V1 weiterhin ohne Cloud; keine voreilige Sync-Zusage. |

### Offizielle Ausgangsquellen für diese Prüfung (keine automatische Lizenzfreigabe)

- Apple MapKit JS: https://developer.apple.com/documentation/mapkitjs/
- Apple Maps für Web / Quotengrenzen: https://developer.apple.com/maps/web/
- Apple Maps Server API: https://developer.apple.com/documentation/applemapsserverapi
- Apple Entwicklerverträge: https://developer.apple.com/terms/
- MapLibre GL JS: https://maplibre.org/maplibre-gl-js/docs/
- MapLibre Custom Layers: https://maplibre.org/maplibre-gl-js/docs/API/interfaces/CustomLayerInterface/
- MapLibre Quelllizenz: https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt
- OSM Standard-Tile-Richtlinie: https://operations.osmfoundation.org/policies/tiles/
- OSM Vector-Tile-Richtlinie: https://operations.osmfoundation.org/policies/vector/
- MDN WebCodecs VideoEncoder: https://developer.mozilla.org/en-US/docs/Web/API/VideoEncoder

## 18. Projektdateien und Dokumentation

Empfohlener Ausgangspunkt:

```text
/
  CLAUDE.md
  README.md
  package.json / lockfile
  .env.example                 # niemals echte Keys
  docs/
    DECISIONS.md
    RISKS.md
    EXTERNAL_EVIDENCE.md
    COST_MODEL.md
    PERFORMANCE.md
    ACCEPTANCE.md
    PROGRESS.md
    API_PROVIDERS.md
    DATA_PRIVACY.md
    RELEASE_MATRIX.md
  src/
    app/
    features/{projects,routing,imports,gps,editor,export,assets,auth,admin}/
    core/{project,geodesy,timeline,scene,types}/
    adapters/{maps,routing,storage,encoding}/
    i18n/{de,en}/
    workers/
  tests/{unit,integration,contracts,e2e,fixtures}/
```

Beginne **nicht** mit einem monolithischen Editor und verspreche keine 4K-Unterstützung ohne Probe. Schreibe zuerst `docs/DECISIONS.md`, `docs/EXTERNAL_EVIDENCE.md`, einen realistischen Phasenplan und einen lauffähigen End-to-End-Spike. Danach iterativ implementieren und Ergebnisse nachweisen.

## 19. Erste Claude-Code-Arbeitsschritte

1. Verifiziere Projektverzeichnis/Repo; bestehende Dateien erhalten, nichts überschreiben ohne Diff-/Backup-Prüfung.
2. Liste alle 44 Produktentscheidungen und 15 externen Nachweisfragen in getrennten Checklisten; ergänze unbekannte reale Bedingungen ausdrücklich als `UNKNOWN`.
3. Erstelle Stack-/Provider-ADR und Nullkostenmodell, einschließlich Apple-Abhängigkeit und exportfähiger Kartendatenquelle.
4. Baue minimalen Geräte-Spike mit einer (lizenzrechtlich zulässigen) Karte, einem animierten Abschnitt, reproducible `renderAt(t)`, einem echten testbaren MP4 und optionalem Audio.
5. Halte tatsächliche Browser-/Device-Ergebnisse fest, entscheide gestützt darauf über Encoder/Renderer und gestaffelte Profile.
6. Implementiere anschließend die Phasen 1–5 ohne öffentliche Freigabe vor Gate; Phase 6 separat nach lokaler Version und expliziter Entscheidung.
7. Ende jedes Arbeitsschritts: gelieferte Funktionen, Tests (mit echten Resultaten), offene Risiken, Blocker, nächste konkrete Schritte, geänderte Dateien.

**Endzustand:** eine nachvollziehbar getestete, datensparsame, installierbare deutsch-/englischsprachige mobile PWA, die vertikale multimodale Routenanimationen mit legitimen Kartendaten zuverlässig in zulässige MP4-Profile exportiert, ohne versprochene aber nicht getestete High-End-Funktionen zu verschleiern.
