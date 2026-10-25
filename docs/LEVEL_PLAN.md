# Plan: Vorgebaute Level („Szenarien“ wie im Original-Clonk)

> **Stand: Etappen 1–6 umgesetzt (v1.33.0–v1.35.0), Etappen 7–8 offen.** Entscheidungen siehe
> Abschnitt 11. Wie man ein Level baut: `docs/LEVELS.md`.
>
> Abweichungen in Etappe 6:
> - Der Editor ist eine eigene Seite (`/editor.html`, nur Entwicklungsserver, nicht im Build)
>   statt ein Modus im Spiel. Er malt die Textkarte; Aufrauen und Zufalls-Zonen sieht man beim
>   Probespielen. Gespeichert wird über einen Endpunkt des Entwicklungsservers (`vite.config.js`).
> - **Die 7 alten Level werden über Prüfsummen eingefroren, nicht als gespeicherte Welten**
>   (U10). Gespeicherte Welten hätten das Spiel um mehrere hundert KB vergrößert; der Test
>   `tests/levels.spec.js` schlägt an, sobald eine Änderung am Generator eines der Level verändert.
>
> Abweichungen in Etappen 2 bis 5:
> - **Karten als Text (`map.txt`) statt PNG.** Ein Zeichen = ein Material. Grund: lädt ohne
>   Warten (das Erzeugen der Welt bleibt synchron), Änderungen sind im Diff lesbar, und Level
>   lassen sich ohne Bildprogramm bauen und im Test prüfen. Zoom, Aufrauen und Zufalls-Zonen (`?`)
>   wie geplant.
> - **Das Tutorial bleibt im Code** (`tutlevel.js`), statt Level-Paket zu werden (U8 entfällt):
>   Es läuft gut, hat eigene Tests, und Spieler hätten nichts davon.
> - Der Bildzähler wird beim Erzeugen auf ungerade gesetzt (`settle()` in `gen.js`); damit kommt
>   dieselbe Welt aus demselben Seed immer gleich heraus. Freie Welten mit 1400 × 400 bleiben
>   bitgenau wie vorher.
> - Ziele (`goals`) sind eine Liste, die ganz erfüllt sein muss (kein `any`); die Anzeige nennt
>   das erste offene Ziel. Mehr hat noch kein Level gebraucht.
> - Eingeschlossene Wipfe (`lost`) laufen nicht vor ihrem Retter weg und blinken auf der Karte.
> - Kapitel 2 ist von Anfang an offen (das erste Level), unabhängig von Kapitel 1.
> - Die Lobby zeigt die Kapitel als Abschnitte mit eigenen Sternen; Vorschaubilder der Karten
>   gibt es nicht, die Levelliste behält ihre Symbole (wenig Nutzen auf dem kleinen Platz).
> - Speicherstände tragen den Level-Zustand (`G.lvl`) und alle Verkäufe je Art (`G.sold`).
>
> Abweichungen und Erkenntnisse aus Etappe 1:
> - Welten mit 1400 × 400 bleiben bitgenau wie vorher (geprüft mit Prüfsummen von v1.29.0 für
>   freies Spiel, Versus und zwei Kampagnen-Level, `tests/worldsize.spec.js`). Andere Größen
>   bekommen Höhlen, Adern, Steine, Gas und Tiere passend zur Fläche, Bäume, Truhen und Wolken
>   passend zur Breite; der Boden liegt bei 30 % der Höhe, niedrige Welten haben flachere Hügel.
> - **Gefunden:** Der Fallsand beim Erzeugen rechnet je nach Bildzähler (`G.frame`, gerade oder
>   ungerade) nach links oder rechts. Dieselbe Welt aus demselben Seed ist darum nur gleich, wenn
>   gleich viele Bilder davor liefen. Das gab es schon vorher und betrifft heute nichts (im
>   Mehrspieler schickt der Host den Boden). Für Level und den Determinismus-Test in Abschnitt 9
>   muss Etappe 2 den Zähler beim Erzeugen festsetzen.
> - Das Weltbild liegt in einem Pixelpuffer und wird in Kacheln mit 1024 × 1024 Texeln gezeigt
>   (`drawWorld`). Geänderte Chunks gehen in die Kachel, in der sie liegen.
> - Himmel, Sonne, Wolken, Vögel und die Hügel im Hintergrund wandern mit dem Boden nach unten,
>   wenn er tiefer liegt als in Zeile 120.
> - Übersichtskarte: ein Viertel der Weltgröße; die kleine Karte in der Ecke zeigt die ganze Welt
>   eingepasst, die große Karte höchstens 60 % der Bildschirmhöhe.
> - Mehrspieler: Die Start-Nachricht trägt die Größe, Nachzügler bekommen die aktuelle Größe.
>   Geprüft mit lokalem Relay, Host, Gast und Nachzügler in 900 × 350 (keine Fehler, Boden zu
>   99,9 % gleich, der Rest ist fließendes Wasser). Diese Prüfung ist kein automatischer Test.
> - Speicherstände tragen `w`/`h`; alte ohne diese Angaben laden als 1400 × 400.
> - Zum Ausprobieren im Entwicklungsserver: `?size=700x300`.

