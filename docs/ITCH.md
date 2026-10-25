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

## Seite gestalten (Vorschlag)

| Feld | Inhalt |
|---|---|
| Kurzbeschreibung | Grabe, baue und sprenge dich durch eine Pixelwelt – allein, im Koop oder Versus. |
| Genre | Simulation / Strategy |
| Tags | pixel-art, digging, mining, sandbox, multiplayer, clonk |
| Cover | 630 × 500 Pixel |
| Screenshots | 3–5 Bilder im Querformat |
