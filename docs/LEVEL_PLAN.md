# Plan: Vorgebaute Level („Szenarien“ wie im Original-Clonk)

> **Stand: Plan, noch nicht umgesetzt.** Baut auf v1.29.0 auf.

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

- **Zoom** in `level.json` (`zoom: 4` → ein Kartenpixel = 4 × 4 Zellen; 350 × 100 px für die volle
  Welt). Zoom 1 ist erlaubt für pixelgenaue Stellen (wie `Landscape.bmp`).
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
| U9 | *(später, optional)* Weltgröße pro Level: `W`/`H` veränderlich, Arrays beim Laden neu anlegen. Berührt alle Module, die `W`, `H`, `mat` importieren (Live-Bindings reichen, aber Puffer wie `px`, `dirty`, Chunk-Zahlen müssen mitwachsen). | `world.js` + viele | L |

Bis U9 kommt, haben alle Level 1400 × 400. Kleinere Karten entstehen mit Granit-Rändern, die
die Kamera nicht zeigt (eine `bounds`-Angabe in `level.json` begrenzt die Kamera).

---

## 6. Level-Editor (wie der Editor-Modus im Original)

Ein Werkzeug im Spiel, aufrufbar mit `?editor` (zuerst nur für uns, Desktop):

- Malen mit Pinsel, Linie, Rechteck und Füllen, Materialpalette wie in 4.2, Umschalter
  „mit Höhlenwand“. Gemalt wird direkt in die Welt, das Aufrauen sieht man live.
- Objekte setzen und verschieben (Burg, Bäume, Tiere, Truhen, Gegenstände, Gebäude), Bereiche
  aufziehen und benennen.
- Startausrüstung, Regeln und Ziele in einem einfachen Formular.
- **Testspielen** auf Knopfdruck und zurück in den Editor, ohne dass Änderungen verloren gehen.
- Export: `map.png` + `level.json` herunterladen (später: als Link teilen, siehe Etappe 7).

Der Editor nutzt die vorhandenen Bausteine: `setMat`/`paint` zum Malen, `render.js` zum Anzeigen,
`input.js` für Maus und Touch. Er braucht kein Bildprogramm, aber man *kann* ein Level auch in
Aseprite oder GIMP malen, weil das Format ein normales PNG ist.

---

## 7. Inhalte: ein neues Kapitel „Klassiker“

Die 7 vorhandenen Level bleiben als **Kapitel 1** (Sterne im Profil bleiben gültig). Neu kommt
**Kapitel 2** mit 8 handgebauten Leveln, angelehnt an typische Clonk-Szenarien. Reihenfolge nach
Lernkurve:

| # | Level | Idee | Ziel | Was es lehrt/prüft |
|---|---|---|---|---|
| 1 | Wipfrettung | Wipfe sitzen in Höhlen unter einem Hügel, Zugänge teils mit Fels verschlossen | 4 Wipfe zur Burg bringen | Graben, Sprengen, Tragen |
| 2 | Die alte Mine | Verlassene Mine mit Schächten, morschen Balken, Grubenbahn-Resten und Gas | 25 Gold verkaufen | Stützbalken, Gas, Grubenbahn |
| 3 | Insel im See | Kleine Insel, wenig Holz, Gold auf der Nachbarinsel | 600 Taler | Floß, Brücken, Holz sparen |
| 4 | Labyrinth | Ein Höhlensystem mit Sackgassen und Wasserfallen, 5 Truhen | alle Truhen | Orientierung, Karte, Wasser ablassen |
| 5 | Feuerinsel | Vulkaninsel, Lava steigt nach Auslöser-Zeit | Schatz bergen und überleben | Zeitdruck, Lava umleiten |
| 6 | Säuresee | Der Weg zum Erz führt unter einem Säuresee durch | 15 Erz ins Lager | Lehmwände, vorsichtig graben |
| 7 | Gipfelsturm | Hoher Berg (mit Granit-Kern), oben ein Turm-Bauplatz | `reach` Gipfel + Turm bauen | Treppen, Fahrstuhl, Seilbahn |
| 8 | Die Schlucht | Zwei Plateaus über einer tiefen Schlucht | Luftschiff bauen und rüberfliegen | gesamte Produktionskette |

Dazu **3 Mehrspieler-Karten** (in der Lobby bei Koop/Versus wählbar, statt Zufallswelt):

| Karte | Modus | Idee |
|---|---|---|
| Zwei Burgen | Versus | Symmetrisch gespiegelt, Gold in der Mitte unter einem Felsriegel |
| Wettgraben | Versus | Wer zuerst unten ankommt, Seitenwege mit Truhen |
| Expedition | Koop | Große Karte, Burg links, Ziel ganz rechts tief unten, nur gemeinsam in der Zeit zu schaffen |

Jedes Level bekommt beim Bauen eine **Spielzeit-Messung** (Testrunden), daraus die Sternzeiten.

---

## 8. Etappen

| Etappe | Inhalt | Ergebnis | Aufwand |
|---|---|---|---|
| 1 | U1, U2, U3, U8: `gen()` aufteilen, Loader, Palette, Aufrauen; Tutorial-Welt als erstes Paket | Tutorial spielt sich wie vorher, kommt aber aus `map.png` | M |
| 2 | U4: Ziele, Niederlage, Auslöser; HUD für Teilziele | Level 1 „Wipfrettung“ spielbar | M |
| 3 | U5, U7: Speicherstand, Lobby mit Kapiteln und Vorschaubildern | Kapitel 2 in der Lobby, Freischalten | S–M |
| 4 | Tests (Abschnitt 9) | Jedes Level wird bei `npm test` geladen und geprüft | S |
| 5 | Level-Editor | Level ohne Code bauen und testspielen | M–L |
| 6 | Inhalte: restliche 7 Level, Sternzeiten aus Testrunden, Texte DE/EN | Kapitel 2 fertig | L (Design-Arbeit) |
| 7 | U6 + Mehrspieler-Karten | 3 Karten für Koop/Versus | S–M |
| 8 | *(optional)* Eigene Level teilen: Export als Datei oder Link (komprimiert im Link-Fragment), Import in der Lobby; nur Daten, nie Code. U9 (Weltgröße). | Community-Level | M / L |

Etappen 1–4 sind das Fundament (ein Release). Ab Etappe 5 lassen sich Editor und Inhalte
parallel bauen. Die ersten Level können schon vor dem Editor in einem Bildprogramm gemalt werden.

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
| Geteilte Level als Angriffsweg | Nur Daten (JSON + PNG), feste Größenobergrenze, kein Code aus Dateien |

---

## 11. Offene Fragen

1. Soll der **Editor für Spieler** freigeschaltet werden (eigener Menüpunkt), oder bleibt er erst
   einmal ein Werkzeug für uns?
2. Sollen die **7 vorhandenen Level** bleiben wie sie sind, oder nach und nach auf Handkarten
   umgebaut werden (Sterne bleiben, aber die Welt ändert sich)?
3. **Level teilen** (Etappe 8): gewünscht, und wenn ja, nur per Datei/Link oder mit einer
   Levelliste auf `play.kiez-power.de`?
4. Ist **variable Weltgröße** (U9) wichtig genug für den großen Umbau, oder reichen
   1400 × 400 mit Granit-Rändern?
