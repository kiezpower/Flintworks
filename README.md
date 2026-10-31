# Flintworks

Ein Aufbau- und Grabespiel mit Pixel-Physik im Stil der Klassiker, inspiriert von den Clonk-Spielen: Führe deine Crew, grabe nach Gold, fälle Bäume, baue eine Produktionskette und verkaufe alles an der Heimatbasis.

**Tagesschacht:** Jeden Tag eine neue Welt, für alle Spieler gleich. Acht Minuten Zeit, so viel Taler wie möglich verdienen, Medaillen und eine Serie von Tagen in Folge sammeln und das Ergebnis mit Freunden teilen (WhatsApp, Teilen-Menü oder Zwischenablage). Der geteilte Link `?daily` öffnet direkt den Schacht des Tages.

**Zusammen spielen:** Bis zu vier Spieler, im Koop, im Versus (zwei Teams) oder „Jeder gegen jeden“ (ab drei Spielern jeder mit eigener Burg, eine gestürmte Burg ist raus, der Letzte gewinnt). „Schnell spielen“ bringt dich ohne Code mit anderen Spielern zusammen (in einen offenen Raum mit freiem Platz, sonst eröffnest du einen); die Liste zeigt alle offenen Räume zum Auswählen. Schnell-Räume spielen den „Modus der Stunde“ (jede Stunde ein anderer Modus oder eine andere Karte, Koop oder Versus, für alle gleich) und starten von selbst: Sind zwei Spieler da, läuft ein Countdown von 20 Sekunden, sind alle bereit, geht es nach 3 Sekunden los; nach einer Runde folgt die nächste genauso. Versus-Runden dauern dort 4 statt 8 Minuten. Ist man allein, geht es nach 30 Sekunden trotzdem los: im Versus gegen Bots, die freie Burgen übernehmen. Wer später dazukommt, übernimmt die Burg eines Bots.

**Bots und Helfer:** Helfer arbeiten nur fürs eigene Lager (graben, sammeln, heimbringen). Bots sind Gegner und spielen wie ein Mensch: Sie kaufen Feuersteine und TNT, laufen zur gegnerischen Burg, zielen und werfen, nehmen den Hügel, verteidigen die eigene Burg, heben Nachschub auf und graben im Wettgraben nach unten. Jeder Bot hat einen Stil (Stürmer, Hügel, Sammler) und trägt „(Bot)“ im Namen. Ein Raum für Freunde bleibt verborgen und wird per Code, Link oder QR-Code geteilt; der Host kann jeden Raum öffnen oder schließen.

**Heimatbergwerk:** Kristalle sind die Währung, die zwischen den Runden bleibt. Deine Heim-Crew schürft sie auch, wenn das Spiel zu ist (bis der Tresor voll ist, anfangs nach 4 Stunden), jede Runde bringt welche dazu (1 je 40 verdiente Taler, 10 für einen Sieg, Medaillen im Tagesschacht). Kassiert wird in der Lobby unter „Heimatbergwerk“. Ausgeben kannst du sie für mehr Heim-Crew und einen größeren Tresor, für kleine Boni im freien Spiel allein (Startkasse, schärfere Hacken, Holzvorrat; nie im Mehrspieler, im Tagesschacht, in der Kampagne oder im Tutorial) und für Skins: Outfits für deinen Wühler und Baustile für deine Gebäude. Die sehen auch deine Mitspieler. Kristalle gibt es nur durchs Spielen, nicht für Geld.

**Produktion im Blick:** Im Burg-Menü zeigt „Produktion“, welches Gebäude läuft und welches auf was wartet. Fehlt Holz, Erz oder Kohle, schickt „Helfer schicken“ einen freien Helfer los. Wartet ein Gebäude länger als 30 Sekunden, blinkt seine Blase.

Läuft im Browser, als installierbare Web-App und als Android-App, auf Deutsch und Englisch (Umschalter im Startbildschirm). Das erste Spiel ist ein geführtes Tutorial in einer eigenen kleinen Welt („Die erste Schicht“); danach erklären Tipps und kleine Aufträge den Rest, nachzulesen unter Optionen → Spielhilfe.

## Spielen

