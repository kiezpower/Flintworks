# Optik-Rubrik und Bewertung

> **Stand: v1.55.0, 01.11.2026** (erste Bewertung v1.52.0 in Abschnitt 4, Neubewertungen in Abschnitt 7). Bewertet wird nur, was auf Bildern zu sehen war. Die Note misst die
> **Optik gegenüber den freigegebenen Vorbildern**. Sie sagt nichts über Budget, Teamgröße oder
> Umfang. Stilregeln: [STYLE.md](STYLE.md), UI-Regeln: [UI_STYLE.md](UI_STYLE.md).

## 1. Ziel und Maßstab (freigegeben)

**Zielaussage:** Flintworks ist eine Siedlungs- und Grabewelt im Querschnitt, in echter
Pixelgrafik mit der Klarheit von Terraria. Die Welt zeigt so viel Siedlung und Leben wie die
klassischen Grabespiele, aber ruhiger: Spielfiguren und Wertvolles heben sich immer vom Gelände ab.
Untertage wird es tiefer und dunkler, mit warmem Licht und leuchtenden Materialien wie in Noita.
Ganz schwarz wird es nie, Bauplätze und Wege bleiben lesbar. HUD und Menüs sind knapp und klar
wie in SteamWorld Dig 2, mit großen Knöpfen fürs Handy, im Holz- und Gold-Stil des Spiels.

| Vorbild | Wofür | Gesichtete Bilder (Quelle) |
|---|---|---|
| Klassische 2D-Grabespiele (zwei Titel) | Genre, Siedlung, Physik | 16 (Spielszenen, Lobby, Siedlung, Bergbau, Kampf, Gegenstände) |
| Terraria | Pixelraster, Welt, HUD | 8 (Steam) |
| Noita | Licht, Effekte, Pixel-Physik | 8 (Steam) |
| SteamWorld Dig 2 | HUD, Menüs, Feinschliff | 8 (Steam) |

Hinweise:
- Keines der fünf Vorbilder ist ein AAA-Spiel. Die klassischen Grabespiele sind auch nicht als
  Pixelgrafik gemacht: der eine nutzt vorgerenderte Sprites, der andere ist 3D-gerendert. Deshalb gibt es je Kategorie
  das Vorbild, das dort am besten ist.
- Die Vorbilder liegen nur als Standbilder vor: Animation und Bewegung der Vorbilder sind **nicht
  bewertet**.
- Die Bilder werden nicht ins Repository übernommen (Urheberrecht). Bei Bedarf neu laden.

**Gemeinsame Bildsprache:** seitlicher Schnitt durch die Welt mit dem Gelände als Spielfeld, kleine
Figuren in großer zerstörbarer Welt, Material an Farbe und Struktur erkennbar, leuchtendes Gold,
warmes Licht vor dunklem Untergrund.

**Was nicht zusammenpasst:**
- Fotostrukturen wie bei den 3D-gerenderten Vorbildern vertragen sich nicht mit dem Pixelraster.
- Die Dunkelheit von Noita steht gegen den Überblick, den man zum Bauen braucht.
- Das volle HUD von Terraria passt nicht aufs Handy.

## 2. Bewegungs-Inventar (Flintworks)

Animation entsteht im Code: Klips sind Pixelzeilen und Phasen in `diggerhi.js`; das ganze System
umfasst zusätzlich Physik (`digger.js`), Partikel (`effects.js`), Ton (`sound.js`), Vibration (`buzz`)
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

