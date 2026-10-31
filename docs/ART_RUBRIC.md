# Optik-Rubrik und Bewertung

> **Stand: v1.52.0, 31.10.2026.** Bewertet wird nur, was auf Bildern zu sehen war. Die Note misst die
> **Optik gegenüber den freigegebenen Vorbildern**. Sie sagt nichts über Budget, Teamgröße oder
> Umfang. Stilregeln: [STYLE.md](STYLE.md), UI-Regeln: [UI_STYLE.md](UI_STYLE.md).

## 1. Ziel und Maßstab (freigegeben)

**Zielaussage:** Flintworks ist eine Clonk-Siedlungs- und Grabewelt im Querschnitt, in echter
Pixelgrafik mit der Klarheit von Terraria. Die Welt zeigt so viel Siedlung und Leben wie Clonk Rage
oder OpenClonk, aber ruhiger: Spielfiguren und Wertvolles heben sich immer vom Gelände ab.
Untertage wird es tiefer und dunkler, mit warmem Licht und leuchtenden Materialien wie in Noita.
Ganz schwarz wird es nie, Bauplätze und Wege bleiben lesbar. HUD und Menüs sind knapp und klar
wie in SteamWorld Dig 2, mit großen Knöpfen fürs Handy, im Holz- und Gold-Stil des Spiels.

| Vorbild | Wofür | Gesichtete Bilder (Quelle) |
|---|---|---|
| Clonk Rage | Genre, Siedlung, Physik | 6 (clonkspot.org: Spielszenen, Lobby) |
| OpenClonk | Genre, Siedlung, Physik | 10 (wiki.openclonk.org Press Kit: Siedlung, Bergbau, Kampf, Gegenstände) |
| Terraria | Pixelraster, Welt, HUD | 8 (Steam) |
| Noita | Licht, Effekte, Pixel-Physik | 8 (Steam) |
| SteamWorld Dig 2 | HUD, Menüs, Feinschliff | 8 (Steam) |

Hinweise:
- Keines der fünf Vorbilder ist ein AAA-Spiel. Die Clonks sind auch nicht als Pixelgrafik gemacht:
  Clonk Rage nutzt vorgerenderte Sprites, OpenClonk ist 3D-gerendert. Deshalb gibt es je Kategorie
  das Vorbild, das dort am besten ist.
- Die Vorbilder liegen nur als Standbilder vor: Animation und Bewegung der Vorbilder sind **nicht
  bewertet**.
- Die Bilder werden nicht ins Repository übernommen (Urheberrecht). Bei Bedarf neu laden.

**Gemeinsame Bildsprache:** seitlicher Schnitt durch die Welt mit dem Gelände als Spielfeld, kleine
Figuren in großer zerstörbarer Welt, Material an Farbe und Struktur erkennbar, leuchtendes Gold,
warmes Licht vor dunklem Untergrund.

**Was nicht zusammenpasst:**
- Fotostrukturen wie bei OpenClonk vertragen sich nicht mit dem Pixelraster.
- Die Dunkelheit von Noita steht gegen den Überblick, den man zum Bauen braucht.
- Das volle HUD von Terraria passt nicht aufs Handy.

## 2. Bewegungs-Inventar (Flintworks)

Animation entsteht im Code: Klips sind Pixelzeilen und Phasen in `clonkhi.js`; das ganze System
umfasst zusätzlich Physik (`clonk.js`), Partikel (`effects.js`), Ton (`sound.js`), Vibration (`buzz`)
und Kamera-Rütteln (`G.shake`).

