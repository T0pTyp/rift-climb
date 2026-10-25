# M8 — ausgeführte Prüfungen

Stand: 25. Oktober 2026. Bestehendes Repository, Windows, Node 20, Playwright,
Chromium 156 und Windows-WebKit. Alle unten aufgeführten Suiten wurden tatsächlich
gegen das lokale statische Projekt ausgeführt. Zwischenfehler wurden korrigiert und
die betroffenen Suiten erneut ausgeführt.

## Fortschritt, Isolation und Migration

`npm test` umfasst fünf gültige/durchspielbare Leveldefinitionen, 17 Physik-,
33 Rift-Pulse-, 20 Pulse-Engine-, 50 Kampagnen- und 24 M8-Progressionsprüfungen.

Die M8-Prüfungen bestätigen:

- Genau einen Versuch beim normalen Start, einen Tod beim Treffer und einen Abschluss
  beim echten Sieg. Wiederholte `die`-/`win`-/`finish`-Aufrufe erhöhen keine Zähler erneut.
- Bronze bei 50, Silber bei 75, Gold erst beim Abschluss; ein Prozentbericht von 100
  allein gilt nicht als Sieg. Bestwerte und Medaillen bleiben monoton.
- Alle acht Achievement-Bedingungen, einmalige Vergabe, korrekte Skin-Freischaltungen,
  gesperrte Ausrüstung und Wiederherstellung der ausgewählten Ausstattung.
- M7-Migration erhält bekannte Bestwerte, Versuche und Abschlüsse. Nachgeholte
  Freischaltungen erfinden keine Zeitpunkte. Alte Todeszahlen/Spielzeit bleiben unbekannt.
- Beschädigtes JSON und beschädigte Felder können aus der Sicherung wiederhergestellt
  werden. Fehlender/werfender Speicher führt zu Sitzungsergebnissen mit Warnhinweis.
  Eine zukünftige Schema-Version wird nicht überschrieben.
- Practice, direkte Wechsel von Practice zu Normal und explizit isolierte Forge-
  Playtests vergeben keine unberechtigten normalen Rekorde oder Belohnungen.
- Aktive Spielzeit entspricht der tatsächlich simulierten Normal-Zeit; Pause zählt nicht.

Für **jedes der drei Levels mit jedem der fünf Skins** wurden vollständige reguläre
Simulationsläufe ausgeführt: 15 Abschlüsse mit identischen Positions-/Dimensions-
Traces, aktiven Kollisionen und unveränderter Flugphysik. Die regulären Normalwerte
werden bei jedem berechtigten Lauf korrekt erfasst. Die M7-Kampagnentests bestätigen
weiterhin identische Traces bei 5/10/30/60/144 FPS und wechselnden Frameabständen,
jeweils mit und ohne Audio-Stub.

## Browser und Menüs

`tests/ascension-e2e.mjs` bestand 121 Prüfungen des vollständigen Ablaufs in Desktop-Chromium,
Pixel-7-Touchprofil und iPhone-13-WebKitprofil:

1. Hauptmenü, alle fünf Menüzielbereiche und drei sofort spielbare Levelkarten mit
   echten Motiven und PLAY/PRACTICE-Aktionen.
2. Tatsächliche vollständige Game-Replays durch alle drei Levels: Bronze, Silber,
   Gold, acht Datenbedingungen und die jeweiligen Designs. Die Simulation verwendet
   normale `press`-Eingaben, aktive Kollisionen und keine Teleports.
3. Abschlussdarstellung, NEXT LEVEL, kein NEXT nach Overload, Duplikatschutz,
   sofort sichtbarer RETRY und getrennte Rückkehr zu Auswahl/Hauptmenü.
4. Practice-Abschluss und NEXT im Practice-Modus ohne normale Belohnungen.
5. Anlegen von Golden Riftling, Wiederherstellung nach Browser-Reload,
   Achievement-/Profilansicht und gespeicherte Stummschaltung.
6. Alle fünf visuell unterschiedlichen Skin-Ebenen werden durch denselben Renderer
   in Idle, Flug, Wechsel, Tod und Respawn tatsächlich auf Canvas gezeichnet.
7. Forge-Playtest erreicht 100 % mit expliziter Isolation; der reguläre Version-2-
   Spielstand bleibt beim Test und nach Editor-Rückkehr bytegleich.
8. Reale Browser-Speicherung mit M7-Altdaten, beschädigtem JSON und absichtlich
   blockiertem `Storage.setItem`, jeweils ohne Absturz und mit passendem Hinweis.
9. Alle sechs Menüseiten bei 320×568, 360×640, 390×844, 430×932 und 768×1024:
   kein horizontaler Überlauf, Oberkante erreichbar und vertikale Scrollbarkeit.
10. Reward-, Rekord- und Siegsounds gemeinsam durch den wirklichen Web-Audio-Graphen:
    hörbarer Pegel ohne digitales Clipping.

Die normalisierte Zeitsteuerung der Replay-Tests dient der vollständigen Simulation;
sie ist kein Test menschlicher Reaktionszeiten oder physischer Touch-Latenz.
Benachrichtigungen werden während aktiver Spielsequenzen nicht eingeblendet. Ihre
Speicherung und die Bildschirmnavigation sind unabhängig von der Anzeigedauer.
Screenshots von Hauptmenü, Auswahl, allen Ergebnisansichten, Collection, Profil und
Achievements wurden visuell geprüft. Ein eigener Bereich am unteren Ergebnisrand
hält die Belohnungsnachricht von den Navigationsknöpfen fern.