- **Browser:** https://kiezpower.github.io/Flintworks/
- **Handy als Web-App:** Adresse öffnen → iPhone: Teilen → „Zum Home-Bildschirm“ · Android: Menü → „App installieren“
- **Android-App:** Unter [Releases](https://github.com/kiezpower/Flintworks/releases/latest) `flintworks.apk` herunterladen und öffnen (einmalig „Installation aus unbekannten Quellen“ erlauben)

## Steuerung

| Aktion | Touch | Tastatur |
|---|---|---|
| Laufen (klassisch auch klettern, hangeln) | Stick links | Pfeile / WASD |
| Springen | Stick nach oben schnippen oder „Sprung“ | Leertaste |
| Graben (gerade, ↓/↑ schräg) | „Graben“ halten oder kurz tippen | Shift / X |
| Werfen | „Wurf“ | E |
| Durch Holztreppe oder -brücke nach unten | Stick nach unten | ↓ / S |
| Aktion (Fällen, Basis, Werk, Brücke, Treppe, Heim …) | Aktions-Knopf | F |
| Enterhaken (nach dem Kauf) | „Haken“ | G |
| Bauen | „Bauen“ oben rechts | B |
| Wühler wechseln | Porträt oben links oder Wühler antippen | Tab |
| Karte | Kleine Karte oben rechts | M |

Zwei Steuerungen (Optionen → Steuerung): **Modern** (Standard) gräbt, wenn man gegen Erde läuft, und hat einen eigenen Sprung-Knopf. **Klassisch** gräbt mit dem Graben-Knopf und lässt an Wänden klettern und an Decken hängen, wie im Original.

**Levelauswahl** (Lobby → Modus): ein Screen zum Durchscrollen, jede Reihe zum Wischen. Oben „Empfohlen“ (das nächste Kampagnen-Level und der Tagesschacht), dann Goldrausch, Siedler und Schatzsucher mit je einer Karte für Wiese, Wüste und Winter, die beiden Kapitel der Kampagne und die Karten für Koop und Versus. Die Chips oben springen zu den Abschnitten.

**Schwierigkeit** (Optionen → Spiel, gilt fürs freie Spiel; Kampagne und Tagesschacht haben ihre eigene): Gemütlich (keine Monster, kein Gas, keine Blitze und Meteore, ruhiges Tempo), Abenteuer (alle Gefahren) oder Hart (alle Gefahren, volles Tempo). Baugebiete (bauen nur im eigenen Gebiet, Flaggen erweitern es) gelten im Modus Siedler, für alle Spieler gleich.

**Festgesessen?** Ist eine Kante zu hoch zum Springen, gräbt sich der Wühler in einer Grube oder Höhle von selbst schräg nach oben, sobald man gegen die Erdwand läuft (moderne Steuerung). Geht das nicht (Fels), zeigt der Aktions-Knopf den Ausweg: „Treppe“ (1 Brett oder 1 Holz aus Gepäck oder Lager, bis zur Kante) und ohne Holz „Heim“ (zurück zur Basis). Der **Enterhaken** (in der Basis zu kaufen, 30 Taler, 2 Holz, 1 Stein) bekommt einen eigenen Knopf „Haken“ (Taste G): Er schießt den Haken an die nächste Kante über dir, auch an eine niedrige und auch im Sprung, und das Seil zieht dich hoch. Ohne Kante in Reichweite ist der Knopf blass.

Holztreppen und Holzbrücken tragen nur von oben: Man läuft von der Seite unter ihnen durch, springt von unten hindurch und steigt auf, wo sie die Füße erreichen. Lehmbrücken bleiben feste Wände.

## Entwickeln

Voraussetzung: Node.js 22 oder neuer.

```
npm install
npm run dev        # Entwicklungsserver mit Live-Reload, auch im WLAN fürs Handy erreichbar
npm run build      # fertige Web-Version in dist/
npm run preview    # gebaute Version lokal testen
npm run android    # Web-Version bauen und ins Android-Projekt kopieren
npm test           # Browser-Tests: spielt das Tutorial durch, gräbt durch jedes Material, prüft Weltgrößen und Versus-Regeln (Playwright)
npm run test:visual # spielt eine Runde, speichert Screenshots in tests/out/ und prüft auf Fehler
npm run previews   # Vorschaubilder der Level für die Levelauswahl neu erzeugen (nach Änderungen an Leveln)
npm run store-shots # erzeugt Store-Bilder (Screenshots, Cover, Feature-Grafik) in docs/itch/ und docs/play/
```

Für die Tests einmalig `npx playwright install chromium` ausführen oder einen vorhandenen Chromium mit `PW_CHROMIUM=/pfad/zu/chrome npm test` angeben.

Mit `?seed=7` in der Adresse entsteht immer dieselbe Welt. Nur im Entwicklungsserver: `?size=700x300` gibt dem freien Spiel eine andere Weltgröße (300–2800 × 150–700), auch für alle Mitspieler einer Runde.

Der Bildtest (`npm run test:visual`) startet Vite selbst und versteht ebenfalls `PW_CHROMIUM=/pfad/zu/chrome`.

Die Android-App lässt sich lokal mit Android Studio aus dem Ordner `android/` bauen. Normalerweise ist das nicht nötig: GitHub baut sie automatisch.

## Level bauen

Vorgebaute Level (Kampagne, Kapitel 2) und Karten für Koop und Versus liegen in `src/levels/`, je ein Ordner mit `map.txt` und `level.json`. Wie das geht, steht in [docs/LEVELS.md](docs/LEVELS.md). Im Entwicklungsserver gibt es dafür einen Editor unter `/editor.html`.

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
  climb.js            Aus Gruben heraus: Kante erkennen, Rampe graben, Treppe, Heim; Enterhaken-Knopf
  buildings.js        Gebäude, Produktion, Strom, Gebiet
  objects.js          Gegenstände, Bäume, Tiere, Explosionen, Partikel
  weather.js          Tag/Nacht, Regen, Gewitter, Meteore
  sound.js            Synthetisierte Soundeffekte
  input.js            Tastatur, Touch-Stick, Knöpfe
  render.js           Zeichnen der Spielwelt
  ui.js               HUD, Menüs, Karte, Tipps
  settings.js         Einstellungen in Gruppen, gleich in Lobby-Optionen und Spielmenü
  effects.js          Berge, Lava-Glühen, Wasserglitzern, Staub, Spritzer, Glühwürmchen
  light.js            Untergrund-Dämmerung, warmes Lampenlicht, Vignette
  uiart.js            Pixel-Logo und 9-Slice-Rahmen, beim Start gezeichnet
  ambience.js         Regen, Wind, Vögel, Grillen
  save.js             Spielstand im Browser speichern
  camp.js             Heimatbergwerk: Kristalle, Offline-Ertrag, Tresor, Ausbau, Solo-Boni
  lobbycamp.js        Heimatbergwerk-Fenster in der Lobby (Kassieren, Ausbau, Skins)
  skins.js            Outfits für Wühler und Baustile für Gebäude
  sprites.js          Pixel-Grafiken
  tutorial.js         Geführtes Tutorial: Ablauf, Zielpfeil, Knopf-Hervorhebung, Geisterhand, Abschlusskarte
  tutsteps.js         Die zehn Schritte des Tutorials
  tutlevel.js         Die Tutorial-Welt mit festem Lehrpfad
  lessons.js          Tipps und Aufträge nach dem Tutorial, Spielhilfe in der Lobby
  versus.js           Versus: Burg-Lebenspunkte, Hügel, Rundenuhr, Nachschub, Sieger
  coop.js             Koop: Teamaufgaben
  daily.js            Tagesschacht: Welt des Tages, Uhr, Medaillen, Serie, Ergebnis teilen
  stats.js            Mehrspieler: Rangliste und Auszeichnungen am Rundenende
  i18n.js             Übersetzungen (Deutsch ist der Schlüssel, Englisch die Übersetzung)
  i18n2.js            Weitere Übersetzungen (damit keine Datei über 1000 Zeilen wächst)
  debug.js            Test-Zugang, nur im Entwicklungsmodus
  style.css           Gestaltung
tests/                Browser-Tests (Playwright)
public/icons/         App-Icons
android/              Android-Projekt (Capacitor)
```

Regel: keine Datei über 1000 Zeilen.
