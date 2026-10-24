# Flintworks Multiplayer-Relay

Kleiner Node-Server für `wss://play.kiez-power.de`. Er rechnet das Spiel nicht, sondern hält Räume (Code, bis 4 Spieler, Host) und leitet Nachrichten weiter.

## Einrichten (einmalig, auf dem dogado-vServer)

| Schritt | Befehl / Aktion |
|---|---|
| 1. DNS | Bei der Domain `kiez-power.de` einen **A-Record** `play` → IP des vServers anlegen (bei IPv6 zusätzlich AAAA) |
| 2. Ports | 80 und 443 müssen offen sein (Firewall/Panel) |
| 3. Dateien | Ordner `server/` auf den Server kopieren, z. B. `scp -r server root@SERVER:/root/flintworks-relay-src` |
| 4. Installieren | `ssh root@SERVER` → `cd /root/flintworks-relay-src && bash setup.sh` |
| 5. Prüfen | `journalctl -u flintworks-relay -f` zeigt `Flintworks relay on :8787` |

Läuft auf dem Server schon nginx/Apache auf Port 443, statt Caddy einen Reverse-Proxy mit WebSocket-Upgrade auf `127.0.0.1:8787` einrichten (nginx: `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).

## Aktualisieren

`scp server/relay.js root@SERVER:/opt/flintworks-relay/ && ssh root@SERVER systemctl restart flintworks-relay`

## Lokal testen

`cd server && npm install && npm start` → Spiel mit `?mp=ws://localhost:8787` öffnen.
