# Flintworks

Ein Aufbau- und Grabespiel mit Pixel-Physik im Stil der Klassiker, inspiriert von den Clonk-Spielen: Führe deine Crew, grabe nach Gold, fälle Bäume, baue eine Produktionskette und verkaufe alles an der Heimatbasis.

Läuft im Browser, als installierbare Web-App und als Android-App, auf Deutsch und Englisch (Umschalter im Startbildschirm). Das erste Spiel ist ein geführtes Tutorial in einer eigenen kleinen Welt („Die erste Schicht“); danach erklären Tipps und kleine Aufträge den Rest, nachzulesen unter Optionen → Spielhilfe.

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
npm test           # Browser-Tests: spielt das Tutorial durch (Playwright)
```

Für die Tests einmalig `npx playwright install chromium` ausführen oder einen vorhandenen Chromium mit `PW_CHROMIUM=/pfad/zu/chrome npm test` angeben.

Mit `?seed=7` in der Adresse entsteht immer dieselbe Welt.

Die Android-App lässt sich lokal mit Android Studio aus dem Ordner `android/` bauen. Normalerweise ist das nicht nötig: GitHub baut sie automatisch.

## Neue Texte übersetzen

Texte werden mit `tr('Deutscher Text', { platzhalter })` ausgegeben bzw. direkt an `toast()` übergeben. Für Englisch den deutschen Text als Schlüssel in `src/i18n.js` eintragen. Fehlt ein Eintrag, erscheint der deutsche Text.

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
  effects.js          Berge, Lava-Glühen, Wasserglitzern, Staub, Spritzer, Glühwürmchen
  light.js            Untergrund-Dämmerung, warmes Lampenlicht, Vignette
  uiart.js            Pixel-Logo und 9-Slice-Rahmen, beim Start gezeichnet
  ambience.js         Regen, Wind, Vögel, Grillen
  save.js             Spielstand im Browser speichern
  sprites.js          Pixel-Grafiken
  tutorial.js         Geführtes Tutorial: Ablauf, Zielpfeil, Knopf-Hervorhebung, Geisterhand, Abschlusskarte
  tutsteps.js         Die zehn Schritte des Tutorials
  tutlevel.js         Die Tutorial-Welt mit festem Lehrpfad
  lessons.js          Tipps und Aufträge nach dem Tutorial, Spielhilfe in der Lobby
  i18n.js             Übersetzungen (Deutsch ist der Schlüssel, Englisch die Übersetzung)
  debug.js            Test-Zugang, nur im Entwicklungsmodus
  style.css           Gestaltung
tests/                Browser-Tests (Playwright)
public/icons/         App-Icons
android/              Android-Projekt (Capacitor)
```

Regel: keine Datei über 1000 Zeilen.
