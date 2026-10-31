# Tutorial-Plan: „Die erste Schicht“ (v2, unter 2 Minuten)

> **Stand: umgesetzt in v1.52.0.** Löst die erste Fassung (v1.22.0–v1.51.0, 10 Schritte, 6–8 min) ab.
> Zielgruppe: völlige Neulinge, Web mit Tastatur und Handy mit Touch, kein Konto, Einstieg beim
> ersten Start. Code: `src/veil.js` (Startschleier), `src/tutorial.js` (Ablauf, Hinweise, Aufdecken,
> Karte), `src/tutsteps.js` (die drei Schritte), `src/tutlevel.js` (Welt), `src/onboarding.css`,
> `src/analytics.js` (Funnel, siehe [ANALYTICS.md](ANALYTICS.md)). Danach übernehmen die Lektionen
> (`src/lessons.js`) in der ersten echten Runde. Tests: `tests/tutorial.spec.js`,
> `tests/onboarding.spec.js`.

---

## 1. Bestandsaufnahme vor v1.52.0

| # | Befund | Folge |
|---|---|---|
| A1 | Erster Start öffnete die volle Lobby; das Tutorial kam erst nach „Spielen“; 1,5 s nach der Lobby ging der Installieren-Dialog auf | erste Eingabe war ein Menüklick, Store-Reibung vor dem Spaß |
| A2 | 10 Schritte (laufen, fällen, Holz, sprengen, graben, Gold, verkaufen, Hütte, Crew, Karte) | Ziel 6–8 min; der erste echte Erfolg (Verkauf) kam erst im 7. Schritt |
| A3 | Das ganze HUD ab Sekunde 1 (Crew, Bauen, Karte, Geld, Inventar, Wurf) | Ablenkung, nichts wurde aufgedeckt |
| A4 | Startinventar Feuerstein + Stein, Hilfe erst nach 20–60 s, Text immer sofort | Ungelehrtes im Spiel, langsame Hilfe, Erfahrene lasen trotzdem mit |
| A5 | Überspringen nur per Tippen/Klicken | Sackgasse für reine Tastatur |
| A6 | Speichern alle 60 s; nach dem Neuladen Umweg über die Lobby | bis zu 60 s Verlust |
| A7 | Keine Analyse, nur Zähler im Profil (`P.tutStats`) | kein Funnel, keine Zeiten |
| A8 | `tr()` ohne Fallback für fehlende Platzhalter, keine Pseudolokalisierung | „undefined“ möglich, Überlauf unentdeckt |
| A9 | Keine Option für Textgröße; Pfeil und Konfetti ohne reduzierte Bewegung | Barrierefreiheit unvollständig |

Kollision des alten Pfads: Die Felsnadel musste genau getroffen werden (Wurfhöhe 9–22 px) und
Splitter mussten weggeräumt werden (`tidyRock`) – fehleranfällig und für die Kernschleife unnötig.

## 2. Was der Neuling in der ersten Sitzung wirklich braucht

| Fähigkeit | Nötig für die Kernschleife? | Wo gelehrt |
|---|---|---|
| Laufen | ja | Tutorial, Schritt 1 |
| Springen | ja (Kanten, Gruben) | Tutorial, Felsbuckel in Schritt 1 und auf dem Rückweg |
| Graben (nach unten) | ja | Tutorial, Schritt 2 |
| Aufheben | ja (geschieht von selbst) | Tutorial, Schritt 2 |
| Aus einer Grube heraus | ja | Tutorial, Rückweg in Schritt 3 (Rampe/Klettern, Rettung „Aktion“) |
| Verkaufen | ja (Ziel von Goldrausch) | Tutorial, Schritt 3 |
| Helfer, Aufgaben | später | Lektionen `crew`, `crewtap` |
| Fällen, Lager, Bauen | später | Lektionen `tree`, `store`, `build` |
| Werfen, Sprengen | später | Lektion `rock` |
| Karte, Laufen per Tipp, Enterhaken | später | Lektionen `tap`, `hook`, Spielhilfe |

Kamera und Fahrzeuge muss niemand lernen: Die Kamera folgt von selbst, Fahrzeuge kommen erst
mit Gebäuden.

## 3. Ablauf vom Start bis zur Kernschleife

