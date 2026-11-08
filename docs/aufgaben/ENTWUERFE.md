# Aufgaben-Anzeige: drei Entwürfe

Heute: Die Tagesaufgaben stehen nur als schlichte Liste in der Lobby (`ist_panel.png`). Im Spiel
erscheint nur ein kurzer Toast „Aufgabe erfüllt! Hol dir die Belohnung in der Lobby“ (`ist_hud.png`).

Ziel: besser lesbar (Symbol je Aufgabe, klare Fortschrittsanzeige, fertige Aufgaben fallen auf) und
auch während des Spiels einsehbar.

## A · Aufgaben-Knopf oben mit Ausklapp-Liste
- Der Auftrag oben in der Mitte bekommt ein Schriftrollen-Symbol und eine Zahl (abholbereite Aufgaben).
- Antippen klappt eine Liste aus: Auftrag dieser Runde, darunter die drei Tagesaufgaben mit Symbol,
  Balken, Zahl und Belohnung. Fertige Aufgaben werden gold.
- Lobby: dieselbe Zeilenform wie im Spiel.
- Bildschirmfläche: im Normalfall gar keine zusätzliche.
- `A1_spiel.png`, `A2_spiel_offen.png`

## B · Tracker immer sichtbar am linken Rand
- Kleiner Kasten unter den Talern: je Aufgabe Symbol, Balken, Zahl. Fertige leuchten gold mit ✓.
  Mit ▴ einklappbar. Fortschritt zeigt kurz „+1 Baum“ in der Welt.
- Lobby: drei große Kacheln mit Fortschritts-Ring um das Symbol und Abholen-Knopf.
- Bildschirmfläche: dauerhaft ca. 150×100 px links.
- `B1_spiel.png`, `B2_lobby.png`

## C · Aufgaben-Tafel im Menü + Meldung bei Fortschritt
- Im Spiel nichts Dauerhaftes: bei jedem Fortschritt gleitet für 2–3 Sekunden eine Meldung mit
  Symbol und Balken ein („Fälle 6 Bäume 5/6“). Der Menü-Knopf trägt eine Zahl, wenn etwas fertig ist.
- Das Menü bekommt einen Reiter „Aufgaben“: ein Anschlagbrett mit angepinnten Zetteln, Kästchen
  statt Balken, Stempel „ERLEDIGT“. Links der Auftrag der Runde. Die Lobby zeigt dieselbe Tafel.
- Bildschirmfläche: nur kurz während der Meldung.
- `C1_spiel.png`, `C2_menue_tafel.png`

## Entscheidung

Umgesetzt (v1.77.0): **B1** im Spiel (Kasten unter den Talern, mit dem Auftrag der Runde; die
Leiste oben mit dem Auftrag entfällt) und **C2** als Tafel, im Menü unter dem Reiter „Aufgaben“ und
in der Lobby. Belohnungen werden direkt auf der Tafel abgeholt. Code: `src/questui.js`.
