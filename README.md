# Flintworks

Ein Aufbau- und Grabespiel mit Pixel-Physik im Stil der Klassiker, inspiriert von den Clonk-Spielen: Führe deine Crew, grabe nach Gold, fälle Bäume, baue eine Produktionskette und verkaufe alles an der Heimatbasis.

**Tagesschacht:** Jeden Tag eine neue Welt, für alle Spieler gleich. Acht Minuten Zeit, so viel Taler wie möglich verdienen, Medaillen und eine Serie von Tagen in Folge sammeln und das Ergebnis mit Freunden teilen (WhatsApp, Teilen-Menü oder Zwischenablage). Der geteilte Link `?daily` öffnet direkt den Schacht des Tages.

**Zusammen spielen:** Bis zu vier Spieler, im Koop, im Versus (zwei Teams) oder „Jeder gegen jeden“ (ab drei Spielern jeder mit eigener Burg, eine gestürmte Burg ist raus, der Letzte gewinnt). „Schnell spielen“ bringt dich ohne Code mit anderen Spielern zusammen (in einen offenen Raum mit freiem Platz, sonst eröffnest du einen); die Liste zeigt alle offenen Räume zum Auswählen. Schnell-Räume spielen den „Modus der Stunde“ (jede Stunde ein anderer Modus oder eine andere Karte, Koop oder Versus, für alle gleich) und starten von selbst: Sind zwei Spieler da, läuft ein Countdown von 20 Sekunden, sind alle bereit, geht es nach 3 Sekunden los; nach einer Runde folgt die nächste genauso. Versus-Runden dauern dort 4 statt 8 Minuten. Ist man allein, geht es nach 30 Sekunden trotzdem los: im Versus gegen Bots, die freie Burgen übernehmen. Wer später dazukommt, übernimmt die Burg eines Bots.

**Bots und Helfer:** Helfer arbeiten nur fürs eigene Lager (graben, sammeln, heimbringen). Bots sind Gegner und spielen wie ein Mensch: Sie kaufen Feuersteine und TNT, laufen zur gegnerischen Burg, zielen und werfen, nehmen den Hügel, verteidigen die eigene Burg, heben Nachschub auf und graben im Wettgraben nach unten. Jeder Bot hat einen Stil (Stürmer, Hügel, Sammler) und trägt „(Bot)“ im Namen. Ein Raum für Freunde bleibt verborgen und wird per Code, Link oder QR-Code geteilt; der Host kann jeden Raum öffnen oder schließen.

**Heimatbergwerk:** Kristalle sind die Währung, die zwischen den Runden bleibt. Deine Heim-Crew schürft sie auch, wenn das Spiel zu ist (bis der Tresor voll ist, anfangs nach 4 Stunden), jede Runde bringt welche dazu (1 je 40 verdiente Taler, 10 für einen Sieg, Medaillen im Tagesschacht). Kassiert wird in der Lobby unter „Heimatbergwerk“. Ausgeben kannst du sie für mehr Heim-Crew und einen größeren Tresor, für kleine Boni im freien Spiel allein (Startkasse, schärfere Hacken, Holzvorrat; nie im Mehrspieler, im Tagesschacht, in der Kampagne oder im Tutorial) und für Skins: Outfits für deinen Wühler und Baustile für deine Gebäude. Die sehen auch deine Mitspieler. Kristalle gibt es nur durchs Spielen, nicht für Geld.

**Produktion im Blick:** Im Burg-Menü zeigt „Produktion“, welches Gebäude läuft und welches auf was wartet. Fehlt Holz, Erz oder Kohle, schickt „Helfer schicken“ einen freien Helfer los. Wartet ein Gebäude länger als 30 Sekunden, blinkt seine Blase.