## Bestehende Regressionssuiten

| Suite | Ergebnis |
| --- | --- |
| `tests/e2e.mjs` | 100/100 Gameplay-Browserchecks |
| `tests/campaign-e2e.mjs` | 141/141 M7-Checks, einschließlich aller 186 echten Touch-Eingaben |
| `tests/forge-e2e.mjs` | 70/70 Desktop-Forge-Checks |
| `tests/forge-mobile-e2e.mjs` | 50/50 Mobile-Forge-Checks |
| `tests/pulse-e2e.mjs` | 51 M6-Audio-/Lifecycle-Browserchecks |
| `tests/m5-visuals.mjs` | 25/25 Grafik-/Animationschecks |
| `tests/campaign-audio.mjs` | Sechs komplette Stück-Renderings, jeweils Blau/Rot, ohne Clipping |

Die bisherigen Tests verwenden jetzt die neue Menü-Navigation und den kanonischen
Version-2-Spielstand. Die eigentlichen Gameplay-/Editorprüfungen bleiben erhalten.
Ein Zwischenlauf des Grafiktests lief beim Browserstart in einen Timeout; der
anschließende vollständige Lauf bestand 25/25. Alte Aussagen, dass alle Levelkarten
gleichzeitig in einen kleinen Viewport passen müssten, wurden durch Prüfungen der
geforderten Scrollbarkeit ersetzt. Kein fehlgeschlagener Zwischenlauf wird als
erfolgreiches Testergebnis gezählt.

Der bestehende Skill-Client wurde für Gameplay und Collection-Zustand ausgeführt;
`render_game_to_text` enthält auch aktuelle Menüseite, Skin und Profil-Summen.
Der Skill-Client extrahiert den Spielcanvas. Die vollständigen DOM-Menüansichten
werden deshalb zusätzlich von den eigenen Browsertests aufgenommen und geprüft.

Die drei M7-JSON-Dateien sowie `player.js`, `physics.js` und `config.js` weisen in M8
keinen Diff auf. Alle drei Levels erreichen weiterhin 100 %; Grafikprofile oder
automatische visuelle Herabstufungen wurden nicht eingeführt.

## Performance und ehrliche Testgrenzen

Ein kompletter Overload-Lauf mit echter requestAnimationFrame-Uhr, Musik und neuer
Fortschrittsspeicherung ergab im Pixel-7-Profil auf dem Windows-Desktop ohne CPU-
Drosselung rund 239 rAF-FPS, 4,5 ms p95-Frameabstand, 0,40 ms p95 für Game-Update
und Rendering, etwa 2,3 MB Heap-Differenz und maximal 30 aktive Stimmen.
Die beobachtete Audio-Clock-Abweichung lag bei 39,2 ms im 95. Perzentil, mit drei
Audio-Neuzuordnungen. Die Musik passt sich der Simulation an; Physik wird nie durch
die Audio-Uhr korrigiert. Das ist keine Messung der hörbaren Ausgabelatenz.

**Es standen keine echten iPhones oder Android-Geräte zur Verfügung.** Die Profile
simulieren Viewports und Touch, verwenden aber den Desktop-Rechner. Es gibt deshalb
keine Zusage gemessener 60 FPS auf Smartphone-GPUs. Windows-WebKit besitzt hier keine
Web Audio API: stummer Betrieb, UI, Eingaben und Forge wurden geprüft, native iOS-
Audiowiedergabe ausdrücklich nicht. Notch, Telefonunterbrechungen, Hardware-Mute,
Bluetooth-Latenz und subjektive Sound-/Skin-Lesbarkeit benötigen echte Gerätetests.

Lokale Speicherung ist browser-/gerätegebunden. Bei blockiertem Speicher bleiben
nur Sitzungsdaten; Löschen der Browserdaten entfernt auch das Backup. Historische
Todesfälle/Spielzeit lassen sich nicht nachträglich messen. Die Notification-Queue
überlebt keinen Reload; die bereits verdienten Achievements/Skins schon.
Menschliche Langzeitbewertung der Motivation und Belohnungsbalance steht noch aus.

## Reproduktion

```sh
npm ci
npm test
npx playwright install chromium webkit
# HTTP-Server separat starten: python -m http.server 8080
npm run test:ascension:e2e
npm run test:campaign:e2e
npm run test:campaign:audio
npm run test:audio:e2e
node tests/e2e.mjs
node tests/forge-e2e.mjs
node tests/forge-mobile-e2e.mjs
node tests/m5-visuals.mjs
# LEVEL=overload, THROTTLE=1, PERF_DIR=test-results/m8 als Umgebungsvariablen
node tests/perf.mjs
```

`BASE_URL` kann den Testserver ersetzen. Die hiesigen lokalen Browserpfade wurden
über denselben ignorierten Launch-Preload wie in M7 gesetzt. Artefakte liegen unter
`test-results/m8/` und zugehörigen `m8-*.log`-Dateien; wiederverwendete M7-Tests behalten
ihre bisherigen Artefaktordner. Testdateien, Playwright und Logs werden nicht als
Spielassets auf Pages ausgeliefert.