## 4. Bewertung (v1.52.0, vor den Verbesserungen)

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
| 5 | **5** | 9 (klassische Grabespiele, SWD2) | F: Startfläche fast leer (Burg, ein Baum); die gestellte Siedlung hat 6 Gebäude in einer Reihe. D: Siedlungen der Vorbilder wirken durch Ebenen, Leitungen, Fahnen und Gerüste bewohnt. | Deko-Props zwischen Gebäuden (Fässer, Zäune, Laternen), Gebäude auf 2 Ebenen | Art Direction | teils |
| 6 | **6** | nicht bewertet (keine Videos) | F (Code): 4 Laufphasen, Hacke mit Takt, Blinzeln; keine Sprung-, Fall- oder Wendepose; Landestaub nur bei hartem Aufprall. | Sprung-/Fallpose, Landestaub immer, Wendebild | Animation | ja |
| 7 | **6** | 10 (Noita) | F: Funken und Rauch in harten Stufen (STYLE.md). D: Explosion und Kampf nicht gesichtet. | Explosion mit Lichtblitz auf dem Gelände | VFX | ja |
| 8 | **5** | 8 (SteamWorld Dig 2) | F: Ob etwas leistbar ist, zeigt nur die Farbe einer 9-px-Kostenzeile (beige oder rot). Kachel und Icon sehen gleich aus. „Erst erforschen“ steht als Text. Metallurgie (60 Taler) bleibt auch mit 400 Talern rot, ein Grund ist im Bild nicht zu sehen. | Leistbar/zu teuer/gesperrt/gekauft als eigene Kachelzustände | UI | ja |
| 9 | **6** | 9 (SteamWorld Dig 2) | F: einheitliche Rahmen; Knöpfe „Bauen/Menü“ und Untertitel in 9–10 px; Auftragschip und Tipp liegen oben übereinander. | Mindestschrift 12 px, Tipps und Auftrag in einer Zeile | UI | ja |
| 10 | **6** | 4 (klassisches Grabespiel, bestes gesichtetes Menü) | F: Lobby und Levelauswahl wirken wie aus dem Spiel. Bau- und Burg-Fenster sind 480 px breite Listen mit 14 gleichen Kacheln und viel Text. Die Siegkarte bietet im freien Spiel nur „Zur Lobby“. | Breitere Fenster am Desktop, Reiter statt langer Liste, Hauptknopf „Neue Runde“ | UI | ja |
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

Stand v1.54.0: ✅ umgesetzt, ◐ teilweise, ✗ offen.

**Schnelle Gewinne:**
1. ✅ Kachelzustände (leistbar, zu teuer, gesperrt, erledigt, läuft) mit Grund-Chip („Fehlt: 20 Taler“,
   „Erst erforschen: …“, „Es läuft schon eine Forschung“), Fortschrittsbalken, Schloss und Haken.
   Ein Tipp auf etwas Unmögliches: kurzer Ruck, Ton, Toast mit demselben Grund.
   (Warum Metallurgie im alten Bild mit 400 Talern rot war, ist nicht geklärt. Jetzt steht der Grund auf der Kachel.)
2. ✅ Kostenzeile 11 px statt 9 px, Fenster am Desktop bis 640 px, Beschreibungen höchstens zwei
   Zeilen, Kartenlegende 11 px.
3. ✅ Sieg- und Niederlagekarte im freien Spiel: „Neue Runde“ bzw. „Nochmal“ als fokussierter
   Hauptknopf, „Zur Lobby“ ruhiger.
4. ✅ Kein Grauschleier mehr: Die Tutorial-Welt steht auf hellem Tag, der Startbildschirm-Verlauf ist leichter.
5. ✅ Sprung- und Fallpose (Beine und Arm), Landestaub bei jeder Landung, Bremsstaub beim Wenden.
6. ✅ Tipp und Auftrag in einer Spur; bei offenem Fenster tritt der Auftrag zurück.

**Große Überarbeitungen:**
1. ✅ Siedlung (`props.js`, nur Bild):
   - Fässer, Kisten, Zaun und Laternenpfähle neben fertigen Gebäuden; die Laternen leuchten nachts.
   - Die Burg hat ab Rundenbeginn einen Hof mit Holzstapel, Fass, Handkarren und Wegweiser.
   - Ausgetretene Wege zwischen Nachbargebäuden.
   - Stromleitungen vom Windrad zu Pumpe, Chemiewerk und Aufzug.

   „Gebäude auf mehreren Ebenen“ ist keine Grafikfrage: Gebaut wird, wo der Wühler steht, auch in
   Stollen. Mehrstöckige Siedlungen entstehen durch Spielen, nicht durch die Welt.
2. ✅ Untertage: zweite Tiefenstufe (bis 70 % dunkel, nie schwarz), leuchtende Pilze und Kristalle
   auf Höhlenböden mit eigenem Licht, Sand- und Lehmlinsen mit vollem Rand und heller Oberkante,
   Explosionen werfen einen Lichtring aufs Gelände.
