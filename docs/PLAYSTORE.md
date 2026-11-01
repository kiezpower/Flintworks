# Flintworks – Play Store

## Was schon fertig ist

| Teil | Wo |
|---|---|
| Signiertes App-Bundle (AAB) | GitHub Action `Play-Store-Bundle bauen` (bei Tag `v*` oder von Hand) |
| Versionsnummer | `versionName` = Version aus `package.json`, `versionCode` = laufende Nummer der Action |
| Datenschutzerklärung | `https://kiezpower.github.io/Flintworks/privacy.html` (**Anschrift oben noch eintragen**) |
| Icons | `public/icons/icon-512.png` (Store-Icon 512×512), Android-Icons in `android/app/src/main/res/mipmap-*` |

## Einmalig einrichten

| # | Schritt | Wie |
|---|---|---|
| 1 | Google-Play-Entwicklerkonto | play.google.com/console, einmalig 25 $ |
| 2 | Upload-Schlüssel erzeugen | `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` (Passwort gut aufheben, Datei sicher sichern) |
| 3 | Secrets im Repo | Settings → Secrets → Actions: `ANDROID_KEYSTORE_BASE64` (= `base64 -w0 upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (= `upload`), `ANDROID_KEY_PASSWORD` |
| 4 | Bundle bauen | Actions → *Play-Store-Bundle bauen* → *Run workflow*, Ergebnis `flintworks.aab` unter Artifacts |
| 5 | App anlegen | Play Console → App erstellen → „Spiel“, kostenlos; Play App Signing aktiv lassen |
| 6 | Interner Test | Release „Interner Test“ → AAB hochladen → Tester per E-Mail einladen |

## Store-Eintrag

| Feld | Deutsch | English |
|---|---|---|
| Name | Flintworks | Flintworks |
| Kurzbeschreibung (80) | Grabe, baue und leite dein Bergwerk – allein oder mit Freunden. | Dig, build and run your own mine – alone or with friends. |
| Kategorie | Spiele → Simulation (oder Strategie) | Games → Simulation |

**Beschreibung (DE):**
Flintworks ist ein Pixel-Grabspiel im Stil der Klassiker: Grabe dich durch Erde, Sand und Fels, finde Gold, Erz und Edelsteine und bring alles zu deiner Burg. Deine Helfer graben, fällen und bauen von selbst – du gibst ihnen Aufgaben und markierst Abbaugebiete. Baue Sägewerk, Hochofen, Werkstatt und Fahrstuhl, stütze deine Stollen mit Balken und hüte dich vor Einstürzen, Grubengas und Höhlenmonstern.
Gemeinsam spielen: Lade bis zu drei Freunde per Link ein und grabt zusammen (Koop) oder tretet mit roter gegen blaue Burg gegeneinander an (Versus).
Ohne Werbung, ohne Käufe, ohne Konto.

**Description (EN):**
Flintworks is a pixel digging game in the spirit of the classics: dig through earth, sand and rock, find gold, ore and gems and bring them home to your castle. Your helpers dig, chop and build on their own – you give them jobs and mark mining areas. Build a sawmill, furnace, workshop and lift, prop up your tunnels with beams and beware of cave-ins, mine gas and cave monsters.
Play together: invite up to three friends with a link and dig together (co-op) or play red castle against blue castle (versus).
No ads, no purchases, no account.

## Fragebögen in der Play Console

| Abschnitt | Antwort |
|---|---|
| Datensicherheit: Werden Daten erhoben? | Ja – nur im Mehrspieler: App-Aktivität (Spieldaten) und Gerätekennung, **nicht gespeichert**, nicht geteilt außer mit Mitspielern, verschlüsselt übertragen (wss), nicht erforderlich (Einzelspiel geht ohne) |
| Werbung | Nein |
| In-App-Käufe | Nein |
| Inhaltsbewertung (IARC) | Comic-Gewalt gering (Monster werden mit Steinen/Sprengstoff besiegt), keine Interaktion mit Fremden außer per Einladungslink, kein Chat (nur feste Zurufe) |
| Zielgruppe | ab 10 Jahren (nicht „für Kinder“, sonst gelten Familienrichtlinien) |

## Screenshots und Grafiken

`npm run store-shots` erzeugt alles aus gestellten Szenen im aktuellen Spiel:

| Datei | Verwendung |
|---|---|
| `docs/play/feature-de.png`, `feature-en.png` | Feature-Grafik (1024 × 500) |
| `docs/itch/screenshot-1..5-de.png`, `-en.png` | Screenshots (1280 × 720, 16:9) |

Mindestens 2 Screenshots pro Gerätetyp; die fünf aus `docs/itch/` passen.

### Optional: Titelbild mit einem KI-Bildgenerator

Für ein gemaltes Titelbild (statt der Szene aus dem Spiel) in einem Bildgenerator 3–4 Bilder
mit diesem Prompt erzeugen und das beste als `docs/play/keyart.png` ablegen:

> Pixel art key art for a cozy mining game, wide landscape 2:1. A small stone castle on a grassy
> hill, a windmill and a sawmill beside it; below the ground a cross-section of warm brown earth
> with tunnels, glowing gold veins, purple crystals and a lava pool deep down. Three little miners
> with red, blue and green caps and pickaxes. Soft morning light, snowy mountains behind.
> Crisp pixels, limited warm palette, dark brown outlines, no text.

Die Nutzungsbedingungen des Generators für kommerzielle Nutzung prüfen; die Schrift kommt
danach dazu (wie in `feature-*.png`), damit sie scharf und übersetzbar bleibt.

## Einladungen per WhatsApp: wohin der Link zeigt

Alle Einladungen und Freundeslinks zeigen auf die **Webversion auf GitHub Pages**, egal ob sie
aus der App, aus itch.io oder aus dem Browser geteilt werden:

- Raum: `https://kiezpower.github.io/Flintworks/?room=ABC123`
- Freund: `https://kiezpower.github.io/Flintworks/?friend=CODE&n=Name`

Das ist der einzige Link, der überall funktioniert: Jeder kann ihn im Browser öffnen und sofort
mitspielen, ohne App und ohne itch-Konto. Ein itch.io-Link taugt dafür nicht, weil das Spiel dort
in einem Rahmen läuft und den Raum-Code aus der Adresse nicht bekommt. Die Nachricht enthält
außerdem den Raum-Code zum Abtippen (im Mehrspieler-Fenster unter „oder mit Code beitreten“).

Wer die App hat, soll mit demselben Link in der App landen. Dafür gibt es zwei Wege:

1. **„In der App öffnen“** (funktioniert schon jetzt): Öffnet jemand den Link im Browser eines
   Android-Handys, zeigt die Webseite unten einen Balken „In der App öffnen“ (`src/applink.js`).
   Ist die App installiert, öffnet sie sich im Raum; sonst bleibt man im Browser und spielt dort.
2. **Verifizierte App-Links** (einmal einrichten): Dann öffnet ein Tipp auf den Link in WhatsApp
   direkt die App, ganz ohne Umweg. Das Manifest ist vorbereitet (`android:autoVerify="true"`);
   es fehlt noch die Bestätigungsdatei auf der Webseite:

   | # | Schritt | Wo / Wie |
   |---|---|---|
   | 1 | Fingerabdruck holen | Play Console → App → Testen und veröffentlichen → **App-Integrität** → App-Signatur → „SHA-256-Zertifikatfingerabdruck“ des **App-Signaturschlüssels** kopieren (Play App Signing signiert die Store-Version damit). Für APKs aus der GitHub Action zusätzlich den Upload-Schlüssel: `keytool -list -v -keystore upload.jks -alias upload` |
   | 2 | Datei ausfüllen | `docs/assetlinks.json` kopieren, die Platzhalter durch die Fingerabdrücke ersetzen (Großbuchstaben mit Doppelpunkten) |
   | 3 | Datei veröffentlichen | Android sucht sie an der **Wurzel der Domain**: `https://kiezpower.github.io/.well-known/assetlinks.json` – nicht unter `/Flintworks/`. Dafür auf GitHub ein Repository **`kiezpower.github.io`** anlegen (Pages aktivieren, Branch `main`), darin `.well-known/assetlinks.json` und eine leere Datei `.nojekyll` (sonst lässt GitHub Pages Ordner mit Punkt weg) |
   | 4 | Prüfen | `https://kiezpower.github.io/.well-known/assetlinks.json` im Browser öffnen; dann mit Googles Prüfer: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://kiezpower.github.io&relation=delegate_permission/common.handle_all_urls` |
   | 5 | App neu installieren | Android prüft beim Installieren bzw. Aktualisieren; danach öffnet ein Link aus WhatsApp die App direkt (Test: `adb shell pm get-app-links de.kiezpower.flintworks` zeigt `verified`) |

   Mit einer eigenen Domain (z. B. `flintworks.de`) gilt dasselbe: Datei unter
   `https://flintworks.de/.well-known/assetlinks.json`, Domain im Manifest und als `LIVE` in
   `src/platform.js` eintragen.
