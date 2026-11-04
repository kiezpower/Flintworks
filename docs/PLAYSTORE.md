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
| 1 | Google-Play-Entwicklerkonto | ✅ vorhanden |
| 2 | Upload-Schlüssel erzeugen | `keytool -genkeypair -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000` (Passwort gut aufheben, Datei sicher sichern – ohne sie gibt es keine Updates, nur über ein Zurücksetzen beim Google-Support) |
| 3 | Secrets im Repo | Settings → Secrets → Actions: `ANDROID_KEYSTORE_BASE64` (= `base64 -w0 upload.jks`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (= `upload`), `ANDROID_KEY_PASSWORD` |
| 4 | Datenschutzerklärung fertig machen | In `public/privacy.html` oben Name, Anschrift und E-Mail eintragen (der gelbe Platzhalter), pushen, dann `https://kiezpower.github.io/Flintworks/privacy.html` prüfen |
| 5 | Bundle bauen | Actions → *Play-Store-Bundle bauen* → *Run workflow*, Ergebnis `flintworks.aab` unter Artifacts |
| 6 | App anlegen | Play Console → App erstellen → Name „Flintworks“, Standardsprache Deutsch, **Spiel**, **kostenlos**; Play App Signing aktiv lassen |
| 7 | Store-Eintrag und Fragebögen | Texte, Bilder und Antworten unten eintragen (Dashboard → „App einrichten“) |
| 8 | Interner Test (optional) | Release „Interner Test“ → AAB hochladen → sich selbst eintragen, kurz prüfen |
| 9 | **Geschlossener Test** | siehe unten – Pflicht vor dem Store-Start |
| 10 | Produktion beantragen | Dashboard → „Zugriff auf Produktion beantragen“, Fragen zum Test beantworten, dann Release „Produktion“ |

**Kostenlos oder kostenpflichtig:** Eine App, die einmal kostenlos veröffentlicht ist, kann nicht
mehr kostenpflichtig werden (umgekehrt geht es). In-App-Käufe (z. B. ein Unterstützer-Paket mit
Skins) lassen sich später jederzeit ergänzen. Sobald die App Geld einnimmt (Preis oder Käufe),
braucht das Konto ein Zahlungsprofil, und Google zeigt die Anschrift im Store an.

## Geschlossener Test (Pflicht für neue private Konten)

Bei privaten Entwicklerkonten, die nach dem 13. 11. 2023 angelegt wurden, gibt Google die
Produktion erst frei, wenn ein geschlossener Test mit **mindestens 12 Testern** lief, die
**14 Tage am Stück** dabei waren (aktuelle Zahlen in der Play Console unter Dashboard prüfen).

| # | Schritt | Wie |
|---|---|---|
| 1 | Tester sammeln | 15–20 Leute mit Gmail-Adresse oder Google-Konto (ein paar Reserve, falls jemand abspringt) |
| 2 | Liste anlegen | Testen → Geschlossene Tests → Track „Alpha“ → Tester → E-Mail-Liste (oder eine Google Group) |
| 3 | Release | AAB hochladen, Länder: alle oder DACH, „Zur Überprüfung senden“ (die erste Prüfung dauert ein paar Tage) |
| 4 | Einladen | Den Link „Am Test teilnehmen“ verschicken: Tester bestätigen die Teilnahme und installieren die App **aus dem Play Store** (nicht die APK aus den Releases) |
| 5 | 14 Tage | App installiert lassen und ab und zu spielen; Rückmeldungen per Tester-Feedback in der Play Console. Updates sind währenddessen erlaubt (neue Version hochladen) |
| 6 | Danach | Produktion beantragen (Fragen: wie Tester gefunden wurden, was geändert wurde, warum die App bereit ist) |

Vorlage für die Einladung:

> Hallo! Flintworks kommt in den Play Store, und Google verlangt vorher einen Test mit 12 Leuten
> über 14 Tage. Machst du mit? 1. Schick mir die E-Mail-Adresse deines Google-Kontos. 2. Öffne
> danach den Link, den ich dir schicke, tippe auf „Tester werden“ und installiere die App aus dem
> Play Store. 3. Lass sie 14 Tage drauf und spiel ab und zu eine Runde (der Tagesschacht reicht).
> Danke!

## Store-Eintrag

| Feld | Deutsch | English |
|---|---|---|
| Name | Flintworks | Flintworks |
| Kurzbeschreibung (80) | Grabe, baue und leite dein Bergwerk – allein oder mit Freunden. | Dig, build and run your own mine – alone or with friends. |
| Kategorie | Spiele → Simulation (oder Strategie) | Games → Simulation |
| Tags | Simulation, Pixel Art, Mehrspieler, Bauen, Abenteuer | |
| Kontakt | E-Mail (Pflicht, öffentlich sichtbar), Website `https://kiezpower.github.io/Flintworks/` | |

**Beschreibung (DE, höchstens 4000 Zeichen):**

Flintworks ist ein Grabe- und Aufbauspiel in einer Pixelwelt, die du komplett umgraben kannst. Grab dich durch Erde, Sand und Fels, finde Gold, Erz und Edelsteine und bring alles zu deiner Burg. Fäll Bäume, bau Sägewerk, Hochofen, Werkstatt und Fahrstuhl und verkaufe, was deine Produktion hergibt. Deine Helfer graben, sammeln und bringen alles heim – und pass auf Einstürze, Grubengas und Höhlenmonster auf.

TAGESSCHACHT
Jeden Tag eine neue Welt, für alle gleich: acht Minuten, so viele Taler wie möglich. Sammle Medaillen, halte deine Serie und vergleiche dich mit deinen Freunden.

ZUSAMMEN SPIELEN
Bis zu vier Spieler im Koop, im Versus (zwei Teams) oder Jeder gegen jeden. „Schnell spielen“ bringt dich ohne Code mit anderen zusammen, jede Stunde mit einem anderen Modus. Bist du allein, spielen Bots gegen dich. Freunde lädst du per Link, Code oder QR-Code ein – ganz ohne Konto.

KAMPAGNE UND FREIES SPIEL
Zwei Kapitel mit handgebauten Leveln (rette die Fluffel aus ihren Höhlen, erkunde eine alte Mine, erklimm den Gipfel), dazu Goldrausch, Siedler und Schatzsucher in Wiese, Wüste und Winter.

HEIMATBERGWERK
Deine Heim-Crew schürft Kristalle, auch wenn das Spiel zu ist. Gib sie für mehr Crew, kleine Boni und Skins für deinen Wühler und deine Gebäude aus.

Ohne Werbung, ohne Käufe, ohne Konto. Auf Deutsch und Englisch.

**Description (EN, at most 4000 characters):**

Flintworks is a digging and building game in a pixel world you can dig up completely. Dig through earth, sand and rock, find gold, ore and gems and bring them home to your castle. Chop trees, build a sawmill, furnace, workshop and lift, and sell what your production makes. Your helpers dig, collect and carry everything home – and watch out for cave-ins, mine gas and cave monsters.

DAILY SHAFT
A new world every day, the same for everybody: eight minutes to earn as many coins as you can. Collect medals, keep your streak and compare with your friends.

PLAY TOGETHER
Up to four players in co-op, versus (two teams) or free-for-all. Quick play matches you with others without a code, with a different mode every hour. Alone? Bots play against you. Invite friends by link, code or QR code – no account needed.

CAMPAIGN AND FREE PLAY
Two chapters of hand-built levels (rescue the fluffels from their caves, explore an old mine, climb the summit), plus Gold Rush, Settlers and Treasure Hunt in meadow, desert and winter.

HOME MINE
Your home crew mines crystals even while the game is closed. Spend them on more crew, small boosts and skins for your digger and your buildings.

No ads, no purchases, no account. In English and German.

## Fragebögen in der Play Console

Stand v1.69.0. Wenn sich etwas ändert (Käufe, Werbung, Analyse-Dienst mit Versand, Chat), die
Antworten hier und in der Play Console anpassen.

**App-Inhalte (Richtlinie → App-Inhalte):**

| Abschnitt | Antwort |
|---|---|
| Datenschutzerklärung | `https://kiezpower.github.io/Flintworks/privacy.html` |
| App-Zugriff | Alle Funktionen ohne besonderen Zugriff verfügbar (kein Login) |
| Werbung | Nein |
| Werbe-ID | Nein, die App verwendet keine Werbe-ID (keine Berechtigung `AD_ID` im Manifest) |
| Zielgruppe | **13–15, 16–17, 18+** (nicht jünger: dann gelten die Familienrichtlinien, und „Schnell spielen“ bringt Fremde zusammen). „Spricht die App Kinder an?“ → Nein |
| Nachrichten-App, Behörden, Finanzen, Gesundheit | Nein |

**Datensicherheit:**

| Frage | Antwort |
|---|---|
| Werden Nutzerdaten erhoben oder geteilt? | Ja (nur Mehrspieler und Freunde) |
| Verschlüsselt übertragen? | Ja (wss / https) |
| Können Nutzer das Löschen anfordern? | Es gibt kein Konto. Angeben: Daten liegen auf dem Gerät und verschwinden mit „App-Daten löschen“; der Server hält nur Arbeitsspeicher (Räume höchstens 10 Min., Freunde höchstens 30 Tage nach der letzten Verbindung) |

| Datentyp | Erhoben | Geteilt | Kurzlebig verarbeitet? | Pflicht? | Zweck |
|---|---|---|---|---|---|
| Persönliche Angaben → **Name** (frei gewählter Name des Wühlers) | Ja | Nein (die Weitergabe an Mitspieler und Freunde geschieht auf Wunsch des Nutzers) | Nein | Optional (nur Mehrspieler/Freunde) | App-Funktionen |
| Geräte- oder andere IDs (zufällige Geräte-Kennung, Freundescode) | Ja | Nein | Nein | Optional | App-Funktionen |
| App-Aktivität → Interaktionen in der App (Spielzüge, Tagesschacht-Ergebnis) | Ja | Nein | Nein | Optional | App-Funktionen |

Nicht erhoben: Standort, Kontakte, Fotos, Dateien, Finanzdaten, Gesundheit, Nachrichten, Absturzberichte, Analysedaten (die Tutorial-Ereignisse aus `src/analytics.js` bleiben auf dem Gerät).

**Inhaltsbewertung (IARC-Fragebogen, Kategorie „Spiel“):**

| Frage | Antwort |
|---|---|
| Gewalt | Ja, Fantasie-/Comic-Gewalt: Monster und gegnerische Wühler werden mit Hacke, Schwert, Bogen, Steinen und TNT besiegt; kein Blut, keine realistischen Menschen |
| Angst, Sex, Drogen, Alkohol, Glücksspiel, Schimpfwörter | Nein (Schatztruhen sind kein Glücksspiel: kein echtes Geld) |
| Interaktion zwischen Nutzern | **Ja**: Mehrspieler mit Fremden („Schnell spielen“, offene Räume); Kommunikation nur über feste Zurufe (kein freier Chat); frei gewählte Spielernamen (12 Zeichen) sind für Mitspieler sichtbar |
| Teilt Standort | Nein |
| Digitale Käufe | Nein |

Erwartetes Ergebnis: etwa USK 6 / PEGI 7.

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