```
Laden → Startschleier über der lebenden Tutorial-Welt → Taste/Tippen
  → 1/3 Laufen (+ Felsbuckel: Springen) → 2/3 Zum Gold graben, Klumpen aufheben
  → 3/3 Zur Burg: Geldzähler erscheint, Münzen fliegen, Fanfare (erster Erfolg)
  → Abschlusskarte („Weiter graben“) → echte Goldrausch-Runde mit 50 Taler Startgeld
  → Lektionen und Aufträge führen weiter
```

Wer schon gespielt hat (`P.tutorialDone` oder `P.games > 0`) oder über einen Link kommt
(`?daily`, `?room=`, `?draft`), bekommt die Lobby wie bisher.

### Die Welt (`tutlevel.js`)

```
[Burg]  Start   ▲Buckel   ✦Gold     flach … normale Welt
─────────────── █████ ──────────────────
                          ░░░
```

- Burg x 72–108, der Wühler startet in der Burg (frei, geprüft mit dem echten `free()`).
- Felsbuckel x 140–146, 7 px hoch: höher als eine Stufe (3 px), viel niedriger als ein Sprung
  (17 px); Fels ohne Hacke ist nicht grabbar → nur ein Sprung führt weiter (oder ein Tunnel
  darunter – auch gültig).
- Goldader bei x 178, 8 px unter der Oberfläche, dicht (`blob` 7×3); Glitzern alle 40 Ticks.
- Keine Bäume, Gegenstände, Tiere im Pfad, leeres Startinventar, Mittag, keine Ereignisse,
  Wühler unverwundbar und nie erschöpft.

### Die ersten 60 Sekunden (Neuling, Richtwerte)

| Zeit | sieht | tut | lernt | Rückmeldung |
|---|---|---|---|---|
| 0 s | Welt mit Burg, Logo, großer Knopf „Spielen · Tippe zum Starten / Drück eine Taste“, oben rechts „English/Deutsch“ | – | – | Knopf „atmet“ (nicht bei reduzierter Bewegung) |
| ~2–5 s | | tippt / drückt | – | Klick, Schleier blendet in 250 ms aus, Ton ist an |
| 5–12 s | „1/3 Lauf nach rechts“ (Tastatur: „→ oder D“), gelber Pfeil über dem Glitzern; Touch: Geisterhand am Stick nach 1,5 s | läuft | Laufen | Schritte, Staub, Kamera schaut voraus |
| 12–18 s | Felsbuckel; nach ~1 s davor: „Spring drüber: Sprung“ / „Leertaste“, Sprung-Knopf pulsiert | springt | Springen | Sprung-Sound, Landestaub, ✓ und Klick beim Schrittende |
| 18–35 s | (nach 1,2 s ohne Fortschritt) „2/3 Grab dich zum Gold: Stick nach unten“ / „↓ oder S“ (klassisch: „Graben halten“), Pfeil auf die Ader | gräbt | Graben | Hacken-Takt, Brocken, Gold blitzt |
| 35–45 s | „Lauf über den Klumpen“ | läuft drüber | Aufheben | Inventar erscheint mit kurzem Aufblitzen, Klumpen darin, „Gold! Bring es nach Hause“ |
| 45–60 s | „3/3 Bring das Gold zur Burg“, Pfeil auf die Burg; Rückweg über den Buckel (Wiederholung) | läuft heim | Verkaufen | Geldzähler erscheint beim Näherkommen, Münzen fliegen hinein, „+25“, Fanfare, Konfetti |

### Die ersten 10 Minuten

| Zeit | Inhalt |
|---|---|
| 0:00–~1:20 | Tutorial (drei Schritte), Abschlusskarte |
| ~1:20–3:00 | Erste Goldrausch-Runde mit 50 Taler Startgeld; Lektion `crew` (Helfer arbeiten von selbst), erster Auftrag |
| 3–5 min | Bäume, Lager, Aufträge; **erste bedeutsame Wahl:** wofür die ersten Taler ausgeben (in der Burg einkaufen oder ein Gebäude bauen – Lektion `build`) |
| 5–8 min | Fels → Lektion `rock` (Feuerstein); Bauen und Helfer-Aufgaben |
| 8–10 min | Aufträge und Produktion; das Rundenziel (800 Taler) trägt weiter |

