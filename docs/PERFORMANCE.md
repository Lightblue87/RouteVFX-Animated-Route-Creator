# Performance-Budgets und Messungen

Stand: 2026-10-08.

## 1. Messungen (nur Sandbox – NICHT repräsentativ für Smartphones)

Umgebung: Linux-Container, headless **Chrome for Testing 141.0.7390.122**, WebGL über **SwiftShader (Software-Rendering auf der CPU)**, H.264 per Software-Encoder, Playwright-Emulation „Pixel 7“. Zeiten enthalten Kartenrendern + Overlay + Encoding + Rücklese-Prüfung.

| Profil | Videodauer | Frames | Exportzeit | Ø Render-fps | ffprobe | Bemerkung |
|---|---|---|---|---|---|---|
| 1080p30 | 4,0 s | 120 | 52,5 s | ≈ 2,3 | h264 High, 1080×1920, 30/1, 120 Frames, 4,000 s | Einzellauf (erster Lauf) |
| 1080p60 | 3,0 s | 180 | 117,7 s | ≈ 1,5 | h264 High, 1080×1920, 60/1, 180 Frames, 3,000 s | parallel zu anderem Export |
| 4k30 | 3,0 s | 90 | 137,3 s | ≈ 0,7 | h264 High, 2160×3840, 30/1, 90 Frames, 3,000 s | parallel zu anderem Export |
| 4k60 | 3,0 s | 180 | 267,4 s | ≈ 0,7 | h264 High, 2160×3840, 60/1, 180 Frames, 3,000 s | teilweise parallel zu 4k30 |
| 1080p30 multimodal (Szenario 2) | 8,0 s | 240 | ≈ 5 min | ≈ 0,8 | h264, 1080×1920, 30/1, 240 Frames, 8,000 s | 3 Abschnitte, Folgekamera mit Fahrtrichtung |

Hochrechnung (nur Sandbox): 180 s 1080p30 ≈ 5.400 Frames ≈ 40–110 min; 180 s 4K60 ≈ 10.800 Frames ≈ 4,5 h und ≈ 1,1 GB RAM-Puffer (R-06) – auf Smartphones so **nicht** tragfähig. Auf Geräten mit GPU-Rasterung und Hardware-Encoder ist ein Vielfaches erwartbar – **nicht gemessen**, keine Zusage.

### Bundle (Produktions-Build, nach Code-Splitting)
| Datei | Größe | gzip |
|---|---|---|
| Start (index) | 338 KB | 105 KB |
| Editor (MapLibre, UI, OpenFreeMap-Stile) – lazy | 1.124 KB | 300 KB |
| Export-Panel (mediabunny) – lazy | 499 KB | 127 KB |
| MapLibre-Worker | 508 KB | – |
| CSS | 89 KB | 12 KB |
| Geodaten (Länder, Seen, Orte, Flughäfen) | ≈ 2,3 MB | ≈ 0,7 MB |

## 2. Vorgeschlagene Budgets (Zielwerte, noch NICHT auf Geräten gemessen)

Referenzgeräte (zu beschaffen/festzulegen): ein aktuelles Mittelklasse-iPhone (Safari + installierte PWA) und ein Mittelklasse-Android (Chrome + installierte PWA).

| Kennzahl | Budget | Status |
|---|---|---|
| Start-JS (gzip) | ≤ 150 KB | 105 KB (Build) – erfüllt im Build |
| Interaktiv (Startseite) auf Mittelklasse, 4G | ≤ 3 s | nicht gemessen |
| Editor bereit inkl. Karte | ≤ 5 s | nicht gemessen |
| Vorschau-Framerate | ≥ 30 fps bei einfachen Szenen | nicht gemessen |
| Timeline-Seek-Latenz | ≤ 100 ms | nicht gemessen |
| GPX-Import | ≤ 15 MB, ≤ 200.000 Punkte | Limit umgesetzt + getestet |
| Audiodatei | ≤ 50 MB | Limit umgesetzt, ungetestet |
| Export-Peak-Speicher | ≤ 50 % des verfügbaren RAM | **verletzt bei langen Videos** (RAM-Puffer, R-06) |
| Exportzeit 60 s 1080p30 | ≤ 3× Videodauer | nicht gemessen |
| 3D-Modell | ≤ 100.000 Dreiecke, ≤ 10 MB | nicht umgesetzt |

## 3. Bekannte Performance-Risiken
- Vollständige MP4 im Speicher (R-06).
- `map.once('idle')` pro Frame: robust, aber langsam; Optimierung über direktes Rendern ohne Idle-Warten möglich, sobald keine asynchronen Quellen beteiligt sind.
- Software-WebGL in der Sandbox verfälscht Zahlen (R-19).
