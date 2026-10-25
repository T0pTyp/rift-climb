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

## M7 — Original prompt / Auftrag
THE FIRST ASCENT: drei handgefertigte Premium-Level (First Pulse, Fractured Rhythm, Overload), ausschließlich hochwertige Grafik ohne Profile/Automatik, Levelauswahl und lokale Einzelstatistiken, normale Replay-Nachweise bis 100 %, Forge-Integration, Musikidentitäten, Mobile-/Regressionstests, Dokumentation, Commit und Pages-Veröffentlichung. Erst First Pulse vollständig entwickeln und prüfen, dann die beiden Folgelevel.

### Analyse und feste Grafik
- M1–M6 sind im main vorhanden. Physik bleibt 260 u/s, 240 Hz, gleiche Feder und Kollision.
- Grafikprofil-Datei, UI, gespeicherte Auswahl und Auto-Downgrade entfernt; Darstellung vereinheitlicht. Alte gfx-Werte werden ignoriert und beim Speichern entfernt.
- Bestehende Legacy-Level bleiben als Editor-/Regression-Referenzen erhalten; Kampagne bekommt eigene JSON-Dateien und reguläre Replays.

### M7 Parcours einzeln verifiziert
- First Pulse zuerst: regulärer Replay erreicht 40,00 s / 100 %, 23 Impulse. Vollständiger Pixel-7-Browserlauf, keine Fehler, Screenshots geprüft. Gemeinsame Zeitverschiebung ±100 ms erfolgreich.
- Danach Fractured Rhythm: 56,25 s / 56 Impulse / 100 %. Synthwave, gebrochene Architektur, Dreierläufe und Pulse-Antworten.
- Danach Overload: 66,67 s / 107 Impulse / 100 %. Kernarchitektur, Polarity-Wandtaps, Siegelketten, 312,5-ms-Cluster.
- 44 Kampagnenchecks: reguläre vollständige Replays, 10/30/60/144 FPS und Jitter, identische Audio-on/off-Traces, Practice mit wiederholten Restarts, Schema-/Musiktests und Einzelinput-Timing-Sweep bestanden.
- Timing-Sweep (5-ms-Auflösung, je ein Input): First ≥−200/+115 ms, Fractured −180/+95 ms, Overload −115/+60 ms; kein menschlicher Schwierigkeits-Playtest.
- Fehler behoben: übrig gebliebener GLOW-Verweis an Ziellinie; Practice speichert jetzt exaktes x/v und Rift-Zustände, damit auch schnelle freie Level sinnvolle Checkpoints haben.
- Drei sofort verfügbare Levelkarten, getrennte Statistiken, Wechsel ohne Reload/zweiten AudioContext; alte Level weiter in Forge und per URL zugänglich.

### M7 abschließende Verifikation
- Abschließend 50 Kampagnenchecks inklusive 5 FPS, Audio-on/off-Traces und sofortigem Retry bestanden; vorherige Angabe 44 war ein Zwischenstand.
- 141 M7-Browserchecks bestanden: Desktop Chromium, Pixel-7-Touch und Windows-WebKit; vollständige echte Touch-Eingabesequenzen mit normalem Input-System, alle drei Ziele 100 %.
- Alle drei Forge-Level pro Profil verlustfrei geöffnet/exportiert, echte Geometrie-/Siegel-/BPM-Änderungen, Vorschau, vollständiger Playtest und Rückkehr mit History erfolgreich. Abschnittsnamen auch über echte Eigenschaftenfelder geprüft.
- Regressionen: 100 Gameplay-, 70 Desktop-Forge-, 50 Mobile-Forge-, 51 M6-Pulse- und 25 Riftling-/Grafikchecks bestanden.
- Sechs komplette finale Web-Audio-Renderings (drei Scores × Blau/Rot) inklusive Schlussfanfare, ohne Clipping, alle Abschnitte hörbar und sauberer Ausklang. Melodien folgen der tatsächlichen Dur-/Moll-Harmonie.
- Sofortiger Retry speichert den Bestwert schon bei Kollision; kein verlorener Rekord im 220–280-ms-Fenster mehr. Practice stellt exaktes x/v und RiftField wieder her.
- Echter Hauptloop konsumiert 200-ms-Frames vollständig; >250-ms-Blind-Stalls pausieren auch ohne Audio. Der Fake-rAF-Test musste vor der Messung den vorgesehenen Start-Epoch-Wechsel initialisieren; danach bestanden.
- Skill-Client nach den finalen Änderungen ausgeführt; Fractured Rhythm bei 15 s spielend, Screenshot und render_game_to_text geprüft. Kampagnenmenü, alle Architekturvarianten und mobiler Forge visuell geprüft.
- Keine tatsächlichen iOS-/Android-Geräte verfügbar. Windows-WebKit besitzt hier kein Web Audio; stummer Betrieb geprüft, keine native iOS-Audio- oder Smartphone-FPS-Zusage. Menschliche Fairness-/Spaßabnahme bleibt offen.
- README, docs/FIRST-ASCENT.md, docs/M7-TEST-REPORT.md und PULSE-ENGINE-Dokumentation aktualisiert.
- Finaler Echtzeit-Overload mit Musik: 15.912 Frames, p95 JS 0,30 ms / Frameabstand 4,4 ms, Ø239,1 rAF-FPS auf Desktop, 30 Live-Stimmen Spitze, Audio-Drift p95 17,8 ms und 4 Neuzuordnungen. Kein Smartphone-Benchmark.
