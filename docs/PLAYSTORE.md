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

## Screenshots

Mindestens 2 Bilder pro Gerätetyp (Querformat 16:9, z. B. 1920×1080): Lobby, Überwelt mit Burg, Stollen mit Helfern, Mehrspieler-Raum. Aus dem Spiel auf dem Handy aufnehmen oder im Browser mit 1920×1080.