3. ✅ Burg- und Bau-Fenster mit Reitern: Ein Reiter zeigt nur seinen Abschnitt, ein zweiter Tipp
   zeigt wieder alle. Die Wahl bleibt beim Neuöffnen erhalten, z. B. nach einem Kauf. Die Kacheln
   sind breiter. Ein Vergleich vorher/nachher bei Werkzeugen entfällt, weil Werkzeuge keine Stufen
   haben, nur „gekauft“.
4. ✅ Bewegung:
   - Tragen: ein Sack auf dem Rücken ab 3 Dingen.
   - Wenden: einige Bilder lang ein Zwischenbild mit Beinen in der Mitte und hängendem Arm.
   - Monster kündigen sich mit einem „!“ an, bevor sie zuschlagen; das „!“ wird jetzt auch an
     Mitspieler übertragen.
   - Höhlenleuchten werden mitgespeichert und tauchen nach dem Laden nicht in neuen Stollen auf.

**Geprüft, nichts zu tun:** Der Lobby-Wühler nutzt schon dieselbe Pixelgrafik und dasselbe Raster
wie die Lobby-Landschaft (1 Texel = 1 Landschaftspixel). Er ist nur näher herangezoomt.

**Mit Fachleuten (offen, im Code nicht ersetzbar):**
- Pixel-Artist: neuer Gebäudesatz in 2× Auflösung und handgezeichnete Animationsbögen (statt der
  Zwischenbilder aus vorhandenen Zeilen).
- UX-Test mit Erstspielern (Burg-Fenster, Leistbarkeit, Tutorial).

## 7. Neubewertung (v1.53.0)

Belege: neue Bilder aus dem echten Spiel. Burg arm und reich, Bau-Fenster, Klick auf gesperrte
Kachel, tiefe Höhle mit Leuchten, Monster-Warnung, Siegkarte, Startbildschirm, Posen in
Nahaufnahme und Store-Bilder (`npm run store-shots`, Tag und Nacht).

| # | Kategorie | vorher | nachher | Beleg |
|---|---|---|---|---|
| 1 | Pixelraster | 8 | 8 | unverändert |
| 2 | Figuren | 7 | 7 | Helferlicht größer; im Bild kaum Unterschied |
| 3 | Material und Wert | 7 | 7 | Linsenrand; auf den neuen Bildern keine Linse nah genug, um es zu belegen |
| 4 | Tiefe und Licht | 6 | **7** | tiefe Höhle: violetter, dunkler Grund, Gold und Kristalle leuchten, Höhlenpilz mit Lichtkreis |
| 5 | Welt und Siedlung | 5 | **6** | Fass und Laterne an Burg und Mühle; noch eine Reihe, keine Ebenen |
| 6 | Animation | 6 | **7** | Sprung- und Fallpose, Sack, Lande- und Bremsstaub (Nahaufnahmen) |
| 7 | Effekte | 6 | 6 | Explosionsring nicht im Bild festgehalten |
| 8 | Zustand und Wirtschaft | 5 | **8** | Schloss, Haken, Balken, „Fehlt: 20 Taler“, Ruck bei unmöglichem Klick |
| 9 | HUD | 6 | **7** | Tipp unter dem Auftrag, Legende größer |
| 10 | Menüs und Knöpfe | 6 | **7** | Sprung-Chips, breitere Fenster, „Neue Runde“ fokussiert |
| 11 | Stimmigkeit | 7 | 7 | unverändert |
| 12 | Technik | 7 | **8** | Startbildschirm hell, kein Grauschleier |

**Gesamt (gewichtet, ohne Kat. 6):** Flintworks **7,0 / 10** (vorher 6,3), Maßstab 8,6 / 10.
Mit Animation: 7,0. Größte Lücken jetzt: Welt und Siedlung (−3), Tiefe und Licht (−3), Effekte (−4).
Schwächster kritischer Zustand ist nicht mehr das Burg-Fenster (jetzt 7), sondern die
**Oberfläche zu Beginn** (5): leer, ohne Ziel, solange es keine Gebäude gibt.

### Nachtrag v1.54.0

Belege:
- Nahaufnahmen von Burghof, Siedlung mit Windrad, Säge und Pumpe (Tag und Nacht), Explosion und Sandlinse.
- Burg-Fenster mit gewähltem Reiter „Forschung“.

