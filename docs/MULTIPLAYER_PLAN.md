# Flintworks – Multiplayer-Plan

Stand: v1.2.3 · Planungsdokument, noch kein Code

**Entscheidungen:**
- Koop und Versus kommen gleichzeitig.
- Bis zu 4 Spieler.
- Spiel übers Internet.
- Serverbudget höchstens 5 € pro Monat.

---

## 1. Bestandsaufnahme

### 1.1 Ist-Zustand der Kernsysteme

| System | Datei(en) | Wie es heute funktioniert | Bedeutung für Multiplayer |
|---|---|---|---|
| Game-Loop | `main.js` (`loop`, `step`) | Feste Schrittweite (16,7 ms ÷ Spieltempo), höchstens 4 Schritte pro Bild. Das Rendern ist getrennt. | ✅ Die Schrittweite hängt nicht von der Bildrate ab. Der Tick ist mit `G.frame` gut als Netz-Takt nutzbar. |
| Terrain | `world.js`, `sim.js` | `mat` und `bg` sind je ein `Uint8Array` mit 1400×400 Zellen (je 560 KB). Fallsand und Flüssigkeiten nutzen aktive 32×32-Chunks und `dirty`-Chunks für den Upload. | ✅ Die Chunk-Struktur eignet sich direkt für Diffs. ⚠️ Fallsand und Wasser ändern laufend viele Zellen. |
| Weltgenerator | `gen.js` | Nutzt `rnd()`. Mit `?seed=` ist das reproduzierbar, sonst wird `Math.random` verwendet. | ⚠️ Der Seed muss zur Laufzeit setzbar sein, damit Clients die Welt selbst erzeugen. |
| Entities | `state.js` (Arrays `crew`, `items`, `animals`, `builds`, `trees`, `lorries` …), `objects.js`, `entities.js` | Einfache Objekte in globalen Arrays. Die Physik steckt in `moveBody`/`updClonk`. | ⚠️ Es gibt keine IDs. Die Netzsynchronisation braucht stabile `id`s. |
| Spieler / Crew | `clonk.js`, `helpers.js`, `crewui.js` | `crew[0]` ist der eigene Wühler. `sel_()`, `G.sel` und die Kamera hängen daran (rund 30 Stellen). | ❌ Es braucht mehrere „eigene“ Wühler: `me()` bzw. `playerOf(id)` statt `crew[0]`. |
| Helfer-KI | `helpers.js`, `pathfind.js` | A* in Zeitscheiben (`performance.now()`). Aufgaben pro Helfer, Abbaugebiet. | ⚠️ Das Ergebnis hängt von der Rechenzeit ab und ist deshalb nicht deterministisch. Die KI darf nur beim Host laufen. |
| Input | `input.js`, `tapgo.js` | Ein globales `inp`-Objekt. `step()` gibt es direkt an `crew[G.sel]`. Kontextaktionen und Bauen wirken direkt auf `sel_()`. | ❌ Nötig sind Eingaben pro Spieler (`inputs[playerId]`) und Aktionen als Befehle (`{t:'build', type}`). |
| Wirtschaft | `store.js`, `G.money`, `buildings.js` | Ein globales Lager, eine globale Kasse, eine Basis (`G.base`). | ❌ Für Versus muss das pro Team laufen: `teams[i].money/store/base`. |
| Zufall | `rnd()` an rund 180 Stellen, `Math.random` in Lobby und Musik | Ein globaler Generator. | ✅ Kein Problem, weil nur der Host simuliert. Bleibt so, nur der Seed wird übertragen. |
| Zeit | `performance.now()` (Sterne, Pausen, Planer) | Echtzeit | ⚠️ Sterne nach Ticks berechnen, nicht nach Echtzeit. |
| Savegame | `save.js` | Alles als JSON in localStorage. Der Zustand wird aus `G` und den Arrays gelesen und geschrieben. | ✅ Taugt direkt als Vollbild für Beitritt und Host-Wechsel, wenn man ihn komprimiert und ohne localStorage nutzt. |
| Lobby | `lobby.js`, `net.js`, `lobbyscene.js` | Raumcode mit 6 Zeichen, Link `?room=`, Teilen per Share-Sheet. Zwei „+“-Plätze neben dem Helden. `connect()` ist ein Platzhalter. | ✅ Die Oberfläche ist vorbereitet. Es fehlen Transport, Spielerliste und „Bereit“. |
| UI / HUD | `ui.js`, `crewui.js`, `missions.js`, `tutorial.js` | Lesen `sel_()`, `G.money`, `G.store`. | ⚠️ Auf `me()` und `myTeam()` umstellen. Tutorial und Aufträge nur im Einzelspiel. |

