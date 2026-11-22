# Flintworks Multiplayer-Relay

Kleiner Node-Server für `wss://play.kiez-power.de`. Er rechnet das Spiel nicht, sondern hält Räume (Code aus 5 Zeichen, bis 4 Spieler, Host; ein getrennter Spieler behält seinen Platz 30 s) und leitet Nachrichten weiter.

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

`cd server && npm install && npm start` → Spiel mit `?mp=ws://localhost:8787` öffnen. `?mp=` wirkt nur im Dev-Server (`npm run dev`) oder wenn das Spiel selbst von `localhost` kommt; die veröffentlichte Seite verbindet sich immer mit `play.kiez-power.de`.

## Schutz und Grenzen

Jeder kann sich verbinden, darum begrenzt das Relay:

| Grenze | Wert |
|---|---|
| Verbindungen pro IP (Umgebungsvariable `MAX_PER_IP`) | 16 (die IP kommt von Caddy aus `X-Forwarded-For`) |
| Nachrichten pro Verbindung | 150/s (kurz bis 300); wer weit darüber liegt, wird getrennt |
| Raum- und Freundes-Anfragen (`create`, `join`, `hello`, `list`, `ghost` …) | 4/s, kurz bis 20 |
| Geister-Läufe der Tagesschicht (`MAX_GHOSTS`), nur im Arbeitsspeicher | 4 000, je höchstens 16 000 Zeichen |
| Falsche Raum-Codes pro Verbindung | 20, dann getrennt (kein Durchprobieren privater Räume) |
| Verschiedene Geräte-Tokens pro Verbindung | 3 |
| Benutzer insgesamt (`MAX_USERS`) | 100 000 |
| Gespeicherter Snapshot | 1 MB |
| Geteilte Welten auf der Festplatte (`SHARED_DIR`, `MAX_SHARED`, `MAX_SHARED_BYTES`) | 500 Welten, je höchstens 2 MB, eine pro Besitzer; nach 180 Tagen ohne Änderung gelöscht |

Spielnachrichten, die nur der Host senden darf (`start`, `snap`, `ter`, `end`, `cfg`, `toast`, `cd`), leitet das Relay von anderen Spielern nicht weiter; die Clients prüfen das zusätzlich. Ein Raum, den alle verlassen haben, wird sofort gelöscht. Raum-Codes kommen aus `crypto.randomInt`.

## Geteilte Welten

Teilt ein Spieler eine Siedlungswelt mit seinen Freunden, hält das Relay ihren neuesten Spielstand
als Datei in `SHARED_DIR` (im Container `/data`, Volume `flintworks-relay-data`): eine Datei
`<Welt-ID>.json` pro Welt, geschrieben über eine temporäre Datei und Umbenennen. Öffnen darf sie,
wer in der Freundesliste des Besitzers steht; die Liste liegt mit in der Datei, damit das auch nach
einem Neustart gilt, während der Besitzer offline ist. Es spielt immer nur ein Raum eine Welt: Wer
sie öffnet, während Freunde darin sind, kommt in deren Raum. Der Host des Raums schickt den Stand
bei jedem Speichern (etwa einmal pro Minute und beim Verlassen). Sicherung: das Volume kopieren.

## Logs auf dem Server

`docker logs -f flintworks-relay`

## Dauerhafte Welten

Die Standard-Auslieferung enthält zusätzlich `flintworks-world`, einen separaten Welt-Host mit
persistentem Volume. Er rechnet die gebaute Spielversion und nutzt dieses Relay wie ein Client.
Betrieb, Sicherungen, private Welten und Wiederherstellung: [WORLDS.md](WORLDS.md).