Lektionen kommen höchstens alle 45 s und nie im Tutorial (`lessons.js`).

## 4. Mechaniken

| Mechanik | Voraussetzung | Lehrmethode | Animation / Rückmeldung | Sichere Übung | Wiederholung | Beherrscht, wenn | Fallback |
|---|---|---|---|---|---|---|---|
| Laufen | – | freier Weg nach rechts, Pfeil über dem Glitzern | Laufzyklus, Staub, Kamera | flache Wiese, nichts kann passieren | Rückweg | läuft ohne Prompt-Wartezeit los | 8 s ohne Bewegung: „Daumen links aufs Bild legen …“ / „Halte → oder D“, Geisterhand |
| Springen | Laufen | Felsbuckel (7 px) im Weg | Sprung-Sound, Landestaub | Buckel ist niedrig, Fallen schadet nicht | Rückweg in Schritt 3 | springt ohne Hinweis | ~1 s davor stehen: Hinweis + pulsierender Sprung-Knopf; 30 s: „Hopp – rüber mit dir!“ (über den Buckel gesetzt) |
| Graben | Laufen | Ader knapp unter der Oberfläche, Glitzern, Pfeil nach unten | Hacken-Takt, Brocken, Gold blitzt, Vibration | Erde, keine Gefahr | jede Runde | gräbt, bevor der Prompt kommt | 12 s: „Stell dich aufs Glitzern …“; klassisch pulsiert der Graben-Knopf |
| Aufheben | Graben | Klumpen fallen vor die Füße | Klumpen fliegt ins neu erscheinende Inventar, „+1“ | – | jede Runde | – (geschieht beim Darüberlaufen) | „Lauf über den Klumpen“; 30 s: ein Klumpen geschenkt |
| Aus der Grube | Graben, Springen | die eigene Grube | Rampe gräbt sich (modern), Klettern (klassisch) | Grube ist flach (< Sprunghöhe) | jede Runde | ohne Hinweis heraus | ~2 s still in der Grube: „Raus aus der Grube: gegen die Wand laufen / an der Wand hochklettern“; 20 s: Aktions-Knopf erscheint („Heim“/„Treppe“) |
| Verkaufen | Aufheben | Pfeil auf die Burg | Geldzähler erscheint, Münzen fliegen, Fanfare, Konfetti | – | jede Runde | – | 40 s: „Ab nach Hause!“ (Wühler geht heim, verkauft) |

## 5. Erfolg, Ziel, Wahl, sicherer Fehlschlag, Übergang

- **Früher echter Erfolg:** der erste Verkauf – echtes Geld der echten Burg, echte Münzen-Animation.
- **Kurzfristiges Ziel:** „1/3 … 3/3“ und der Pfeil; nur ein Ziel gleichzeitig.
- **Erste bedeutsame Wahl:** bewusst nach dem Tutorial – die ersten Taler in der Burg ausgeben oder
  ein Gebäude bauen (die Lektionen führen hin). Im Tutorial gibt es keine Scheinwahl.
- **Erster sicherer Fehlschlag:** in der eigenen Grube festsitzen oder vor dem Buckel scheitern –
  ohne Schaden, mit eigenem Ausweg und einer Rettung als Netz.
- **Übergang:** Abschlusskarte mit einem fokussierten Hauptknopf „Weiter graben“ (Enter/Leertaste)
  → sofort eine echte Goldrausch-Runde mit 50 Taler Startgeld und dem Grubenhelm; „Zur Lobby“ als
  zweiter, ruhiger Knopf.

## 6. Regeln

**Prompts.** Höchstens ein Text, höchstens zwei kurze Zeilen (CSS kürzt ab), Handlung zuerst. Der
erste Schritt zeigt seinen Text sofort; spätere erst, wenn der Spieler 1,2 s nicht vorankommt
(`progress()` in `tutorial.js`). Vorrang: Rettungstext > Hinweis aus der Lage > Schritttext.
Prompts blockieren keine Eingabe und nehmen keinen Fokus; die Quest-Box hat nur den
Überspringen-Knopf. Lob-Toasts nur kurz, nie neben einem Rettungstext.

