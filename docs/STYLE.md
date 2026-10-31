# Stil-Leitfaden

Alles in Flintworks wird im Code gezeichnet. Diese Regeln halten neue Grafiken im selben Stil.

**Ziel (freigegeben, Details in [ART_RUBRIC.md](ART_RUBRIC.md)):** Clonk-Siedlungs- und Grabewelt im
Querschnitt, echte Pixelgrafik mit Terraria-Klarheit; Siedlung dicht wie bei Clonk, aber ruhiger;
Untertage tiefer und dunkler mit warmem Licht und leuchtenden Materialien wie Noita, nie ganz
schwarz; HUD und Menüs knapp wie SteamWorld Dig 2 ([UI_STYLE.md](UI_STYLE.md)).

## Raster

| Was | Größe |
|---|---|
| Landschaftspixel (Zelle der Welt) | 1 px, im Weltbild 2×2 Texel (`RES = 2` in `world.js`) |
| Feine Details (Wühler, Hacke, Funde) | auf das Halbpixel-Raster runden: `Math.round(v * 2) / 2` |
| Wühler | 16×20 Texel = 8×10 Landschaftspixel (`portrait.js`, `clonkhi.js`) |
| Funde in der Erde | 1 Zeichen = 1 Landschaftspixel, höchstens 9×8, ein Fund je 20×20-Block (`under.js`) |
| Knopf-Icons | heute 12×12 (`PAD_ICONS` in `sprites.js`), neue Icons 24×24 |

Keine weichgezeichneten Kanten: Bilder ohne Glättung zeichnen, Koordinaten runden.

## Farbe und Licht

- **Umriss:** `#24160c` (dunkles Braun, nie reines Schwarz), 1 Texel breit.
- **Licht von oben:** Oberkante heller (×1,3), Unterkante unter offener Luft dunkler (×0,62), linke
  Kante ×1,1, rechte ×0,82 (siehe `texel()` in `world.js`).
- **Tiefe:** Unter Tage wandern alle Farben von warm (direkt unter dem Gras) über kühl (Mitte) zu
  violett (tief). Eigene Farben für Unterirdisches über `depthGrade` aus `under.js` führen.
- **Wertvolles leuchtet:** Gold und Edelsteine werden nicht abgedunkelt, sondern aufgehellt
  (×1,2–1,3) und färben die Erde um sich herum leicht ein.
- **Grundpalette der Materialien:** `PAL` in `world.js`; Erde `#7d5230`, Fels `#6f6a64`,
  Gold `#f2c230`, Sand `#d9b56a`, Lehm `#b07a45`, Erz `#a65a40`, Kohle `#2e2a2a`,
  Edelstein `#45c8e6`, Holz `#a0703f`.
- **Schatten** sind dunklere Töne derselben Farbe (×0,6–0,8), kein Grau darüber.

## Effekte und Wetter

- **Warm gegen kalt:** Regen, Dunst, Schnee, Blitz-Rand und abziehender Rauch sind kühl (Blaugrau),
  Funken, Glut, Fenster und Feuer warm. Die Palette steht in `FX_PAL` (`effects.js`).
- **Keine weichen Verläufe in Effekten:** Licht in 2–3 harten Ringen oder Bändern, außen
  gerastert (Schachbrett) statt Alpha-Verlauf; Kreise und Linien pixelweise (`pixelDisc`,
  `pixelLine`).
- **Altern in Stufen:** Funken werden weiß-gelb → orange → dunkelrot, Rauch wächst in halben
  Pixeln und kühlt ab (`pal`/`l0`/`grow` an einem Partikel, gezeichnet in `drawPart`).
- **Flackern in Stufen:** `flicker(seed)` springt zwischen drei Helligkeiten statt einer Sinuswelle.
- **Regen in drei Ebenen** (fern hinter den Hügeln, mittel in der Welt, nah davor) plus Spritzer,
  Ringe auf dem Wasser, Tropfen von der Traufe und nasser Boden (`rainfx.js`).
- Feinste Einheit eines Effekts ist ein Texel (`px()`: 0,5 Landschaftspixel bei doppelter
  Auflösung, sonst 1).

## Bewegung

- Takt statt Dauerbewegung: Ausholen → schneller Schlag → Nachfedern (siehe Hacke, `pickAngle`).
- Wichtige Momente bündeln Bild, Klang und Vibration im selben Frame.
- Partikel nehmen die Farbe ihres Ursprungs an (`cssOf` in `world.js`) und haben ein Budget
  (weniger bei „Grafik: schnell“).

## Neue Grafik einbauen

1. Varianten nebeneinander auf einen Vergleichsbogen rendern (Skript mit Playwright, gleiche Welt).
2. Auswahl treffen, einbauen, Vorher/Nachher aus dem echten Spiel ansehen.
3. Zeichenzeit prüfen: `paintAll()` läuft beim Rundenstart über die ganze Welt; was pro Texel
   gerechnet wird, muss billig sein (keine Hilfsfunktionen oder Arrays pro Texel anlegen).

## Figuren und Maßstab