Läuft im Browser, als installierbare Web-App und als Android-App, auf Deutsch und Englisch (Umschalter im Startbildschirm). Beim allerersten Start geht es ohne Lobby direkt in eine kleine Welt („Die erste Schicht“): eine Taste oder ein Tippen, dann in drei Schritten laufen und springen, zum Gold graben und es an der Burg verkaufen – unter zwei Minuten. Wer es kann, sieht keine Anleitung; Überspringen geht jederzeit (Knopf oder Esc → Menü). Danach erklären Tipps und kleine Aufträge in der ersten echten Runde den Rest, nachzulesen unter Optionen → Spielhilfe. Ablauf und Messungen: [docs/TUTORIAL_PLAN.md](docs/TUTORIAL_PLAN.md).

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
| Enterhaken werfen (nach dem Kauf) | Stick zielt, „Haken“ | Pfeiltaste zielt, G |
| Bauen | „Bauen“ oben rechts | B |
| Wühler wechseln | Porträt oben links oder Wühler antippen | Tab |
| Karte | Kleine Karte oben rechts | M |
| Menü (auch Tutorial überspringen) | „Menü“ oben rechts | Esc |

**Anzeige** (Optionen → Anzeige): „Große Texte“ vergrößert Aufgabe, Tipps und Karten. Bei „Bewegung reduzieren“ im Betriebssystem bleiben Pfeil und Startknopf ruhig.

Zwei Steuerungen (Optionen → Steuerung): **Modern** (Standard) gräbt, wenn man gegen Erde läuft, und hat einen eigenen Sprung-Knopf. **Klassisch** gräbt mit dem Graben-Knopf und lässt an Wänden klettern und an Decken hängen, wie im Original.

**Levelauswahl** (Lobby → Modus): ein Screen zum Durchscrollen, jede Reihe zum Wischen. Oben „Empfohlen“ (das nächste Kampagnen-Level und der Tagesschacht), dann Goldrausch, Siedler und Schatzsucher mit je einer Karte für Wiese, Wüste und Winter, die beiden Kapitel der Kampagne und die Karten für Koop und Versus. Die Chips oben springen zu den Abschnitten.

**Schwierigkeit** (Optionen → Spiel, gilt fürs freie Spiel; Kampagne und Tagesschacht haben ihre eigene): Gemütlich (keine Monster, kein Gas, keine Blitze und Meteore, ruhiges Tempo), Abenteuer (alle Gefahren) oder Hart (alle Gefahren, volles Tempo). Baugebiete (bauen nur im eigenen Gebiet, Flaggen erweitern es) gelten im Modus Siedler, für alle Spieler gleich.

**Festgesessen?** Ist eine Kante zu hoch zum Springen, gräbt sich der Wühler in einer Grube oder Höhle von selbst schräg nach oben, sobald man gegen die Erdwand läuft (moderne Steuerung). Geht das nicht (Fels), zeigt der Aktions-Knopf den Ausweg: „Treppe“ (1 Brett oder 1 Holz aus Gepäck oder Lager, bis zur Kante) und ohne Holz „Heim“ (zurück zur Basis). Der **Enterhaken** (in der Basis zu kaufen, 30 Taler, 2 Holz, 1 Stein) bekommt einen eigenen Knopf „Haken“ (Taste G). Er wird immer geworfen: in die Richtung, in die du den Stick oder eine Pfeiltaste hältst, ohne Richtung an die nächste Kante über dir, sonst schräg nach oben. Was er trifft, daran zieht dich das Seil hin (gibt es dort einen Platz zum Stehen, landest du darauf); trifft er nichts, rollt sich das Seil wieder ein.

Holztreppen und Holzbrücken tragen nur von oben: Man läuft von der Seite unter ihnen durch, springt von unten hindurch und steigt auf, wo sie die Füße erreichen. Lehmbrücken bleiben feste Wände.

## Entwickeln

Voraussetzung: Node.js 22 oder neuer.