| Bewegung | Zweck | Heute (Code) | Kontakt / Sync | Ziel | Prüfen |
|---|---|---|---|---|---|
| Laufen, Start, Stopp | Steuern | 4 Beinphasen, Armschwung, kein Start-/Stopp-Bild, keine Wende | Schritt-Ton, Staub selten | Wendebild (1 Frame), 1 Bremsbild | Video 60 fps, 1× Zoom |
| Sprung, Fall, Landung | Kanten, Gruben | keine eigene Sprung-/Fallpose, Landestaub und Ton erst bei hartem Aufprall | Ton `jump`/`land` | Hock-, Steig- und Fallpose, leichter Staub bei jeder Landung | Video |
| Graben (3 Richtungen) | Kernschleife | Hacke mit Ausholen, schnellem Schlag, Nachfedern (`pickAngle`), Brocken, Funken nach Material | Ton je Material, Vibration, Rütteln bei Fels | gut; Richtung schräg sichtbarer machen | Video je Material |
| Klettern, Hangeln (klassisch) | Bewegung | 2 Kletterbilder | – | ok | Video |
| Werfen, Sprengen | Fels, Kampf | Wurfbahn, Explosion, Rauch in Stufen | `boom`, Rütteln | Ausholpose vor dem Wurf | Video |
| Fällen, Hämmern | Holz, Bauen | Arm hoch/runter | `chop`, `hammer` | ok | Video |
| Tragen | Wirtschaft | Gegenstand in der Hand | – | sichtbare Last (Sack auf dem Rücken) | Standbild |
| Enterhaken | Ausweg | Seil, Zug | – | ok | Video |
| Fahrzeuge, Loren, Mechanik | Produktion | drehende Räder und Teile (`DESIGN_PLAN.md`) | Ton je Gerät | ok | Video |
| Tiere, Monster | Gefahr | eigene Sprites | `growl` | Vorwarnung (Ankündigungspose) vor Angriffen | **nicht gesichtet** |
| Wetter, Licht | Stimmung | Regen in 3 Ebenen, Blitz, Tag/Nacht | Donner | ok | Video |

Gesichter, Lippen, Stoff und IK gibt es bei 8×10 px nicht. Diese Kategorien entfallen.

## 3. Rubrik

Gewicht in %. Stufen: 1 = kaputt oder unlesbar, 5 = brauchbar mit klaren Mängeln,
8 = sauber und stimmig, 10 = Vorbild-Niveau in jedem Zustand.

