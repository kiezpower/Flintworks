# Plan: Design und Grafik

> **Stand: Etappe 1 und 2 umgesetzt (v1.30.0).** Nachfolger von `GRABEN_PLAN.md` (v1.29.0).
> - Etappe 1: Stil-Leitfaden in `docs/STYLE.md`.
> - Etappe 2: Aus drei Varianten gewählt: „Detailreich“ mit der Farbstimmung von „Stimmung“
>   (`src/under.js`). Adern und Linsen mit Rand, Mineral-Schimmer in der Erde, Bodenflecken,
>   Funde je nach Tiefe (Wurzeln, Steine, Knochen, Trilobiten, Kristalle), Stollen-Rückwand aus
>   Erde bzw. Fels, Farbverlauf warm → kühl → violett, Gold und Edelsteine leuchten.
>   Nicht umgesetzt: Tropfsteine und Pilze in Höhlen (gegrabene Stollen und natürliche Höhlen
>   sind im Weltspeicher nicht zu unterscheiden; sie würden auch in frischen Stollen auftauchen).
> - Kosten: Das einmalige Zeichnen der Welt beim Rundenstart dauert etwa 1,5-mal so lange
>   (im Test 320 statt 205 ms); das laufende Spiel ist nicht betroffen.

Ziel: Flintworks soll auf den ersten Blick hochwertig wirken – im Store, in der Lobby und in den
ersten fünf Minuten unter Tage – **ohne dass dafür jemand Grafiken von Hand zeichnen muss.**

---

## 1. Ausgangslage

Flintworks hat **keine Bilddateien** (außer den App-Icons) und **keine Sounddateien**. Alles wird im
Code erzeugt:

| Was | Wo | Wie |
|---|---|---|
| Wühler (Spiel und Lobby) | `portrait.js`, `clonkhi.js` | Pixel als Textzeilen, z. B. `'..oCCCCCCCCCCo..'` |
| Gebäude, Fahrzeuge, Gegenstände, Knopf-Icons | `sprites.js` | Rechtecke per Code (`R(x, y, w, h, Farbe)`) |
| Erde, Fels, Erze | `tex.js` | Rauschen und Voronoi, 128×128 nahtlos |
| Himmel, Berge, Deko | `backdrop.js`, `effects.js`, `decor.js` | prozedural |
| Geräusche, Musik | `sound.js`, `music.js` | Web-Audio-Synthese |

Das ist ein Vorteil: Ein einheitlicher Stil, keine Lizenzfragen, winzige Downloads – und Claude
kann jede Grafik direkt ändern. Ein Wechsel auf Bilddateien würde den Stil brechen und Arbeit
erzeugen (Dateien pflegen, zwei Auflösungen, Animationen einzeln zeichnen).

### Was heute noch billig wirkt (aus den Bildern in `tests/out/`)

| # | Bereich | Problem |
|---|---|---|
| D1 | Unter Tage | Große, gleichförmige Erdflächen; Erzadern sind Kleckse ohne Rand; Sandlinsen sind flache Flecken; keine Höhlen-Deko (Wurzeln, Tropfsteine, Kristalle, Fossilien) |
| D2 | Bau-Menü und Knopf-Icons | 12×12-Icons, teils nur ein Strich (Schienen, Seilbahnmast); passen nicht zur detaillierten Lobby |
| D3 | Gebäude und Fahrzeuge | Einfache Rechteck-Sprites in einfacher Auflösung, kein Bauvorgang, kaum Leben (Rauch, Licht, bewegte Teile) |
| D4 | Größenbruch | In der Lobby ist der Wühler groß und detailliert, im Spiel 7×10 px – Gebäude sind ähnlich grob |
| D5 | Rückmeldung | Verkaufen, Bau fertig, Forschung fertig: wenig „Belohnungsgefühl“ (Münzen fliegen nicht, kaum Fanfare im Bild) |
| D6 | Store-Auftritt | Cover und Feature-Grafik sind Screenshots; kein Titelbild, das neugierig macht |

---

## 2. Vorgehen: Wer macht was

**Empfehlung: Claude zeichnet weiter im Code, du entscheidest anhand von Vergleichsbögen.**

1. Claude legt für einen Bereich **2–3 Varianten** nebeneinander auf einen Bogen (so wie die
   Hacken-Phasen beim Graben) und zeigt sie dir als Bild.
2. Du wählst eine aus oder sagst in einem Satz, was dir fehlt („wärmer“, „mehr Details“, „wie
   Terraria“).
3. Claude baut sie ein und zeigt dir ein Vorher/Nachher aus dem echten Spiel.

Dein Aufwand: pro Bereich einmal hinschauen und entscheiden. Kein Grafikprogramm nötig.

Als Grundlage kommt zuerst ein kurzer **Stil-Leitfaden** (`docs/STYLE.md`): feste Palette,
Umrissfarbe (`#24160c`, gibt es schon), Licht von oben links, Pixelgrößen je Objektart. So bleibt
alles einheitlich, egal in welcher Reihenfolge es entsteht.

### Werkzeuge – wofür sie sich lohnen