| # | Kategorie | v1.53.0 | v1.54.0 | Beleg |
|---|---|---|---|---|
| 3 | Material und Wert | 7 | **8** | Sandlinse in der Nahaufnahme mit klarem Rand; die hellere Oberkante ist kaum zu sehen |
| 5 | Welt und Siedlung | 6 | **7** | Burghof ab Start, Leitung Windrad → Pumpe, Laternen leuchten nachts |
| 10 | Menüs und Knöpfe | 7 | **8** | Reiter mit Auswahl, die Wahl bleibt erhalten |
| 6 | Animation | 7 | 7 | Wende-Zwischenbild nicht im Bild festgehalten |
| 7 | Effekte | 6 | 6 | Explosionsring am Tag kaum sichtbar, danach verstärkt, aber nicht neu aufgenommen |

**Gesamt (gewichtet, ohne Kat. 6):** Flintworks **7,4 / 10**, Maßstab 8,6 / 10.
Schwächster kritischer Zustand: **Oberfläche zu Beginn**, jetzt 6 (Burghof statt leerer Wiese, aber
noch kein Ziel im Bild, solange nach dem Tutorial keine Gebäude stehen).

### Nachtrag v1.55.0

Die drei zuletzt offenen Punkte sind umgesetzt, und zwar im Code statt durch einen Pixel-Artist:

1. **Ziel zu Rundenbeginn** (`startcue.js`): ein Banner mit dem Rundenziel; der gelbe Pfeil zeigt bis
   zum ersten Graben (höchstens 12 s) auf die nächste Goldader nahe der Oberfläche; der Wegweiser am
   Burghof dreht sich dorthin.
2. **Neue Posen** (`diggerhi.js`): Frontansicht beim Wenden, Vorlage beim Loslaufen, Rücklage mit
   gestemmten Beinen beim Bremsen. Dazu kommen Sprung, Fall und Tragen.
3. **Gebäude in doppelter Auflösung** (`bldart.js`, Variante 1 nach Wahl des Nutzers):
   - Jeder Pixel der Vorlage wird als Stein, Holz, Dach oder Fenster erkannt und in 2×2 Texeln mit
     Fugen, Maserung, Schindeln oder Glanz gezeichnet.
   - Das gilt für alle 12 Gebäude und alle 4 Baustile, auch für die Icons im Bau-Menü und die Lobby-Burg.
   - Die Maße bleiben exakt; ein Test prüft das.

Belege:
- Posenbogen (Stehen, Laufen, Start, Bremsen, Wenden, Sprung, Fall, Tragen).
- Gebäudebogen (heute, Variante 1, Variante 2, Tag und Nacht) und alle Baustile.
- Store-Bilder.

| # | Kategorie | v1.54.0 | v1.55.0 | Beleg |
|---|---|---|---|---|
| 6 | Animation | 7 | **8** | Posenbogen: Frontansicht, Start- und Bremspose lesbar |
| 3 | Material und Wert | 8 | 8 | Gebäude zeigen ihr Material (Burg mit Fugen); Gelände unverändert |
| 5 | Welt und Siedlung | 7 | 7 | Gebäude detailreicher, Siedlung aber weiter eine Reihe |

**Gesamt:** ohne Kategorie 6 bleibt es bei **7,4**, mit Animation **7,4** (vorher 7,3).
Die Oberfläche zu Beginn steigt von 6 auf **7** (Banner, Pfeil, Wegweiser). Schwächster kritischer
Zustand ist jetzt kein einzelner Bildschirm mehr. Die größten Lücken zum Maßstab bleiben Effekte (6)
und Licht in der Tiefe (7).

**Offen:**
- UX-Test mit echten Spielern.

### Nachtrag v1.72.0 – Welt 2.0

Neuer Vergleich mit Clonk Rage und OpenClonk: Figuren, Gebäude und UI sind nah dran; der größte
Abstand war die Welt selbst (sanfte Hügel über einer einheitlichen Erdschicht mit kleinen Flecken).
Umgesetzt im freien Spiel (`gen.js`, Kampagne und Tutorial unverändert):

- Hochplateaus mit Steilhängen an der Oberfläche (nie an einer Burg).
- Große Felsmassive in mittlerer Tiefe.
- Große Hallen und gewundene Gänge, die Höhlen zu Systemen verbinden; eine große Grotte mit See.
- Gesteinsschichten: wellige Bänder unterschiedlicher Helligkeit (`layerTint` in `world.js`),
  die Tiefe ist in der Erde selbst zu sehen.
