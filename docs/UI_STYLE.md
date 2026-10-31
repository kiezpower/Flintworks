# UI-Leitfaden: Menüs, HUD, Knöpfe

> **Stand: v1.52.0.** Gilt für alles, was Spieler sehen. Bewertung des heutigen Stands:
> [ART_RUBRIC.md](ART_RUBRIC.md) (Kategorien 8–10). Grafikregeln: [STYLE.md](STYLE.md).
> Ziel: so knapp und klar wie SteamWorld Dig 2, im Holz- und Gold-Stil von Flintworks.

## Grundsätze

1. **Spiel, nicht Webseite.** Jedes Element benutzt den 9-Slice-Rahmen (`--frame`, `uiart.js`),
   die Holz- und Gold-Palette und Pixelschriften. Keine Browser-Standardknöpfe, keine Formulare,
   keine Dashboard-Karten.
2. **In einer Sekunde lesbar:** Wo bin ich? Was kann ich tun? Was ist wichtig? Komme ich voran? Droht Gefahr?
3. **Ein Hauptknopf je Bildschirm** (Gold, `.go`), alles andere ruhiger (`.ghost`, `.small`).
4. **Zeigen statt schreiben:** Icon und Zustand vor Text; Beschreibungen höchstens zwei Zeilen.
5. **Nur was nützt:** Neues erscheint, wenn es gebraucht wird (Tutorial: `onboarding.css`).

## Bausteine (`style.css`, `onboarding.css`)

| Token | Wert | Bedeutung |
|---|---|---|
| `--gold` | `#f2c230` | Hauptaktion, Geld, Auswahl, Fokus |
| `--ember` | `#e0572f` | Gefahr, zu teuer, Verlust – nie als Deko |
| `--leaf` | `#7cbf52` | erledigt, Gewinn, Leben |
| `--water` | `#6fb7ff` | Information, Luft |
| `--ink` | `#f4ead2` | Text, Kontrast zum Rahmen ≥ 4,5:1 |
| `--panel` | dunkles Braun, 82 % | Fensterfläche |

**Schrift:** Überschriften `Pixelify Sans` (`--font-display`), Beschriftungen `Silkscreen`
(`--font-ui`). Mindestgröße **12 px** für Lesetext und **10 px** für Knopfbeschriftungen in Großbuchstaben.
„Große Texte“ (`--ui-scale` 1,25) muss alles mitwachsen lassen.

**Abstände:** Raster in Vielfachen von 2 px; Innenabstand von Kacheln 8–10 px; zwischen Gruppen 12 px.

**Icons:** 24×24 (doppelt aufgelöst aus 12×12, `padIcon`/`itemIcon`), ganze Gerätepixel, Licht von
oben, Umriss `#24160c`. Ein Begriff hat genau ein Icon (Geld = Münze, Lager = Burg).

## HUD-Prioritäten

1. Tutorial-Aufgabe oder Gefahr (Luft, Feuer) oben in der Mitte.
2. Geld und Rundenziel oben links.
3. Spielfigur und Crew (Porträts) oben links.
4. Bauen und Menü oben rechts, Minikarte darunter.
5. Tipps und Aufträge: **eine** Spur oben unter der Aufgabe, nie übereinander.

Das HUD belegt höchstens 15 % der Fläche und verdeckt nie die Figur. Am Handy bleiben die Daumen frei:
links der Stick, rechts die runden Knöpfe (Aktion 88 px).

## Fenster, Kacheln, Raster

- Fenster mittig, Breite `min(640px, 100% − 32px)` am Desktop, ganze Breite am Handy, mit Reitern statt
  Listen über 8 Einträge.
- Kacheln: Icon links, Name, höchstens zwei Zeilen Nutzen, Preis (11 px), darunter der Grund als Chip.
  Umsetzung: `opt(parent, { …, state, why, pct })` in `ui.js`, Gestaltung in `panels.css`; fehlende
  Mengen mit `lacking(c, need, money)` („Fehlt: 2× Holz + 10 Taler“). Lange Fenster bekommen
  Reiter (`chips(p)`): einer zeigt nur seinen Abschnitt, ein zweiter Tipp wieder alle; die Wahl
  bleibt beim Neuöffnen erhalten.
