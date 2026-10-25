# Stil-Leitfaden

Alles in Flintworks wird im Code gezeichnet. Diese Regeln halten neue Grafiken im selben Stil.

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