| # | Kategorie (misst …) | Gew. | 1 / 5 / 8 / 10 | Typische KI-Fehler | Objektive Prüfung |
|---|---|---|---|---|---|
| 1 | **Pixelraster** – Texel auf Raster, keine Glättung | 8 | gemischte Größen, weich / meist sauber, einzelne Ausreißer / alles auf Raster / dazu Halbtexel bewusst gesetzt | weichgezeichnete Sprites, gemischte Pixelgrößen, Verläufe | Zoom 400 %: keine Zwischenfarben an Kanten; `imageSmoothingEnabled` aus |
| 2 | **Figurenlesbarkeit** – Wühler und Gegner sofort erkennbar | 10 | verschwindet im Gelände / an der Oberfläche lesbar / überall / auch im Gewimmel | Figur in Geländefarben, kein Umriss | Graustufenbild: Figur unterscheidbar; 1-Sekunden-Test |
| 3 | **Material und Wert** – Erde, Fels, Gold usw. unterscheidbar, Wertvolles fällt auf | 12 | Brei / Hauptmaterialien klar, Rand unklar / alle klar, Gold leuchtet / auch tief und nachts | Rauschen statt Form, alles gleich hell | Kontrast Gold zu Erde ≥ 3:1 (Helligkeit); jedes Material in 1 s benannt |
| 4 | **Tiefe und Licht** – Untertage, Nacht, Lichtquellen | 10 | flach, überall gleich hell / dunkler mit Lichtkreis / klare Tiefenstufen, warmes Licht / emissive Materialien, nie Blindflug | Schwarz statt Dunkel, Glow über allem | Helligkeit tief ≥ 15 % von oben; Lichtquellen haben harte Ringe |
| 5 | **Welt und Siedlung** – Dichte, Orientierung, Landmarken | 10 | leer / Gebäude stehen, Umgebung leer / Siedlung wirkt bewohnt / dicht und trotzdem ruhig | Wiederholung, Kopien, Füllkram ohne Funktion | Zählen: Varianten je Prop-Typ, Landmarken je Bildschirm |
| 6 | **Animation** – Takt, Kontakt, Gewicht | 10 | ruckelt, rutscht / Zyklen da, Übergänge fehlen / Start, Stopp, Landung stimmen / jede Aktion mit Vorbereitung und Nachfedern | Gleiten, fehlende Kontakte, Dauerbewegung ohne Takt | Video, Füße auf dem Boden, Bild und Ton im selben Frame |
| 7 | **Effekte** – Funken, Rauch, Explosion lesbar und nicht störend | 8 | verdecken Spiel / sichtbar, etwas Brei / klar, in Stufen / Ursache, Treffer, Folge sofort klar | weiche Alpha-Wolken, Bloom über alles | Bild mit Effekt: Figur und Gefahr noch sichtbar |
| 8 | **Zustand und Wirtschaft** – leistbar, gesperrt, Kosten, Fortschritt | 10 | nicht erkennbar / im Text lesbar / auf einen Blick / Folge vor dem Klick sichtbar | rote Zahlen überall, Text statt Symbol | leistbar vs. nicht leistbar unterscheidbar ohne Lesen |
| 9 | **HUD** – Priorität, Fußabdruck, Lesbarkeit | 8 | Durcheinander / alles da, zu klein / knapp und klar / nur das Nötige, groß genug am Handy | Webseiten-Leisten, Mini-Schrift | Schrift ≥ 12 px auf 1280×720; HUD ≤ 15 % der Fläche |
| 10 | **Menüs und Knöpfe** – Spielgefühl, Hierarchie, alle Zustände | 8 | Browser-Standard / eigener Stil, gleich gewichtet / klarer Hauptknopf, Zustände da / wie aus der Spielwelt, kein Lesen nötig | gleiche Kacheln für alles, Textwände, fehlender Fokus | Zustände laut [UI_STYLE.md](UI_STYLE.md) vorhanden |
| 11 | **Stimmigkeit** – Figuren, Welt, UI, Effekte sprechen dieselbe Sprache | 3 | Stilbruch / kleine Brüche / stimmig / wie aus einem Guss | gemischte Stile, Fremdschriften | Palette und Umriss nach STYLE.md |
| 12 | **Technik** – Flimmern, Unschärfe, Artefakte | 3 | Fehler stören / sichtbar, selten / keine im Spiel / auch bei Bewegung und Effekten | Schlieren, Z-Fighting, Debug-Text im Bild | Bilder bei 1×/2×, Handy und Desktop |

## 4. Bewertung

Belege stammen aus Bildern aus dem echten Spiel. Sie lassen sich neu erzeugen mit
`npm run test:visual`, `npm run store-shots`, dem Tutorial-Test und einer Zusatzaufnahme von
Burg, Bauen, Crew, Menü, Karte, Sieg und Niederlage (Desktop 1280×720 und Handy 780×360).
**F** = Tatsache auf dem Bild, **D** = Deutung.

