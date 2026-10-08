# Release-Matrix

Stand: 2026-10-08. **Freigabe: NEIN** – Pflichtszenarien offen, keine Gerätetests (CLAUDE.md §15). Keine Veröffentlichung.

Status: `PASS` · `FAIL` · `BLOCKED_EXTERNAL` · `DEFERRED_APPROVED` · `OFFEN`.

## Exportprofile

| Profil | Sandbox (CfT 141, Linux, SwiftShader) | iPhone Safari | iPhone PWA | Android Chrome | Android PWA | Freigabe |
|---|---|---|---|---|---|---|
| 1080p30 | **PASS** – `test-results/hannover-barcelona-1080p30.mp4`, h264 High, 1080×1920, 30/1, 120 Frames, 4,000 s | OFFEN | OFFEN | OFFEN | OFFEN | Nein |
| 1080p60 | **PASS** – h264 High, 1080×1920, 60/1, 180 Frames, 3,000 s | OFFEN | OFFEN | OFFEN | OFFEN | Nein |
| 4k30 | **PASS** – h264 High, 2160×3840, 30/1, 90 Frames, 3,000 s | OFFEN | OFFEN | OFFEN | OFFEN | Nein |
| 4k60 | **PASS** – h264 High, 2160×3840, 60/1, 180 Frames, 3,000 s | OFFEN | OFFEN | OFFEN | OFFEN | Nein |
| Audio (AAC) | BLOCKED_EXTERNAL (kein AAC-Encoder in Linux-Chrome) | OFFEN | OFFEN | OFFEN | OFFEN | Nein |
| Share-Sheet | OFFEN | OFFEN | OFFEN | OFFEN | OFFEN | Nein |

Testartefakte (MP4/JSON) werden lokal unter `test-results/` erzeugt und nicht eingecheckt (Größe); reproduzierbar mit `npm run test:e2e` bzw. `PROFILES=1080p60,4k30,4k60 npm run test:e2e`.

**Hinweis:** „PASS (Sandbox)“ belegt nur, dass Pipeline und Datei korrekt sind (kurze Clips). Lange Exporte (bis 180 s) und alle realen Geräte sind ungetestet; 4K wird bis zum Gerätenachweis nicht freigegeben.

## Abnahmeszenarien
Siehe `ACCEPTANCE.md`. Zusammenfassung: 1 OFFEN (teilw.) · 2 PASS (Sandbox) · 3 OFFEN (teilw.) · 4 PASS (Unit + E2E Sandbox) · 5 PASS (Sandbox) · 6 PASS (Unit, Determinismus; Keyframes offen) · 7 OFFEN · 8 BLOCKED_EXTERNAL/OFFEN · 9 PASS (Sandbox-Dateien) · 10 OFFEN (Abbruch PASS) · 11 OFFEN (Reload PASS) · 12 OFFEN · 13 PASS (Sandbox) · 14 DEFERRED_APPROVED (Phase 6, freigegeben 2026-10-08).

**Kein Szenario ist auf realen Geräten bestanden → keine Freigabe.**

## Sicherheit / Accessibility / Rechte
| Prüfung | Status |
|---|---|
| `npm audit` (high) | PASS (0 Funde, 2026-10-08) |
| CSP im Build | implementiert; App lief unter CSP im E2E |
| GPX: XXE/DOCTYPE, Größenlimits, Textausgabe ohne HTML | PASS (Unit) |
| Accessibility (VoiceOver/TalkBack, Kontrast, Fokus) | OFFEN |
| Lizenzprüfung Karten/Assets | Natural Earth PASS; OpenFreeMap (Video mit Attribution, Stile BSD-3/CC BY 4.0) PASS laut README/LICENSE; kommerzielle Nutzung nur sekundär belegt |
