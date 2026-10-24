# M6 – Testbericht

Stand: 25. Oktober 2026. Repository `T0pTyp/rift-climb`, bestehender Pages-Branch `main`.

## Automatisierte Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| `npm test`: Leveldaten und Durchspielbarkeit | 2/2 Level gültig, Solver bzw. echter Replay-Nachweis |
| Physik | 17/17 |
| Rift Pulse, Siegel, Practice, faire Öffnungsfenster | 33/33 |
| Neue Beat-/Audio-Logik (`tests/pulse.mjs`) | 20/20 |
| M6-Browserintegration (`tests/pulse-e2e.mjs`) | 51/51 ausführbare Checks; native WebKit-Audioprüfungen ausdrücklich übersprungen, siehe unten |
| LEVEL FORGE Desktop | 70/70 |
| LEVEL FORGE Mobile | 50/50, einschließlich WebKit-Touchplatzierung und Bottom Sheet |
| Allgemeines Gameplay-E2E | 100/100 im abschließenden Lauf |
| Echtzeit-Performance | Vollständiger 44-s-Autopilot-Run bis 100 %, Messwerte unten |
| Skill-Client und visuelle Kontrolle | Ausgeführt; Spiel-, Desktop- und Mobile-Editor-Screenshots geprüft |

Getestete M6-Abläufe: gesperrtes Audio vor Benutzerinteraktion, Start danach, feste Beatposition, normale/Beat/kombinierte
Raster, neue BPM/Taktart, Musikvorschau, Seek, Pause/Resume, Neustart, getrennte gespeicherte Lautstärken, Mute,
Dimensionsbusse, einmalige Aktions-SFX, Practice-Position und Dimension, tonloser 100-%-Abschluss,
Playtest mit expliziter Freigabe und verlustfreie Editor-Rückkehr. Ein API-Ausfall verhindert keine Eingaben oder Kollisionen.

Die Logikprüfung enumeriert alle 352 Sechzehntel des Hauptlevels exakt einmal bei 10/30/60/144 FPS und unregelmäßigen
Frames. Ein separater zehnminütiger Clock-Test mit kontrollierter Audio-Clock ergibt maximal 4,111 ms Differenz
(ein 240-Hz-Simulationsschritt), ohne Neuzuordnung. Alle Kick-Termine bleiben exakt 500 ms auseinander.
Ein künstlicher Clock-Sprung korrigiert ausschließlich die Audiotermine. 100 schnelle Neustarts hinterlassen nach
Release keine Voice. Identische Physik-Traces mit Ton an/aus bei 30/60/144 FPS erreichen jeweils 100 %.
Das sind kontrollierte Clock-Tests, keine Messungen der Lautsprecherlatenz.

## Native Audioausgabe und Pegel

Chromium prüft die echte Web-Audio-Graph- und Transportintegration im Desktop- und Pixel-7-Touchprofil.
Zusätzlich rendert `OfflineAudioContext` die vollständige originale Partitur durch dieselbe Synthese,
Dimensionsbusse und den Kompressor. 45-s-WAV einschließlich Ausklang:
`test-results/m6/neon-ascent.wav` (nicht versioniertes Testartefakt).

Standardmischung Blau, Musik 0,65 / Effekte 0,70:
- Peak: 0,377701 (digitale Grenze 1,0), kein digitales Clipping.
- RMS INTRO/BUILD/DROP/FINALE: 0,03453 / 0,03595 / 0,03648 / 0,03423.
- Der letzte Abschnitt enthält den bewusst ruhigeren Abschluss und den Ausklang; Intensität wird durch Arrangement
  und Akzente gestaltet, nicht durch immer höhere Lautstärke.

## Echtzeit und Performance

Lokales Windows, Chromium 156 / Playwright 1.64.1, Pixel-7-Profil, Grafik MITTEL, keine CPU-Drosselung.
Dies ist ein Desktop-Benchmark mit Mobile-Viewport, kein Smartphone-Benchmark.