Ziel: Neben den Zufallswelten gibt es **von Hand gestaltete Level**. Jedes hat eine eigene
Landschaft, eigene Startbedingungen, ein eigenes Ziel und kleine Ereignisse, so wie die Szenarien
im Original-Clonk. Ein Level soll sich anfühlen wie ein Ort, den jemand gebaut hat, und nicht wie
ein Seed mit Aufgabe.

---

## 1. Wie das Original es gemacht hat

In Clonk (ab Clonk 4 über Endeavour und Planet bis OpenClonk) ist jedes Spiel ein **Szenario**.
Das ist ein Ordner (`.c4s`) mit wenigen, klar getrennten Teilen:

| Teil im Original | Inhalt | Was Flintworks davon übernimmt |
|---|---|---|
| `Scenario.txt` | Kopfdaten (Titel, Schwierigkeit), Spielziele und Regeln, Startausrüstung pro Spieler (Crew, Material, **Baupläne/Wissen**), Landschaftsparameter (Breite, Vegetation, Wetter, Vulkane, Meteore) | ✅ als `level.json` |
| `Map.bmp` (statische Karte) | Ein kleines Bild mit Farbpalette: **jeder Pixel = ein Material** und steht für 8×8 Landschaftspixel (MapZoom). Paletten-Index ≥ 128 bedeutet „unterirdisch“, also Höhle oder Tunnel mit Hintergrund. Beim Laden wird die Karte hochgerechnet und an den Rändern **aufgeraut**, damit sie natürlich aussieht. | ✅ Kern des Plans: `map.png` mit Zoom und Aufrauen |
| `Landscape.bmp` | Optional die volle Landschaft Pixel für Pixel (für ganz genau gebaute Level) | ✅ als Option „Zoom 1“ |
| `Landscape.txt` (dynamische Karte) | Ein Kartenskript aus Überlagerungen („overlays“): Höhlen, Erzadern, Seen, per Zufall in Bereichen | ✅ als `fill`-Zonen: Bereiche einer Handkarte, die der normale Generator füllt |
| `Objects.txt` | Alle vorplatzierten Objekte: Gebäude, Fahrzeuge, Tiere, Gegenstände, Crew | ✅ `objects` in `level.json` |
| `Script.c` | Szenarioskript: `Initialize()`, Zeitgeber, Meldungen, Sieg- und Niederlage-Bedingungen, kleine Inszenierungen | ✅ deklarative **Auslöser** (`triggers`), dazu Code-Hooks wie heute `setup`/`tick` |
| `Title.txt`, `Desc.rtf`, `Title.png` | Name, Beschreibungstext und Vorschaubild in der Szenarienauswahl | ✅ Titel, Text, automatisch erzeugtes Vorschaubild |
| Ordner `.c4f` | Szenarien in Kapiteln und Paketen, Freischalten über gelöste Missionen | ✅ Kapitel in der Kampagne |
| Editor-Modus der Engine | Mit Pinsel, Linie, Rechteck und Füllen Material in die Landschaft malen, Objekte setzen, sofort ausprobieren | ✅ eigener Level-Editor (Etappe 5) |

Was die Originale gut gemacht haben und wir übernehmen sollten:

1. **Kleines Kartenbild + Aufrauen.** Ein Level ist schnell gemalt (ein paar hundert Pixel breit),
   sieht im Spiel aber nicht nach Klötzchen aus.
2. **Daten statt Code.** Ein Szenario ist größtenteils Konfiguration. Skript braucht man nur für
   Besonderes.
3. **Startausrüstung als Werkzeug fürs Level-Design.** Was erforscht ist, was im Lager liegt und
   welche Gebäude schon stehen, bestimmt das Rätsel genauso wie die Landschaft.
4. **Gemischte Karten.** Feste Form (Berg, Schlucht, Burg) mit zufälligem Inhalt (Erz, Höhlen).
   So bleibt jedes Spiel etwas anders.

Typische Szenario-Arten aus den Clonk-Teilen, die zu Flintworks passen: Rettungsmissionen (die
bekannte „Wipfrettung“), Goldminen mit vorgezeichneten Schächten, Schatzsuche in Höhlenlabyrinthen,
Vulkan- und Inselkarten, Siedlungsaufbau unter Zeitdruck, Wettrennen/Parkour, und symmetrische
Melee- und Belagerungskarten für mehrere Spieler.