### 1.2 Umbauliste (Voraussetzungen)

| # | Umbau | Betroffene Dateien | Aufwand |
|---|---|---|---|
| U1 | `players.js` neu: `players[]` (id, name, Mütze, Team, crewRef), `me()`, `playerOf(c)`. Ersetzt `crew[0]`, `sel_()` und `G.sel`. | neu, plus `main.js`, `ui.js`, `render.js`, `helpers.js`, `crewui.js`, `missions.js`, `tutorial.js`, `hazards.js`, `ambience.js`, `buildings.js`, `clonk.js`, `store.js`, `gen.js` | M |
| U2 | Eingaben pro Spieler: `inputs[id]`. Das lokale `inp` füllt nur `inputs[me]`. `tapgo` wird pro Spieler geführt. | `input.js`, `tapgo.js`, `main.js` | S |
| U3 | Aktionen als Befehle: `doCommand(playerId, cmd)` für Bauen, Kontext, Werfen, Kaufen, Helfer-Aufgabe, Abbaugebiet. | `ui.js`, `buildings.js`, `clonk.js`, `crewui.js`, neu `commands.js` | M |
| U4 | Teams: `teams[]` mit Geld, Lager, Basis und Gebiet. `G.money`, `G.store` und `G.base` werden zu Gettern auf das eigene Team. | `store.js`, `buildings.js`, `ui.js`, `modes.js`, `helpers.js`, `gen.js` | M |
| U5 | Stabile `id` für alle Entities (`nextId++` beim Anlegen) | `entities.js`, `objects.js`, `buildings.js`, `gen.js`, `state.js` | S |
| U6 | Seed zur Laufzeit setzen: `setSeed(n)` in `world.js` | `world.js`, `gen.js` | S |
| U7 | Sterne und Spielzeit nach Ticks statt nach `performance.now()` | `main.js`, `modes.js` | S |
| U8 | `save.js` aufteilen: `serialize()` und `deserialize()` ohne localStorage, für Netz-Vollbilder | `save.js` | S |

---

## 2. Architektur-Optionen

### 2.1 Transport und Hosting

GitHub Pages liefert nur statische Dateien. Signaling und Relay müssen deshalb extern laufen.

| Option | Was extern läuft | Aufwand | Kosten / Monat | Latenz (DE) | Cheat-Sicherheit | Mobile-Tauglichkeit |
|---|---|---|---|---|---|---|
| **A. P2P WebRTC (Host-autoritativ) + Signaling** | Signaling (PeerJS-Cloud gratis oder eigener Server), TURN für ca. 10–20 % der Mobilfunk-NATs | M–L (ICE, TURN, Fehlersuche) | 0 € (PeerJS ohne Gewähr) bis ca. 5 € (TURN-Traffic) | am besten (direkt, 30–80 ms) | mittel (Host ist ein Spieler) | ⚠️ NAT- und Mobilfunk-Probleme, Verbindungsaufbau 2–5 s |
| **B. WebSocket-Relay (Host-autoritativ), kleiner Node-Server** | ca. 150 Zeilen Node `ws`, leitet nur weiter und hält Räume plus das letzte Vollbild | **S** | **ca. 4–5 €** (Hetzner CX22, 20 TB Traffic inklusive) | gut (+10–30 ms Umweg) | mittel (Host ist ein Spieler) | ✅ Geht durch jedes NAT, Reconnect einfach |
| C. Dedizierter Spielserver (Node simuliert) | Spiel-Simulation headless in Node | **L** (Code hängt an `document`/Canvas, das muss getrennt werden) | 4–5 € (VPS) | gut | **hoch** | ✅ |
| D. Cloudflare Durable Objects als Relay | Worker plus Durable Object pro Raum | S–M | ca. 5 $ (Workers Paid) | gut (Edge) | mittel | ✅ Keine Serverwartung, aber Anbieterbindung |
| E. Colyseus | Colyseus-Server (selbst gehostet oder Cloud) | M (eigenes State-Schema) | ab ca. 4 € selbst gehostet, Cloud deutlich teurer | gut | hoch, wenn die Simulation auf dem Server läuft | ✅ |
| F. Supabase Realtime (Free) | nichts Eigenes | S | 0 € | mittel | niedrig | ⚠️ Nachrichtenkontingent reicht nicht für 15–20 Hz × 4 Spieler. Nur als Signaling geeignet. |

