# Wühler: Fähigkeiten, Meisterschaft und Spielerbindung (1.136.0)

Der erste Wühler wird auf der vorhandenen Abschlusskarte des Tutorials ausgewählt. Anna
ist sichtbar vorausgewählt; die vier sofort verfügbaren Rollen stehen daneben. Erst beim
Weitergehen wird die Wahl gespeichert. Vor dem Tutorial erscheint kein neues Menü.
Alte Profile und ausdrücklich ausgewählte Figuren behalten ihr Aussehen.

## Rollen und Varianten

| Wühler | Grundfähigkeit, 8 s / 40 s Abklingzeit | Persönliche Alternative |
|---|---|---|
| Anna | +40 % Grabtempo | Präzisionshieb: +80 % in hartem Boden, kein aktiver Schub in weichem Boden; 5 s / 30 s |
| Bruno | +25 % Lauftempo mit mindestens vier Gegenständen | Sammelruf: Gegenstände werden herangezogen; 6 s / 30 s |
| Mika | Rohstoffe in 90 Pixeln Umgebung zeigen | Schatzpeilung: vier nächste Gold-/Edelsteinfunde in 55 Pixeln; 6 s / 30 s |
| Juna | +40 % Zugtempo des gekauften Hakens | Sicherer Aufstieg: normales Zugtempo, −60 % Fallschaden; 6 s / 30 s |
| Toni | +50 % Tempo einer nahen laufenden Produktion | Baustellenschub: eigene Bauhilfe mit Faktor 1,6; 6 s / 35 s |
| Nora | −30 % Schaden | Entgiften: Gift/Brand sofort beenden, danach −10 % Schaden; 2 s / 35 s |

Passive Rollenboni bleiben erhalten: Anna +10 % auf weichem Boden, Bruno 20 Taschenplätze,
Mika kurze Rohstoffhinweise, Juna −20 % Fallschaden, Toni +15 % Bauhilfe, Nora schnelleres
Abklingen von Gift/Brand. Werkzeuge, Forschung und Zutaten bleiben erforderlich.

Im freien Spiel wird die Alternative nach Kapitel 2 freigeschaltet. Der Host prüft jeden
Aktivierungsbefehl gegen den Freischaltstand der Figur, nicht gegen mitgesendete Behauptungen.
Die bestehende Architektur hat lokale Profile ohne Konto: der Relay überträgt eine begrenzte
Freischaltmaske des Geräteprofils, und der Host ergänzt selbst erspielte Freischaltungen.
Das ist keine serverseitige Beglaubigung eines lokal gespeicherten Profils.

## Persönliche Meistermissionen und Belohnungen

Die Arbeitsziele aus 1.135.0 bleiben bestehen. Kapitel 2 braucht zusätzlich zwei wirksame
Aktivierungen und eine eigene Rollenaufgabe. Kapitel 3 verlangt acht wirksame Aktivierungen
und eine Meisterprüfung. Nur passende Spielaktionen zählen, jede Aktivierung höchstens einmal.

| Wühler | Aufgabe in Kapitel 2 | Meisterprüfung in Kapitel 3 | Titel / Outfit |
|---|---|---|---|
| Anna | 15 m Tiefe erreichen | 1.200 Felder unterhalb 25 m in einer Welt graben | Stollenmeisterin / Bernsteinkittel |
| Bruno | volle Tasche (20) heimbringen | mindestens 16 Gegenstände aus 20 m Tiefe sicher heimbringen | Lastenmeister / Schieferwams |
| Mika | Gold und Edelsteine finden | aktive Suche in vier Stollenabschnitten einer Welt | Aderfinder / Kupfermantel |
| Juna | drei unterschiedliche Kanten einer Welt erreichen | 12 m Aufstieg mit einem Hakenwurf | Gipfelstürmerin / Gipfeljacke |
| Toni | drei Gebäudearten mitbauen | zwei verschiedene Produktionsarten einer Welt warten | Werkmeister / Meisterschurz |
| Nora | Gift oder Brand lebend überstehen | nach 10 abgefangenen Schadenspunkten mit ≥50 Energie heimkehren | Tiefenwächterin / Tiefenmantel |

Kapitel geben 60 / 120 / 200 XP. Die letzte Stufe gibt persönliches Outfit, Titel und eine
statische Meisterpose auf dem Podest. Outfits werden nicht automatisch angezogen und können
nicht mit Kristallen freigekauft werden. Bereits belohnte Kapitel bleiben nach dem Update
erreicht; bestehende Meister erhalten ihr persönliches Outfit ohne erneute XP-Auszahlung.

Toni bleibt alternativ über zwölf mitgebaute Gebäude, Nora über sechzig gesammelte Goldnuggets
oder Edelsteine erreichbar. Das freiwillige Tagesziel (+30 XP für eine wirksame Aktivierung im
freien Spiel) steht auch auf der vorhandenen Aufgabentafel und im begrenzten Aufgaben-HUD.

