# Routing-Proxy mit Supabase einrichten

Stand: 2026-10-08. Ziel: echte Straßen-, Rad- und Fußrouten über **openrouteservice (ORS)**, ohne den ORS-Schlüssel in der App auszuliefern. Laut ORS-FAQ darf ein HeiGIT-Schlüssel nicht clientseitig verwendet werden, deshalb läuft jede Anfrage über eine eigene **Supabase Edge Function** (`supabase/functions/route`).

```
App (Browser) ──POST {mode, coordinates}──▶ Supabase Edge Function „route“ ──(ORS-Schlüssel)──▶ api.heigit.org/openrouteservice
                                              │
                                              └─ Tages-Kontingent je Client + gesamt (Tabelle routing_usage)
```

## Kosten
Alles im kostenlosen Rahmen (Supabase Free Plan – laut Drittquellen ohne Zahlungsmethode, bitte im Dashboard bestätigen: 500.000 Function-Aufrufe/Monat; ORS Standard-Plan: 2.000 Routen/Tag, 40/min). Die Function begrenzt sich selbst auf **1.800 Routen/Tag gesamt** und **50 je Client und Tag**, damit das ORS-Kontingent nie überschritten wird. Beides ist per Secret einstellbar.

**Wichtig – Pausierung:** Supabase pausiert kostenlose Projekte nach 7 Tagen mit wenig Datenbankaktivität. Jede Routenanfrage schreibt einen Zähler und hält das Projekt aktiv. Wird die App eine Woche lang nicht genutzt, musst du das Projekt im Supabase-Dashboard einmal fortsetzen („Restore“). Bis dahin zeigt die App wie gewohnt die gekennzeichnete Schätzung.

## Einmalige Einrichtung (ca. 15 Minuten)

1. **Eigenes Supabase-Projekt anlegen** – getrennt von anderen Projekten (z. B. SFT-Drive), damit Daten, Schlüssel und Kontingente getrennt bleiben. Das kostenlose Konto erlaubt 2 aktive Projekte. Region: möglichst EU (z. B. Frankfurt).
2. **ORS-Schlüssel holen:** Konto auf https://account.heigit.org anlegen, Standard-Plan (kostenlos), Schlüssel kopieren. Den Schlüssel **nie** ins Repository, in `.env` oder in Chats kopieren.
3. **Supabase CLI** installieren (https://supabase.com/docs/guides/cli), dann im Repository:
   ```bash
   supabase login
   supabase link --project-ref <projekt-ref>
   supabase db push                       # legt Tabelle routing_usage + Funktion routing_take_quota an
   supabase secrets set ORS_API_KEY=<dein-ors-schlüssel>
   supabase secrets set ROUTING_QUOTA_SALT=$(openssl rand -hex 32)
   supabase secrets set ROUTING_ALLOWED_ORIGINS=https://<deine-app-domain>,http://localhost:4173
   supabase secrets set ROUTING_ENABLED=true
   supabase functions deploy route --no-verify-jwt
   ```
   Optional: `ROUTING_PER_CLIENT_DAILY` (Standard 50), `ROUTING_GLOBAL_DAILY` (Standard 1800), `ORS_BASE_URL` (Standard `https://api.heigit.org/openrouteservice`; die alte Adresse `api.openrouteservice.org` wird von HeiGIT abgeschaltet).
4. **App bauen** mit der öffentlichen Function-URL (kein Geheimnis):
   ```bash
   VITE_ROUTING_PROXY_URL=https://<projekt-ref>.supabase.co/functions/v1/route npm run build
   ```
   Die CSP erlaubt dann automatisch genau diesen Origin.

## Betrieb
- **Notschalter:** `supabase secrets set ROUTING_ENABLED=false` – die Function antwortet sofort mit 503, die App fällt auf die gekennzeichnete Schätzung zurück.
- **Verbrauch:** Tabelle `routing_usage` (Tag, anonymisierter Client-Schlüssel, Zähler). Gespeichert wird nur ein täglich wechselnder, gesalzener Hash der IP; Einträge werden nach 7 Tagen gelöscht. Koordinaten werden weder gespeichert noch geloggt.
- **Später (Phase 6):** Login und Nutzerdatenbank können im selben Supabase-Projekt entstehen; Kontingente lassen sich dann pro Konto statt pro IP vergeben.

## Getestet / nicht getestet
- Getestet (Sandbox): Handler-Logik (Vitest), Deno-Typprüfung und echter Deno-Lauf der Function mit simulierter Datenbank, SQL-Migration in eingebettetem Postgres (PGlite).
- **Nicht getestet:** echtes Supabase-Projekt, echter ORS-Aufruf (Sandbox blockiert die ORS-API), Geräte.
