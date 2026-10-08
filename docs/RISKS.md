# Technische Risiken – priorisiert

Stand: 2026-10-08. Bewertung: Eintrittswahrscheinlichkeit (W) × Auswirkung (A), je 1–3. Priorität = W×A.

| # | Risiko | W | A | Prio | Bezug | Gegenmaßnahme / Fallback | Status |
|---|---|---|---|---|---|---|---|
| R-01 | **Keine exportlizenzierte, kostenlose Detailkarte** (Straßen, Städte, Satellit). Natural Earth zeigt nur Länder/Küsten/Seen – für Auto-/Rad-Routen optisch grob. | 3 | 3 | 9 | E04, Ent. 10/39 | **Entschieden 2026-10-08:** OSM-Vektorkacheln als selbst gehostete PMTiles auf statischem Hosting (ODbL, Attribution im Video). Größe/Hosting-Limits noch zu prüfen. Satellit/Hybrid bis Lizenznachweis gesperrt. | Entschieden, Umsetzung offen |
| R-02 | **Apple Maps nicht nutzbar** für Export (Rechte unklar) und nur mit kostenpflichtiger Developer-Mitgliedschaft. | 3 | 2 | 6 | E01–E03 | Apple nur ggf. als Editor-Vorschau nach Freigabe der Kosten; Export immer über lizenzierte Alternative, Unterschied in Vorschau kennzeichnen. | Blockiert |
| R-03 | **Kein kostenloser, produktionstauglicher Routingdienst** bestätigt. FOSSGIS-Demo ist Best-Effort, Bedingungen nicht abrufbar. | 3 | 3 | 9 | E05, Ent. 07 | Opt-in + Drosselung + gekennzeichnete Näherung (umgesetzt). **Entschieden 2026-10-08:** Free-Tier mit API-Schlüssel (openrouteservice oder GraphHopper, Bedingungen vor Auswahl belegen); Selbsthosting nur mit Kostenfreigabe. | Entschieden, Umsetzung offen |
| R-04 | **iOS Safari**: WebCodecs-H.264-Encoding, AAC, WebGL-Readback, Speicher – unbekannt. | 2 | 3 | 6 | E08/E09/E13 | Echte Feature-Detection umgesetzt; Feldtest auf iPhone zwingend vor Release. Fallback MediaRecorder (MP4, wenn unterstützt) evaluieren. | Offen |
| R-05 | **AAC-Encoder fehlt** auf manchen Plattformen (Linux-Chrome nachgewiesen). Audio-Pflichtszenario 8 gefährdet. | 3 | 2 | 6 | E08, Ent. 17 | UI exportiert dann ohne Ton und sagt es. Option: WASM-AAC (`@mediabunny/aac-encoder`, FFmpeg/LGPL – Lizenz prüfen). | Offen |
| R-06 | **Speicher**: fertige MP4 liegt komplett im RAM (`BufferTarget`). 3 min 4K60 @ 50 Mbit/s ≈ 1,1 GB → Absturz auf Smartphones. | 3 | 3 | 9 | E09, §10 | OPFS-Streaming (`StreamTarget`) + profilabhängige Bitrate; vor Export Speicherschätzung + Warnung (Warnung für 4K umgesetzt). | Offen |
| R-07 | **Exportdauer/Thermik** auf Mobilgeräten; iOS pausiert Hintergrund-Tabs. | 3 | 2 | 6 | E09 | Export bricht bei Hintergrundwechsel sauber ab (umgesetzt, ungetestet auf Gerät); Fortschritt + Abbruch; Wake-Lock prüfen. | Teilweise |
| R-08 | **Determinismus über Geräte**: Systemschriften/Emoji unterscheiden sich → Videos nicht pixelgleich. | 2 | 1 | 2 | §8 | OFL-Schrift bündeln (z. B. Inter), keine Emoji im Video. | Offen |
| R-09 | **Bahn/Schiff/ÖPNV-Geometrie** ohne lizenzierte Daten; Schiffslinien können über Land verlaufen. | 3 | 2 | 6 | E05, Ent. 07/41 | Kennzeichnung `estimated` + Warnung umgesetzt; manuelle Geometriebearbeitung (Phase 2) nötig; Natural-Earth-Land-Polygone für Kollisionsprüfung nutzbar. | Teilweise |
| R-10 | **GPS im Hintergrund** (iOS) unzuverlässig. | 3 | 1 | 3 | E10 | Nur aktive Aufzeichnung versprechen; klare UI-Einschränkung. | Nicht begonnen |
| R-11 | **Rechte an Musik/SFX/3D/Fonts** für Social-Kommerz. | 2 | 3 | 6 | E11 | Keine Bibliothek ausliefern, bis Lizenz schriftlich belegt; Hinweis bei eigener Musik (umgesetzt). | Offen |
| R-12 | **Bundle-Größe** 1,9 MB JS (≈ 523 KB gzip) + 0,5 MB Worker → langsamer Start auf Mittelklassegeräten. | 2 | 2 | 4 | §14 | Code-Splitting (Export-Engine, Editor lazy); Budget in PERFORMANCE.md. | Offen |
| R-13 | **Web Share mit Dateien** in installierten PWAs (iOS/Android) unklar. | 2 | 2 | 4 | E13 | Download immer verfügbar (umgesetzt). | Teilweise |
| R-14 | **iOS-Speicherbereinigung**: Safari kann skriptgeschriebene Daten nicht installierter Websites nach Inaktivität löschen (nicht in dieser Sitzung verifiziert). | 2 | 3 | 6 | §12 | Hinweis in UI (umgesetzt), `storage.persist()` anfragen (umgesetzt), Installation empfehlen; Cloud erst Phase 6. | Teilweise |
| R-15 | **Kartenlink-Import** (Google/Apple): Formate/ToS, keine offizielle Spezifikation. | 2 | 1 | 2 | E07 | Nur Whitelist eindeutig parsbarer Koordinaten-URLs; sonst freundliche Ablehnung. | Nicht begonnen |
| R-16 | **3D-Modelle (GLB)**: Speicher, Sicherheit, Lizenz. | 2 | 2 | 4 | §8/E11 | Größen-/Polygonlimits, kein Skript aus Assets, Fallback-Symbol. | Nicht begonnen |
| R-17 | **Drittanbieter-Datenübertragung** (DSGVO) bei Online-Routing/-Suche. | 2 | 2 | 4 | E14 | Standardmäßig aus; Opt-in mit Erklärung (umgesetzt); Datenschutzhinweise vor Release. | Teilweise |
| R-18 | **Kosten-Lock-in Apple/Router** bei Wachstum (Quoten). | 1 | 3 | 3 | E03/E12 | Provider hinter Schnittstellen; Limits/Kill-Switch vor öffentlichen Online-Funktionen. | Offen |
| R-19 | **Sandbox-Messwerte nicht repräsentativ** (Software-WebGL, keine Hardware-Encoder). | 3 | 2 | 6 | §14/§15 | Alle Messwerte als „Sandbox“ markiert; Gerätetests vor jeder Profilfreigabe. | Bewusst |

## Top-5 für die nächsten Schritte
1. R-01 + R-03: Entscheidungen getroffen (PMTiles selbst gehostet; Routing Free-Tier mit Schlüssel) – Anbieterbedingungen belegen und umsetzen.
2. R-04/R-05: Gerätetests iPhone + Android mit dem Prototyp (Profil-Probe-Seite liefert die Daten).
3. R-06: Streaming-Export über OPFS statt RAM-Puffer.
4. R-09/41: manuelle Geometriekorrektur.
5. R-12: Code-Splitting.
