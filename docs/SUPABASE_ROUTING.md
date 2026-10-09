# Routing-Proxy mit Supabase einrichten

Stand: 2026-10-09. Ziel: echte Straßen-, Rad- und Fußrouten über **openrouteservice (ORS)**, ohne den ORS-Schlüssel in der App auszuliefern. Laut ORS-FAQ darf ein HeiGIT-Schlüssel nicht clientseitig verwendet werden; deshalb läuft jede Anfrage über eine eigene **Supabase Edge Function** namens `route`.

```
App (Browser) ──POST {mode, coordinates}──▶ Edge Function „route“ ──(ORS-Schlüssel)──▶ api.heigit.org/openrouteservice
                                              │
                                              └─ Tages-Kontingent je Client + gesamt (Tabelle routing_usage)
```

Alles läuft im kostenlosen Rahmen: ORS-Standard-Plan mit 2.000 Routen/Tag und 40/Minute, Supabase Free Plan. Die Function begrenzt sich selbst auf **1.800 Routen/Tag gesamt** und **50 je Client und Tag**.

**Pausierung:** Supabase pausiert kostenlose Projekte nach 7 Tagen mit wenig Datenbankaktivität. Jede Routenanfrage schreibt einen Zähler und hält das Projekt aktiv. Nach einer Woche ohne Nutzung musst du das Projekt im Dashboard einmal fortsetzen („Restore project“). Bis dahin zeigt die App die gekennzeichnete Schätzung.

---

## Anleitung im Dashboard (ohne Kommandozeile, ca. 15 Minuten)

> Bezeichnungen im Supabase-Dashboard können sich leicht ändern. Wenn ein Menüpunkt anders heißt, nimm den sinngemäß passenden.

### Schritt 1 – Projekt anlegen

| Feld | Wert |
|---|---|
| Organization | deine bestehende |
| GitHub (optional) | **leer lassen** |
| Project name | `RouteVFX` |
| Database password | „Generate a password“ und im Passwort-Manager speichern (wird hier nicht gebraucht) |
| Region | **Central EU (Frankfurt)** |
| Enable Data API | ✅ an (die Function nutzt sie für die Kontingent-Prüfung) |
| Automatically expose new tables | ❌ **aus** |
| Enable automatic RLS | ✅ an |
| Postgres Type | Postgres (Default) |

„Create new project“ klicken und warten, bis das Projekt bereit ist (1–2 Minuten).

### Schritt 2 – openrouteservice-Schlüssel kopieren

1. https://account.heigit.org öffnen → Dashboard → deinen Schlüssel (Standard-Plan) kopieren.
2. Den Schlüssel **nirgends** außer in Schritt 4 einfügen: nicht ins Repository, nicht in `.env`, nicht in Chats.

### Schritt 3 – Datenbank vorbereiten (SQL)