| # | Flintworks | Maßstab (bestes Vorbild) | Belege und Lücke | Kleinste Änderung | Art | Machbar |
|---|---|---|---|---|---|---|
| 1 | **8** | 9 (Terraria, Noita) | F: Welt und Figuren scharf auf 2×-Texeln, Rahmen und Schrift pixelgenau. D: die Kartenvorschau im HUD wirkt weicher als der Rest. | Minikarte auf ganzzahlige Skalierung | Technik | ja |
| 2 | **7** | 9 (SteamWorld Dig 2) | F: rote Mütze an der Oberfläche sofort zu sehen; Untertage nur dank Lichtkreis. D: Helfer (blau, grün) gehen auf Erde eher unter als der Spieler. | 1-Texel-Umriss heller im Dunkeln, Mützen sättigen | Asset | ja |
| 3 | **7** | 9 (SteamWorld Dig 2) | F: Gold leuchtet, Kohle, Erz, Edelstein klar; große Erdflächen gleichförmig mit Sprenkeln. D: Sand- und Lehmlinsen sind beige Flecken ohne Form. | Linsen mit Rand und Licht von oben wie Adern | Asset | ja |
| 4 | **6** | 10 (Noita) | F: Untertage dunkler mit warmem Kreis um den Wühler, Nacht mit warmen Fenstern. D: Mittlere Tiefe überall gleich hell; Höhlen ohne eigene Lichtquellen. | Tiefenstufen deutlicher, leuchtende Pilze/Kristalle in Höhlen | Licht | ja |
| 5 | **5** | 9 (Clonk Rage, OpenClonk, SWD2) | F: Startfläche fast leer (Burg, ein Baum); die gestellte Siedlung hat 6 Gebäude in einer Reihe. D: Clonk-Siedlungen wirken durch Ebenen, Leitungen, Fahnen und Gerüste bewohnt. | Deko-Props zwischen Gebäuden (Fässer, Zäune, Laternen), Gebäude auf 2 Ebenen | Art Direction | teils |
| 6 | **6** | nicht bewertet (keine Videos) | F (Code): 4 Laufphasen, Hacke mit Takt, Blinzeln; keine Sprung-, Fall- oder Wendepose; Landestaub nur bei hartem Aufprall. | Sprung-/Fallpose, Landestaub immer, Wendebild | Animation | ja |
| 7 | **6** | 10 (Noita) | F: Funken und Rauch in harten Stufen (STYLE.md). D: Explosion und Kampf nicht gesichtet. | Explosion mit Lichtblitz auf dem Gelände | VFX | ja |
| 8 | **5** | 8 (SteamWorld Dig 2) | F: Ob etwas leistbar ist, zeigt nur die Farbe einer 9-px-Kostenzeile (beige oder rot). Kachel und Icon sehen gleich aus. „Erst erforschen“ steht als Text. Metallurgie (60 Taler) bleibt auch mit 400 Talern rot, ein Grund ist im Bild nicht zu sehen. | Leistbar/zu teuer/gesperrt/gekauft als eigene Kachelzustände | UI | ja |
| 9 | **6** | 9 (SteamWorld Dig 2) | F: einheitliche Rahmen; Knöpfe „Bauen/Menü“ und Untertitel in 9–10 px; Auftragschip und Tipp liegen oben übereinander. | Mindestschrift 12 px, Tipps und Auftrag in einer Zeile | UI | ja |
| 10 | **6** | 4 (OpenClonk, bestes gesichtetes Menü) | F: Lobby und Levelauswahl wirken wie aus dem Spiel. Bau- und Burg-Fenster sind 480 px breite Listen mit 14 gleichen Kacheln und viel Text. Die Siegkarte bietet im freien Spiel nur „Zur Lobby“. | Breitere Fenster am Desktop, Reiter statt langer Liste, Hauptknopf „Neue Runde“ | UI | ja |
| 11 | **7** | 9 (Terraria) | F: Eine Palette, ein Rahmen, zwei Pixelschriften. D: Der große Wühler der Lobby passt kaum zur kleinen Spielfigur. | Lobby-Wühler mit sichtbarem Pixelraster | Stimmigkeit | ja |
| 12 | **7** | 8 | F: keine Artefakte gefunden. Grauschleier über der Welt hinter dem Startbildschirm und auf manchen Oberflächenbildern. | Schleier heller, Dunst am Morgen prüfen | Technik | ja |

**Gesamt (gewichtet, ohne Kat. 6):** Flintworks **6,3 / 10**, Maßstab **8,6 / 10**.
Mit Animation (6) zählt Flintworks 6,2. Größte Lücken: Welt und Siedlung (−4), Tiefe und Licht
(−4), Zustand und Wirtschaft (−3), HUD (−3).

## 5. Zustands-Matrix

