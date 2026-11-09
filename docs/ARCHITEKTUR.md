# Architektur: welches Modul wofür

> **Stand: v1.112.0.** Eine Landkarte für `src/` (rund 100 Module). Jede Datei erklärt sich im
> Kopfkommentar selbst genauer; hier steht nur, wo man etwas findet und wie die Teile zusammenhängen.

## Grundsätze

- **Ein Zustand:** `state.js` hält `G` (die laufende Runde). `profile.js` hält `P` (was zwischen den
  Runden bleibt, im Browser gespeichert).
- **Befehle statt direkter Änderungen:** Die Oberfläche ändert das Spiel nie direkt, sondern ruft
  `send()` in `commands.js` auf. So laufen Einzelspiel und Mehrspieler über denselben Weg: Im
  Mehrspieler führt der Host die Befehle aus (`net/host.js`).
- **Der Host rechnet:** Alle Geräte bauen dieselbe Welt aus dem Seed (`gen.js`). Danach schickt der
  Host Kopien der Figuren (`net/sync.js`) und Geländeänderungen (`net/terrain.js`), die anderen zeigen
  nur an (`net/client.js`).
- **Level sind Daten:** `src/levels/<id>/level.json` + `map.txt`, siehe [LEVELS.md](LEVELS.md).
- **Kein Modul über 1000 Zeilen** (darum gibt es zum Beispiel `i18n.js` und `i18n2.js`).

## Ablauf einer Runde

`main.js` startet und liest Einladungen aus der Adresse → `lobby.js` → `levelselect.js` / `modes.js`
wählen den Modus → `gen.js` (oder `levels/loader.js`) baut die Welt → pro Tick: `input.js` /
`gamepad.js` → `commands.js` → Simulation (`sim.js`, `digger.js`, `helpers.js`, `entities.js`,
`objects.js` …) → `render.js` + `ui.js` zeichnen.

## Module nach Bereichen

### Kern

| Modul | Aufgabe |
|---|---|
| `main.js` | Start, Hauptschleife, Einladungen aus der Adresse |
| `state.js` | Zustand der Runde (`G`) |
| `world.js` | Materialien und Landschaft (Pixelraster `mat`, Chunks, aktive Zellen) |
| `sim.js` | Fallsand-Simulation: Sand, Wasser, Öl, Säure, Lava, Dampf |
| `gen.js` | Erzeugt die Welt aus dem Seed |
| `biomes.js` | Weltarten Wiese, Wüste, Winter |
| `commands.js` | Spieleraktionen als Befehle |
| `save.js` | Speichern und Laden im Browser |
| `settings.js` | Alle Optionen, geteilt von Lobby und Spielmenü |
| `profile.js` | Profil über Runden hinweg: Level, Trophäen, Hüte, Tagesaufgaben |
| `platform.js` | Android-App, eigene Web-Version oder andere Seite |
| `debug.js` | Haken für die Browser-Tests (nur im Entwicklungsserver) |

### Wühler, Helfer und Steuerung

| Modul | Aufgabe |
|---|---|
| `digger.js` | Der Wühler: Laufen, Springen (Coyote-Time, Sprung-Puffer), Graben |
| `climb.js` | Hilfe beim Herausklettern aus Gruben |
| `players.js` | Von Menschen gesteuerte Wühler (`c.pid`) |
| `helpers.js` | Helfer, die selbst arbeiten |
| `pathfind.js` | A*-Wegsuche auf der Pixellandschaft |
| `crewui.js` | Crew-Leiste: Helfern einen Schwerpunkt geben |
| `tapgo.js` | In die Welt tippen schickt den Wühler dorthin |
| `input.js`, `keys.js`, `gamepad.js` | Tastatur und Touch, eigene Tasten, Gamepads |
| `local.js` | Zu zweit an einem Gerät |
| `descend.js` | Zurück zur letzten Grabestelle |
| `tombs.js` | Grabstein mit den verlorenen Sachen |

### Wirtschaft und Bauen

| Modul | Aufgabe |
|---|---|
| `buildings.js` | Gebäude und Produktionsketten |
| `store.js` | Gemeinsames Lager an der Burg, Verkauf, automatische Herstellung |
| `tools.js` | Werkzeuge und Ausrüstung |
| `research.js` | Kleiner Forschungsbaum |
| `farm.js` | Feld, Mühle, Brot |
| `mine.js` | Stützbalken in Stollen |
| `crate.js` | Lagertruhe tief unten |
| `torches.js` | Fackeln |
| `merchant.js` | Wandernder Händler |
| `villagers.js` | Siedler, die in fertige Hütten ziehen, Miete nach Zufriedenheit |
| `vehicles/` | Bohrwagen, Floß, Katapult, Luftschiff, Seilbahn, Schienen und Loren, Fahrstuhl |
| `camp.js`, `lobbycamp.js` | Heimatbergwerk: Kristalle zwischen den Runden |
| `skins.js` | Outfits und Baustile |

### Welt, Gefahren und Entdecken

| Modul | Aufgabe |
|---|---|
| `weather.js`, `seasons.js`, `storms.js`, `rainfx.js` | Tag und Nacht, Jahreszeiten, Sand- und Schneesturm, Regen |
| `nights.js` | Nachtmonster und Blutmond |
| `events.js`, `hazards.js` | Erdbeben, Einstürze, Gastaschen |
| `fire.js` | Öl und Feuer |
| `zones.js` | Höhlenbiome tief unten |
| `shrines.js` | Schreine mit Gaben und Höhlenwächtern |
| `boss.js`, `queen.js` | Riesenwurm, Lavakönigin (Bosse) |
| `combat.js`, `fort.js`, `siege.js` | Kampf, Festung, Belagerung |
| `treasure.js`, `hoards.js` | Schatztruhen, Schatzkarten zu großen Verstecken |
| `potions.js` | Tränke aus Leuchtpilzen |
| `fishing.js` | Angeln |
| `pets.js` | Fluffel als Begleiter |
| `fog.js` | Karte mit Nebel |
| `entities.js`, `objects.js` | Monster, Tiere, Gegenstände, Bäume, Explosionen |

