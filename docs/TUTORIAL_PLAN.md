# Tutorial-Plan: „Die erste Schicht“

Ziel: Ein neuer Spieler versteht in **6–8 Minuten** die Kernschleife von Flintworks –
*graben → sammeln → bauen → verkaufen → Crew einsetzen* – und hat dabei nie das Gefühl,
belehrt zu werden. Danach übernimmt ein System aus kontextuellen Lektionen und Aufträgen
den Rest, die Kampagne vertieft.

---

## 1. Bestandsaufnahme (Stand `src/tutorial.js`)

Was heute da ist: 5 Schritte (Laufen, Graben, Baum fällen, Hütte, Gold verkaufen),
Zielpfeil, Überspringen-Knopf, +20 Taler am Ende.

| # | Problem | Folge | Ursache im Code |
|---|---|---|---|
| P1 | Zufallswelt mit gewähltem Biom und Schwierigkeit | Baum oder Gold kann weit weg / hinter Fels liegen, jedes Tutorial ist anders, nicht testbar | `main.js` ruft `gen()` normal auf, kein fester Seed |
| P2 | Helfer arbeiten parallel | „Sammle 2 Holz“ erfüllt sich oft von selbst (Helfer fällen, `countRes` zählt das Lager mit) – Spieler lernt nichts | `countRes` = Inventar + `stock()` |
| P3 | Ereignisse laufen weiter | Meteor, Gewitter, Nacht, Einsturz mitten im ersten Schritt | `evRate`, Wetter nicht gedrosselt |
| P4 | Aufträge laufen parallel | Zwei Aufgaben-Anzeigen gleichzeitig (Tutorial-Box + Auftrag unter dem Geld) | `updMissions` prüft `G.tut` nicht |
| P5 | Texte nicht geräteabhängig | Tastatur-Spieler liest „Stick nach unten drücken“ | feste Strings |
| P6 | Nur Pfeil in der Welt | UI-Knöpfe („Bauen“, „Aktion“, Porträt) werden nie hervorgehoben | `drawTutorial` zeichnet nur ins Canvas |
| P7 | Kein Schutz gegen Festhängen | Spieler gräbt sich ein, findet kein Gold, stirbt → Tutorial hängt | keine Timeouts, keine Hilfen |
| P8 | Überspringen ≠ erledigt | Wer überspringt, bekommt es bei jeder neuen Welt wieder | `endTutorial(false)` setzt `P.tutorialDone` nicht |
| P9 | Wichtige Systeme fehlen | Feuerstein gegen Fels, Crew-Aufgaben, Brücke, Karte, Produktion – nur über Zufalls-Tipps | Lücke zwischen Tutorial, `HINTS`, `MISSIONS` |
| P10 | Keine Messung | Man weiß nicht, wo Spieler abbrechen | nur `track('tutorial')` am Ende |

---

## 2. Design-Prinzipien

1. **Machen statt lesen.** Max. 1 Satz pro Schritt, ≤ 60 Zeichen. Jede Erklärung folgt
   *auf* eine Handlung, nie davor („Super – Holz brauchst du für Gebäude“).
2. **Eine Sache gleichzeitig.** Nur ein Ziel sichtbar, keine Tipps/Aufträge parallel.
3. **Die Welt lehrt.** Das Level ist so gebaut, dass der naheliegende Weg der richtige ist
   (Baum direkt rechts, Goldader knapp unter der Oberfläche, Fels genau im Weg).
4. **Fehler sind billig.** Kein Tod, kein Verlust im Tutorial; Steckenbleiben wird erkannt
   und sanft aufgelöst.
5. **Zeigen, wo es ist.** Pfeil in der Welt *und* pulsierender Rahmen um den richtigen Knopf.
6. **Belohnen.** Jeder Schritt hat ein Mini-Feedback (Sound, Partikel, „+1“), das Ende eine
   kleine Feier und einen echten Vorteil für die erste richtige Runde.
7. **Respekt vor Erfahrenen.** Überspringen jederzeit, erinnert wird sich daran; jede Lektion
   ist später einzeln wiederholbar.

---

## 3. Struktur in drei Ebenen

```
Ebene 1  Kern-Tutorial „Die erste Schicht“   fester Level, 9 Schritte, ~7 min, Pflichtangebot
Ebene 2  Kontext-Lektionen                     just-in-time in normalen Runden (ersetzt HINTS)
Ebene 3  Kampagne c1–c7                        vertieft je ein System (existiert schon)
```

Ebene 2 vereint die bestehenden `HINTS` (ui.js) und `MISSIONS` (missions.js) zu einem
Lehrpfad: ein Tipp erscheint, wenn die Situation eintritt, die Mission dazu lässt es üben.

---

## 4. Ebene 1 – Kern-Tutorial im Detail

### 4.1 Eigener Level statt Zufallswelt

Neuer Modus `tut` in `scenarios.js` (wie `c1`, `campaign: true`), damit Ziel, Endbildschirm
und Setup schon funktionieren:

