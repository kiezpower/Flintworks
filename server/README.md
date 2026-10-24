# Flintworks Multiplayer-Relay

Kleiner Node-Server für `wss://play.kiez-power.de`. Er rechnet das Spiel nicht, sondern hält Räume (Code, bis 4 Spieler, Host) und leitet Nachrichten weiter.

Er läuft als Docker-Container `flintworks-relay` auf dem dogado-vServer **neben den kiez-power-Apps**: Er hängt im Docker-Netz `kiezpower-net`, und deren Caddy (`kiezpower-caddy`) leitet `play.kiez-power.de` an ihn weiter.

## Automatisches Deployment

GitHub Action `.github/workflows/deploy-relay.yml`, bei jedem Push auf `main`, der `server/` ändert (oder manuell unter *Actions → Deploy multiplayer relay → Run workflow*):

| Schritt | Was passiert |
|---|---|
| Build | Image `ghcr.io/kiezpower/flintworks-relay` bauen und in die GitHub Container Registry schieben |
| Deploy | `docker-compose.yml` und `caddy-site.conf` nach `/opt/flintworks-relay` kopieren, Image ziehen, Container starten |
| Caddy | Den Block für `play.kiez-power.de` einmalig an `/opt/kiezpower/Caddyfile` anhängen und Caddy neu laden (andere Seiten laufen weiter) |
| Health check | `https://play.kiez-power.de` muss `426 Upgrade Required` antworten |

## Einmalig einrichten

| Schritt | Wo |
|---|---|
| 1. DNS | Cloudflare: A-Record `play` → IP des vServers (wie `app`/`member`) |
| 2. Secrets | Flintworks-Repo → Settings → Secrets → Actions: `DOGADO_HOST`, `DOGADO_SSH_USER`, `DOGADO_SSH_KEY` (dieselben Werte wie im Repo kiez-power-b2b) |
| 3. Caddy dauerhaft | Der Block steht auch in `kiez-power-b2b/deploy/Caddyfile`, damit ihn das nächste b2b-Deployment nicht überschreibt |
| 4. Starten | Actions → *Deploy multiplayer relay* → *Run workflow* |

## Lokal testen

`cd server && npm install && npm start` → Spiel mit `?mp=ws://localhost:8787` öffnen.

## Logs auf dem Server

`docker logs -f flintworks-relay`
