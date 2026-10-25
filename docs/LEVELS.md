# Level bauen

Vorgebaute Level liegen in `src/levels/<id>/`, je ein Ordner mit zwei Dateien. Sie bilden
Kapitel 2 der Kampagne. Die Reihenfolge steht in `src/levels/order.json`. Der Plan dazu ist
`docs/LEVEL_PLAN.md`.

## Der Editor

`npm run dev`, dann `/editor.html` im Browser (nur im Entwicklungsserver, nicht in der
Web-Version oder der App).

- **Level** wählt ein vorhandenes Level, **Neu …** legt eines an (Ordnername, Größe, Zoom).
- **Pinsel**, **Rechteck** und **Füllen** malen das gewählte Material; der Regler stellt die
  Pinselgröße ein. Rechtsklick nimmt das Material unter dem Zeiger, Strg+Z macht rückgängig.
- **Objekt** setzt das gewählte Objekt (Umschalt + Klick entfernt das nächste), **Bereich**
  zieht einen benannten Bereich für Auslöser und Ziele auf.
- Alles andere (Ziele, Auslöser, Start, Regeln) steht im Textfeld `level.json`; **Übernehmen**
  liest es ein. Eine neue Größe schneidet die Karte ab oder setzt sie am Rand fort.
- **Probespielen** startet das Level im Spiel (über `/?draft=1`), „← Editor“ führt zurück.
- **Speichern** schreibt `level.json` und `map.txt` nach `src/levels/<id>/` und hängt ein neues
  Level hinten an `order.json` an. Texte danach in `src/i18n.js` übersetzen.

Karten lassen sich auch von Hand oder mit einem Skript schreiben: es sind normale Textdateien.

| Datei | Inhalt |
|---|---|
| `map.txt` | Die Landschaft als Text: ein Zeichen = ein Material, gezoomt |
| `level.json` | Name, Größe, Start, Regeln, Objekte, Bereiche, Ziele, Auslöser |

## Die Karte (`map.txt`)

Jedes Zeichen steht für `zoom × zoom` Zellen der Welt. Zeilenzahl × Zoom = Höhe, Zeilenlänge ×
Zoom = Breite (`size` in `level.json`), sonst meldet der Loader einen Fehler. Beim Laden werden
die Grenzen zwischen Materialien aufgeraut (`rough`, 0 = exakt wie gemalt), nur Granit,
Flüssigkeiten und Holzplanken behalten ihre Form.

| Zeichen | Material | | Zeichen | Material |
|---|---|---|---|---|
| `.` | Himmel | | `X` | Granit (unzerstörbar) |
| `,` | Höhle / Stollen (Luft mit Rückwand) | | `G` | Gold |
| `#` | Erde | | `O` | Erz |
| `R` | Fels | | `C` | Kohle |
| `S` | Sand | | `E` | Edelstein |
| `L` | Lehm | | `P` | Holzplanke |
| `~` | Wasser | | `%` | Lava |
| `A` | Säure | | `?` | Erde, die der Generator mit Steinen, Adern und Höhlen füllt |

Die Oberfläche ist überall die erste Zelle von oben, die nicht Himmel ist. Gras und die oberste
Bodenschicht kommen von allein.

## `level.json`

```json
{
  "id": "wipfrettung",            // = Ordnername
  "v": 1,                         // erhöhen, wenn sich das Level spürbar ändert
  "name": "Wipfrettung",          // deutsch; englisch in src/i18n.js
  "icon": "crew",                 // Symbol in der Levelliste (toolIcon)
  "desc": "Rette {goal} Wipfe …", // {goal} = Summe aller Ziele
  "intro": "…",                   // Meldung kurz nach dem Start
  "biome": "meadow",              // meadow | desert | winter
  "size": [800, 300],             // 300–2800 × 150–700
  "zoom": 4,
  "rough": 0.5,
  "seed": 8101,                   // für '?'-Zonen und das Aufrauen
  "diff": "adventure",            // oder "relaxed"
  "fill": { "caves": 0 },         // Menge je Art in '?'-Zonen (1 = wie im freien Spiel):
                                  // rock sand loam caves coal ore gold gems
  "start": { "money": 60, "crew": 3, "inv": [["flint"], ["loam"], []],
             "research": ["mech"], "store": { "plank": 4 } },
  "rules": { "meteors": false, "events": ["quake"], "evRate": 1 },
  "objects": [ … ],
  "areas": { "name": [x, y, w, h] },   // x < 0 zählt vom rechten Rand
  "goals": [ … ],                       // alle müssen erfüllt sein
  "lose": { "crewDead": true, "time": 20 },
  "stars": [6, 10],                     // Minuten für 3 bzw. 2 Sterne
  "triggers": [ … ]
}
```

### Objekte

| `t` | Felder | |
|---|---|---|
| `base` | `x`, `lvl` | die Burg (Pflicht, sonst x = 60) |
| `tree` | `x`, `stage` (1–4) | |
| `item` | `kind`, `x`, `y` | ohne `y` auf dem Boden |
| `animal` | `kind` (wipf, monster, bat, fish), `x`, `y`, `lost` | `lost`: wartet auf Rettung |
| `trapped` | `x`, `y` | ein verschütteter Wühler, wartet auf Rettung |
| `chest` | `x`, `y` | Schatztruhe (Höhle dafür in der Karte malen) |
| `gas` | `x`, `y`, `r` | Grubengas-Tasche |

### Ziele

| `t` | Felder | zählt |
|---|---|---|
| `money` | `n` | Taler |
| `sell` | `what`, `n` | verkaufte Stücke (`nug`, `ore`, `gem` …) |
| `collect` | `what`, `n` | Stück im Lager |
| `rescue` | `n` | gerettete Wipfe und Wühler |
| `kills` | `n` | besiegte Monster |
| `chests` | `n` | gefundene Truhen |
| `depth` | `n` | tiefster Punkt in Metern |
| `build` | `what`, `n` | fertige Gebäude oder Fahrzeuge dieser Art |
| `reach` | `area`, `label` | ein Wühler war im Bereich |
| `survive` | `n` | Minuten |

### Auslöser

`{ "when": {…}, "do": [ … ], "repeat": false }`

| `when.t` | Felder | | `do.t` | Felder |
|---|---|---|---|---|
| `enter` | `area` | | `say` | `text` |
| `after` | `min` | | `banner` | `title`, `text` |
| `goal` | `n` (Index) | | `flag` | `name` |
| `flag` | `name` | | `unlock` | `what` (Forschung) |
| `rescued` | `n` | | `event` | `kind`: quake, volcano, meteor |
| | | | `spawn` | `animal` oder `item`, `x`, `y` |
| | | | `win` / `lose` | `text` (bei lose) |

Alle Texte brauchen einen englischen Eintrag in `src/i18n.js`. Der Test prüft das.

## Prüfen

`npm test` lädt jedes Level (`tests/levels.spec.js`). Geprüft wird: richtige Größe, die Burg
steht auf festem Boden, kein Wühler steckt im Material, jedes Ziel ist ohne Granit dazwischen
erreichbar, das Level kommt jedes Mal gleich heraus, und alle Texte sind übersetzt. Zum
Anschauen startet man das Level in der Lobby über Kampagne → Kapitel 2.