> Die Preise sind ungefähre Werte. Vor der Bestellung aktuell prüfen.

### 2.2 Synchronisationsmodell

| Modell | Voraussetzung | Passt zu Flintworks? | Warum |
|---|---|---|---|
| Deterministischer Lockstep | Alle Clients rechnen exakt gleich, nur Eingaben werden gesendet | ❌ | Die Helfer-KI plant nach Rechenzeit. Der globale Zufall, Float-Physik und Fallsand mit Zufallsrichtung müssten komplett deterministisch werden. Ein Desync wäre kaum zu finden. |
| **State-Sync, Host-autoritativ** | Ein Gerät simuliert, die anderen zeigen an und schicken Eingaben | ✅ | Die Simulation bleibt fast unverändert. Clients sind „dumme“ Anzeigen plus Vorhersage der eigenen Figur. |

### 2.3 Empfehlung

| Entscheidung | Empfehlung | Begründung |
|---|---|---|
| Modell | **State-Sync, Host-autoritativ** (das Gerät des Einladenden simuliert) | Kleinster Umbau, kein Desync-Risiko, und die Helfer-KI bleibt wie sie ist |
| Transport | **Option B: WebSocket-Relay auf dem vorhandenen dogado-vServer, `wss://play.kiez-power.de`** | Im Budget. Funktioniert in jedem Mobilfunknetz. Der Server hält das letzte Vollbild für Beitritt, Reconnect und Host-Wechsel. Am wenigsten Fehlerquellen. |
| Später optional | WebRTC-DataChannel als Direktweg mit dem Relay als Ersatz | Erst, wenn die Latenz wirklich stört |
| Cheat-Schutz | Bewusst niedrig | Spiel unter Freunden, keine Ranglisten, keine Währung zum Kaufen |

---

## 3. Kernprobleme

### 3.1 Zerstörbares Pixel-Terrain

| Thema | Lösung | Zahlen |
|---|---|---|
| Start | Clients erzeugen die Welt selbst aus Seed, Welttyp und Modus. Beim Beitritt mitten im Spiel kommt stattdessen ein Vollbild. | Vollbild `mat` plus `bg` (1,1 MB roh), mit `CompressionStream('deflate-raw')` geschätzt 40–80 KB |
| Laufende Änderungen | Der Host merkt sich pro 32×32-Chunk eine „zuletzt gesendet“-Kopie. Alle 50 ms (20 Hz) gehen die geänderten Chunks als XOR gegen die Kopie, RLE-kodiert und binär raus. | Pro geändertem Chunk 1 KB roh, RLE ca. 50–300 B |
| Fallsand und Wasser | Clients simulieren nicht. Sie setzen nur, was kommt. Sand, der sichtbar fließt, ruckelt bei 20 Hz leicht. Das ist für den Stil vertretbar. | Mit fließendem Wasser ca. 5–15 KB/s, beim Graben 1–3 KB/s |
| Begrenzung | Höchstens 24 Chunks pro Paket. Der Rest geht im nächsten Takt raus, Chunks in Spielernähe zuerst. | Deckel ca. 20 KB/s pro Client |
| Konsistenz | Alle 10 s eine Prüfsumme pro Chunk-Zeile. Weicht sie ab, schickt der Host die Zeile neu. | Wenige Bytes |

### 3.2 Entities und Physik