> Quelle für diesen Abschnitt ist die Kenntnis der Spiele und ihres Dateiformats, nicht ein
> Nachschlagen im Netz. Für die Umsetzung ist nur das Prinzip wichtig, nicht das genaue Format.

---

## 2. Bestandsaufnahme Flintworks

Es gibt schon eine **Kampagne mit 7 Leveln** (`src/scenarios.js`). Jedes Level ist ein Spielmodus
(`campaign: true` in `GAME_MODES`) mit festem Seed, Biom, Ziel, Sternzeiten, Startlager, Forschung
und manchmal einem `setup()`, das Höhlen gräbt und Wühler oder Monster setzt. Daneben gibt es die
**Tutorial-Welt** (`src/tutlevel.js`): eine normale Zufallswelt, in die per Code ein flacher Weg,
eine Felsnadel und eine Goldader gesetzt werden.

| # | Befund | Folge | Stelle im Code |
|---|---|---|---|
| L1 | Kampagnen-Level sind Zufallswelten mit festem Seed | Die Landschaft ist nicht gestaltet. Ein neuer Generator-Stand ändert alle Level unbemerkt. | `LEVELS[*].seed`, `gen()` |
| L2 | Gestaltete Teile nur per Code | Jede Felsnadel, jede Höhle wird in JS ausgerechnet (`pocket`, `tutlevel.setup`). Nicht malbar, schwer abzustimmen. | `scenarios.js`, `tutlevel.js` |
| L3 | `gen()` erledigt alles in einer Funktion | Zurücksetzen, Landschaft, Burg, Bäume, Crew und Tiere sind nicht getrennt. Ein Level-Loader kann nur einen Teil davon wiederverwenden. | `gen.js:120–333` |
| L4 | Ein Ziel = ein Zahlenwert | `prog()` gegen `goal`. Mehrere Ziele, „und/oder“ oder Niederlage (z. B. „alle Wühler tot“, Zeit um) gibt es nicht. | `modes.js` |
| L5 | Ereignisse nur über `tick()` | Keine Bereiche („wenn ein Wühler hier ankommt …“), keine Zeitgeber, keine Meldungen im Ablauf außer `intro`. | `updScenario` |
| L6 | Feste Weltgröße 1400 × 400 | Kleine Rätsel- oder große Expeditionskarten gehen nicht. `W`/`H` sind Konstanten, die Arrays werden beim Laden des Moduls angelegt. | `world.js:5` |
| L7 | Burg immer bei x = 72 | Level mit Start mitten in der Karte, auf einem Berg oder ohne Burg gehen nicht. | `gen.js` (`G.base`) |
| L8 | Keine Prüfung, ob ein Level schaffbar ist | Fehler fallen erst beim Spielen auf. | `tests/` |

Was schon passt und bleibt:

- **Speicherstand** (`save.js`) schreibt die Welt als Lauflängen-Code und alle Objekte als JSON.
  Ein laufendes Level wird also schon richtig gespeichert. Es fehlt nur `levelId` + Version.
- **Mehrspieler** schickt Seed und Einstellungen, jeder Client erzeugt die Welt selbst. Für ein
  Level schickt der Host stattdessen `levelId` + Version. Für Nachzügler gibt es schon das Vollbild
  über `deserialize`.
- **Sterne und Freischalten** im Profil (`P.campaign`) und die Levelliste in der Lobby
  (`campaignPanel`) lassen sich erweitern.
- **Materialien** sind 14 feste Werte (`AIR … GEM`) plus Hintergrund-Bit, also genau das, was eine
  Palette im Kartenbild braucht.

---

## 3. Design-Prinzipien

1. **Ein Level ist Daten.** `map.png` + `level.json`. Code nur für echte Sonderfälle, und dann
   als benannter Hook, nicht im Level selbst (wichtig, falls später Spieler Level teilen).
2. **Malen statt rechnen.** Wer ein Level baut, malt es in einem Bildprogramm oder im Editor. Er
   schreibt keine Koordinaten in JS.
3. **Handarbeit sieht natürlich aus.** Grobe Karte + Aufrauen + Bodenschichten wie im freien
   Spiel. Kein Level sieht nach Lego aus.
4. **Fest, wo es zählt, und zufällig, wo es Abwechslung bringt.** Pro Bereich entscheidbar.
5. **Jedes Level ist geprüft.** Ein automatischer Test lädt jedes Level und prüft, ob man zu jedem
   Ziel hinkommt.
6. **Bestehendes bleibt.** Freies Spiel, Tutorial, die 7 Kampagnen-Level und alte Speicherstände
   funktionieren weiter.

---