```
npm install
npm run dev        # Entwicklungsserver mit Live-Reload, auch im WLAN fürs Handy erreichbar
npm run build      # fertige Web-Version in dist/
npm run preview    # gebaute Version lokal testen
npm run android    # Web-Version bauen und ins Android-Projekt kopieren
npm test           # Browser-Tests: spielt das Tutorial durch (Neuling, Erfahrene, Touch, klassische Steuerung, Rettungen, Layouts), gräbt durch jedes Material, prüft Weltgrößen und Versus-Regeln (Playwright)
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

Texte werden mit `tr('Deutscher Text', { platzhalter })` ausgegeben bzw. direkt an `toast()` übergeben. Für Englisch den deutschen Text als Schlüssel in `src/i18n.js` oder `src/i18n2.js` eintragen (neue Texte nach `i18n2.js`, damit keine Datei über 1000 Zeilen wächst). Fehlt ein Eintrag, erscheint der deutsche Text; fehlt ein Platzhalter-Wert, bleibt die Stelle leer.

- **Sprachen:** Deutsch und Englisch vollständig. Jede andere Gerätesprache bekommt Englisch. Keine Rechts-nach-links-Sprachen und keine CJK-Schriften (die Pixelschriften haben dafür keine Zeichen) – ungetestet.
- **Wahl:** Startschleier (erster Start) oder Optionen → Sprache; gespeichert in `localStorage['flintworks-lang']`, wirkt sofort.
- **Pseudolokalisierung** (nur Entwicklungsserver): `?lang=pseudo` verlängert alle Texte um gut ein Drittel und setzt Akzente und Klammern – so fallen abgeschnittene oder unübersetzte Texte auf (Test: `tests/onboarding.spec.js`).
- Analyse-Ereignisse, Spielstände und Inhalts-IDs sind sprachunabhängig.

## Analyse

Ereignisse für den Onboarding-Funnel laufen nur über `ev()` aus `src/analytics.js` (feste Namen, geprüfte Felder, keine persönlichen Daten). Sie bleiben auf dem Gerät; es gibt keinen Anbieter. Liste, Regeln und Prüfung: [docs/ANALYTICS.md](docs/ANALYTICS.md). Im Entwicklungsserver zeigt `?ev` die Ereignisse live an.

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
  veil.js             Erster Start: Startschleier über der Tutorial-Welt (Spielen, Sprache)
  tutorial.js         Geführtes Tutorial: Ablauf, Hinweise, Rettungen, Aufdecken des HUD, Zielpfeil, Geisterhand, Abschlusskarte
  tutsteps.js         Die drei Schritte des Tutorials
  tutlevel.js         Die Tutorial-Welt mit festem Lehrpfad (Felsbuckel, Goldader)
  onboarding.css      Startschleier, HUD im Tutorial, große Texte
  panels.css          Fenster als Spiel-UI: Kachelzustände, Grund-Chips, Reiter
  props.js            Burghof, Fässer, Kisten, Zäune, Laternen, Wege und Stromleitungen (nur Bild)
  analytics.js        Analyse-Ereignisse (nur lokal), siehe docs/ANALYTICS.md
  lessons.js          Tipps und Aufträge nach dem Tutorial, Spielhilfe in der Lobby
  versus.js           Versus: Burg-Lebenspunkte, Hügel, Rundenuhr, Nachschub, Sieger
  coop.js             Koop: Teamaufgaben
  daily.js            Tagesschacht: Welt des Tages, Uhr, Medaillen, Serie, Ergebnis teilen
  stats.js            Mehrspieler: Rangliste und Auszeichnungen am Rundenende
  i18n.js             Übersetzungen (Deutsch ist der Schlüssel, Englisch die Übersetzung)
  i18n2.js            Weitere Übersetzungen (damit keine Datei über 1000 Zeilen wächst)
  pseudo.js           Pseudolokalisierung zum Testen (?lang=pseudo, nur Entwicklung)
  debug.js            Test-Zugang, nur im Entwicklungsmodus
  style.css           Gestaltung
tests/                Browser-Tests (Playwright)
public/icons/         App-Icons
android/              Android-Projekt (Capacitor)
```

Regeln:

- Keine Datei über 1000 Zeilen (`style.css` liegt noch darüber; neue Gestaltung in eigene CSS-Dateien).
- Alles, was Spieler sehen, geht durch `tr()` und ist für Menschen geschrieben (keine IDs, Fehlermeldungen oder Platzhalter).
- Analyse-Ereignisse nur über `src/analytics.js` und erst in `docs/ANALYTICS.md` eintragen.
- Neue Grafik folgt [docs/STYLE.md](docs/STYLE.md), Menüs und HUD folgen [docs/UI_STYLE.md](docs/UI_STYLE.md). Prüfen und bewerten mit der Rubrik in [docs/ART_RUBRIC.md](docs/ART_RUBRIC.md).
- Der erste Start gehört dem Tutorial: nichts davor (kein Dialog, keine Lobby, kein Installieren-Angebot); neue Systeme kommen als Lektion (`lessons.js`), nicht ins Tutorial.