- `biome: 'meadow'`, fester `seed`, `diff: 'relaxed'`, `evRate: 0`, Tageszeit fest auf Mittag.
- `setup()` formt das Gelände mit `pocket()`/`paint()` von links nach rechts zu einem
  **Lehrpfad** (≈ 2 Bildschirmbreiten):

```
 Basis   flach    Baum Baum   kleine Senke   Fels-    Goldader 6–10 px     Baustelle
 [Burg]  ───────  🌲   🌲     ╲___╱ (Lehm)   brocken  unter der Erde       (ebener Platz)
  ▲ Start                                    ▲ blockiert Tunnel
```

- Zu Beginn **nur der eigene Wühler**; Helfer kommen erst in Schritt 8 (löst P2).
- Fallschaden aus, Luft unbegrenzt, keine Tiere, kein Grubengas (löst P3/P7).

### 4.2 Schritte

Jeder Schritt hat: Ziel-Text (geräteabhängig), Pfeil-Ziel, hervorgehobenen Knopf,
Erfolgsbedingung, Lob-Satz, Rettungsanker nach Zeit.

| # | Ziel (Touch-Text) | Lehrt | Erfolg | Hervorhebung | Rettungsanker |
|---|---|---|---|---|---|
| 1 | „Lauf zu den Bäumen“ | Bewegen | x > Baum − 20 | Stick (Geisterhand wischt) | 20 s: Pfeil größer, Geisterhand wiederholt |
| 2 | „Fäll den Baum mit Aktion“ | Aktion | Baum fällt | Aktions-Knopf pulsiert | Wühler am Baum, 10 s: Text „Drück Aktion“ |
| 3 | „Heb 2 Holz auf“ | Sammeln/Inventar | `c.inv` hat 2 × wood (**nur Inventar**) | Inventarleiste blinkt beim Aufheben | Holz rollt weg → näher spawnen |
| 4 | „Grab dich in die Erde“ | Graben (gerade, schräg) | 1,5 s gegraben **und** 8 px unter Oberfläche | Graben-Knopf / Stick ↓ | — |
| 5 | „Fels! Wirf einen Feuerstein darauf“ | Werfen, Sprengen | Fels-Brocken zerstört | Wurf-Knopf | 30 s: zweiter Feuerstein liegt neben dem Wühler |
| 6 | „Grab das Gold aus“ → „Bring es zur Burg“ | Rohstoff → Geld | `G.money` steigt | Pfeil wechselt: Gold → Burg | Gold nicht gefunden 40 s: Ader glitzert stärker |
| 7 | „Bau eine Hütte: Bauen → Hütte“ | Baumenü, Bauplatz, Mitbauen | `hut.done` | erst „Bauen“-Knopf, dann Hütten-Eintrag im Menü, dann Pfeil auf Baustelle | fehlt Material → Hinweis, wo es liegt |
| 8 | „Tipp auf deinen Helfer und gib ihm eine Aufgabe“ | Crew & Fokus | Helfer hat `focus ≠ 'all'` | Porträt in der Crew-Leiste | 20 s: Panel öffnet sich mit Erklärung |
| 9 | „Öffne die Karte“ | Überblick, nächste Ziele | Karte offen | Karten-Knopf | — |

Schritt 8 inszenieren: Ein Helfer kommt aus der Burg gelaufen („Ein Helfer ist da!“).
Schritt 9 zeigt auf der Karte das Ziel der ersten richtigen Runde.

Verworfen für Ebene 1 (→ Ebene 2): Brücke/Lehm, Sägewerk, Strom, Fahrstuhl, Forschung,
Kampf, Fahrzeuge. Faustregel: Alles, was man in den ersten 10 Minuten nicht *braucht*.

### 4.3 Abschluss

- Kurze Feier: Fanfare, Konfetti-Partikel aus der Burg, Karte „Erste Schicht geschafft!“
  mit 3 Lernpunkten als Icons (Graben · Bauen · Crew) und Zeit.
- Belohnung mit Bedeutung: 50 Taler **und** ein kosmetischer Hut (`P.hat`) – sichtbar
  in jeder späteren Runde.
- Zwei Knöpfe: **„Erste echte Runde“** (Goldrausch, entspannt) · „Zur Lobby“.
- `P.tutorialDone = true`, beim Überspringen ebenfalls (mit Rückfrage), löst P8.

---

## 5. Ebene 2 – Kontext-Lektionen

`HINTS` und `MISSIONS` werden zu **Lektionen** zusammengeführt (`src/lessons.js`):

```js
{ id: 'bridge',
  when: c => c.inv[c.isel] === 'loam' || gapAhead(c),   // Auslöser
  tip:  'Lehm in der Hand: Aktion baut eine Brücke',     // erscheint einmal
  task: { text: 'Bau eine Brücke', done: () => G.bridges > 0, pay: 15 }, // optional üben
  after: ['tutorial'] }                                   // Reihenfolge
```

Reihenfolge (grob nach Spielzeit):