- Die neuen Formen haben einen eigenen Zufallsgenerator und überdecken nie Erz, Kohle, Gold oder
  Edelsteine: Rohstoffe, Truhen und Tiere liegen wie vorher (Tests in `worldsize.spec.js`).

Kategorie 5 (Welt und Siedlung): Die Welt bekommt Landmarken und Hallen wie bei Clonk; die Note wird
nach einem Bildvergleich in der nächsten Bewertung angepasst.

Nächste Schritte laut Vergleich: größere Explosionen und Feuer, Wasser und Lava öfter sichtbar,
ein Schaustück-Level (Himmelsinsel oder Siedlung auf mehreren Ebenen).


### Nachtrag v1.73.0–v1.75.0 – Wasser, Feuer, Schaustück

- v1.73.0: Lavakammern tief unten und ein See in jeder zweiten Halle (Welt 2.0); Wasser und Lava
  liegen jetzt in jeder freien Welt in Sichtweite.
- v1.74.0: Explosionen mit Rauchsäule, Glut und Feuerball; brennende Bäume rauchen.
- v1.75.0: Schaustück-Level „Himmelsinseln“: eine Terrassen-Burg links, ein Meer, vier schwebende
  Inseln mit Gold und Edelsteinen, Land mit Goldhöhle rechts. Jede Insel ist mit dem Haken
  erreichbar (geprüft für alle vier Sprünge); Ziel: die ferne Insel erreichen und 500 Taler.
- v1.75.1: Dampfwolken, wenn Wasser auf Lava trifft.
- v1.75.2: Behoben: Stein- und Winterstil färbten Ofenfeuer und Ladenlicht grau. `restyle` lässt
  jetzt alles mit Sättigung über 0,7 stehen (Holz liegt bei höchstens 0,65); Test `skins.spec.js`.
- v1.75.3: Die Mehrspieler-Tests laufen wieder (`npm test` installiert die Relay-Pakete selbst).
- v1.76.0: Zweites Schaustück-Level „Bergdorf“: ein Tal mit der Burg, eine Terrasse mit Wald und
  Teich, eine Hochebene mit Felskante, darunter ein altes Bergwerk mit Stützbalken und Gold.
  Ziel: auf allen Ebenen bauen (Sägewerk, 2 Hütten, Fahrstuhl hinab ins Bergwerk) und 300 Taler.
  Im Spiel geprüft: Die Hochebene zählt als erreicht, der Fahrstuhl fährt bis in die Halle, an
  39 von 60 Stellen der Hochebene ist der Schacht ohne Fels.
- v1.76.1: Wasserfälle mit Gischt (wie Noita/Terraria): Wo ein schmaler Wasserstrahl in einen
  Teich oder auf den Boden fällt, springen Tropfen und steigt ab und zu Nebel auf (`effects.js`,
  nur Bild). Ruhige Seen und abfließende Kanten bleiben ruhig.
- v1.76.2: Tropfsteinhöhlen (wie SteamWorld Dig 2/Terraria): An Höhlendecken hängen nahe der
  Oberfläche Wurzeln, tiefer Tropfsteine (im Winter Eiszapfen, in der Wüste sandfarben); jeder
  dritte tropft, der Tropfen zerspritzt beim Aufschlag, ohne Wasser hinzuzufügen (`decor.js`,
  nach Ort verteilt wie die Leuchtpilze, also in jeder Welt gleich).
- v1.76.3: Leben an der Oberfläche (wie Terraria): Schmetterlinge flattern am Tag über Wiesen
  (nicht bei Regen, Nacht, Winter, Wüste; vor den Bäumen gezeichnet), und von Laubbäumen fallen
  Blätter, die im Wind pendeln, sich gelb färben und kurz am Boden liegen bleiben.
- v1.77.0: Festung (wie Clonk/OpenClonk): Mauer (24 hoch, für alle fest, Monster schlagen darauf
  ein), Steinsturz über dem Tor, damit kein Monster darüber springt, Kanonenturm (Kugeln, die
  beim Aufschlag platzen; 1 Kohle = 3 Schuss). Festungsteile dürfen direkt aneinander stehen,
  haben Lebenspunkte mit Rissen und Balken, und ein Wühler daneben bessert sie aus (`fort.js`).