**Aufdecken (`onboarding.css`, Klassen an `#game`).** Hinter dem Schleier: nur die Welt. Im
Tutorial versteckt: Crew-Leiste, Bauen, Emotes, Minikarte, Lager, Aufträge, Wurf, Haken, Aktion.
Sichtbar: Stick, Sprung (bzw. Graben klassisch), Menü, Quest-Box. Das Inventar erscheint mit dem
ersten Klumpen, der Geldzähler beim Näherkommen an die Burg, der Aktions-Knopf nur als Rettung.
Mit dem Ende des Tutorials ist alles da.

**Speichern.** Bei jedem Schrittwechsel, alle 60 s, beim Verstecken und Verlassen der Seite.
Neuladen mitten im Tutorial → derselbe Schleier mit „Weiterspielen“ → derselbe Schritt.

**Überspringen.** Knopf in der Quest-Box (zweimal tippen, „Wirklich?“), oder Esc → Menü →
„Tutorial überspringen“. Überspringen zählt als erledigt; die Karte bietet eine echte Runde an.

**Wiederholen.** Lobby → Optionen → „Tutorial spielen“ (fragt nach, wenn ein Spielstand verloren
ginge). Erneutes Spielen erzeugt `onb_start` mit `entry: replay`.

**Anpassung an Erfahrene.** Wer einen Schritt erledigt, bevor sein Text nötig ist, sieht ihn nie
(`prompted: false`). Zwei solche Schritte → `skilled`: keine Geisterhand, keine Lob-Toasts,
Abschlusskarte ohne Konfetti-Pause. Wer außer der Reihe handelt (Klumpen schon im Gepäck, Buckel
untertunnelt), dessen Schritte gelten sofort als erledigt.

**Barrierefreiheit.** Tastatur und Touch vollständig; jede Taste startet; Fokus-Ringe auf allen
neuen Knöpfen; Tippflächen ≥ 44 px (Startknopf ≥ 72 px); reduzierte Bewegung: kein Atmen, kein
Ausblenden, Pfeil ohne Wippen, wenig Konfetti; „Große Texte“ (Optionen → Anzeige) vergrößert
Quest-Box, Tipps und Karten um 25 %; Hervorhebung nie nur über Farbe (Rahmen + Pulsieren +
Pfeilform); jedes Geräusch hat ein Bild-Gegenstück. Keine Zeitgrenzen, kein Zeitdruck.

## 7. Menüs und Knöpfe der ersten Sitzung

- **Hierarchie:** pro Bildschirm ein Hauptknopf in Gold (`.go`), Nebenaktionen als Rahmenknopf
  (`.ghost`). Startschleier: „Spielen“; Karte: „Weiter graben“; Sprache klein in der Ecke.
- **Zustände:** Hover (heller), Fokus (heller Ring), gedrückt (2 px tiefer, Schatten kürzer),
  deaktiviert (halbe Deckkraft), Doppeltipp-Schutz auf der Karte (`leave()` einmal).
- **Eingabe:** Tastatur (Enter/Leertaste auf dem Fokus, Esc = Menü), Maus und Touch gleichwertig,
  Tab erreicht im Schleier beide Knöpfe. Kein Gamepad (nicht unter den Zielplattformen).
- **Rücknahme:** Esc schließt ein offenes Fenster, sonst öffnet es das Menü; Tippen neben ein
  Fenster schließt es (wie überall im Spiel).
- **Stil:** Pixelschrift, 9-Slice-Rahmen, Gold/Erde-Palette aus `style.css`; keine Web-Formulare,
  keine Textwände; Übergänge in Stufen (`steps()`), kurz (≤ 300 ms).
- **Ränder:** Safe-Area-Abstände am Schleier, Quest-Box schmaler als der Bildschirm bei 360 px.

## 8. Alle Texte

