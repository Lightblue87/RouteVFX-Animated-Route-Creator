# Abnahmeszenarien (CLAUDE.md §15)

Stand: 2026-10-08. Status je Szenario: `PASS` · `FAIL` · `BLOCKED_EXTERNAL` · `DEFERRED_APPROVED` · `OFFEN` (noch nicht testbar/nicht umgesetzt).
`PASS (Sandbox)` heißt: automatisiert in Linux/headless Chrome for Testing 141 bestanden – **kein Ersatz für Gerätetests**.

| # | Szenario | Status | Nachweis / fehlende Teile |
|---|---|---|---|
| 1 | Hannover→Barcelona per Ortssuche, Stopps/Wegpunkte, Alternativroute, speichern & lokal wieder öffnen | **OFFEN (teilweise)** | Ortssuche + Speichern: E2E `tests/e2e/export.spec.ts`. Alternativroute nur mit Mock (keine Online-Route in Sandbox, E05). Wegpunkte-UI fehlt. Wiederöffnen nach Reload: nur Integrationstest (IndexedDB), kein E2E. |
| 2 | Multimodal Hannover→Flughafen→Barcelona→Palma (Auto/Flug/Schiff), Wechsel-Overlay, Fahrtrichtungs-Kamera, Wasserweg markiert | **OFFEN (Logik PASS Unit)** | Unit: `tests/unit/scene.test.ts` (Wechsel-Overlay je Modus, Schiff `estimated`, Flug `derived`). Fahrtrichtungs-Kamera implementiert. Kein E2E-Video dieses Szenarios. |
| 3 | Straßenroute ziehen, Schiffsroute manuell korrigieren | **OFFEN** | Geometrie-Editor nicht begonnen. |
| 4 | GPX importieren, ungültiges GPX sicher ablehnen, kein XSS | **PASS (Unit)** / UI offen | `tests/unit/gpx.test.ts` (9 Tests). Texte werden nur per `fillText`/React-Text gerendert. UI-Import nicht E2E-getestet. |
| 5 | Offline nach Projektanlage bearbeiten, keine unlizenzierten Tiles, danach online ohne Datenverlust | **OFFEN** | Service Worker + lokale Geodaten implementiert; keine Fremdkacheln im Code. Kein Offline-E2E. |
| 6 | Kamera-/Text-Keyframes; 60/120/180 s; Seek-Wiederholungen identisch | **PASS (Unit) für Determinismus** / Keyframes offen | `scene.test.ts`: 200 Zeitpunkte in zufälliger Reihenfolge für 60/120/180 s identisch. Manuelle Keyframes nicht begonnen. |
| 7 | Symbol, 2D, 3D-Asset; kaputtes GLB → Fallback; Farben/Orientierung | **OFFEN** | Nur eingebaute Symbole + Farbe. |
| 8 | Foto, Videoclip, Musik, Voice-over; Fades hörbar; ohne Ton spielbar | **BLOCKED_EXTERNAL (Sandbox)** / teilweise offen | Musik + Fades implementiert, AAC-Encoder in Sandbox nicht vorhanden. Ohne Ton: PASS (Sandbox). Foto/Clip/Voice-over nicht begonnen. |
| 9 | 1080p/30 auf Zielgeräten, MP4 + Abspieltest + native Freigabe; höhere Profile einzeln | **PASS (Sandbox) für 1080p30-Datei** / Geräte offen | ffprobe: h264 High, 1080×1920, 30/1, 120 Frames, 4,000 s. Höhere Profile: siehe RELEASE_MATRIX.md. Native Freigabe ungetestet. |
| 10 | Abbruch, Hintergrund, Speicher voll, Codec fehlt → hilfreiche UI, Projekt bleibt | **OFFEN** | Abbruch/Hintergrund-Abbruch/Profilsperre implementiert; nicht getestet. |
| 11 | Projekte überleben Reload/Installation/Update | **OFFEN (Integration PASS)** | `tests/integration/storage.test.ts` (neues DB-Handle). SW-Update löscht nur `arc-shell-*`-Caches. Kein Browser-E2E. |
| 12 | DE/EN durchgängig, iPhone/Android gleichwertig | **OFFEN** | Wörterbücher typgeprüft vollständig; Geräte fehlen. |
| 13 | Kein Apple-Material im Export, korrekte Attribution | **PASS (Sandbox)** | Kein Apple-Code vorhanden; Attribution im Video sichtbar (Frame-Prüfung). |
| 14 | Backend/Admin | **DEFERRED** (Phase 6) | Kein Backend. Benötigt deine Freigabe als zurückgestellt. |