| Werkzeug | Was es kann | Für Flintworks | Aufwand für dich |
|---|---|---|---|
| **Claude im Code** | Pixelkunst, Texturen, Animationen, Effekte, Sound direkt im Spiel | **Hauptweg** für alles im Spiel | sehr gering |
| **KI-Pixelgeneratoren** (z. B. PixelLab, Retro Diffusion) | Sprites und kurze Animationen aus Text | Nur als **Vorlage/Ideengeber**: Bild hochladen, Claude setzt es im Stil um. Direkt eingebaut passen Palette und Pixelraster selten, und Nacharbeit wäre nötig | gering |
| **KI-Bildgeneratoren** (z. B. Midjourney, Leonardo, Ideogram) | Illustrationen, Titelbilder | **Store-Grafiken**: Titelbild, Play-Store-Feature-Grafik (1024×500), itch.io-Cover. Hier spielt der Pixel-Stil keine Rolle, und es spart am meisten Zeit | gering |
| **KI-Sounds/-Musik** (z. B. ElevenLabs Sound Effects, Suno) | Geräusche und Musik aus Text | Später möglich; heute ist alles synthetisch. Echte Aufnahmen bräuchten einen kleinen Sample-Player (überschaubar) | gering |
| **Blender** | 3D-Modelle, die man als Pixel-Sprites rendert | **Nicht empfohlen**: lohnt sich erst bei vielen Drehwinkeln oder großen 3D-Maschinen; die Figuren hier sind 7×10 px. Hohe Einarbeitung, widerspricht „wenig Arbeit“ | hoch |
| **Aseprite / LibreSprite** | Pixel-Editor | Nur falls du selbst einmal etwas zeichnen willst; nicht nötig | mittel |
| **Fertige Asset-Pakete** (Kenney, itch.io, OpenGameArt) | Kostenlose Sprites | Stilbruch zum vorhandenen Look; höchstens für Ideen | gering, aber passt nicht |

Hinweise zu KI-Inhalten: Nutzungsbedingungen des jeweiligen Generators für kommerzielle Nutzung
prüfen; itch.io fragt beim Hochladen nach KI-generierten Inhalten. Preise und Bedingungen ändern
sich schnell – vor der Nutzung nachsehen.

---

## 3. Etappen

Reihenfolge nach Wirkung auf den ersten Eindruck.

### Etappe 1 – Stil-Leitfaden (klein)
Palette, Umriss, Licht, Größen, Animationsregeln (`docs/STYLE.md`), dazu ein Vergleichsbogen aller
heutigen Sprites nebeneinander, damit Ausreißer sichtbar werden.

### Etappe 2 – Lebendige Unterwelt (D1, hohe Wirkung)
- Erzadern mit Rand, Glanzpunkten und Einschlüssen statt Klecksen; Sand-, Lehm- und Kohlelinsen
  mit Schichtung.
- Deko, die mit der Tiefe wechselt: Wurzeln und Steine nah an der Oberfläche, Fossilien und
  Pilze in der Mitte, Kristalle, Tropfsteine und Lavaglühen tief unten.
- Mehr Abwechslung in der Erdtextur (größere Muster gegen das Kachel-Gefühl).
- Höhlen bekommen eine dunklere, strukturierte Rückwand.

### Etappe 3 – Gebäude und Fahrzeuge (D3, D4)
- Alle Gebäude in doppelter Auflösung neu zeichnen (wie der Wühler in `clonkhi.js`).
- Bauvorgang in Stufen (Gerüst → Mauern → fertig), Rauch aus Schornsteinen, Licht in Fenstern
  nachts, bewegte Teile (Sägeblatt, Rad am Fahrstuhl, Blasebalg am Hochofen).
- Fahrzeuge mit Rädern, die sich drehen, und kleinen Wackelbewegungen.

### Etappe 4 – Icons und Oberfläche (D2)
- Alle Knopf- und Bau-Icons in 24×24 (doppelte Auflösung) im gleichen Stil wie die Lobby.
- Kleine Vorschaubilder der Gebäude im Bau-Menü statt Symbolen.

### Etappe 5 – Belohnungsgefühl (D5)
Münzen fliegen beim Verkauf zum Geldzähler, Bau fertig mit kurzer Staub-und-Glanz-Animation,
Forschung fertig mit Banner; neue Fanfaren passend dazu.

### Etappe 6 – Store-Auftritt (D6)
- Titelbild per KI-Bildgenerator (du erzeugst 3–4 Bilder mit einem vorbereiteten Prompt, Claude
  macht daraus Feature-Grafik, itch-Cover und Lobby-Hintergrund in den nötigen Größen).
- Neue Screenshots aus `npm run test:visual` mit gestellten, schönen Szenen.

---

## 4. Erfolgskriterien

- Jemand, der das Spiel nicht kennt, beschreibt einen Screenshot unter Tage als „liebevoll“
  oder „detailliert“, nicht als „leer“.
- Kein Sprite fällt auf dem Vergleichsbogen aus dem Stil.
- Bildrate auf Android unverändert, Download-Größe wächst kaum (alles bleibt Code).
