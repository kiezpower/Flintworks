# Flintworks

Ein Aufbau- und Grabespiel mit Pixel-Physik im Stil der Klassiker, inspiriert von den Clonk-Spielen: Führe deine Crew, grabe nach Gold, fälle Bäume, baue eine Produktionskette und verkaufe alles an der Heimatbasis.

Läuft im Browser, als installierbare Web-App und als Android-App.

## Spielen

- **Browser:** https://kiezpower.github.io/Flintworks/
- **Handy als Web-App:** Adresse öffnen → iPhone: Teilen → „Zum Home-Bildschirm“ · Android: Menü → „App installieren“
- **Android-App:** Unter [Releases](https://github.com/kiezpower/Flintworks/releases/latest) `flintworks.apk` herunterladen und öffnen (einmalig „Installation aus unbekannten Quellen“ erlauben)

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

## Entwickeln

Voraussetzung: Node.js 22 oder neuer.

```
npm install
npm run dev        # Entwicklungsserver mit Live-Reload, auch im WLAN fürs Handy erreichbar
npm run build      # fertige Web-Version in dist/
npm run preview    # gebaute Version lokal testen
npm run android    # Web-Version bauen und ins Android-Projekt kopieren
```

Die Android-App lässt sich lokal mit Android Studio aus dem Ordner `android/` bauen. Normalerweise ist das nicht nötig: GitHub baut sie automatisch.

## Automatische Builds

| Workflow | Auslöser | Ergebnis |
|---|---|---|
| `pages.yml` | Push auf `main` | Web-Version auf GitHub Pages |
| `android.yml` | Push auf `main` | `flintworks.apk` als neues Release |

Einmalig einrichten: **Settings → Pages → Source: GitHub Actions**.

## Projektstruktur

```
index.html            Seitengerüst (HUD, Knöpfe, Dialoge)
src/
  main.js             Start, Spielschleife, Start-/Endbildschirm
  state.js            Gemeinsamer Spielzustand (Objekt G, Listen)
  world.js            Materialien, Pixel-Welt, Kollision
  sim.js              Fallende Pixel: Sand, Wasser, Lava, Säure
  gen.js              Weltgenerator
  entities.js         Wühler, Tiere, Gegenstände anlegen; Bewegung
  clonk.js            Wühler-Steuerung, Graben, Klettern, Aktionen
  buildings.js        Gebäude, Produktion, Strom, Gebiet
  objects.js          Gegenstände, Bäume, Tiere, Explosionen, Partikel
  weather.js          Tag/Nacht, Regen, Gewitter, Meteore
  sound.js            Synthetisierte Soundeffekte
  input.js            Tastatur, Touch-Stick, Knöpfe
  render.js           Zeichnen der Spielwelt
  ui.js               HUD, Menüs, Karte, Tipps
  save.js             Spielstand im Browser speichern
  sprites.js          Pixel-Grafiken
  debug.js            Test-Zugang, nur im Entwicklungsmodus
  style.css           Gestaltung
public/icons/         App-Icons
android/              Android-Projekt (Capacitor)
```

Regel: keine Datei über 1000 Zeilen.