Abschließender Messlauf: 1.820 Frames über den gesamten 44-s-Run, gemittelt 41,4 FPS im Headless-RAF.
JS für Update + Render: Mittel 0,37 ms, p95 0,80 ms, p99 1,40 ms; Frame-Abstand p95 33,7 ms.
Audio-Clock-Differenz nach der ersten Sekunde: p95 8,17 ms. Maximal vor Korrektur einschließlich
AudioContext-Aufwärmphase 100 ms; 7 Audio-Neuzuordnungen, maximal 28 lebende Stimmen.
Ein früherer Lauf desselben Szenarios lag bei 236 FPS; die Host-/RAF-Schwankung ist erheblich.
Damit wird hier keine stabile 60-FPS-Ausgabe auf echter Smartphone-Hardware behauptet. Die Musik folgt dem durch Frame-Capping begrenzten
Simulationsfortschritt; die Simulation wird nie zur Musik beschleunigt. Diese Softwaremessung enthält weder
Bluetooth- noch DAC-/Lautsprecherlatenz. Ein Clock-Resync kann einzelne Noten auslassen oder Pad-Tails verkürzen.

Nach Tod, Menü, Pause und Abschluss wird nicht weiter Musik geplant. Kurze ausklingende Releases bzw. die
Abschluss-Fanfare dürfen noch aktiv sein. Quellen werden nach ihrem Ende getrennt.

## Mobile-Grenzen

- Chromium Pixel 7: echte Browser-Audio-API und Touch-Emulation getestet.
- WebKit 27.2 iPhone 13: Touch, Steuerung, sichtbare Timeline, Editor, stummer Fallback und Playtest-Rückkehr getestet.
- **Der installierte Windows-WebKit-Testbuild exportiert weder `AudioContext` noch `webkitAudioContext`.**
  Deshalb kann er hier keine native iOS-Audiofreigabe, Klangmischung oder Unterbrechungswiederherstellung beweisen.
  Der Test gibt dafür ausdrücklich `SKIP` aus; API-lose Funktion wird separat geprüft.
- Echte iOS-Safari- und Android-Chrome-Geräte, Hardware-Stummschalter, Anrufe, Sperrbildschirm und Bluetooth
  wurden nicht physisch getestet. Diese Abnahme bleibt offen.
- Audio-Interrupt- und Clock-Fehlerpfade sind zusätzlich mit kontrolliertem Context getestet;
  `visibilitychange` pausiert im Browser-E2E. Es gibt keine Behauptung samplegenauer Kopfhörer-/Touch-Synchronität.
- Checkpoint-Seeks rekonstruieren die Partitur mit neuen Hüllkurven und Pad-Restdauer; sie erhalten keine alten
  Oszillatorphasen. Die seitliche Flugphysik wird nur im echten Playtest geprüft, nicht in der Kameravorschau.

## Reproduktion

`npm ci`, `npx playwright install chromium webkit`, lokaler HTTP-Server, dann `npm test`,
`npm run test:audio:e2e`, `node tests/e2e.mjs`, `node tests/forge-e2e.mjs`,
`node tests/forge-mobile-e2e.mjs`. Für Performance: `THROTTLE=1 GFX=medium node tests/perf.mjs`
(Umgebungsvariablen unter PowerShell über `$env:THROTTLE` / `$env:GFX` setzen).
`BASE_URL` kann auf einen anderen Server zeigen.

Hier wurde der unveränderte Skill-Client als Kopie unter `test-results/` ausgeführt, damit seine ESM-Imports die
lokale Playwright-Installation auflösen. Browserpfade wurden nur über eine nicht versionierte Test-Hilfsdatei angepasst.
Ein lokaler Server mit größerer Verbindungswarteschlange verhinderte Windows-Verbindungsfehler bei Modulimports.
Ein Zwischenlauf des allgemeinen E2E hatte einen transienten `ERR_NO_BUFFER_SPACE`-Konsolenfehler;
der abschließende Lauf ist in der Tabelle oben separat ausgewiesen. Fehlgeschlagene Zwischenläufe wurden nicht
als bestandene Tests gezählt. Sämtliche Testartefakte liegen im ignorierten Verzeichnis `test-results/`.

## Veröffentlichung

Der bestehende GitHub-Pages-Workflow führt vor dem Upload `npm test` aus. Er veröffentlicht weiterhin nur
`index.html`, `css/`, `js/` und `assets/` von `main`; Playwright und Testartefakte werden nicht ausgeliefert.
Spiel: https://t0ptyp.github.io/rift-climb/ · Editor: https://t0ptyp.github.io/rift-climb/assets/forge/.
Deploymentstatus und Commit werden nach dem Push im Abschlussbericht dieser Aufgabe verifiziert.
