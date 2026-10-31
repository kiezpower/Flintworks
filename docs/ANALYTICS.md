# Analyse: Ereignisse, Funnel, Datenschutz

> **Stand: v1.52.0.** Eine zentrale Schnittstelle (`src/analytics.js`), zuerst für das Onboarding.
> Es gibt **keinen Anbieter**: Ereignisse bleiben auf dem Gerät (Ringpuffer). Ein Anbieter lässt
> sich mit `setSink()` anschließen, braucht dann aber eine Einwilligung (siehe unten).

## Regeln

- Ereignisse gibt es **nur** über `ev(name, felder)` aus `src/analytics.js`. Kein `console.log`, kein
  eigener Speicher in anderen Modulen. (`track()` in `profile.js` ist **keine** Analyse, sondern
  XP und Tagesaufgaben.)
- Namen sind stabil, englisch, `snake_case`, unabhängig von der Sprache. Neue Ereignisse und Felder
  zuerst in die Tabelle `EVENTS` in `analytics.js` **und** in diese Datei eintragen.
- Felder sind nur Zahlen, kurze Kennungen (Schritt-IDs, Modus-IDs) und Wahrheitswerte. Keine Namen,
  keine freien Texte, keine Spielertexte, keine Geräte-IDs, keine Weltkoordinaten.
- Ungültige Ereignisse (unbekannter Name, unbekanntes Feld, falscher Typ) werden verworfen und nur im
  Entwicklungsserver als Warnung gemeldet.
- `once: true` = höchstens einmal je Sitzung, `once: 'run'` = höchstens einmal je Tutorial-Lauf
  (`newRun()` beim Start des Tutorials). So gibt es keine Doppelten, auch bei Doppeltipps.
- Die Analyse darf das Spiel nie stören: alles in `try/catch`, Speicher voll oder gesperrt → die
  Ereignisse bleiben im Speicher; der Anbieter wird asynchron (`setTimeout`) aufgerufen, seine
  Fehler werden verschluckt. Offline ändert nichts.

## Kontext an jedem Ereignis

| Feld | Bedeutung |
|---|---|
| `e` | Name |
| `sid` | Zufällige Kennung der Sitzung (8 Zeichen, nicht gespeichert, keine Geräte-ID) |
| `seq` | Laufende Nummer in der Sitzung (Reihenfolge) |
| `t` | Millisekunden seit Sitzungsbeginn |
| `v` | Spielversion (`__APP_VERSION__`) |
| `plat` | `web`, `pwa` (installiert) oder `android` |
| `input` | `keys` oder `touch` (`G.inputKind`) |
| `lang` | `de` oder `en` |

## Ereignisse

| Ereignis | Felder | Wann | Quelle |
|---|---|---|---|
| `app_open` | `first`, `days_since` | Laden der Seite; `days_since` = Tage seit dem letzten Besuch (Rückkehr) | `analytics.js` |
| `onb_first_input` | `ms`, `kind` (`keys`, `touch`, `pointer`) | Erste Eingabe auf dem Startschleier; `ms` = Zeit seit dem Laden | `veil.js` |
| `onb_start` | `entry` (`first_launch`, `replay`) | Tutorial beginnt | `tutorial.js` |
| `onb_step_start` | `step`, `i` | Ein Schritt beginnt | `tutorial.js` |
| `onb_first_action` | `kind` (`move`, `jump`, `dig`), `sec` | Erste Handlung in der Welt | `tutorial.js` |
| `onb_hint` | `step`, `level` (`jump`, `pickup`, `pit`) | Ein Hinweis aus der Situation wird gezeigt | `tutorial.js` |
| `onb_rescue` | `step`, `kind` (`walk`, `lift`, `dig`, `gift`, `action`, `home`) | Eine Rettung greift (Text oder Hilfe) | `tutorial.js` |
| `onb_recover` | `kind` (`ramp`, `climb`, `home`) | Aus der Grube heraus (selbst oder per Rettung) | `tutorial.js` |
| `onb_step_done` | `step`, `i`, `sec`, `prompted`, `hints` | Schritt erledigt; `prompted: false` = ohne Anleitung geschafft | `tutorial.js` |
| `onb_first_success` | `sec`, `money` | Erster Verkauf (der erste echte Erfolg) | `tutorial.js` |
| `onb_complete` | `sec`, `hints`, `skilled` | Tutorial geschafft | `tutorial.js` |
| `onb_skip` | `step`, `sec`, `via` (`button`, `menu`) | Tutorial übersprungen | `tutorial.js` |
| `onb_menu` | `action` (`open`, `skip`, `lobby`, `home`) | Spielmenü im Tutorial; `open` ohne Folgeaktion = abgebrochen | `main.js` |
| `onb_card` | `choice` (`play`, `lobby`), `result` (`done`, `skip`) | Wahl auf der Abschlusskarte | `tutorial.js` |
| `onb_exit` | `step`, `sec` | Seite verlassen mitten im Tutorial (Abbruchstelle) | `tutorial.js` |
| `onb_resume` | `step` | Gespeichertes Tutorial geht weiter | `tutorial.js` |
| `core_round_start` | `mode`, `after_onb` | Eine neue echte Runde beginnt; `after_onb` = direkt nach dem Tutorial | `main.js` |
| `session_end` | `sec`, `state` | Seite wird verlassen (Sitzungslänge) | `analytics.js` |