- Wühler 8×10 Landschaftspixel, die Burg 36 px breit. Neue Gebäude orientieren sich an diesen Maßen: Ein Wühler muss durch die Tür passen.
- Spielfiguren und Wertvolles heben sich immer ab: gesättigte Mütze, heller Umriss im Dunkeln,
  Gold und Edelsteine leuchten. Gelände bleibt gedämpfter als alles, womit man spielt.
- Neue Gebäude stehen auf dem Boden (Schatten), haben eine klare Silhouette und ein bewegtes Teil
  oder Licht, wenn sie arbeiten.

## Animation

- Klips sind Pixelzeilen und Phasen (`clonkhi.js`); das System dazu sind Physik (`clonk.js`),
  Partikel (`effects.js`), Ton (`sound.js`), Vibration und Kamera-Rütteln.
- Jede Aktion: Vorbereitung → schneller Teil → Nachfedern. Kontakt (Schlag, Landung, Fuß) bekommt
  Bild, Ton und ggf. Vibration im selben Frame.
- Pflichtposen für neue Figuren: Stehen, 4 Laufphasen, Sprung/Fall, Landung, Aktion. Füße rutschen nicht:
  die Laufphase folgt der Strecke (`c.anim`), nicht der Zeit.
- Posen (`clonkhi.js`): `LEGS` (4 Laufphasen), `JUMP` (steigen: Beine angezogen, Arm halb hoch),
  `FALL` (fallen: Beine gespreizt, Arm hoch), `CLIMB`. „In der Luft“ heißt `c.airT > 3` (eine Stufe
  hinab zählt nicht). Ab 3 Dingen im Gepäck trägt der Wühler einen Sack auf dem Rücken.
- Wenden: 5 Bilder lang die Durchgangs-Beinphase (`LEGS[3]`) ohne Armschwung (`c.turnF`).
- Staub (`dust`): jede Landung ab `fallV > 1.2`, Wenden aus vollem Lauf, Schritte.
- Monster zeigen ein blinkendes „!“, bevor sie zuschlagen können (nur Bild; Takt und Schaden gleich;
  im Netz als Feld `w` der Tiere übertragen).
- Bewegungs-Inventar und Lücken: ART_RUBRIC.md, Abschnitt 2.

## Welt-Details

- **Oberfläche:** Gras, Blumen, Büsche, Steinchen (`decor.js`).
- **Höhlenböden** ab 30 Reihen Tiefe: leuchtende Pilze (türkis) und Kristalle (violett) mit eigenem
  Lichtkreis. Ihr Zufall kommt aus einem Hash der Stelle, nie aus `rnd()`: Welten, Level-Vorschauen
  und Netzrunden bleiben dadurch gleich. Sie werden im Spielstand mitgespeichert (`glow`). Ältere
  Spielstände suchen die Höhlen neu.
- **Siedlung** (`props.js`, nur Bild, keine Kollision):
  - Neben fertigen Gebäuden bis zu 2 Props (Fass, Kiste, Zaun, Laternenpfahl). Welche, bestimmt ein
    Hash der Gebäude-Id. Sie stehen nur, wo Platz ist. Laternen leuchten nachts.
  - Die Burg hat einen festen Hof: Holzstapel, Fass, Handkarren, Wegweiser.
  - Ausgetretene Wege zwischen Nachbargebäuden (Abstand 3–70 px, gleiche Höhe).
  - Stromleitungen vom Windrad zur nächsten Pumpe, Chemiewerk oder Aufzug (bis 140 px).
- **Licht:** zwei Tiefenstufen (`light.js`: 58 % nach 60 Reihen, 70 % nach weiteren 100); große
  Explosionen werfen einen schwachen, hart begrenzten Lichtring.

## Leistung

- „Grafik: schnell“ zeichnet in 1× statt 2×; das Spiel schaltet selbst um, wenn es zweimal in
  Folge über 2 s im Schnitt langsamer als 25 ms pro Bild läuft (`perfGuard` in `main.js`).
  „Licht“ kann aus. Partikel haben ein Budget, bei „schnell“ kleiner.
- Was pro Texel oder pro Frame läuft, darf nichts anlegen (keine Arrays oder Objekte in Schleifen).
- Kein Three.js, keine Bilddateien außer App-Icons: Qualitätsstufen bleiben die beiden oben.

## Prüfablauf für neue Grafik

1. Vergleichsbogen wie oben, dazu Bilder aus dem echten Spiel: `npm run test:visual`
   (Startbildschirm, Oberfläche, Nacht, Höhle, Funken, Desktop und Handy) und `npm run store-shots`.
2. Gegen die Rubrik in ART_RUBRIC.md prüfen; die wichtigsten Kategorien je Zustand stehen in der
   Zustands-Matrix. Eine Änderung darf keine Kategorie schlechter machen.
3. 1-Sekunden-Test: Bild kurz zeigen. Sind Figur, Gefahr, nächste Handlung erkennbar?
4. Note in ART_RUBRIC.md nachtragen, wenn sich eine Kategorie sichtbar ändert.