- **Kachelzustände** (Pflicht für Laden, Bauen, Forschung):

| Zustand | Aussehen |
|---|---|
| leistbar | normal, Preis in `--ink` |
| zu teuer | Icon gedimmt, fehlender Teil des Preises in `--ember` |
| gesperrt | Schloss-Icon, Kachel grau, „Erst: Mechanik“ als Chip |
| gekauft / vorhanden | Haken in `--leaf`, Kachel nicht mehr wählbar |
| ausgewählt | Goldrahmen |

- Vergleich: Werkzeuge und Ausrüstung zeigen vorher → nachher (z. B. „Hacke 1 → 2“).

## Knöpfe und Zustände

| Zustand | Pflicht | Heute |
|---|---|---|
| ruhend | Rahmen und Fläche | ja |
| Hover (Maus) | heller | ja (`.go`, `.opt` Goldrand, Chips) |
| Fokus (Tastatur) | heller Ring, 2–3 px, Abstand 2–4 px | ja (`:focus-visible`) |
| gedrückt | 2 px tiefer, Schatten kürzer, Klick-Ton | ja (`.go:active`, Klick in `main.js`) |
| deaktiviert | halbe Deckkraft bzw. Zustand `st-poor`/`st-locked`, Grund als Chip | ja für Kacheln (`panels.css`, `opt({ state, why })`) |
| ausgewählt | Goldrahmen | ja (`.cbtn.sel`, Levelkarten) |
| beschäftigt | Puls oder Fortschrittsbalken, kein Doppelklick | ja (`st-busy` mit Balken, `#lbPlay.wait`, Karten-Knöpfe einmalig) |
| Fehler | kurzer Ruck, Ton, Text mit nächstem Schritt | ja für Kacheln (`.nope`, Ton `thud`, Toast mit Grund) |
| Abklingzeit | Füllbalken im Knopf | fehlt (es gibt keine Abklingzeiten) |

**Größen:** Tippflächen ≥ 44 px (Hauptknöpfe ≥ 56 px, Startknopf 72 px), Desktop-Knöpfe ≥ 32 px hoch.

**Eingabe:** Maus, Touch und Tastatur gleichwertig. Enter/Leertaste löst den Fokus aus, Esc schließt
das Fenster bzw. öffnet das Menü, Tippen neben ein Fenster schließt es. Der erste Fokus liegt auf dem
Hauptknopf. Tastenzeichen im Text: „→“, „Leertaste“, „F“ (siehe Texte in `tutsteps.js`). Gamepad
wird nicht unterstützt.

## Bewegung und Ton

- Übergänge 150–300 ms in Stufen (`steps()`), nie länger. Bei reduzierter Bewegung: aus.
- Jede Bestätigung hat Bild und Ton im selben Frame (Klick, Münzen, Fanfare).

## Ränder, Sprachen, Barrierefreiheit

- Safe-Area-Abstände (`env(safe-area-inset-*)`) an allen Rändern.
- Englische Texte sind bis zu 30 % länger. Mit `?lang=pseudo` prüfen, dass nichts abgeschnitten wird.
- Farbe nie allein: Gefahr hat Icon oder Form, leistbar/zu teuer hat Dimmen oder Schloss.
- Kein Zeitdruck in Menüs, keine Doppelbedeutung von Gold (Geld und Fokus sind beide Gold, Fokus hat zusätzlich den Ring).

## So nie

- Weiße Browser-Knöpfe, Dropdowns, Scrollbalken im Systemstil.
- Listen mit 14 gleich großen Kacheln ohne Reiter.
- Rote Zahlen ohne Grund, oder Zustand nur über Farbe.
- 9-px-Fließtext, Absätze in Menüs.
- Zwei goldene Hauptknöpfe nebeneinander.
- Tipps, die Knöpfe oder die Spielfigur verdecken.
- Technische Texte (IDs, Fehlermeldungen, „undefined“) für Spieler.