## 4. Das Level-Format

### 4.1 Dateien

```
src/levels/
  index.js               Liste der Kapitel und Level (Reihenfolge, Freischalten)
  wipfrettung/
    map.png              Kartenbild (Palette siehe 4.2)
    level.json           alles andere (4.3)
    level.js             optional: Code-Hooks für Sonderfälle
```

Die Dateien kommen in den Build (Vite-Import, `?url` für das PNG). Sie liegen also offline in der
Web-App und in der APK und brauchen keinen Server.

### 4.2 Kartenbild `map.png`

- **Zoom** in `level.json` (`zoom: 4` → ein Kartenpixel = 4 × 4 Zellen; bei einer Welt von
  1400 × 400 ist das Bild 350 × 100 px groß). Bildgröße × Zoom muss `size` ergeben, sonst meldet der
  Loader einen Fehler. Zoom 1 ist erlaubt für pixelgenaue Stellen (wie `Landscape.bmp`).
- **Farbe → Material**, feste Tabelle (in `src/levels/palette.js`, im Editor und als Bild in der
  Doku):

| Farbe | Material | | Farbe | Material |
|---|---|---|---|---|
| `#000000` | Luft (Himmel) | | `#3b3640` | Granit (unzerstörbar) |
| `#202020` | Luft mit Höhlenwand | | `#e8b923` | Gold |
| `#8a5a32` | Erde | | `#b0603a` | Erz |
| `#6f6a64` | Fels | | `#222a2a` | Kohle |
| `#d9b56a` | Sand | | `#c06080` | Edelstein |
| `#a0703a` | Lehm | | `#3b7fc4` | Wasser |
| `#ff4010` | Lava | | `#80ff20` | Säure |
| `#ff00ff` | **Zufall:** wie im freien Spiel füllen | | `#00ffff` | **Gas** (Grubengas-Tasche) |

  Unbekannte Farben werden beim Laden gemeldet (Konsole und Test), nicht still geschluckt.
- **Aufrauen beim Hochrechnen:** An Grenzen zwischen zwei Materialien wird pro Zelle mit
  geglättetem Rauschen (`rough` 0–1 in `level.json`, Seed fest pro Level) entschieden, welche Seite
  sie bekommt. Granit, Wasser und Lava werden nicht aufgeraut, damit Becken dicht bleiben und
  Grenzen fest. Danach laufen dieselben Schritte wie in `gen()`: Bodenschicht an der Oberfläche
  (`shade |= 4`), `surf[]` neu berechnen, 60 Simulationsschritte, damit Sand und Wasser sich setzen.
- **Zufalls-Zonen (`#ff00ff`):** Diese Bereiche füllt der normale Generator mit Erde, Steinen,
  Höhlen und Adern. Wie viel davon, steuert `fill` in `level.json`. So geht „feste Berg-Silhouette,
  zufälliges Innenleben“ wie beim `Landscape.txt` des Originals.

### 4.3 `level.json`

```json
{
  "id": "wipfrettung",
  "v": 1,
  "name": "Wipfrettung",
  "desc": "Bring {goal} Wipfe heil zur Burg",
  "intro": "In den Höhlen unter dem Hügel sitzen Wipfe fest …",
  "biome": "meadow",
  "size": [1024, 384],
  "zoom": 4,
  "rough": 0.5,
  "seed": 8101,
  "diff": "adventure",
  "fill": { "rock": 0.6, "caves": 0.4, "gold": 1, "ore": 0.5 },
  "start": {
    "money": 60,
    "research": ["mech"],
    "store": { "plank": 4 },
    "crew": 3,
    "inv": [["flint", "rock"], ["loam"], []]
  },
  "rules": { "events": ["quake"], "evRate": 1, "meteors": false, "rain": 0.5, "monsters": false },
  "objects": [
    { "t": "base", "x": 60 },
    { "t": "tree", "x": 140, "stage": 4 },
    { "t": "animal", "kind": "wipf", "x": 520, "y": 210, "tag": "lost" },
    { "t": "chest", "x": 900, "y": 300 },
    { "t": "item", "kind": "tnt", "x": 300, "y": 180 },
    { "t": "build", "type": "hut", "x": 190, "done": true }
  ],
  "areas": { "home": [40, 100, 80, 60], "cave": [480, 180, 120, 60] },
  "goals": { "all": [{ "t": "rescue", "tag": "lost", "n": 4, "to": "home" }] },
  "lose": { "any": [{ "t": "crewDead" }, { "t": "time", "min": 30 }] },
  "stars": [8, 14],
  "triggers": [
    { "when": { "t": "enter", "area": "cave" }, "once": true, "do": [{ "t": "say", "text": "Da hinten piepst etwas!" }] },
    { "when": { "t": "after", "min": 6 }, "do": [{ "t": "event", "kind": "quake" }] }
  ]
}
```

