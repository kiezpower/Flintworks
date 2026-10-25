# Plan: Hochwertigeres Graben

> **Stand: Plan, noch nicht umgesetzt.**

Ziel: Graben ist die Tätigkeit, die man in Flintworks am häufigsten macht. Es soll sich
**satt, körperlich und belohnend** anfühlen – jeder Hieb ist sicht-, hör- und spürbar, jedes
Material fühlt sich anders an, und ein gegrabener Stollen sieht aus wie von Hand gegraben,
nicht wie ausgestanzt. Steuerung und Spielbalance (Tempo, Erträge, Helfer-Wege) bleiben
dabei verlässlich.

---

## 1. Bestandsaufnahme (Stand `src/clonk.js`, `src/world.js`, `src/sound.js`, `src/clonkhi.js`)

So funktioniert Graben heute: Solange gegraben wird, löscht `digStroke` **jedes Frame** die
Körperbox (6×10 px, Ecken 1 px abgerundet), ein paar Pixel in Grabrichtung verschoben. Der
Wühler gleitet dabei mit fester Geschwindigkeit (0,55 px/Frame, mit Spitzhacke 0,8) in eine
von drei Richtungen (gerade, schräg runter 0,12, schräg hoch 0,38). Alle 9 Frames ein
Rausch-Sound, mit 14 % Chance pro Zelle ein 1–2 px großer Krümel in fester Farbe.

| # | Problem | Folge | Ursache im Code |
|---|---|---|---|
| G1 | Alle Materialien gleich schnell | Sand, Erde, Lehm, Erz, Kohle und Gold fühlen sich identisch an; nur Fels ist anders (und dort zufällig gesprenkelt) | `sp = hasTool('pick') ? 0.8 : 0.55` in `updBody`; `digCell` kennt keine Härte |
| G2 | Kontinuierliches „Abschmelzen“ statt Hiebe | Kein Rhythmus, kein Moment des Aufpralls – Graben wirkt wie Radieren | `digStroke` jedes Frame, kein Schlag-Takt |
| G3 | Stollen sehen ausgestanzt aus | Gerade, glatte Kanten, gleichförmige Breite, Treppenstufen bei Schrägen | `strokeCells` = Rechteck mit 1 px Eckabrundung |
| G4 | Schwaches Partikel-Feedback | Krümel sind einzelne Pixel in Einheitsfarbe, kein Staub, kein Geröll, das liegen bleibt | `CRUMB`-Tabelle, `parts` als `fillRect` |
| G5 | Dünner, monotoner Sound | Derselbe Rauschstoß alle 9 Frames, keine Variation, nicht synchron zur Animation | `sfx('dig')` mit `G.frame % 9` |
| G6 | Hacke ohne Wucht | Hacke wackelt per `sin`, kein Ausholen/Zuschlagen/Zurückfedern, Körper reagiert nicht | `drawGear` in `clonkhi.js` |
| G7 | Beute erscheint „irgendwo“ | Nugget-, Erz-, Kohle-Zähler sind **global** für alle Wühler; das Nugget fällt bei dem, der zufällig den Zähler überlaufen lässt, auch bei Sprengungen | `G.goldDust`, `G.oreDug` … in `digCell`/`spawnFromDig` |
| G8 | Fels-Wackeln flackert | Jede Fels-Zelle setzt `G.shake = 0.8` → Dauerzittern statt Schlägen | `digCell` |
| G9 | Start/Stopp hakelig | Automatisches Graben startet erst nach 8/18 Frames Drücken, schaltet bei wenig Erde ab; keine Vorschau, wohin gegraben wird | `wantsDig`, `pushT`, `digZone`-Schwellen |
| G10 | Haptik ungenutzt | Handy vibriert nur bei Treffern/Schaden, nicht beim Graben | `navigator.vibrate` nur in `sound.js`/`input.js` |

---

## 2. Design-Prinzipien

1. **Jeder Hieb zählt.** Graben bekommt einen Takt (Ausholen → Treffer → Nachfedern). Der
   Treffer-Frame bündelt alles: Material weg, Partikel, Sound, Mini-Shake, Vibration.
2. **Material ist fühlbar.** Härte bestimmt Tempo, Klang, Partikel und Wackeln – man erkennt
   mit geschlossenen Augen, ob man in Sand oder Erz gräbt.
