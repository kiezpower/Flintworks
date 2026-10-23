# Wühlwelt

Ein Aufbau- und Grabespiel mit Pixel-Physik im Stil der Klassiker: Führe deine Crew, grabe nach Gold, fälle Bäume, baue eine Produktionskette und verkaufe alles an der Heimatbasis.

Läuft komplett im Browser – auf dem Handy (Touch) und am PC (Tastatur). Eine einzige HTML-Datei, keine Abhängigkeiten, kein Build-Schritt.

## Spielen

Nach dem Einrichten von GitHub Pages (siehe unten) läuft das Spiel unter:

```
https://<dein-github-name>.github.io/wuehlwelt/
```

### Auf dem Handy als App

- **iPhone:** Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“
- **Android:** Seite in Chrome öffnen → Menü → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“

Danach startet Wühlwelt im Vollbild, mit eigenem Icon und funktioniert auch offline. Der Spielstand wird im Browser gespeichert.

## Steuerung

| Aktion | Touch | Tastatur |
|---|---|---|
| Laufen, klettern, hangeln | Stick links | Pfeile / WASD |
| Springen | Stick nach oben schnippen oder „Sprung“ | Leertaste |
| Graben (gerade, ↓/↑ schräg) | „Graben“ halten oder kurz tippen | Shift / X |
| Werfen | „Wurf“ | E |
| Aktion (Fällen, Basis, Werk, Brücke …) | Aktions-Knopf | F |
| Bauen | „Bauen“ oben rechts | B |
| Wühler wechseln | Porträt oben links oder Wühler antippen | Tab |
| Karte | „Karte“ | M |

## Inhalte

- Zerstörbare Pixel-Landschaft: Erde, Fels, Sand, Lehm, Erz, Kohle, Gold, Wasser, Lava, Säure
- Lava + Wasser wird Fels, Säure frisst Erde, Explosionstrümmer landen als Material
- Crew aus mehreren Wühlern, Folgen-Modus, Nachkauf an der Basis
- Gebäude: Hütte, Flagge, Werkstatt, Sägewerk, Windrad, Fahrstuhl, Pumpe, Hochofen, Chemiefabrik, Wachturm, Tor
- Strom aus Windrädern, Baugebiet durch Flaggen, Burg-Ausbau in drei Stufen
- Wipfe, Fische, Vögel, Höhlenmonster
- Tag und Nacht, Regen, Gewitter, Meteore, Feuer
- Synthetisierte Soundeffekte (Web Audio)

## GitHub Pages einrichten

1. Repository auf GitHub öffnen → **Settings** → **Pages**
2. Unter **Build and deployment**: Source **Deploy from a branch**
3. Branch **main**, Ordner **/ (root)** → **Save**
4. Nach ca. einer Minute ist das Spiel unter der oben genannten Adresse erreichbar

## Lokal starten

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` öffnen. (Die Datei lässt sich auch direkt per Doppelklick öffnen; Offline-Modus und App-Installation funktionieren dann aber nicht.)

## Updates veröffentlichen

1. `index.html` ändern
2. In `sw.js` die Konstante `VERSION` erhöhen (z. B. `wuehlwelt-v2`), damit Handys die neue Version laden
3. Committen und pushen – GitHub Pages aktualisiert automatisch

## Projektstruktur

```
index.html             Das komplette Spiel (HTML, CSS, JavaScript)
manifest.webmanifest   App-Beschreibung für „Zum Startbildschirm“
sw.js                  Service Worker für Offline-Betrieb
icons/                 App-Icons
.nojekyll              GitHub Pages ohne Jekyll ausliefern
```