1. Brücke & Lehm · 2. Lager & Helfer-Aufgaben · 3. Abbaugebiet markieren ·
4. Stützbalken & Einsturz · 5. Sägewerk → Bretter · 6. Windrad & Strom ·
7. Hochofen → Metall → bessere Werkzeuge · 8. Forschung · 9. Nacht & Gefahren ·
10. Gebiet & Flaggen (nur wenn aktiv).

Regeln: höchstens ein Tipp pro 60 s, nie während Kampf/Gefahr, gesehene Lektionen im Profil
speichern (heute `G.hintsSeen` – geht pro Runde verloren), Lobby-Eintrag
„Lektionen“ zum Wiederholen.

---

## 6. Technische Bausteine

| Baustein | Datei | Inhalt |
|---|---|---|
| Schritt-Engine | `tutorial.js` | Schritte bekommen `text`, `target`, `highlight`, `done`, `praise`, `rescue: [{after, do}]`, `onEnter` |
| UI-Hervorhebung | `tutorial.js` + `style.css` | `highlight: '#btnBuild'` → Klasse `.tut-pulse` (Ring + Pulsieren), Rest des HUD leicht abgedunkelt |
| Geisterhand | `render.js`/`ui.js` | halbtransparente Hand animiert die Geste (Wischen, Tippen) bei Touch |
| Geräte-Texte | `input.js`, `i18n.js` | `G.lastInput = 'touch' \| 'keys'`; Schritttext als `{ touch, keys }`, Tastenname per Platzhalter `{key:dig}` |
| Tutorial-Level | `scenarios.js`, `modes.js` | Modus `tut`, `setup()` baut den Lehrpfad, `noHelpers`, `noFallDmg` |
| Ruhe-Schalter | `missions.js`, `ui.js`, `events.js`, `weather.js` | alle prüfen `G.tut` und pausieren |
| Messung | `profile.js` | `track('tut_step', {i, sec})` pro Schritt, `tut_skip` mit Schritt, `tut_rescue` |
| Tests | `debug.js` | `__ww.tut` erweitern: Schritt setzen, Bedingungen auslösen, Playwright-Durchlauf aller 9 Schritte |

Rahmen: Regel „keine Datei über 1000 Zeilen“ – Schritt-Definitionen ggf. in
`tutorial_steps.js` auslagern. Alle neuen Texte in `i18n.js` (DE als Schlüssel, EN dazu).
Multiplayer: Tutorial nur im Einzelspiel, nie bei `G.teams`/Netzrunde.

---

## 7. Umsetzung in Etappen

| Etappe | Inhalt | Löst | Aufwand |
|---|---|---|---|
| **1 – Schnelle Fixes** | Aufträge/Tipps/Ereignisse während Tutorial pausieren; Holz nur aus Inventar; Überspringen merkt sich; geräteabhängige Texte; Messung pro Schritt | P2–P5, P8, P10 | ~1 Tag |
| **2 – Tutorial-Level** | Modus `tut` mit festem Lehrpfad, keine Helfer zu Beginn, kein Fallschaden | P1, P3, P7 | ~2 Tage |
| **3 – Neue Schritte** | Schritte 1–9 inkl. Feuerstein, Crew, Karte; Lob-Sätze; Rettungsanker | P7, P9 | ~2 Tage |
| **4 – Führung & Feier** | Knopf-Hervorhebung, Geisterhand, Abschluss-Karte, Hut-Belohnung, „Erste echte Runde“ | P6 | ~2 Tage |
| **5 – Lektionen** | `lessons.js` vereint HINTS + MISSIONS, Profil-Speicher, Lobby-Wiederholung | P9 | ~2–3 Tage |
| **6 – Testen & Feinschliff** | Playwright-Durchlauf, 5 Erstspieler-Tests (Handy + PC), Texte kürzen, Zeiten justieren | – | laufend |

Jede Etappe ist einzeln auslieferbar; Etappe 1 bringt schon spürbar mehr Qualität.

---

## 8. Erfolgskriterien

- ≥ 80 % der Starter beenden das Tutorial (`tut_step 9` / `tut_step 1`).
- Median-Dauer 5–9 min; kein Schritt im Median > 90 s.
- Rettungsanker greift bei < 20 % der Spieler pro Schritt (sonst Schritt/Level umbauen).
- ≥ 60 % starten direkt danach die „Erste echte Runde“.
- Erstspieler-Test: Jeder kann danach ohne Hilfe erklären, wie man Geld verdient und
  wozu Helfer da sind.
- Automatischer Test spielt alle Schritte in DE und EN, Touch- und Tastatur-Texte durch.

---

## 9. Risiken

| Risiko | Gegenmaßnahme |
|---|---|
| Physik/Sand macht den Lehrpfad instabil (Gold rutscht, Tunnel stürzt ein) | Lehrpfad aus stabilen Materialien, Soak-Test mit festem Seed |
| Tutorial fühlt sich zu lang an | Schritte 8–9 bewusst kurz; nach Erstspieler-Test ggf. 9 → Ebene 2 |
| Bestehende Spielstände | `clearSave()` beim Tutorial nur nach Rückfrage, wenn ein Spielstand existiert |
| Texte zu lang auf kleinen Handys | Limit 60 Zeichen, Test bei 360 px Breite |