3. **Handarbeit statt Schablone.** Stollenkanten sind unregelmäßig, frisch gegrabene Wände
   sind kurz dunkler/feucht, Geröll bleibt einen Moment liegen.
4. **Beute gehört dem Grabenden.** Erträge entstehen dort, wo man gräbt, und zwar
   nachvollziehbar (Ader leer → letzter Brocken).
5. **Steuerung bleibt heilig.** Tempo im Mittel ≈ heute, Tunnel bleiben für Körper und
   Helfer-Pfadfindung passierbar, keine neuen Hänger. Alles abschaltbar über „Schnelle Grafik“.

---

## 3. Etappen

### Etappe 1 – Materialhärte und Schlag-Takt (Kern, G1 G2 G8)

- Neue Tabelle `HARD` in `clonk.js`: Sand 0,6 · Erde 1 · Lehm 1,3 · Kohle 1,4 · Erz 1,6 ·
  Gold 1,2 · Edelstein 1,8 · Fels 3 (nur mit Spitzhacke). Vorschuss-Tempo = Basis / Härte
  des Materials vor dem Gesicht (gemittelt über die Stroke-Zone), Spitzhacke teilt die Härte.
- Schlag-Takt: `c.digT` zählt einen Zyklus von ~12 Frames (Sand 8, Fels 18). Bewegung läuft
  weiter gleichmäßig (Steuerung fühlt sich nicht ruckelig an), aber Material wird in zwei
  Portionen entfernt: Hauptteil im Treffer-Frame, Rest verteilt. So bleibt `digZone` gültig.
- Fels: statt 30 %-Zufall pro Zelle (Sprenkel) wird pro Treffer eine zusammenhängende
  Kerbe abgetragen; `G.shake` nur im Treffer-Frame.
- Mittelwert kalibrieren: Erde = heutiges Tempo, damit Helfer-Zeitpläne und Missionen passen.
- **Abnahme:** Stoppuhr-Test (Bot gräbt 100 px durch jedes Material), Tutorial-Test grün.

### Etappe 2 – Stollen-Optik (G3)

- `strokeCells`: Rand der Box mit Rauschen verbiegen (Seed aus Weltkoordinate, also
  deterministisch und multiplayer-fest). Innen bleibt die volle Körperbox frei – nur
  *außerhalb* wird zusätzlich etwas mitgenommen, nie weniger.
- Glatte Schrägen statt Treppenstufen: Boden und Decke entlang der Grabrichtung interpolieren.
- „Frisch gegraben“: neues Byte-Feld `fresh[i]` (oder Bit in `shade`), Tunnel-Rückwand in
  `texel()` dunkler/feuchter getönt, verblasst über ~20 s (nur Chunks mit frischen Zellen neu
  malen, Budget pro Frame).
- Kantenlicht an Tunnelrändern feiner abstufen (heute harte 1,3/0,62-Faktoren); einzelne
  Kiesel/Wurzeln, die aus der Wand ragen, als Deko-Texel.

### Etappe 3 – Partikel und Geröll (G4)

- Krümelfarbe aus der echten Textur an der Stelle (`TEX[m][ti]`) statt fester Farbe.
- Pro Treffer ein Büschel: 3–6 Brocken (2×2, mit Schwerkraft, prallen einmal ab, bleiben
  ~1 s auf dem Boden liegen), plus Material-Extras: Sand → Staubwolke (halbtransparent),
  Fels → Funken, Kohle → schwarzer Staub, Gold/Edelstein → Glitzern schon *vor* dem
  Treffer, wenn die Ader in Reichweite ist.
- Partikel-Budget (max. Anzahl), in „Schnelle Grafik“ halbiert.

### Etappe 4 – Animation (G6)

- Hacken-Zyklus in `clonkhi.js` an `c.digT` koppeln: Ausholen (Hacke hinter dem Kopf),
  schneller Schlag, kurzes Nachfedern; Körper beugt sich im Treffer 1 px vor, Kopf nickt.
- Eigene Posen für schräg hoch/runter; Hacke auf ganze Pixel runden (keine Halbpixel-Unschärfe).
- Bei harten Materialien prallt die Hacke sichtbar zurück, bei Sand taucht sie ein.

### Etappe 5 – Klang (G5)