Alle Texte laufen wie gewohnt über `tr()`. Die deutschen Texte sind die Schlüssel in `i18n.js`.

### 4.4 Ziele, Niederlagen, Auslöser

Ziele ersetzen das bisherige `prog/goal`, das alte Format bleibt aber gültig (ein Ziel = `prog`).

| Ziel-Typ | Bedeutung | Gibt es schon als Zähler |
|---|---|---|
| `money` | Taler erreichen | `G.money` |
| `sell` | X Stück eines Rohstoffs verkaufen | `G.goldSold` (verallgemeinern) |
| `rescue` | markierte Wühler/Tiere befreien, optional bis in einen Bereich bringen | `G.rescued` |
| `kills` | Monster besiegen | `G.kills` |
| `depth` | Tiefe erreichen | `depthOf` |
| `build` | bestimmte Gebäude/Fahrzeuge errichten | Siedler-Modus, `vehicles` |
| `chests` | Schatztruhen finden | `G.chestsFound` |
| `reach` | ein Wühler erreicht einen Bereich (Parkour, Expedition) | neu |
| `collect` | X Gegenstände einer Art ins Lager | neu (`G.store`) |
| `survive` | X Minuten durchhalten | neu |

`all` / `any` verknüpfen Ziele. Die Fortschrittsanzeige im HUD zeigt jedes Teilziel als kleine
Zeile (heute eine Zahl).

Auslöser (`triggers`) bestehen aus einer Bedingung (`enter`, `after`, `goal` erreicht,
`count`, `destroyed`, `flag`) und Aktionen (`say`, `spawn`, `event`, `unlock` (Forschung),
`setFlag`, `camera` (kurz zu einem Punkt schwenken), `win`, `lose`). Sie werden alle halbe Sekunde
in `updScenario` geprüft, nur auf dem Host. Was mehr braucht, kommt als Hook in `level.js`
(`setup`, `tick`, `onGoal`), so wie heute `rescueTick`.

---

## 5. Umbau im Code

| # | Umbau | Dateien | Aufwand |
|---|---|---|---|
| U1 | `gen()` aufteilen: `resetWorld()` (Arrays, Zähler, Listen), `genTerrain()` (Landschaft), `populate()` (Burg, Bäume, Crew, Tiere, Wolken). Freies Spiel ruft alle drei, ein Level nur `resetWorld` + `loadMap` + `placeObjects` + Teile von `populate`. | `gen.js` | M |
| U2 | `src/levels/loader.js`: PNG über ein `OffscreenCanvas` lesen, Palette auflösen, hochrechnen und aufrauen, Zufalls-Zonen füllen, Objekte setzen | neu | M |
| U3 | Burg-Position frei (`objects` → `base`), Kamera-Start und Helfer-Heimweg an `G.base` statt an x = 72/90 | `gen.js`, `scenarios.js` (`baseX`), `helpers.js`, `render.js` | S |
| U4 | Ziele/Niederlage/Auslöser als kleine Engine; `goalReached` und HUD-Fortschritt darauf umstellen; alte Modi als Ein-Ziel-Fall | `modes.js`, `scenarios.js`, `ui.js` | M |
| U5 | Speicherstand: `levelId`, `levelV`, Auslöser-Zustand (`fired`, Flags) speichern. Beim Laden eines Spielstands mit älterer Level-Version spielt man trotzdem weiter (die Welt steckt ja im Speicherstand). | `save.js` | S |
| U6 | Mehrspieler: Start-Nachricht mit `levelId` + `v`; Client mit fehlendem/anderem Level bekommt das Vollbild | `main.js` (`playNet`), `net/session.js` | S |
| U7 | Lobby: Kapitel als Reiter, pro Level Vorschaubild (aus `map.png` mit Biom-Farben gerendert), Beschreibung, Sterne, Bestzeit | `scenarios.js`, `lobby.js`, `lobby.css` | M |
| U8 | Tutorial-Welt als erstes echtes Level-Paket (`tut/map.png`), `tutlevel.js` behält nur noch Positionen und Prüfungen (`rockOpen`, `tidyRock`) | `tutlevel.js` | S |
| U9 | Weltgröße pro Level (Abschnitt 5.1) | `world.js`, `tex.js`, `light.js`, `ui.js`, `render.js`, `net/terrain.js`, `gen.js`, `save.js` | L |
| U10 | Alte Kampagnen-Level einfrieren (Abschnitt 7.1) | `scenarios.js`, `src/levels/` | S |

### 5.1 Verschiedene Weltgrößen (U9)