- v1.78.0: Belagerung: Angriffswellen kommen nur über Land von den Kartenrändern und marschieren
  auf die Burg (`siege.js`); Mauern halten sie auf, die Burg hat in der Belagerung 1000
  Lebenspunkte. Neues Level „Belagerung“: Burg auf einem Hügel, Fels und Kohle gleich darunter,
  drei Wellen; Ziele: 4 Mauern, ein Kanonenturm, 3 Wellen abwehren.
- v1.78.1: Wassergraben und Mauerschützen: Monster ertrinken in Wasser (ein Graben ist eine
  Verteidigung); „Auf die Mauer“ an jeder Mauer und jedem Tor, ein Wühler oben schießt einen
  Pfeil pro Sekunde auf Monster bis 150 weit (`fort.js`).
- v1.79.0: Freier Modus „Festung“: Jede Nacht kommt eine Welle über Land von beiden Seiten,
  jede größer als die vorige (ab Nacht 2 eine Spinne, ab Nacht 3 ein Golem); ein Morgen mit
  stehender Burg zählt, Ziel 3 Nächte; Startausrüstung Fels, Bretter, Metall und Kohle.
- v1.87.0: Öl und Feuer (wie Noita/Clonk): Öl (Material 14) schwimmt auf Wasser, liegt in Blasen
  tief in der Erde (freies Spiel) und brennt; Lava, Explosionen, Brandpfeile und brennende Wühler
  zünden es, das Feuer breitet sich aus, wirft Flammen, Rauch und Licht in die Tiefe, setzt Wühler
  und Bäume in Brand, verletzt Monster und verbrennt das Öl (`fire.js`). Kartenzeichen `B`.
- v1.88.0: Boss „Riesenwurm“ (wie Terraria/Noita): Kopf und 13 Panzerglieder, gräbt sich durch die
  Erde, bricht im Bogen an der Oberfläche aus, trifft, wen sein Körper berührt; Pfeile, Explosionen,
  Kanone und brennendes Öl treffen den Kopf; Boss-Balken unten; besiegt 14 Goldklumpen, Erz und
  Edelsteine. Kommt im freien Spiel einmal pro Welt nach 10 Minuten und in Nacht 3 von „Festung“.
- v1.89.0: Erfolge: 18 Langzeitziele (Gold, Taler, Bäume, Gebäude, Edelsteine, Monster, Truhen,
  Tiefe, Öl, Riesenwurm, Festungsnächte, Siege, 3 Sterne, Mehrspieler, zu zweit, Tagesschächte),
  nur im Profil auf dem Gerät, mit Banner und XP; Liste auf der Aufgaben-Tafel (`achievements.js`).
- v1.90.0: Angeln (wie Terraria): Angelrute in der Burg (25 Taler, 2 Holz); am Wasser „Angeln“,
  beißt etwas an (Schwimmer taucht, „!“), holt die Aktion es ein: meist ein Fisch (8 Taler), sonst
  Gold, ein Edelstein, Taler oder ein Stein; Fische in der Nähe beißen schneller (`fishing.js`).
- v1.91.0: Wandernder Händler (wie Terraria/Clonk): steht eine Hütte, kommt ab Minute 4 alle 6–9
  Minuten ein Händler über Land zur Burg, bleibt 2½ Minuten; an ihm öffnet die Aktion seinen Stand
  mit 3 wechselnden Angeboten (Sprengladungen, Metall, Kohle, Bretter, Glücksbeutel, Angelrute oder
  Enterhaken günstig), dann zieht er weiter (`merchant.js`).
- v1.92.0: Ackerbau (wie OpenClonk): Feld (Korn wächst in Stufen, im Regen doppelt so schnell,
  im Winter und in der Wüste langsamer; reif mit der Aktion ernten, 3 Korn, sät sich neu) und
  Mühle (Korn → Brot von selbst); Brot bleibt in der Tasche, an der Burg nimmt ein Wühler ein
  Laib mit und isst es, wenn seine Kraft unter 35 fällt (+50) (`farm.js`).
- v1.93.0: Gefährliche Nächte (wie Terraria): im freien Spiel ab der zweiten Nacht 1–3 Monster
  (im Koop mehr) auf der Oberfläche nahe den Wühlern, außerhalb des Bildes; bei Morgengrauen
  graben sich die, bei denen niemand ist, ein (`nights.js`). Nicht im entspannten Spiel.