## Gemeinsame Bauprojekte

Siedlungswelten haben drei aufeinanderfolgende, freiwillige Projekte. Alle können dazu beitragen;
keine feste Teamzusammensetzung ist erforderlich. Helfer, Produktion und verschiedene Rollen
unterstützen dasselbe Weltziel. Abgegebene Materialien werden gezählt, nicht ein zweites Mal bezahlt.

1. **Stollenlager:** 12 Holz, 12 Stein abgeben und Sägewerk bauen; 80 Taler.
2. **Werkverbund:** 18 Bretter und 6 Metall produzieren, drei Gebäudearten bauen; 120 Taler.
3. **Tiefenexpedition:** 24 Nuggets und vier Edelsteine abgeben, 25 m erschließen, drei Hakenankünfte; 180 Taler.

Stand, Beiträge und bereits bezahlte Projekte werden mit der Welt gespeichert und an Mitspieler
übertragen. Aufgaben-HUD, Aufgabentafel und Heimatbergwerk zeigen die nächsten Anforderungen.

## Tagesschicht, Versus, Wiederholungen

- Tagesschicht: Tagesnummer bestimmt für alle dieselbe Rolle und dieselbe Variante. Ein Spieler
  kann diese Vorgabe nicht per Befehl ändern. An Juna-Tagen ist der Haken für alle vorhanden.
- Versus: alle sechs Rollen und beide Varianten stehen jedem zur Verfügung. Die Wettkampfrolle
  wird im Album gewählt, unabhängig von gesperrten kosmetischen Figuren. Bots nutzen ebenfalls
  eine Rolle und aktivieren sie regelmäßig. Persönlicher Fortschritt gibt keine zusätzlichen Werte.
- Dauerhaft gekaufte Ausrüstung gilt in gewerteten Modi nicht; Rundenausrüstung gilt für alle
  nach denselben Regeln. Kampagne und Tutorial bleiben ohne Rollenboni.
- Wiederholungen führen aufgezeichnete Fähigkeiten deterministisch aus, vergeben aber keine
  neuen Belohnungen und nehmen keine neuen Eingaben an. App-Versionen trennen alte Aufzeichnungen.

## Hostwechsel und Weltimport

Snapshots übertragen den Einmal-Merker, Missionszustand, Freischaltmaske, laufende Wartung und
exakte Produktionsrestzeit samt Ausgabemenge. Ein neuer Host setzt diese Zustände fort.
Weltimporte prüfen zusätzliche Missions-, Projekt- und Freischaltfelder. Alte Archive ohne diese
Felder bleiben lesbar. Vorhandene Weltzähler bilden beim Laden einen Ausgangsstand und werden
nicht erneut als neue Profilfortschritte belohnt.

## Auswertung und Balancing

Album → Spielverlauf zeigt auf diesem Gerät Rückkehr nach einem beziehungsweise sieben lokalen
Kalendertagen, ausprobierte Rollen, Aktivierungen, wirksame Nutzungen und Kapitelabschlüsse.
Nicht erreichte Beobachtungstage werden als „Noch nicht auswertbar“ gezeigt. Rückkehrflags
bleiben auch nach der Begrenzung des Besuchsverlaufs erhalten. Ereignisse bleiben im vorhandenen
lokalen Ringpuffer (300 Einträge); es gibt keinen externen Anbieter und keine Übertragung.

Diese Anzeige ist ein Prüfwerkzeug, kein Nachweis höherer Spielerbindung. Für eine belastbare
Bewertung braucht es echte Spieler, ausreichend Beobachtungszeit und eine Vergleichsgruppe.
Als erste Balancing-Iteration prüfen: Kapitel-1-Abschluss in der ersten Sitzung, Rollenwechsel,
Anteil wirksamer Aktivierungen, D1/D7 sowie vergleichbare Ergebnisse je Wettkampfrolle.
Die dokumentierten Werte sind Startwerte und dürfen erst anhand solcher Beobachtungen als
bewährt bezeichnet werden.

## Prüfabdeckung

`hero-completion.spec.js` prüft die Audit-Lücken, Missionssperren, Rollenvarianten, persönliche
Belohnungen, Bauprojekte, faire Vorgaben, den Einstieg und die lokale Rückkehranzeige.
`heroskills.spec.js`, `hero-coop.spec.js` und `heroalbum.spec.js` prüfen die bestehenden Grundlagen,
Netzwerkbefehle und Layouts. Zusätzlich werden Tutorial, Weltarchive, Produktion, Tagesschicht,
Wiederholungen und Mehrspieler-Regressionen ausgeführt. UI nutzt bestehende Holz-/Goldflächen,
Bree Serif/Nunito, Fokuszustände und mindestens 44 Pixel große Tippflächen.