Heute ist die Welt fest 1400 × 400 Zellen. `W` und `H` sind Konstanten in `world.js`, und alle
Puffer werden einmal beim Laden des Moduls angelegt. 19 Module importieren `W`/`H`.

**Größen:** `size: [w, h]` in `level.json`. Breite 300–2800, Höhe 150–700 (die Chunk-Zahlen werden
wie heute aufgerundet, die Größe muss also kein Vielfaches von 32 sein). Freies Spiel und Mehrspieler-Zufallswelten bleiben bei 1400 × 400.
Die Obergrenze ergibt sich aus dem Speicher auf dem Handy. Pro Zelle liegen heute rund 31 Byte in
Puffern (`mat`, `bg`, `shade`, `stamp`, `fresh`, die Schattierung `WSH`, `sent` und 4 Texel im
Weltbild). 2800 × 700 sind knapp 2 Mio. Zellen, also rund 60 MB. Das ist das Maximum, das wir
auf älteren Android-Geräten vertreten.

**Umbau:**

| Schritt | Was | Wo |
|---|---|---|
| a | `W`, `H`, `mat`, `bg`, `shade`, `stamp`, `surf`, `fresh`, Chunk-Zahlen (`CWn`, `CHn`) und Chunk-Puffer werden `export let`. `resizeWorld(w, h)` legt alles neu an. ES-Module sehen die neuen Werte über Live-Bindings, Code wie `mat[y * W + x]` muss sich also nicht ändern. | `world.js` |
| b | Module, die beim Laden eigene Puffer nach `W`/`H` anlegen, melden sich mit `onResize(fn)` an: Lichtspalten `colTop`, Schattierung `worldShade`, Netz-Puffer `sent`/`liqT`. | `light.js`, `tex.js`, `net/terrain.js` |
| c | **Weltbild in Kacheln:** Heute ist es *eine* Leinwand mit 2800 × 800 Texeln. Bei 2800 Zellen Breite wären es 5600 Texel, und viele Handy-GPUs schaffen nur 4096. Darum wird das Bild in Kacheln von 1024 × 1024 Texeln aufgeteilt; `render.js` zeichnet die 1–4 Kacheln im Bild. Der Upload der geänderten Chunks (`flush`) geht in die jeweilige Kachel. | `world.js`, `render.js` |
| d | Übersichtskarte rechnet mit `W/4 × H/4` statt fest 350 × 100 und passt das Kartenfenster an das Seitenverhältnis an | `ui.js` |
| e | Feste Annahmen über die Größe ersetzen: Oberflächen-Höhe 120 im Generator, Granitboden bei `H - 9`, Kamera-Grenzen, Tiefe in Metern, Wolken- und Vogelbereich, Ränder für Meteore | `gen.js`, `render.js`, `weather.js`, `hazards.js`, `scenarios.js` |
| f | Speicherstand und Mehrspieler-Vollbild enthalten `w`/`h`; `deserialize` ruft vorher `resizeWorld`. Alte Speicherstände ohne `w`/`h` laden als 1400 × 400. | `save.js`, `net/session.js` |

**Absichern:** Der Umbau kommt als **eigene Etappe vor dem Loader** (Etappe 1), mit nur dem
Größenwechsel und ohne Level. Er wird geprüft, indem das freie Spiel mit `?size=700x300` und
`?size=2800x700` startet (nur im Entwicklungsmodus). Dabei laufen alle vorhandenen Tests, das
Graben durch jedes Material, das Tutorial und ein Mehrspieler-Spiel. Erst dann kommen die Level
dazu.

---

## 6. Level-Editor (wie der Editor-Modus im Original)

Ein Werkzeug **nur für uns**: Es gibt ihn nur im Entwicklungsserver (`npm run dev`, dann
`?editor`), er wird über `import.meta.env.DEV` eingebunden und kommt so nicht in die Web-Version
und nicht in die APK. Am Desktop bedient, übers WLAN aber auch auf dem Handy testbar.

- Malen mit Pinsel, Linie, Rechteck und Füllen, Materialpalette wie in 4.2, Umschalter
  „mit Höhlenwand“. Gemalt wird direkt in die Welt, das Aufrauen sieht man live.
- Objekte setzen und verschieben (Burg, Bäume, Tiere, Truhen, Gegenstände, Gebäude), Bereiche
  aufziehen und benennen.
- Startausrüstung, Regeln und Ziele in einem einfachen Formular.
- **Testspielen** auf Knopfdruck und zurück in den Editor, ohne dass Änderungen verloren gehen.
- Weltgröße einstellen (vergrößern oder beschneiden, an jeder Seite).
- Export: `map.png` + `level.json` direkt in `src/levels/<id>/` speichern (ein kleiner Vite-Endpunkt
  im Entwicklungsserver) oder herunterladen.