1-Sekunden-Test: Erkennt man Hauptsache, Zustand, Gefahr oder Chance, nächste Handlung und Folge?

| Zustand | Note | Wichtigste Kategorien | Befund |
|---|---|---|---|
| Startbildschirm | 6 | 9, 12 | Knopf klar, Welt dahinter grau verschleiert |
| Lobby | 7 | 10, 11 | Hauptknopf eindeutig, Wühler groß |
| Levelauswahl | 7 | 8, 10 | Karten mit Vorschau, Schloss bei gesperrt |
| Oberfläche, Start | 5 | 5, 2 | leer, Ziel unklar ohne Tutorial |
| Siedlung | 7 | 5, 2 | lesbar, aber Reihe statt Siedlung |
| Untertage | 6 | 3, 4 | Gold leuchtet, Tiefe flach |
| Nacht | 7 | 4 | warmes Licht wirkt |
| Tutorial | 8 | 2, 9 | ein Ziel, Pfeil, wenig HUD |
| **Burg / Laden** | **4** | 8, 10 | **schwächster kritischer Zustand:** leistbar nur an der Farbe einer kleinen Zeile zu erkennen, Rot ohne sichtbaren Grund, Textliste |
| Bau-Menü | 5 | 8, 10 | wie Burg, lange Liste |
| Crew-Aufgaben | 6 | 10 | klar, aber gleich gewichtet |
| Spielmenü | 6 | 10 | Gruppen ok, kleine Schrift |
| Karte | 6 | 9 | Übersicht gut, Legende sehr klein |
| Sieg | 6 | 10 | Feier lesbar, nur „Zur Lobby“ |
| Niederlage | 6 | 10 | Grund steht da, kein Weiter |
| Handy-HUD | 7 | 9 | runde Knöpfe gut, Fenster überdecken Knöpfe |

**Größter Mangel im Bild:** Am Desktop (1280×720) belegen die Fenster nur gut ein Drittel der
Breite und sind mit 9–12 px Text gefüllt. Man muss lesen statt sehen.

**Nicht bewertet** (keine Bilder): Versus und Kampf, Monster, Explosionen in Aktion, Fahrzeuge in
Bewegung, Hochformat, Lade-, Offline- und Fehlerzustände, Animation der Vorbilder, Menüs von
Terraria, Noita und SteamWorld Dig 2.

## 6. Verbesserungsplan

**Schnelle Gewinne (Code, Tage):**
1. Kachelzustände im Burg- und Bau-Fenster: leistbar (Preis gold), zu teuer (Preis rot, Icon
   gedimmt), gesperrt (Schloss und grau), gekauft (Haken).
2. Mindestschrift 12 px; Fenster am Desktop bis 640 px breit; Beschreibungen höchstens zwei Zeilen.
3. Siegkarte im freien Spiel: Hauptknopf „Neue Runde“, „Zur Lobby“ als zweiter Knopf.
4. Grauschleier hinter dem Startbildschirm aufhellen.
5. Sprung- und Fallpose, Landestaub bei jeder Landung.
6. Tipp und Auftragschip in einer Spur oben, nie übereinander.

**Große Überarbeitungen (Wochen):**
1. Siedlungsdichte: Deko-Props, Gebäude auf mehreren Ebenen, Wege und Leitungen sichtbar.
2. Untertage in Tiefenstufen mit eigenen Lichtquellen (Kristalle, Pilze, Lava), nach Noita.
3. Burg- und Bau-Fenster mit Reitern und großen Kacheln; Vergleich vorher/nachher bei Werkzeugen.
4. Bewegungsübergänge: Start, Stopp, Wende, Tragen, Ankündigung bei Monstern.

**Mit Fachleuten:**
- Pixel-Artist für einen stimmigen Gebäudesatz (bis 2× Größe) und Animationsbögen für den Wühler.
- UX-Test mit Erstspielern (Burg-Fenster, Leistbarkeit, Tutorial).