| Wo | Deutsch (Schlüssel) | Englisch |
|---|---|---|
| Schleier | Spielen / Weiterspielen | Play / Continue |
| Schleier | Tippe zum Starten / Drück eine Taste | Tap to start / Press any key |
| 1/3 | Lauf nach rechts · Lauf nach rechts: → oder D | Walk right · Walk right: → or D |
| 1/3 Hinweis | Spring drüber: Sprung · Spring drüber: Leertaste | Jump over it: Jump · Jump over it: Space |
| 1/3 Rettung | Daumen links aufs Bild legen und nach rechts schieben · Halte → oder D gedrückt · Hopp – rüber mit dir! | Put your thumb on the left and slide it right · Hold → or D · Up and over you go! |
| 2/3 | Grab dich zum Gold: Stick nach unten · …: ↓ oder S · …: Graben halten · …: Shift halten, ↓ lenkt | Dig down to the gold: stick down · …: ↓ or S · …: hold Dig · …: hold Shift, ↓ steers |
| 2/3 Hinweis | Lauf über den Klumpen | Walk over the nugget |
| 2/3 Rettung | Stell dich aufs Glitzern und drück den Stick nach unten · … drück ↓ · Hier, ein Klumpen für dich | Stand on the sparkle and push the stick down · … press ↓ · Here, a nugget for you |
| 2/3 Lob | Gold! Bring es nach Hause | Gold! Take it home |
| 3/3 | Bring das Gold zur Burg | Take the gold to the castle |
| 3/3 Hinweis | Raus aus der Grube: gegen die Wand laufen · …: an der Wand hochklettern | Out of the pit: walk into the wall · …: climb up the wall |
| 3/3 Rettung | Steckst du fest? Tippe auf Aktion · … Drück F · Ab nach Hause! | Stuck? Tap Action · Stuck? Press F · Off home you go! |
| Karte | Erste Schicht geschafft! · Laufen · Graben · Verkaufen · Belohnung: Grubenhelm und {n} Taler Startgeld für deine erste Runde · Zeit {time} · Den Rest zeigen dir Tipps im Spiel · Weiter graben · Zur Lobby | First shift done! … Keep digging · To the lobby |
| Menü | Tutorial überspringen · Direkt ins Spiel – die Tipps erklären den Rest | Skip tutorial · Straight into the game – tips explain the rest |
| Optionen | Anzeige · Große Texte: an/aus · Größere Schrift für Tipps und Aufgaben | Display · Large text: on/off · Bigger letters for tips and tasks |

**Hervorhebungen:** gelber Pfeil (Glitzern → Ader/Klumpen → Burg), pulsierender Rahmen um
Sprung-, Graben- (klassisch) oder Aktions-Knopf, Geisterhand (Touch: Stick nach rechts/unten,
Tippen auf den pulsierenden Knopf). **Umgebung:** Glitzern über der Ader, der Buckel als sichtbares
Hindernis, die Burg mit Fahne als Ziel. **Sprachaufnahmen:** keine – das Spiel hat keine Stimmen;
alle Hinweise sind Text plus Bild, die Töne sind synthetisiert (`sound.js`).

## 9. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Neuling findet den Stick nicht (Touch) | Geisterhand nach 1,5 s, Rettungstext nach 8 s |
| Neuling erkennt den Buckel nicht als Sprungaufgabe | Hinweis nach ~1 s Stillstand, pulsierender Sprung-Knopf; nach 30 s darübergesetzt |
| Grube zu tief / Rampe unbekannt | Ader nur 8 px tief; Hinweis nach 2 s; Aktions-Knopf nach 20 s; Heim nach 40 s |
| Klassische Steuerung (Klettern statt Rampe) | eigene Texte, Test `classic controls` |
| Erfahrene fühlen sich gegängelt | Texte erst bei Stillstand, `skilled`, Überspringen jederzeit (Knopf und Esc) |
| Sehr kleine Handys / lange Übersetzungen | zweizeilige Quest-Box, Pseudolokalisierung bei 360×740 und 640×360 getestet |
| Spieler kommt über einen Einladungslink und hat nie ein Tutorial | Lobby wie bisher; die Lektionen erklären die Grundlagen; Tutorial in den Optionen |
| Installieren-Dialog stört den Einstieg | erst nach Tutorial **und** einer echten Runde |
| Spielstände von vor v1.52.0 mitten im alten Tutorial | Beim Start erkannt (kein `run` im gespeicherten `tut`) und verworfen: das neue Tutorial beginnt in der neuen Welt |
| Kein Konto, keine Berechtigungen, kein Laden | entfällt (das Spiel hat nichts davon) |

## 10. Funnel