Der Editor nutzt die vorhandenen Bausteine: `setMat`/`paint` zum Malen, `render.js` zum Anzeigen,
`input.js` für Maus und Touch. Er braucht kein Bildprogramm, aber man *kann* ein Level auch in
Aseprite oder GIMP malen, weil das Format ein normales PNG ist.

---

## 7. Inhalte: ein neues Kapitel „Klassiker“

### 7.1 Die vorhandenen 7 Level

**Entscheidung:** Sie bleiben, wie man sie heute spielt, werden aber **eingefroren**. Der Editor
erzeugt jede Welt einmal aus ihrem Seed und speichert sie als Level-Paket mit Zoom 1 (das Bild ist
die Welt Pixel für Pixel). `setup()`, Forschung, Lager und Ziele wandern nach `level.json` bzw. als
Hook nach `level.js`. Danach hängen sie nicht mehr am Zufallsgenerator: Wenn wir später `gen()`
ändern, bleiben die Kampagnen-Level gleich, und die Sternzeiten stimmen weiter. Die IDs `c1`–`c7`
bleiben, damit die Sterne im Profil gültig bleiben. Umgestalten kann man sie danach im Editor
nach und nach, das ist aber kein Teil dieses Plans.

### 7.2 Kapitel 2 „Klassiker“

Die 7 vorhandenen Level bilden **Kapitel 1**. Neu kommt
**Kapitel 2** mit 8 handgebauten Leveln, angelehnt an typische Clonk-Szenarien. Reihenfolge nach
Lernkurve. Die Größen sind Startwerte für den Entwurf: kleine Karten für Rätsel, große für
Expeditionen.

| # | Level | Größe | Idee | Ziel | Was es lehrt/prüft |
|---|---|---|---|---|---|
| 1 | Wipfrettung | 800 × 300 | Wipfe sitzen in Höhlen unter einem Hügel, Zugänge teils mit Fels verschlossen | 4 Wipfe zur Burg bringen | Graben, Sprengen, Tragen |
| 2 | Die alte Mine | 1000 × 600 | Verlassene Mine mit Schächten, morschen Balken, Grubenbahn-Resten und Gas | 25 Gold verkaufen | Stützbalken, Gas, Grubenbahn |
| 3 | Insel im See | 1600 × 350 | Kleine Insel, wenig Holz, Gold auf der Nachbarinsel | 600 Taler | Floß, Brücken, Holz sparen |
| 4 | Labyrinth | 1200 × 600 | Ein Höhlensystem mit Sackgassen und Wasserfallen, 5 Truhen | alle Truhen | Orientierung, Karte, Wasser ablassen |
| 5 | Feuerinsel | 1000 × 450 | Vulkaninsel, Lava steigt nach Auslöser-Zeit | Schatz bergen und überleben | Zeitdruck, Lava umleiten |
| 6 | Säuresee | 1200 × 500 | Der Weg zum Erz führt unter einem Säuresee durch | 15 Erz ins Lager | Lehmwände, vorsichtig graben |
| 7 | Gipfelsturm | 900 × 700 | Hoher Berg (mit Granit-Kern), oben ein Turm-Bauplatz | `reach` Gipfel + Turm bauen | Treppen, Fahrstuhl, Seilbahn |
| 8 | Die Schlucht | 2400 × 500 | Zwei Plateaus über einer tiefen Schlucht | Luftschiff bauen und rüberfliegen | gesamte Produktionskette |

Dazu **3 Mehrspieler-Karten** (in der Lobby bei Koop/Versus wählbar, statt Zufallswelt):

| Karte | Modus | Größe | Idee |
|---|---|---|---|
| Zwei Burgen | Versus | 1600 × 400 | Symmetrisch gespiegelt, Gold in der Mitte unter einem Felsriegel |
| Wettgraben | Versus | 1000 × 700 | Wer zuerst unten ankommt, Seitenwege mit Truhen |
| Expedition | Koop | 2800 × 700 | Große Karte, Burg links, Ziel ganz rechts tief unten, nur gemeinsam in der Zeit zu schaffen |

Jedes Level bekommt beim Bauen eine **Spielzeit-Messung** (Testrunden), daraus die Sternzeiten.

---

## 8. Etappen