- Sound pro Treffer statt alle 9 Frames, synchron zur Animation.
- Zwei Schichten pro Material: Anschlag (kurz, tonal: Fels hell/metallisch, Erde dumpf,
  Sand weich) + Nachrieseln (Rauschen, Länge je Material). Zufällige Tonhöhe ±8 %, damit
  es nie identisch klingt; Panorama nach Bildschirmposition.
- Treffer auf Gold/Edelstein: heller „Ting“ (gibt es) mit steigender Tonhöhe, wenn mehrere
  Nuggets kurz nacheinander fallen.

### Etappe 6 – Beute (G7)

- Zähler pro Wühler statt global (`c.dust = { gold, ore, coal, gem, loam, earth }`),
  Sprengungen bekommen einen eigenen Zähler am Explosionsort.
- Nugget springt mit kleinem Bogen und Lichtblitz heraus, wird beim Einsammeln ins Inventar-
  Feld „geflogen“ (vorhandene Reward-Sparks nutzen).
- Ader-Ende: wenn die letzte Zelle einer Ader fällt, fällt der Rest-Ertrag (kein verlorener
  Staub mehr).
- Balance prüfen: Erträge pro Ader im Mittel unverändert (Soak-Test `tests/visual.mjs`).

### Etappe 7 – Steuerung und Haptik (G9 G10)

- Automatisches Graben: kürzere Anlaufzeit, wenn schon gegraben wurde (Weitergraben nach
  kurzem Absetzen ohne neue Wartezeit), Hysterese gegen An/Aus-Flackern.
- Schräge sanft wechseln (Slope über ~6 Frames interpolieren statt springen).
- Touch: dezente Vorschau-Kontur der nächsten Grabzone, solange „Graben“ gehalten wird.
- Vibration 8–15 ms pro Treffer (Fels stärker), Option „Vibration“ im Menü, respektiert Stumm.

---

## 4. Technische Leitplanken

- **Multiplayer:** Graben läuft auf dem Host; Rand-Rauschen muss aus Koordinaten abgeleitet
  sein (nicht `rnd()`), damit `net/terrain.js` keine zusätzlichen Chunks schicken muss.
  Partikel/Sound/Animation bleiben rein lokal.
- **Helfer:** `helpers.js` übergibt eigene `I.slope`; Härte und Takt gelten für sie genauso.
  Pfadfindung (`pathfind.js`) bekommt die Härte als Kosten, damit Helfer Sand bevorzugen.
- **Performance:** `paint()` malt pro Zelle 9 Zellen neu – bei größeren Treffer-Portionen
  einmal pro Treffer gesammelt neu malen. Ziel: kein Frame über 16 ms auf einem
  Mittelklasse-Android beim Graben.
- **Abschaltbar:** Alles Optische hängt an `G.lightFx` bzw. „Schnelle Grafik“.

## 5. Tests

- Neuer Playwright-Test `tests/dig.spec.js`: Bot gräbt gerade, schräg hoch, schräg runter
  durch jedes Material; prüft Tempo-Korridor, dass der Körper nie stecken bleibt
  (`unstuck` greift nicht) und dass Erträge beim Grabenden landen.
- `tests/visual.mjs` um Szenen „Graben in Sand/Erde/Fels“ erweitern (Screenshots vorher/nachher).
- Tutorial- und Treppen-Tests müssen grün bleiben.

## 6. Reihenfolge und Aufwand

| Etappe | Wirkung | Aufwand | Risiko |
|---|---|---|---|
| 1 Härte + Takt | sehr hoch | mittel | Balance, Helfer-Timing |
| 5 Klang | hoch | klein | gering |
| 3 Partikel | hoch | klein | Performance |
| 4 Animation | hoch | mittel | gering |
| 2 Stollen-Optik | mittel–hoch | mittel | Multiplayer-Sync, Kollision |
| 6 Beute | mittel | klein | Balance |
| 7 Steuerung/Haptik | mittel | klein | Gewöhnung |

Empfehlung: **1 → 5 → 3 → 4** als erster Release (das „Gefühl“), danach **2 → 6 → 7**.

## 7. Erfolgskriterien

- Blindtest: Tester erkennen Sand, Erde, Fels allein am Klang.
- Graben 100 px Erde dauert ±10 % so lange wie heute.
- Kein neuer Hänger in Tutorial-, Treppen- und Grab-Tests.
- Bildrate beim Graben auf Android unverändert (Profiler).
