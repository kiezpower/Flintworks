# Dauerhafte Siedlungswelten

Der Welt-Host führt die **gebaute Spielversion** in einem lokalen, kopflosen Chromium aus.
Er verbindet sich als unsichtbarer Gastgeber mit dem bestehenden Relay. Acht Plätze bleiben
für Menschen frei. Jeder spielt dieselbe Simulation wie im Browser; ein zweiter Physik-Kern
und ein eigener Satz von Spielregeln sind nicht nötig.

Die normale Auslieferung startet `flintworks-world` neben `flintworks-relay`: eine öffentliche
„Flintworks Siedlungswelt“, zu finden unter Zusammen spielen → offene Räume. Einladungen über
den Raumcode funktionieren ebenfalls. Der Server übernimmt keine fremden privaten Welten.

## Verhalten

- Alle zehn Sekunden wird `world.json` auf dem Datenträger gesichert. Beim regulären Stoppen
  wird zuerst eine letzte Sicherung geschrieben und erst danach der Browser geschlossen.
- Schreiben erfolgt über eine temporäre Datei, `fsync` und Umbenennen. Die vorige gültige
  Datei liegt unter `world.json.bak`. Schreibfehler stoppen den Host mit einem Fehlerstatus.
- `identity` enthält den geheimen Geräte-Token. Er hält den Einladungscode über Neustarts
  von Host, Relay und Container stabil. Der Token wird nicht an Mitspieler weitergegeben.
- Sind keine Menschen verbunden oder fehlt die Verbindung zum Relay, pausiert die Simulation. Vorräte werden während einer
  leeren Welt nicht verbraucht, Angriffe und Aufgaben laufen nicht weiter.
- Abwesende Besitzerfiguren arbeiten nicht als Helfer, geben ihre Tasche nicht ab, liefern
  keine Baumaterialien und erleiden keinen Schaden. Ihre Gerätekennung ordnet sie beim
  Wiederkommen wieder zu, auch nach einer Namensänderung.
- Ein Betriebssystem-Lock (`flock`) verhindert zwei Schreiber auf demselben Datenverzeichnis.
  Er wird auch nach einem Absturz automatisch freigegeben.
- Ein kaputter Spielstand wird beim Start abgewiesen. Der Host ersetzt ihn niemals durch
  eine frische Welt. Für eine Wiederherstellung den Host stoppen, eine geprüfte Sicherung
  nach `world.json` kopieren und den Host wieder starten.

Bei einem harten Absturz können die Änderungen seit der letzten Zehn-Sekunden-Sicherung fehlen.
Die Welt läuft nur, während ihr Host-Prozess läuft. Ein Hostwechsel auf Spielergeräte ist bei
Dauerwelten absichtlich deaktiviert; der Welt-Host bleibt die zuständige Instanz.

## Eigene Welt lokal betreiben

Voraussetzung: Node 22+, `flock` (Linux/util-linux) und die Chromium-Abhängigkeiten.

```bash
npm ci
npx playwright install --with-deps chromium
npm run build
WORLD_NAME="Unser Berg" WORLD_PUBLIC=false node server/world-host.mjs
```

Der Host meldet nach erfolgreichem Laden seinen Raumcode und den lokalen Port der
Bereitschaftsprüfung. Freunde öffnen das normale Spiel mit `?room=CODE` oder geben den Code
unter Zusammen spielen ein. Für einen privaten Host `WORLD_PUBLIC=false` setzen.

| Variable | Standard | Zweck |
|---|---|---|
| `WORLD_NAME` | Flintworks | Name einer neuen Welt |
| `WORLD_DATA_DIR` | `server/world-data` | Privates Verzeichnis für Identität und Sicherungen |
| `WORLD_RELAY_URL` | `wss://play.kiez-power.de` | Relay, auch `ws://127.0.0.1:8787` für lokale Tests |
| `WORLD_BIOME` | meadow | meadow, desert oder winter, für eine neue Welt |
| `WORLD_DIFFICULTY` | adventure | relaxed, adventure oder hard, für eine neue Welt |
| `WORLD_PUBLIC` | true | false: nur per Raumcode auffindbar |
| `WORLD_HTTP_PORT` | automatisch | Port des ausschließlich lokalen Datei-/Bereitschaftsservers |
| `WORLD_IMPORT_FILE` | leer | Export aus „Meine Welten“ beim ersten Start importieren |
| `PW_CHROMIUM` | Playwright-Chromium | Optionaler Pfad zu einer installierten Chromium-Version |

Eine vorhandene Welt behält ihren Namen, ihr Biom und ihren Spielzustand. Ein Import wird nur
beim ersten Start ohne `world.json` verwendet. Browserprofile und private Spielerdaten werden
nicht an einen fremden Dienst geschickt. Die Host-Brücke ist keine URL-Option und kein
öffentliches Verwaltungs-API: Sie wird nur vom lokalen Betreiber vor dem Seitenstart injiziert.

## Container und Auslieferung

Eigene Installation vom Repository-Hauptverzeichnis aus:

```bash
docker compose -f server/world-host.compose.yml up -d --build
docker compose -f server/world-host.compose.yml logs -f world
```

Die normale GitHub-Auslieferung baut Relay und Welt-Host, startet beide über
`server/docker-compose.yml` und prüft die Bereitschaft der Welt. Der Host hat keine öffentlich
freigegebenen Ports und ist auf einen CPU-Kern und 768 MiB Arbeitsspeicher begrenzt. Ein
abgetrennter Browserprozess wird durch Docker `init` aufgeräumt.

**Das Volume `flintworks-world-data` sichern und bei Updates behalten.** `world.json`,
`world.json.bak` und `identity` gehören zusammen in die Betreibersicherung. Die Identität ist
vertraulich. `docker compose down -v` entfernt auch die Welt und ihren festen Einladungscode.
Normale Updates und `down` ohne `-v` behalten das Volume.

Ein Betreiber hinter einer Unternehmens-CA kann dem Docker-Build ein optionales BuildKit-Secret
`build_ca` mitgeben. Die CA wird nur während der Paketinstallation verwendet und nicht ins
Image kopiert; TLS-Prüfungen bleiben aktiv.

## Prüfung

`tests/dedicated.spec.js` startet die Produktionsversion als echten Host, lässt einen Menschen
beitreten, stoppt und startet den Host neu und prüft Code, Gelände, Weltidentität und Rückkehr.
`tests/hosted-rooms.spec.js` prüft acht menschliche Plätze zusätzlich zum Host und dessen
unveränderte Zuständigkeit bei einer Unterbrechung. Beide Tests verwenden ein eigenes Relay.