| Etappe | Inhalt | Ergebnis | Aufwand |
|---|---|---|---|
| 1 | U9: verschiedene Weltgrößen, Weltbild in Kacheln | Freies Spiel läuft unverändert, im Entwicklungsmodus auch mit `?size=…`; alle Tests grün | L |
| 2 | U1, U2, U3, U8: `gen()` aufteilen, Loader, Palette, Aufrauen; Tutorial-Welt als erstes Paket | Tutorial spielt sich wie vorher, kommt aber aus `map.png` | M |
| 3 | U4: Ziele, Niederlage, Auslöser; HUD für Teilziele | Level 1 „Wipfrettung“ spielbar | M |
| 4 | U5, U7: Speicherstand, Lobby mit Kapiteln und Vorschaubildern | Kapitel 2 in der Lobby, Freischalten | S–M |
| 5 | Tests (Abschnitt 9) | Jedes Level wird bei `npm test` geladen und geprüft | S |
| 6 | Level-Editor (nur Entwicklungsserver), danach U10: alte Level einfrieren | Level ohne Code bauen und testspielen; `c1`–`c7` hängen nicht mehr am Generator | M–L |
| 7 | Inhalte: restliche 7 Level, Sternzeiten aus Testrunden, Texte DE/EN | Kapitel 2 fertig | L (Design-Arbeit) |
| 8 | U6 + Mehrspieler-Karten | 3 Karten für Koop/Versus | S–M |

Jede Etappe ist ein eigener PR. Etappe 1 kommt zuerst und allein, weil sie am meisten bestehenden
Code berührt; danach baut alles andere auf festem Grund. Etappen 1–5 sind das Fundament. Ab
Etappe 6 lassen sich Editor und Inhalte parallel bauen. Die ersten Level können schon vor dem
Editor in einem Bildprogramm gemalt werden.

**Nicht in diesem Plan:** Level mit anderen Spielern teilen oder importieren und der Editor als
Menüpunkt für Spieler. Das Format ist so gebaut, dass beides später ohne Umbau dazukommen kann
(nur Daten, kein Code in Level-Dateien).

---

## 9. Tests

- **`tests/levels.spec.js`:** lädt jedes Level-Paket im Browser und prüft, dass keine Fehler
  auftreten, alle Farben bekannt sind, die Burg auf festem Boden steht, die Crew nicht im Material
  steckt und alle Objekte in der Welt liegen.
- **Erreichbarkeit:** mit `pathfind.js` (Graben erlaubt, Granit nicht) von der Burg zu jedem
  Ziel-Objekt und jedem `reach`-Bereich. Ein Level, dessen Ziel hinter Granit liegt, fällt durch.
- **Determinismus:** Dasselbe Level zweimal laden → gleiche Welt (Prüfsumme über `mat`). Das ist
  wichtig für Mehrspieler.
- **Bildtest:** `tests/visual.mjs` macht pro Level einen Screenshot vom Start, damit man
  Aufrau-Fehler sofort sieht.
- **Bot-Durchlauf** wie beim Tutorial (`tutorial-bot.js`) nur für Level 1, als Stichprobe.

---

## 10. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Aufrauen zerstört gewollte Stellen (Engpässe, Becken) | `rough` pro Level, Granit/Flüssigkeiten nie aufrauen, Zoom-1-Bereiche für Präzision, Bildtest |
| Sand und Wasser setzen sich anders als gemalt | 60 Simulationsschritte beim Laden (wie in `gen()`), Editor zeigt den Zustand danach |
| Helfer-KI verhält sich in engen Handkarten seltsam | Erreichbarkeits-Test; Level 1–2 früh mit Helfern spielen |
| Level veralten bei Änderungen an Physik oder Preisen | Versionsnummer pro Level, Sternzeiten bei großen Änderungen neu messen |
| Sternzeiten zu streng/zu locker | Messung aus mehreren Testrunden, im Zweifel großzügig |
| Größenwechsel bricht Stellen, die `W`/`H` beim Laden festhalten | `onResize` für alle eigenen Puffer; Suche nach `new …Array(W`, `350`, `100`, `H - ` im Code; Tests mit kleiner und großer Welt |
| Große Welten ruckeln oder sprengen den Speicher auf alten Handys | Obergrenze 2800 × 700; Simulation läuft ohnehin nur in aktiven Chunks; Messung auf einem schwachen Android-Gerät vor Etappe 7 |
| Weltbild zu groß für die GPU | Kacheln mit 1024 × 1024 Texeln (Etappe 1) |
| Speicherstand großer Welten passt nicht in den Browser-Speicher | Lauflängen-Code wie heute; Größe in Test messen (Ziel unter 1 MB) |

---

## 11. Entscheidungen

| Frage | Entscheidung |
|---|---|
| Editor für Spieler? | Nein, erst einmal nur für uns: nur im Entwicklungsserver, nicht in Web-Version und APK |
| Die 7 vorhandenen Level? | Bleiben wie gespielt, werden aber als feste Level-Pakete eingefroren (7.1), Sterne bleiben gültig |
| Level teilen? | Erst einmal nicht |
| Verschiedene Weltgrößen? | Ja, 300–2800 × 150–700, als erste Etappe (5.1) |