1. Links **SQL Editor** → **New query**.
2. Den kompletten Inhalt dieser Datei einfügen:
   [`supabase/migrations/20261008220000_routing_quota.sql`](https://github.com/Lightblue87/RouteVFX-Animated-Route-Creator/blob/claude/nice-galileo-wiy8cr/supabase/migrations/20261008220000_routing_quota.sql) (auf GitHub oben rechts „Copy raw file“).
3. **Run** klicken. Erwartet: „Success. No rows returned“.
4. Kontrolle: Unter **Table Editor** gibt es jetzt die leere Tabelle `routing_usage`, unter **Database → Functions** die Funktion `routing_take_quota`.

### Schritt 4 – Secrets setzen

Links **Edge Functions** → **Secrets** (alternativ: Project Settings → Edge Functions → Secrets). Lege diese vier an (Name exakt so, Groß-/Kleinschreibung beachten):

| Name | Wert |
|---|---|
| `ORS_API_KEY` | dein openrouteservice-Schlüssel aus Schritt 2 |
| `ROUTING_QUOTA_SALT` | eine lange Zufallszeichenkette (z. B. 40+ Zeichen aus deinem Passwort-Generator). Wird nur intern für die Anonymisierung genutzt. |
| `ROUTING_ALLOWED_ORIGINS` | `http://localhost:4173` (später kommagetrennt die echte App-Adresse ergänzen, z. B. `https://meine-app.example,http://localhost:4173` – ohne Schrägstrich am Ende) |
| `ROUTING_ENABLED` | `true` |

Optional (nur wenn du die Standardwerte ändern willst): `ROUTING_PER_CLIENT_DAILY` (Standard `50`), `ROUTING_GLOBAL_DAILY` (Standard `1800`), `ORS_BASE_URL` (Standard `https://api.heigit.org/openrouteservice`).

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase automatisch bereit. **Nicht** selbst anlegen.

### Schritt 5 – Edge Function anlegen

1. Links **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Funktionsname: **`route`** (genau so; er wird Teil der URL).
3. Den vorgegebenen Beispielcode in `index.ts` komplett löschen und den Inhalt dieser Datei einfügen:
   [`docs/supabase/route-function-single-file.ts`](https://github.com/Lightblue87/RouteVFX-Animated-Route-Creator/blob/claude/nice-galileo-wiy8cr/docs/supabase/route-function-single-file.ts) („Copy raw file“).
4. **Deploy function** klicken.
5. Danach in der Function **route** → **Details** bzw. **Settings**: **„Enforce JWT verification“ / „Verify JWT“ ausschalten** und speichern. Die App hat in V1 keine Konten; die Function schützt sich selbst (erlaubte Herkunft, Kontingente, Notschalter).
6. Die angezeigte Function-URL notieren: `https://<projekt-ref>.supabase.co/functions/v1/route`.

### Schritt 6 – Testen

Ersetze `<projekt-ref>` (steht in der Function-URL bzw. unter Project Settings → General → „Project ID“).

**macOS/Linux (Terminal):**
```bash
curl -s -X POST "https://<projekt-ref>.supabase.co/functions/v1/route" \
  -H "Origin: http://localhost:4173" -H "Content-Type: application/json" \
  -d '{"mode":"car","coordinates":[[9.7375,52.3745],[10.5268,52.2689]]}'
```

**Windows (PowerShell):**
```powershell
Invoke-RestMethod -Method Post -Uri "https://<projekt-ref>.supabase.co/functions/v1/route" `
  -Headers @{ Origin = "http://localhost:4173" } -ContentType "application/json" `
  -Body '{"mode":"car","coordinates":[[9.7375,52.3745],[10.5268,52.2689]]}'
```

**Erwartet:** eine Antwort mit `"routes":[{"coordinates":[...],"distanceM":…,"durationS":…}]` (Hannover → Braunschweig, ca. 60–70 km). Danach steht in **Table Editor → routing_usage** eine Zeile mit `count = 1`.

| Antwort | Bedeutung | Lösung |
|---|---|---|
| `Missing authorization header` / HTTP 401 | JWT-Prüfung noch an | Schritt 5.5 |
| `origin_not_allowed` (403) | Origin passt nicht zu `ROUTING_ALLOWED_ORIGINS` | Secret prüfen (exakt `http://localhost:4173`, ohne `/` am Ende) |
| `disabled` (503) | `ROUTING_ENABLED` ≠ `true` oder Schlüssel/Salz fehlt | Schritt 4 |
| `quota_unavailable` (503) | SQL aus Schritt 3 fehlt oder ist fehlgeschlagen | Schritt 3 wiederholen |
| `quota` (429) | Tageslimit erreicht | morgen wieder bzw. Limits erhöhen |
| `upstream_quota` (503) / `upstream` (502) | ORS lehnt ab (Schlüssel falsch oder Kontingent leer) | Schlüssel in Schritt 4 prüfen, HeiGIT-Dashboard ansehen |
| `upstream_unreachable` (502) | ORS nicht erreichbar | später erneut; ggf. `ORS_BASE_URL` prüfen |

### Schritt 7 – Rückmeldung

Schick mir **nur** die Projekt-Ref (oder die Function-URL) und das Testergebnis (die Antwort ohne Schlüssel). Dann baue ich die App mit `VITE_ROUTING_PROXY_URL` und teste den Ablauf in der App.

---

## Betrieb

- **Notschalter:** Secret `ROUTING_ENABLED` auf `false` setzen. Die Function antwortet sofort mit 503, die App nutzt die gekennzeichnete Schätzung.
- **Verbrauch:** Tabelle `routing_usage` (Tag, anonymisierter Client-Schlüssel, Zähler). Gespeichert wird nur ein täglich wechselnder, gesalzener Hash der IP; Einträge werden nach 7 Tagen gelöscht. Koordinaten werden weder gespeichert noch geloggt.
- **Code ändern:** Quelle ist `supabase/functions/route/handler.ts` + `index.ts`. Die Dashboard-Datei wird mit `npm run build:function-single-file` neu erzeugt; ein Test prüft den Gleichstand.
- **Später (Phase 6):** Login und Nutzerdatenbank im selben Projekt; Kontingente dann pro Konto statt pro IP.

## Alternative: Supabase CLI

```bash
supabase login
supabase link --project-ref <projekt-ref>
supabase db push
supabase secrets set ORS_API_KEY=<schlüssel> ROUTING_QUOTA_SALT=<zufall> ROUTING_ALLOWED_ORIGINS=http://localhost:4173 ROUTING_ENABLED=true
supabase functions deploy route --no-verify-jwt
```

## Getestet / nicht getestet
- Getestet (Sandbox): Handler-Logik (Vitest), Deno-Typprüfung beider Varianten (Quellen + Dashboard-Einzeldatei), echter Deno-Lauf mit simulierter Datenbank, SQL-Migration in eingebettetem Postgres (PGlite).
- **Nicht getestet:** echtes Supabase-Projekt, echter ORS-Aufruf (Sandbox blockiert die ORS-API), Dashboard-Bezeichnungen (aus Doku-Kenntnis, nicht live geprüft), Geräte.