| Thema | Entscheidung |
|---|---|
| Snapshots | Host sendet 15 Hz. Inhalt: Spieler, Helfer, Tiere, Items, Loren, Bäume (nur Zustand), Gebäude (nur Änderungen). Positionen auf 0,25 px gerundet. Nur Felder, die sich geändert haben (Delta zum letzten bestätigten Snapshot). |
| Fremde Figuren | Interpolation mit 100 ms Puffer zwischen zwei Snapshots |
| Eigene Figur | **Client-Prediction**: Die eigene Figur läuft lokal mit `updClonk` auf dem lokalen Terrain. Der Host korrigiert sanft: unter 2 px nichts, 2–8 px über 6 Ticks angleichen, über 8 px springen. |
| Graben vom Client | Lokal sofort als Vorschau. Gilt erst, wenn das Terrain-Diff vom Host kommt. |
| Rollback | **Nein**. Unnötig bei Clonk-Tempo, und der Aufwand wäre zu hoch. |
| Eingaben | Client sendet mit 30 Hz `{tick, ax, ay, dig, jump, throw, act}`. Befehle (Bauen, Kaufen, Helfer-Aufgabe) gehen einzeln mit Bestätigung. |
| Bandbreite | Host-Upload bei 3 Clients ca. 40–80 KB/s (0,3–0,6 Mbit/s). Pro Client ca. 15–25 KB/s herunter. |

### 3.3 Join, Leave, Reconnect, Host-Wechsel

| Fall | Ablauf |
|---|---|
| Join vor dem Start | Mit Raumcode in die Lobby, ein Platz wird belegt, Spielstart gemeinsam |
| Join im laufenden Spiel | Der Server gibt das letzte Vollbild weiter (höchstens 30 s alt). Danach holt der Host alles nach. Der neue Wühler erscheint in der Basis seines Teams. |
| Spieler geht | Sein Wühler wird zum Helfer (Aufgabe „Alles erledigen“). Kommt er zurück, übernimmt er ihn wieder. |
| Reconnect | Die `playerToken` aus localStorage erkennt den Spieler wieder. Bis 2 Minuten bekommt er seine Figur zurück. |
| Host geht oder App im Hintergrund | Der Host schickt alle 15 s ein komprimiertes Vollbild (`serialize()`) an den Server. Bleibt der Host länger als 5 s weg, bestimmt der Server den Client mit der besten Verbindung zum neuen Host. Der lädt das letzte Vollbild und simuliert weiter. Verlust: höchstens 15 s. |
| Alle weg | Der Raum bleibt 10 Minuten offen, danach löscht der Server ihn |

### 3.4 Mobile

| Problem | Maßnahme |
|---|---|
| Funkloch | WebSocket-Reconnect mit Backoff (0,5 → 1 → 2 → 4 s). Solange getrennt: Hinweis „Verbindung …“, eigene Figur stehen lassen. |
| App im Hintergrund (Client) | Bei `visibilitychange` abmelden. Beim Zurückkehren Reconnect und Vollbild. |
| App im Hintergrund (Host) | Pause für alle mit Hinweis „Host ist weg“. Nach 5 s Host-Wechsel wie in 3.3. |
| Akku | Clients simulieren nicht (spart CPU). Der Host senkt beim Akkusparmodus die Snapshot-Rate auf 10 Hz. Grafik-Option „schnell“ bleibt. |
| Datenvolumen | Ca. 50–100 MB pro Stunde für einen Client. In den Einstellungen anzeigen. |

### 3.5 Spielmodi

| Modus | Spieler | Regeln | Welt |
|---|---|---|---|
| **Koop** | 2–4 | Eine Basis, ein Lager, eine Kasse, gemeinsames Ziel (Goldrausch, Siedler, Schatzsucher). Jeder kann Helfern Aufgaben geben. | Wie bisher, 1400 px |
| **Versus 1:1** | 2 | Je eine Basis links und rechts, eigene Kasse und eigenes Lager, getrennte Helfer. Wer zuerst das Ziel erreicht, gewinnt. | Basen bei ca. 10 % und 90 % der Breite. Der Rohstoffverteiler `spread()` sorgt für Fairness. |
| **Versus 2:2** | 4 | Wie 1:1, zwei Spieler teilen sich jeweils eine Basis | Wie 1:1 |
| Später | – | Freie Versus-Runde mit 4 Basen, dafür muss die Welt breiter werden (`W` variabel) | `W` ist heute konstant. Das wäre ein großer Umbau. |