## Onboarding-Funnel

```
app_open(first) → onb_first_input → onb_start → onb_step_start:walk → onb_first_action
  → onb_step_done:walk → onb_step_start:dig → onb_step_done:dig → onb_step_start:sell
  → onb_step_done:sell → onb_first_success → onb_complete → onb_card(play) → core_round_start(after_onb)
```

Auswertungen (sobald ein Anbieter angeschlossen ist):

| Frage | Rechnung |
|---|---|
| Zeit bis zur ersten Eingabe | `onb_first_input.ms` |
| Zeit bis zur ersten Handlung / zum ersten Erfolg | `onb_first_action.sec`, `onb_first_success.sec` |
| Abschlussquote | `onb_complete` / `onb_start` |
| Abbruchstelle | letzter `onb_step_start` ohne `onb_step_done`, `onb_exit.step`, `onb_skip.step` |
| Schwierige Schritte | `onb_step_done.sec` (Median), `hints`, Anteil `onb_rescue` je Schritt |
| Erfahrene Spieler | Anteil `onb_complete.skilled`, `onb_step_done.prompted = false` |
| Menü-Abbrüche | `onb_menu:open` ohne folgendes `onb_menu:<aktion>` |
| Übergang ins Spiel | `core_round_start.after_onb` / `onb_complete` |
| Rückkehr | `app_open.days_since` (1 = am nächsten Tag), Sitzungslänge aus `session_end.sec` |

Tode gibt es im Tutorial nicht (der Wühler ist dort unverwundbar), deshalb kein Ereignis dafür.
Wiederholungen eines Schritts gibt es nicht (kein Fehlschlag setzt zurück); was dem am nächsten
kommt, sind `onb_hint`, `onb_rescue` und `onb_recover`.

## Abdeckung

| Bereich | Stand |
|---|---|
| Onboarding (Start, Schritte, Hinweise, Rettungen, Erfolg, Abschluss, Überspringen, Menü, Karte, Abbruch, Fortsetzen) | umgesetzt, getestet (`tests/tutorial.spec.js`, `tests/onboarding.spec.js`) |
| Erste echte Runde (`core_round_start`) | umgesetzt, getestet |
| Sitzung, Rückkehr (`app_open`, `session_end`) | umgesetzt; `app_open` getestet, `session_end` nur von Hand geprüft (`?ev`) |
| Lektionen und Aufträge nach dem Tutorial, Rundenende, Kampagne, Tagesschacht, Mehrspieler | aufgeschoben – noch keine Ereignisse |
| Anbieter, Einwilligung, Versand | aufgeschoben – kein Anbieter gewählt |

## Prüfen

- Im Entwicklungsserver: `window.__ww.analytics.sessionEvents()` (diese Sitzung),
  `events()` (alles Gespeicherte), `clearEvents()`.
- `?ev` an der Adresse blendet die letzten Ereignisse unten links ein (nur im Entwicklungsserver).
- Gespeichert in `localStorage['flintworks-analytics']` (höchstens 300 Ereignisse) und
  `flintworks-analytics-last` (Zeitpunkt des letzten Besuchs).

## Einen Anbieter anschließen

1. Einwilligung einholen (eigener Dialog nach dem Tutorial, nie davor) und im Profil merken.
2. Erst danach `setSink(e => anbieter.send(e))` aufrufen; ohne Einwilligung bleibt alles lokal.
3. Die Datenschutzseite (`public/privacy.html`) um Anbieter, Zweck und Felder ergänzen.
4. Gesammelte lokale Ereignisse ggf. einmalig nachsenden (`events()`), danach `clearEvents()`.
