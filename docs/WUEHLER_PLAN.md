# Wühler: Fähigkeiten und Spielerbindung

Alle sechs Figuren haben eine passive Rolle und eine aktive Fähigkeit. Im freien Spiel
(Goldrausch, Siedler, Schatzsucher, Festung, Siedlungswelt) und Koop gelten dieselben
Basiswerte für neue und erfahrene Spieler. Tutorial, Kampagne, eigene Szenarien,
Tagesschicht, Wiederholungen und Versus bleiben ohne Rollenboni.

| Wühler | Passiv | Aktiv |
|---|---|---|
| Anna | +10 % Grabtempo auf weichem Boden | +40 % Grabtempo |
| Bruno | 20 statt 16 Taschenplätze | +25 % Lauftempo mit mindestens 4 Gegenständen |
| Mika | Rohstoffhinweise in 15 Pixeln Umgebung | Rohstoffhinweise in 90 Pixeln Umgebung |
| Juna | −20 % Fallschaden | +40 % Zugtempo des gekauften Enterhakens |
| Toni | +15 % Bauhilfe | +50 % Tempo einer laufenden Produktion in 50 Pixeln Nähe |
| Nora | Gift und Brand klingen 25 % schneller ab | −30 % Schaden |

Aktivieren: Knopf im HUD, R (umstellbar) oder linker Gamepad-Stick. Die Ausdauer-Variante
wirkt 8 Sekunden, Abklingzeit 40 Sekunden ab Aktivierung. Nach Kapitel 2 steht die Tempo-Variante
mit 5 Sekunden Wirkung und 25 Sekunden Abklingzeit zur Wahl. Eine Variante ist kein Stat-Upgrade.
Werkzeuge, Forschung, Zutaten und Kollisionen bleiben notwendig. Toni beschleunigt nur
bereits bezahlte Produktionsaufträge, solange er in der Nähe bleibt.

## Persönlicher Fortschritt

Das Album zeigt Rolle, Fähigkeit, Aufgaben, aktuellen Stand, Belohnungen und Varianten.
Drei kumulative Kapitel belohnen tatsächliche Aktionen mit 60, 120 und 200 XP. Kapitel 2
braucht zusätzlich zwei produktive Aktivierungen, Kapitel 3 acht. Leeres Aktivieren bringt
keinen Fortschritt; jede Aktivierung zählt höchstens einmal. Kapitel 3 gibt das persönliche
Meisterabzeichen und die vorhandene Königsrobe, ohne das aktuelle Outfit zu wechseln.
Wer die Robe schon besitzt, behält sie; XP und Abzeichen bleiben die persönliche Belohnung.

- Anna: 300 / 2.500 / 10.000 tatsächlich entfernte Bodenfelder.
- Bruno: 12 / 80 / 300 an der Basis abgegebene Gegenstände.
- Mika: 4 / 25 / 100 eingesammelte Goldnuggets oder Edelsteine.
- Juna: 2 / 12 / 40 mit dem Haken erreichte Kanten.
- Toni: 1 / 5 / 15 mitgebauten fertigen Gebäuden; laufende Wartung zählt als produktive Nutzung.
- Nora: 5 / 30 / 100 durch Standhalten abgefangene Schadenspunkte.

Toni bleibt ab Level 5 verfügbar, alternativ nach 12 mitgebauten Gebäuden. Nora bleibt
nach 10 Siegen verfügbar, alternativ nach 60 eingesammelten Goldnuggets oder Edelsteinen.
Die Alternativen gelten auch für Spieler mit altem Aussehen ohne ausgewählten Helden.
Ein freiwilliges Tagesziel vergibt 30 XP für die erste produktive Aktivierung am lokalen
Kalendertag. Keine neue Währung und kein Fortschrittsverlust bei Pausen.

Siedlungswelten haben ein freiwilliges Teamprojekt: drei unterschiedliche Rollen mit
produktiven Aktivierungen beitragen lassen. Es blockiert keinen Meilenstein und kann auch
über mehrere Sitzungen erreicht werden. Das Heimatbergwerk stellt die Meisterabzeichen aus.

## Technik und Fairness

- Identität kommt aus dem bestehenden Skin-Tag; Spielbefehle werden vom Host geprüft.
- Aktive Zeiten und Fortschrittszähler gehören zur Figur und werden an Clients übertragen.
- Nur das eigene Gerät sammelt die eigenen Fortschrittsdifferenzen ins Profil.
- Alte/importierte Figuren beginnen beim ersten Snapshot als Ausgangsstand; gespeicherte
  Zähler werden nicht als neue Aktionen belohnt. Neue Aktivitäten zählen danach normal.
- Weltarchive erlauben jetzt bis zu 20 Gegenstände. Bestehende Archive bleiben lesbar.
- Keine externe Analyse: Ereignisse bleiben im vorhandenen lokalen Ringpuffer.

## Bewertung und nächste Anpassung

Die Basisprüfung betrifft alle sechs Rollen, Modusgrenzen, Abklingzeiten, leere und produktive
Nutzung, eigene und fremde Fortschritte, Weltarchive und Übersetzungen. Albumtests prüfen
320 bis 1280 Pixel Breite. UI bleibt bei Holz/Gold, 44-Pixel-Tippflächen und Fokuszuständen;
Abklingzeiten haben Text und Füllstand. Kategorien 8–10 der ART_RUBRIC: klare Fortschritts-
und Sperrzustände, ein zusätzlicher situationsabhängiger HUD-Knopf, bestehende Albumhierarchie.

Balancing ist ein Startwert und benötigt echte Spieltests. Verglichen werden erste
Meisterschaftsabschlüsse, Rollenwechsel, produktive Nutzung und Rückkehr (1/7 Tage).
Lokale Ereignisse erlauben Tests pro Gerät; organisationsweite Rückkehrraten brauchen eine
spätere, separat entworfene Analyse mit Einwilligung. Versus-Fähigkeiten und eine gewertete
Tagesschicht mit standardisierten Rollen sollten erst nach diesen Spieltests folgen.