---

## 4. Lobby und Einladen

| Element | Entscheidung |
|---|---|
| Raumcode | 6 Zeichen ohne Verwechsler wie 0/O und 1/I (gibt es schon in `net.js`). Der Server vergibt ihn und prüft, dass er eindeutig ist. |
| Einladungslink (Web) | `https://kiezpower.github.io/Flintworks/?room=CODE` (gibt es schon) |
| Einladungslink (Android) | 1. Eigenes Schema `flintworks://join/CODE` über einen `intent-filter` plus Capacitor `App.addListener('appUrlOpen')`. 2. Optional App Links für die https-Adresse. Dafür muss `/.well-known/assetlinks.json` im Domain-Root liegen, also im Repo `kiezpower.github.io`. |
| Link ohne App | Die Web-Version öffnet sich und tritt dem Raum direkt bei |
| Freundesliste | **Nein**. Stattdessen lokal „Zuletzt gespielt mit“ (Name und Mütze) zum Neu-Einladen. |
| Lobby-Szene | Die „+“-Plätze zeigen beigetretene Freunde als Wühler in ihrer Mütze und mit Namen. Dazu ein „Bereit“-Haken und im Raum die Wahl Koop/Versus. |

### Ablauf

| # | Host | Freund |
|---|---|---|
| 1 | Tippt auf „+“, dann auf „Link teilen“. Raum wird beim Server angelegt. | – |
| 2 | Wartet, der Platz zeigt „wartet …“ | Öffnet den Link (App oder Web) |
| 3 | – | Verbindet sich, der Name kommt aus dem Profil |
| 4 | Der Platz zeigt den Wühler des Freundes. Host wählt Modus, Welt und Gefahr. | Sieht die Wahl des Hosts, tippt „Bereit“ |
| 5 | Tippt „Spielen“, wenn alle bereit sind | – |
| 6 | Sendet `start {seed, mode, gmode, diff, teams}` | Erzeugt die Welt selbst aus dem Seed |
| 7 | Simuliert und sendet Snapshots | Zeigt an und schickt Eingaben |

---

## 5. Umsetzungsplan

### 5.1 Neue Modulstruktur

| Datei | Zweck | ca. Zeilen |
|---|---|---|
| `src/players.js` | Spieler, Teams, `me()`, `myTeam()`, `playerOf()` | 120 |
| `src/commands.js` | `doCommand(pid, cmd)`: Bauen, Kaufen, Kontext, Helfer-Aufgabe | 150 |
| `src/net/transport.js` | WebSocket-Verbindung, Reconnect, Ping/RTT | 120 |
| `src/net/room.js` | Raum anlegen und beitreten, Spielerliste, Bereit, Start (ersetzt `net.js`) | 150 |
| `src/net/protocol.js` | Nachrichtentypen, Binär-Kodierung (DataView) | 150 |
| `src/net/host.js` | Snapshots bauen, Eingaben und Befehle anwenden, Vollbild alle 15 s | 200 |
| `src/net/client.js` | Snapshots anwenden, Interpolation, Prediction, Korrektur | 220 |
| `src/net/terrain.js` | Chunk-Diffs (XOR + RLE), Vollbild per deflate, Prüfsummen | 180 |
| `src/net/snapshot.js` | Vollbild über `save.js` (`serialize`/`deserialize`) | 80 |
| `server/relay.js` | Node `ws`: Räume, Weiterleitung, letztes Vollbild, Host-Wechsel | 200 |
| `server/package.json`, `server/README.md` | Start mit systemd oder Docker, TLS über Caddy | – |

### 5.2 Phasen