Siehe [ANALYTICS.md](ANALYTICS.md): `app_open → onb_first_input → onb_start → onb_step_* →
onb_first_success → onb_complete → onb_card → core_round_start`, dazu `onb_hint`, `onb_rescue`,
`onb_recover`, `onb_skip`, `onb_menu`, `onb_exit`, `onb_resume`, `session_end`.

## 11. Messungen

Gemessen mit dem Test-Bot (`tests/tutorial-bot.js`, perfekte Eingaben, Spielzeit in Ticks/60):

| | vorher (v1.51.0) | nachher (v1.52.0) |
|---|---|---|
| Schritte | 10 | 3 |
| Bot, Summe | 18,4 s | 4,4 s |
| Bot, je Schritt | walk 1,0 · chop 2,7 · wood 0,7 · blast 2,6 · dig 1,9 · gold 0,3 · sell 2,7 · hut 5,3 · crew 0,5 · map 0,7 | walk 1,4 · dig 1,2 · sell 1,3 (+0,5 s Erfolg) |
| Erster Erfolg (Verkauf) nach | Schritt 7 (Bot 11,9 s) | Schritt 3 (Bot 4,4 s) |
| Zögernder Bot (liest erst, wartet auf den Sprunghinweis) | – | 9,5 s |
| Schlimmster Fall mit allen Rettungen (Spieler tut nichts Richtiges) | unbegrenzt (Hinweise nur als Text) | ~100 s Rettungen + Laufwege |
| Erste Eingabe | erst nach Lobby + „Spielen“ | auf dem Startschleier, sofort nach dem Laden |

Mit echten Neulingen ist noch nicht gemessen worden (kein Analyse-Anbieter, kein Playtest). Ziel
für den Playtest: erste Eingabe ≤ 5 s, erster Erfolg ≤ 75 s, Abschluss ≤ 120 s im Median.

## 12. Offene Fragen für den Playtest

1. Wie viele Sekunden vergehen bis zur ersten Eingabe – und tippt jemand zuerst auf „English“?
2. Erkennt man den Felsbuckel ohne Hinweis als Sprungaufgabe? Wie lange steht man davor?
3. Gräbt man auf Touch intuitiv mit „Stick nach unten“, oder läuft man über die Ader hinweg?
4. Kommt man aus der Grube ohne Hinweis heraus (modern: Rampe, klassisch: Klettern)?
5. Wird der Geldzähler beim Verkauf bemerkt – versteht man „Gold = Geld“ ohne Text?
6. Wählt man auf der Karte „Weiter graben“, und spielt man die erste Runde länger als 3 Minuten?
7. Wird der erste Tipp in der echten Runde (Helfer) verstanden, ohne dass Helfer im Tutorial vorkamen?
8. Fehlt jemandem das Fällen/Bauen im Tutorial, oder reichen die Lektionen?
9. Bemerken Erfahrene, dass sie keine Texte sehen – oder suchen sie danach?
10. Ist der Überspringen-Knopf oben in der Mitte zu leicht versehentlich zu treffen?

## 13. Erweitern und Fehlersuche

- Ein neuer Schritt: Eintrag in `STEPS` (`tutsteps.js`) mit `id`, `text`, `done`; optional `target`,
  `hl`, `hand`, `hint`, `rescue`, `progress` (in `tutorial.js`); Texte in `i18n2.js`; Ereignisse
  entstehen von selbst. Den Bot (`tests/tutorial-bot.js`) um eine `POLICY` ergänzen.
- Geometrie ändern: nur `TUT` in `tutlevel.js`; der Buckel muss höher als 3 px und niedriger als
  17 px bleiben, die Ader so flach, dass die Grube ohne Hilfe verlassen werden kann. Danach
  `tests/onboarding.spec.js` (Kollision, Rettungen, zögernder Spieler) laufen lassen.
- Im Entwicklungsserver: `__ww.tut` (Schritt und Zustand), `__ww.tutLevel`, `__ww.endTutorial()`,
  `__ww.analytics.sessionEvents()`, `?ev` (Ereignisse einblenden), `?lang=pseudo` (lange Texte).
- Ein Prompt erscheint nicht? `G.tut.s.shown` und `G.tut.s.idle` ansehen; erst nach 72 Ticks
  ohne Fortschritt. Ein HUD-Teil fehlt? Klassen `onb`, `onb-inv`, `onb-money`, `onb-act` an `#game`.
