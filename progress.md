Original prompt: RIFT CLIMB: PULSE – M6: PULSE ENGINE. Bestehendes Repository analysieren und vollständig um Musik, feste Beat-Timeline, Dimensions-Layer, Action-SFX, Audio-Einstellungen, mobile Lifecycle-Behandlung und LEVEL FORGE erweitern; testen, dokumentieren, committen und auf den vorhandenen Pages-Branch main pushen.

## Ausgangslage
- Sauberer main, origin T0pTyp/rift-climb, Pages deployt main.
- M1–M5 vorhanden: konstante 260 u/s, 240-Hz-Simulation, Practice, Spur-Solver, mobiler Forge.
- Vorhandener Audio-Sequencer plant pro Frame relativ zu currentTime, verfolgt/stoppt Quellen nicht und hat keine getrennten Busse.
- Forge besitzt BPM, Viertelbeat-Snap, Höhen-Beat-Raster und eine Kamera-/Metronom-Vorschau.
- Keine AGENTS.md im Projekt. Flugphysik und Kollisionsmodell bleiben erhalten.

## M6 Arbeit
- Gemeinsame BeatTimeline und deterministische Komposition; Audio folgt Simulation mit fester Audio-Clock-Abbildung und Lookahead.
- Quellen-Lifecycle, Lautstärke, Dimensions-Layer, SFX, Editor-Timeline und Vorschau integrieren.
- Tests und visuelle Prüfung ausführen; echte iOS/Android-Hardware hier nicht verfügbar.

## M6 implementiert
- Gemeinsame BeatTimeline, stateless NEON ASCENT-Partitur und visuelle Beat-/Akzenthüllkurven.
- Feste Audio-Clock-Abbildung, 25-ms-Scheduler / 120-ms-Lookahead, Source-Tracking mit Release/Stop/Disconnect.
- Gemeinsame Blau-/Rot-Layer, zehn Action-SFX, gespeicherte Musik-/Effektlautstärke und Mute.
- Lifecycle für Pause, Tod, Neustart, Practice-Respawn, tab visibility und AudioContext-Unterbrechungen.
- Forge: BPM/Meter, Takt-Snap, Objektfelder Beat/Takt/Abschnitt, kompakte Timeline mit Seek und Musikvorschau, echte Playtest-Freigabe über Weiter.
- Hauptlevel: bestehende faire Geometrie erhalten; musikalische Viertelabschnitte und Siegel-Pickups/Akkordakzente passend zur Durchquerungshöhe.
- Export/Autosave erhalten beatsPerBar; früher Resize vor Dokumentladen abgesichert. Mobile Timeline-Overlays entzerrt.
- render_game_to_text und advanceTime; virtuelle Tests schalten Musik-Scheduling ab (keine künstlichen Audio-Node-Lawinen).

## Validierung bis hier
- npm test: beide Level lösbar, 17 Physik-, 33 Rift- und 20 Pulse-Checks bestanden.
- Pulse-Browser: 48 Checks bestanden (Chromium Desktop/Pixel 7, WebKit iPhone-Fallback, OfflineAudioContext-Render).
- Windows-WebKit 27.2 stellt KEINE Web Audio API bereit. Native Safari-Audioassertions ausdrücklich übersprungen; keine echte iOS-/Android-Hardware verfügbar.
- Desktop Forge 70/70; mobile Forge nach Koordinaten-/Resize-Korrektur abschließend erneut ausführen.
- Skill-Client (unveränderte Kopie unter test-results, lokaler Dependency-Auflösung wegen) ausgeführt; Canvas-Screenshots sowie echte Page-Screenshots visuell geprüft.
- Echtzeit-Performance, Pixel-7-Profil, Chromium, Grafik medium, keine CPU-Drosselung: 44-s-Run bis 100 %, JS p95 0,60 ms, Ø 0,30 ms, Audio-Clock-Abweichung p95 20,17 ms, max. vor Korrektur 62,5 ms, 10 Audio-Neuzuordnungen, max. 28 lebende Quellen. Kein echter Gerätebenchmark.
- Offline-WAV: Peak 0,3777; RMS je Abschnitt ca. 0,0345 / 0,0360 / 0,0365 / 0,0342. Kein digitales Clipping bei Standardlautstärke.
- GitHub authentifiziert; Pages-Workflow auf main bestätigt; HEAD identisch origin/main vor Commit.

## Abschluss
- Letzte UI-/Mobile-Resultate und README/Testbericht prüfen, dann geforderten M6-Commit erstellen und main normal pushen.
- Pages-Workflow und veröffentlichte Spiel-/Editor-Version prüfen; echte Hardware- und Hörlatenzprüfung bleibt ausdrücklich offen.

## Abschließende Funktionsprüfungen
- Gameplay-E2E abschließend 100/100, Desktop Forge 70/70, Mobile Forge 50/50, M6-Browser 51/51 ausführbare Checks.
- Neue Grid-Modi explizit als UI-Wechsel geprüft; BPM/Meter-Export-Roundtrip ergänzt (nun 20 Pulse-Unitchecks).
- Finaler Performance-Lauf vollständig bis 100 %: 41,4 Headless-FPS, JS Ø 0,37 / p95 0,80 / p99 1,40 ms, Audio drift p95 8,17 ms, 7 Neuzuordnungen, max. 28 Quellen. 60 FPS auf echter Hardware nicht nachgewiesen.
- Bekannte Grenze bleibt native iOS-/Android-Hardware-Audioabnahme; Windows-WebKit kann Audio nicht bereitstellen.

## Fertig zur Veröffentlichung
- Alle abschließenden Funktionsprüfungen bestanden; README, Architektur und ausführlicher Testbericht fertig.
- Zwischenfehler (Metronom-Altaufruf, Meter-Export, Startup-Frame-Pause, frühes Resize, mobile Testkoordinaten) korrigiert und nachgeprüft.
- Keine offenen Implementierungs-TODOs. Hardware-Abnahme (echtes iOS/Android, Anruf/Bluetooth/Hardware-Mute) bleibt dokumentierte Testgrenze.
- M6 normal auf main committen/pushen; keine Force-Pushes, keine neuen Repositories.