| Phase | Sichtbares Ergebnis | Betroffene / neue Dateien | Aufwand | Risiken |
|---|---|---|---|---|
| **0 Vorbereitung** ✅ v1.3.0 | Einzelspiel läuft wie vorher (U1–U3, U5–U8; U4 Teams kommt mit Phase 6) | `players.js`, `commands.js`, `input.js`, `tapgo.js`, `main.js`, `ui.js`, `render.js`, `helpers.js`, `crewui.js`, `store.js`, `buildings.js`, `save.js`, `world.js`, `entities.js` | 1,5–2 Tage | Viele kleine Stellen mit `crew[0]`. Danach ein Durchlauf durchs Einzelspiel. |
| **1 Zwei Geräte sehen sich bewegen** ✅ v1.4.0 | Zwei Handys im selben Raum, gleiche Welt per Seed, jeder sieht den anderen Wühler laufen (nur Positionen, Terrain lokal) | `server/relay.js`, `net/transport.js`, `net/room.js`, `net/protocol.js`, `lobby.js` | 1 Tag + Server-Setup (2 h) | Domain/TLS für `wss://` (Caddy plus eine Subdomain nötig) |
| **2 Host-autoritativ** ✅ v1.5.0 | Host simuliert, der Freund gräbt, beide sehen dieselben Löcher, Items und Helfer | `net/host.js`, `net/client.js`, `net/terrain.js`, `main.js` | 2–3 Tage | Bandbreite bei Wasser. Wie sich die Vorhersage anfühlt. |
| **3 Lobby und Einladen** ✅ v1.6.0 | Freunde erscheinen in den „+“-Plätzen, Bereit-Haken, gemeinsamer Start, Link öffnet den Raum | `net/room.js`, `lobby.js`, `lobbyscene.js`, `lobby.css`, `i18n.js` | 1 Tag | – |
| **4 Koop** | Gemeinsame Kasse und gemeinsames Lager, jeder steuert Helfer, Mitspieler auf der Minikarte, Namen über den Köpfen, Emotes (👋 ⛏ 🆘) | `players.js`, `ui.js`, `crewui.js`, `render.js`, `modes.js` | 1–1,5 Tage | UI-Platz auf kleinen Handys |
| **5 Robustheit** ✅ v1.7.0 | Funkloch und Hintergrund überstehen, Reconnect, Host-Wechsel, Join im laufenden Spiel | `net/*`, `server/relay.js`, `save.js` | 2 Tage | Host-Wechsel ist der heikelste Teil. Vorher manuell mit 3 Geräten testen. |
| **6 Versus** | 1:1 und 2:2 mit getrennten Basen, Kassen und Helfern, Siegerbildschirm | `players.js`, `gen.js`, `modes.js`, `store.js`, `buildings.js`, `helpers.js`, `ui.js` | 2 Tage | Balance zwischen den Basen. Weltbreite reicht nur für 2 Basen. |
| **7 Android und Feinschliff** | `flintworks://`-Links öffnen die App, Datenanzeige, Verbindungsqualität im HUD | `AndroidManifest.xml`, `main.js`, `net/room.js` | 0,5–1 Tag | App Links nur mit eigenem `kiezpower.github.io`-Repo |

**Gesamt:** ca. 11–13 Arbeitstage. Ab Phase 1 gibt es nach jeder Phase etwas zum Anfassen.

### 5.3 Laufende Kosten

| Posten | Kosten |
|---|---|
| dogado-vServer (vorhanden) | 0 € zusätzlich |
| Subdomain `play.kiez-power.de` | 0 € |
| TLS (Caddy und Let's Encrypt) | 0 € |
| **Summe** | **≤ 5 €/Monat** ✅ |

### 5.4 Regeln für die Umsetzung

| Regel | Umsetzung |
|---|---|
| Höchstens 1000 Zeilen pro Datei | Netzcode aufgeteilt in `src/net/*`. Keine Datei über ca. 250 Zeilen geplant. |
| Keine automatischen Tests | Pro Phase manuell mit zwei Geräten (Handy und Browser) prüfen |
| Keine Monetarisierung | Kein Shop, keine Währung, keine Truhen zum Kaufen. Die Taler bleiben reines Spielgeld innerhalb einer Runde. |
| Alte Savegames | Dürfen brechen (neues `save`-Format mit IDs und Teams) |
| Version | Bei jeder Änderung `package.json` hochzählen |

---

## 6. Offene Punkte

| # | Frage | Vorschlag |
|---|---|---|
| 1 | Server und Subdomain | ✅ dogado-vServer, `play.kiez-power.de` |
| 3 | Gilt das Spieltempo für alle? | Ja, der Host bestimmt es |
