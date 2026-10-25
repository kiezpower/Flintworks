# Flintworks auf itch.io

Bei jedem Push auf `main` lädt GitHub Actions die Web-Version (Kanal `html5`) und die
Android-APK (Kanal `android`) mit **butler** auf itch.io hoch – sobald der Zugang unten
eingerichtet ist. Ohne Zugang werden die Schritte übersprungen, nichts schlägt fehl.

## Einmalig einrichten

| # | Wo | Was |
|---|---|---|
| 1 | itch.io → *Upload new project* | Titel `Flintworks`, URL `flintworks`, *Kind of project*: **HTML**, *Classification*: Game, *Pricing*: **No payments**. Ohne Datei als Entwurf speichern. |
| 2 | itch.io → *Settings → API keys* | *Generate new API key*, Schlüssel kopieren |
| 3 | GitHub → Repo → *Settings → Secrets and variables → Actions → Secrets* | `BUTLER_API_KEY` = Schlüssel aus Schritt 2 |
| 4 | dieselbe Seite → Reiter *Variables* | `ITCH_GAME` = `<dein-itch-name>/flintworks` |
| 5 | GitHub → *Actions* | „itch.io veröffentlichen“ und „Android-App bauen“ einmal per *Run workflow* starten |
| 6 | itch.io → Projekt bearbeiten → *Uploads* | Bei der Datei aus `html5`: **This file will be played in the browser** anhaken. Bei `android`: Plattform **Android** anhaken. |
| 7 | itch.io → Projekt bearbeiten → *Embed options* | siehe Tabelle unten |
| 8 | itch.io → *Visibility* | von *Draft* auf **Public** |

## Einbettung (Embed options)

| Einstellung | Wert |
|---|---|
| Embed in page | Manually set size: **960 × 540** |
| Mobile friendly | an, Orientation **Landscape** |
| Fullscreen button | an |
| Automatically start on page load | aus (Ton braucht einen Klick) |
| Enable scrollbars | aus |
| SharedArrayBuffer support | aus (nicht nötig) |

## Unterschiede zur Version auf GitHub Pages

| Thema | Verhalten auf itch.io |
|---|---|
| Neue Versionen | kommen automatisch mit jedem Push, kein Update-Hinweis im Spiel |
| Offline / als App installieren | aus (das Spiel läuft in einem Rahmen auf itch.io) |
| Multiplayer | geht wie überall über `play.kiez-power.de` |
| Einladungslinks | zeigen auf die Web-Version auf GitHub Pages (der itch-Rahmen kann keine Raum-Links öffnen) |
| Spielstand und Profil | eigene, getrennt von GitHub Pages (andere Domain) |

## Seite gestalten

Bilder liegen in `docs/itch/`:

| Datei | Verwendung |
|---|---|
| `cover.png` | Cover (630 × 500) |
| `screenshot-1..5-en.png` | Screenshots englisch (1280 × 720): Siedlung, Mine mit Grubenbahn, Kampf, Vulkan und Luftschiff, Bohrwagen |
| `screenshot-1..5-de.png` | dieselben auf Deutsch |

| Feld | Inhalt |
|---|---|
| Short description | Dig, build and blast your way through a pixel world – alone, in co-op or versus. |
| Genre | Simulation |
| Tags | pixel-art, digging, mining, sandbox, multiplayer, base-building, clonk |

Beschreibung (Englisch, zum Einfügen):

> **Flintworks** is a digging and building game in a fully destructible pixel world, inspired by the classic *Clonk*.
>
> - Dig tunnels, mine gold and gems and sell them at your castle
> - Your helpers work on their own: they chop trees, mine ore and bring everything home
> - Build sawmills, furnaces, windmills, lifts and towers – and research new technology
> - Ride vehicles: drill wagon, mine train, raft, catapult, cable car, airship
> - Fight cave monsters with sword and longbow
> - Survive earthquakes, volcanoes, meteors and cave-ins
> - Campaign with 7 levels, plus free play in three worlds
> - Up to 4 players online in co-op or versus
>
> Free, no ads, no in-app purchases. Plays in the browser on phone and desktop – an Android app is available too.