- v1.94.0: Siedler (wie Terraria/Clonk-Siedlung): in jede fertige Hütte zieht nach und nach ein
  Siedler, er läuft tagsüber zwischen Hütte und Burg, nachts ist er daheim, zahlt alle 30 s 2 Taler
  und isst jeden Morgen ein Brot aus dem Lager; ohne Brot zieht er nach dem zweiten hungrigen Morgen
  aus (`villagers.js`).
- Nachtrag v1.95.0: Spielmodi haben in der Auswahl nur noch eine Karte; das Bild zeigt Wiese, Wüste und Winter nebeneinander, die Welt wechselt jede Runde.
- v1.94.1: Lore-Fix: sie nimmt Stufen bis 4 px (Wühler: 3), lässt sich also jeden begehbaren Hang
  hochschieben; Holztreppen und Brücken tragen sie nur an den Rädern (`setPlat(3)`), so rollt sie
  unter einer Treppe durch und hinauf, statt daran hängen zu bleiben (`tests/lorry.spec.js`).
- Nachtrag v1.96.0: Fluffel-Begleiter (pets.js): mit Brot oder Fisch gefüttert folgt er seinem Wühler, trägt ein rotes Halsband und zeigt mit einem pulsierenden Funkeln Gold und Edelsteine in bis zu 40 px Umkreis.
- Nachtrag v1.97.0: Jahreszeiten (seasons.js) in Wiesen-Welten der freien Modi: jeder Spieltag eine Jahreszeit; Eichen mit Blüten (Frühling), rot-gold (Herbst), kahl mit Reif (Winter), Kiefern verschneit, Regen fällt im Winter als Schnee.
- Nachtrag v1.98.0: Hintergrund-Hügel der Wiesen-Welt im Herbst warm (eigene Ebenen), im Winter die verschneiten Winter-Ebenen; Mühlenflügel nicht mehr im Sprite, sie drehen sich (Wind, schneller beim Mahlen); fallende Bäume tragen das Kleid der Jahreszeit.
- Nachtrag v1.100.0: Schreine (shrines.js) tief unten in freien Welten: Halle mit Granitboden, zwei Säulen, Altar und ein Kristall in der Farbe der Gabe, der leuchtet und pulsiert, solange die Gabe nicht genommen ist.
- Nachtrag v1.101.0: Schatzkarten (hoards.js): großes Versteck als eisenbeschlagene Truhe auf Goldhaufen, rotes Kreuz auf der Karte, roter Pfeil am Bildrand. Tränke (potions.js): Braukessel (schwarzer Topf über Feuer, grüner Sud, blubbert beim Brauen), Leuchtpilz und drei Trankflaschen (rot, gelb, blau) als Gegenstände; der Leuchttrank öffnet ein zweites, weites Lichtloch und einen größeren warmen Schein.
- Nachtrag v1.102.0: Karte mit unerforschten Gebieten (fog.js): Unbekanntes ist dunkel (#1a120c), Himmel und ein Streifen unter der Oberfläche sind bekannt; gesehene Schreine als kleines Licht in ihrer Farbe (grau, wenn genommen). Volle Tasche: der Taschen-Knopf wackelt kurz, solange ein Fund nicht hineinpasst.
- Nachtrag v1.103.0: Grabstein (tombs.js), wo ein Wühler erschöpft liegen blieb: grauer Stein mit Kreuz, auf der Karte als graues Feld, für den eigenen Spieler ein grauer Pfeil am Bildrand. Neue Fische: Höhlenfisch (blass, rotes Auge) und Goldfisch (orange-gold).
- Nachtrag v1.104.0: Tiefenanzeige im Status-Chip („↓ 30 m“, gold, wo tiefes Gold ergiebiger ist); Name des gewählten Gegenstands kurz links neben der Tasche (dunkles Schild, helle Schrift).
- Nachtrag v1.105.0: Uhr neben dem Geld: Halbscheibe aus Himmel über grünem Horizont, Sonne (gelb) bei Tag, Mond (hell, angeschnitten) bei Nacht vor dunklem Blau; daneben die Jahreszeit (🌸☀️🍂❄️). Händler auf der Karte als blinkendes lila-goldenes Feld.
