# Gemalte Kreaturen, Gegenstände und Icons (v1.137.0)

Stilprüfung vom 16.11.2026: Hintergrund, Gelände, Gebäude, Bäume und Helden waren gemalt,
Monster, Gegenstände, Icons, Logo und Beschriftungen noch Pixelgrafik (`ist-zustand.png`).

## Die fünf Varianten

Dieselben sechs Kreaturen in drei Posen; `groessentest.png` zeigt sie in Spielgröße.

| Datei | Richtung | Urteil |
|---|---|---|
| `A-bilderbuch.png` | Malweise der Helden und Gebäude, warmes Licht, braune Kontur | **gewählt** |
| `B-duester.png` | dunkle Körper, leuchtende Details, kaltes Randlicht | kleine Kreaturen verschwinden im Dunkeln |
| `C-knuffig.png` | runde Formen, große Augen | sehr lesbar, anderer Ton |
| `D-material.png` | Monster aus Granit, Kohle, Kristall, Lava | in Spielgröße unruhig |
| `E-klar.png` | wenige Farbflächen, dicke Kontur | am lesbarsten, flacher als die Helden |

## Aus A abgeleitete Bögen

| Datei | Inhalt | Atlas |
|---|---|---|
| `A-bilderbuch.png` | Höhlenmonster, Fledermaus, Spinne, Lavaschleim, Golem, Fluffel | `src/assets/creatures/atlas.png` |
| `A-zusatz-bosse.png` | Fisch, Lavakönigin, Eiskönig, Riesenwurm | `src/assets/creatures/atlas.png` |
| `A-zusatz-gegenstaende.png` | 21 Gegenstände, Truhe (zu/offen), großes Versteck | `src/assets/items/atlas.png` |
| `A-zusatz-icons.png` | 30 Knopf-, Werkzeug- und Fahrzeug-Icons | `src/assets/items/ui.png` |
| `A-zusatz-requisiten.png` | Händler (3 Posen), Grabstein, Schrein, Mast, Gondel, Bohrwagen | `src/assets/items/props.png` |

Alle Bögen wurden mit einem Bildgenerator aus Textbeschreibungen erzeugt (gleiche
Stilbeschreibung wie A, flacher dunkelgrauer Hintergrund, festes Raster) und mit den
`build.py`-Skripten neben den Atlanten freigestellt und gepackt.

## Was im Spiel gemalt ist

Kreaturen und Bosse, Gegenstände, Truhen und Verstecke, Icons in HUD, Menüs und auf den
Knöpfen, Gebäude-Icons, Floß, Reitfluffel, Luftschiff, Grubenbahn, Lore, Bohrwagen, Seilbahn,
Händler, Schreine, Grabsteine, Fackeln, das Logo, Boss-Leiste, Schilder, Namensschilder,
Schadenszahlen, Crew-Gesichter und Tagesuhr im HUD, die Landschaftsbilder der Levelkarten und
die Kapitel-Karte und der Sprengplatz. Das Gelände kachelt ohne Spiegelmuster (`umgesetzt.png`, `umgesetzt-wurm.png`).

## Noch nicht gemalt

- Katapult (der Arm zielt) und Zielscheibe: glatte Vektorzeichnung.
- Vorschaubilder der Level und Karten (`public/previews`): Übersichtskarten, an Prüfsummen gebunden.
- Minimap, Flüssigkeiten und Wettereffekte (Regen, Schnee). Lichtpfützen, Explosionen und Funken sind weich.
- Kanten von Gelände und Höhlen folgen weiter den Simulationszellen.
- Kreaturen haben zwei Bewegungsphasen und eine Angriffspose, die Helden sechs Phasen je Aktion.