### Modi, Aufgaben und Fortschritt

| Modul | Aufgabe |
|---|---|
| `modes.js` | Spielmodi mit Siegbedingung |
| `scenarios.js`, `levels/` | Kampagne und handgebaute Level |
| `daily.js` | Tagesschacht |
| `missions.js`, `questui.js`, `coop.js` | Aufträge in der Runde, Tracker, Team-Aufgaben im Koop |
| `achievements.js` | Erfolge |
| `teams.js`, `versus.js`, `bots.js` | Teams, Versus-Regeln, Bots |
| `stats.js`, `scoreboard.js` | Statistik und Punktetafel im Mehrspieler |
| `reward.js` | Sichtbare Belohnungen (fliegende Münzen) |

### Einstieg und Hilfen

| Modul | Aufgabe |
|---|---|
| `veil.js`, `tutorial.js`, `tutsteps.js`, `tutlevel.js` | Erster Start und „Die erste Schicht“ |
| `lessons.js` | Tipps zur rechten Zeit |
| `startcue.js`, `castlecue.js`, `arrow.js` | Hinweise in den ersten Sekunden, Zielpfeil |
| `analytics.js` | Ereignisse für Funnels, siehe [ANALYTICS.md](ANALYTICS.md) |

### Darstellung und Ton

| Modul | Aufgabe |
|---|---|
| `render.js` | Zeichnen der Welt |
| `ui.js` | HUD, Fenster, kleine Karte |
| `sprites.js`, `bldart.js`, `diggerhi.js`, `portrait.js`, `uiart.js` | Pixel-Art von Figuren, Gebäuden, Logo und Rahmen |
| `tex.js`, `under.js`, `decor.js`, `props.js` | Materialtexturen und Details |
| `light.js`, `backdrop.js`, `effects.js`, `bfx.js`, `floats.js` | Licht, Hintergrund, Effekte, schwebende Texte |
| `announce.js` | Meldungen und Bildschirmwackeln für alle |
| `sound.js`, `music.js`, `ambience.js` | Klänge, Musik, Hintergrundgeräusche (alles erzeugt) |

### Lobby

`lobby.js` mit `lobbyscene.js`, `lobbyworkers.js`, `lobbyname.js`, `lobbyinvite.js`,
`lobbyfriends.js` und den `*.css`-Dateien; `install.js` bietet die Installation als App an.

### Mehrspieler (`src/net/` und `server/`)

| Modul | Aufgabe |
|---|---|
| `transport.js` | WebSocket zum Relay, verbindet sich selbst neu |
| `room.js`, `countdown.js`, `rotation.js` | Räume, Schnell spielen, Modus der Stunde |
| `session.js`, `host.js`, `client.js` | Ablauf einer geteilten Runde |
| `sync.js`, `terrain.js` | Was der Host verschickt: Figuren und Gelände |
| `netsave.js` | Geteilte Runde speichern |
| `watch.js` | Zuschauen statt mitspielen |
| `friends.js`, `emotes.js`, `deeplink.js` | Freunde ohne Login, Zurufe, Einladungen in die App |
| `server/relay.js` | Relay: Räume und Weiterleitung, rechnet selbst kein Spiel |

## Leistung

- **Simulation:** Die Welt ist in Chunks von 32 × 32 Zellen geteilt; nur Chunks, in denen sich
  etwas bewegt hat, werden im nächsten Bild durchlaufen. Ein Tausch weckt Nachbar-Chunks nur, wenn
  er nah an ihrem Rand liegt (`activate` in `world.js`). Zellen, die sich ändern, werden pro Schritt
  einmal gemalt (`beginPaint`/`endPaint`), und nur geänderte Chunks gehen auf die Leinwand.
- **Messen:** `G.perf` und `?fps` zeigen Bilder pro Sekunde und die Kosten eines Schritts und
  eines Bildes; `MPLOAD=1 npx playwright test tests/mpload.spec.js --workers 1` misst den
  Netzverkehr (Zahlen in [MULTIPLAYER_PLAN.md](MULTIPLAYER_PLAN.md)).
- **Kein Web Worker für die Simulation (bewusst, v1.114.0):** Ein Spielschritt kostet in einer
  ruhigen Runde rund 1 ms, die Sandsimulation davon etwa ein Fünftel. Graben, Zeichnen und Netz
  greifen synchron auf dasselbe Zellraster zu; ein Worker bräuchte dafür `SharedArrayBuffer`, und der
  verlangt die Header COOP/COEP, die GitHub Pages nicht setzen kann. Erst wenn Messungen auf
  schwachen Geräten zeigen, dass die Simulation das Bild bremst, lohnt sich der Umbau.

## Tests

`npm test` startet den Entwicklungsserver und spielt in Chromium (`tests/*.spec.js`, über
`debug.js`). In GitHub Actions laufen sie bei jedem Pull Request (`.github/workflows/test.yml`,
auf sechs Jobs verteilt). Bildschirmfotos aus Tests gehören nach `test-results/` oder `tests/out/`,
nicht ins Root (`/*.png` steht in `.gitignore`).
