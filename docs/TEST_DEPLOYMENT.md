# Test-Veröffentlichung auf GitHub Pages

Stand: 2026-10-09. Zweck: Den Prototyp selbst auf Handy und Rechner ausprobieren. **Das ist keine öffentliche Freigabe** (CLAUDE.md §0/§16): Die App trägt den Hinweis „Prototyp – nicht veröffentlicht“, ist per `noindex`/`robots.txt` für Suchmaschinen gesperrt und wird nirgends verlinkt. Wer die Adresse kennt, kann sie aber aufrufen, weil das Repository öffentlich ist.

Adresse nach der Einrichtung: `https://lightblue87.github.io/RouteVFX-Animated-Route-Creator/`

## Einmalige Einrichtung (ca. 5 Minuten)

1. **GitHub Pages einschalten:** Repository → *Settings* → *Pages* → *Build and deployment* → **Source: GitHub Actions**.
2. **Routing-Proxy eintragen (optional, für echte Straßenrouten):** Repository → *Settings* → *Secrets and variables* → *Actions* → Reiter **Variables** → *New repository variable*
   - Name: `ROUTING_PROXY_URL`
   - Wert: `https://<projekt-ref>.supabase.co/functions/v1/route` (öffentlich, kein Geheimnis)
   - Ohne diese Variable nutzt die App den FOSSGIS-OSRM-Prototyp.
3. **Supabase erlauben:** Im Supabase-Dashboard unter *Edge Functions → Secrets* `ROUTING_ALLOWED_ORIGINS` auf
   `https://lightblue87.github.io,http://localhost:4173` setzen (ohne Pfad und ohne Schrägstrich am Ende). Sonst blockiert die Function die Anfragen der App (`origin_not_allowed`).

## Veröffentlichen / Aktualisieren

*Actions* → **Test-Deployment (GitHub Pages)** → *Run workflow* (Branch `main`) – oder Claude bitten, den Lauf zu starten, sobald Schritt 1 erledigt ist. Der Lauf prüft Typen und Tests, baut die App und veröffentlicht sie; die Adresse steht am Ende im Lauf. Neue Stände werden nur auf Knopfdruck veröffentlicht, nie automatisch.

## Auf dem Handy

- Adresse im Browser öffnen (iPhone: Safari, Android: Chrome). Installieren: iPhone *Teilen → Zum Home-Bildschirm*, Android *Menü → App installieren*.
- Die Kartenstile „OpenFreeMap“ und die Online-Dienste laden Daten von Drittanbietern und fragen vorher um Erlaubnis; die Standardkarte funktioniert offline.
- Für die Release-Matrix (CLAUDE.md §15) zählt dieser Test auf echten Geräten. Bitte pro Gerät notieren: Modell, Betriebssystem, Browser-Version, ob installiert, und was geklappt hat oder nicht (besonders MP4-Export und Freigabe-Dialog).

## Rückbau

*Settings → Pages → Unpublish site* (oder die Pages-Quelle wieder abschalten). Daten der Nutzer liegen nur lokal im jeweiligen Browser; es gibt nichts Serverseitiges zu löschen außer den Zählern in `routing_usage`.

## Hinweise zu Kosten und Missbrauch

GitHub Pages ist für öffentliche Repositories kostenlos (Limits laut GitHub-Doku: Site ≤ 1 GB, 100 GB/Monat weich). Der Routing-Proxy bleibt durch die Tageskontingente (50 je Client, 1.800 gesamt) begrenzt; ein Notschalter ist `ROUTING_ENABLED=false`.
