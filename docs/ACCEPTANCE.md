# Abnahmeszenarien (CLAUDE.md §15)

Stand: 2026-10-08. Status je Szenario: `PASS` · `FAIL` · `BLOCKED_EXTERNAL` · `DEFERRED_APPROVED` · `OFFEN` (noch nicht testbar/nicht umgesetzt).
`PASS (Sandbox)` heißt: automatisiert in Linux/headless Chrome for Testing 141 bestanden – **kein Ersatz für Gerätetests**.

| # | Szenario | Status | Nachweis / fehlende Teile |
|---|---|---|---|
| 1 | Hannover→Barcelona per Ortssuche, Stopps/Wegpunkte, Alternativroute, speichern & lokal wieder öffnen | **OFFEN (teilweise PASS Sandbox)** | Ortssuche, Speichern, Reload + Wiederöffnen: E2E `core.spec.ts` PASS. Alternativroute nur mit Mock (keine Online-Route in Sandbox, E05). Routing-Wegpunkte-UI fehlt (Formpunkte über Linienbearbeitung vorhanden). |
| 2 | Multimodal Hannover→Flughafen→Barcelona→Palma (Auto/Flug/Schiff), Wechsel-Overlay, Fahrtrichtungs-Kamera, Wasserweg markiert | **PASS (Sandbox)** – Gerätetest offen | E2E `core.spec.ts` „Szenario 2“: MP4 h264 1080×1920, 240 Frames, 8,000 s; Frames visuell geprüft (Wechsel „Car“/„Ship/ferry“, Großkreis- und Schätzhinweis). Auto-Abschnitt ist mangels Online-Routing ebenfalls geschätzt (markiert). |
| 3 | Straßenroute ziehen, Schiffsroute manuell korrigieren | **OFFEN (Schiff PASS Sandbox)** | Linienbearbeitung (Kontrollpunkte ziehen/einfügen/entfernen) für jeden Abschnitt; E2E: Schiffsroute gezogen → `manually_edited`, Distanz ändert sich; Unit: Distanz/Provenienz/Datumsgrenze. Straßenroute mit Re-Routing über Ziehpunkte (Online) nicht umgesetzt. Touch-Ziehen nur per Maus-Emulation getestet. |
| 4 | GPX importieren, ungültiges GPX sicher ablehnen, kein XSS | **PASS (Unit + E2E Sandbox)** | `gpx.test.ts` (9 Tests); E2E: ungültige Datei mit `<script>` → Fehlermeldung, kein Absturz; gültiger Track → Segment „Aufgezeichnet“. Texte nur per `fillText`/React-Text. |
| 5 | Offline nach Projektanlage bearbeiten, keine unlizenzierten Tiles, danach online ohne Datenverlust | **OFFEN** | Service Worker + lokale Geodaten implementiert; keine Fremdkacheln im Code. Kein Offline-E2E. |
| 6 | Kamera-/Text-Keyframes; 60/120/180 s; Seek-Wiederholungen identisch | **PASS (Unit) für Determinismus** / Keyframes offen | `scene.test.ts`: 200 Zeitpunkte in zufälliger Reihenfolge für 60/120/180 s identisch. Manuelle Keyframes nicht begonnen. |
| 7 | Symbol, 2D, 3D-Asset; kaputtes GLB → Fallback; Farben/Orientierung | **OFFEN** | Nur eingebaute Symbole + Farbe. |
| 8 | Foto, Videoclip, Musik, Voice-over; Fades hörbar; ohne Ton spielbar | **BLOCKED_EXTERNAL (Sandbox)** / teilweise offen | Musik + Fades implementiert, AAC-Encoder in Sandbox nicht vorhanden. Ohne Ton: PASS (Sandbox). Foto/Clip/Voice-over nicht begonnen. |
| 9 | 1080p/30 auf Zielgeräten, MP4 + Abspieltest + native Freigabe; höhere Profile einzeln | **PASS (Sandbox) für 1080p30-Datei** / Geräte offen | ffprobe: h264 High, 1080×1920, 30/1, 120 Frames, 4,000 s. Höhere Profile: siehe RELEASE_MATRIX.md. Native Freigabe ungetestet. |
| 10 | Abbruch, Hintergrund, Speicher voll, Codec fehlt → hilfreiche UI, Projekt bleibt | **OFFEN (Abbruch PASS Sandbox)** | E2E: Abbruch während Rendern → Meldung, Projekt unverändert. Hintergrund-Abbruch, Speicher voll, fehlender Codec: implementiert, ungetestet. |
| 11 | Projekte überleben Reload/Installation/Update | **OFFEN (Reload PASS Sandbox)** | E2E Reload + Integrationstest. Installation und App-Update (Service-Worker-Wechsel) ungetestet; SW löscht nur `arc-shell-*`-Caches. |
| 12 | DE/EN durchgängig, iPhone/Android gleichwertig | **OFFEN** | Wörterbücher typgeprüft vollständig; Geräte fehlen. |
| 13 | Kein Apple-Material im Export, korrekte Attribution | **PASS (Sandbox)** | Kein Apple-Code vorhanden; Attribution im Video sichtbar (Frame-Prüfung). |
| 14 | Backend/Admin | **DEFERRED** (Phase 6) | Kein Backend. Benötigt deine Freigabe als zurückgestellt. |
