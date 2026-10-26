Original prompt: RIFT CLIMB: PULSE – M6: PULSE ENGINE. Bestehendes Repository analysieren und vollständig um Musik, feste Beat-Timeline, Dimensions-Layer, Action-SFX, Audio-Einstellungen, mobile Lifecycle-Behandlung und LEVEL FORGE erweitern; testen, dokumentieren, committen und auf den vorhandenen Pages-Branch main pushen.

## M7.8 – Phase Flow & Fairness (2026-10-26)
- Auftrag aus angehängtem Text gelesen. Ausgangspunkt main 2822215, sauber und gleich origin/main; M7.7 ist veröffentlicht. Keine AGENTS.md im Projekt. Develop-web-game-Testschleife bleibt aktiv.
- Vorläufige Analyse: keine Bewegungs-/Animationssperre; jeder Impuls retargetet sofort, nur 45-ms-Eingabeentprellung. Verdacht: Entprellung misst Bearbeitungszeit statt Ereigniszeit und kann nach Browser-Stalls gültige zeitversetzte Kontakte verwerfen. Wird mit tatsächlicher Input-Klasse geprüft.
- M7.8 vergleicht nur intern 360/324/306 u und Buffer 0/60/100 ms. Keine öffentlichen Modi/Optionen; Compact bleibt verborgen. Keine Entscheidung ohne Simulation. Schwerpunkt geometrische Reserven statt Unverwundbarkeit.
- Laufend: unveränderte npm-test-Baseline; anschließend kleine Korrekturen, reale Replays aller sechs Levels/20 Chunks, Reaktionsanalyse, Mobile-/Forge-/Audio-Regression, Dokumentation und Commit/Push/Pages.
- Baseline vollständig bestanden. Gültige Ereignisse 100/160 ms bei Empfang 200 ms: vorher 1, jetzt 2 angenommen. Gemeinsame monotone Uhr einschließlich Epoch-Normalisierung; synchrone Event-Scope-Grenze für langsame Start-/Resume-Aktionen, strikte Grenze bei Tod/Unterbrechung; keine spätere Eingabewarteschlange. UI verfolgt einzelne Kontakte mit Capture/Cancel und akzeptiert auch sekundären Retry-Finger.
- Produktionsentscheidungen: Breite 360 u, Input-/Phase-Buffer 0/0 ms, alle Physikparameter unverändert. Interne 324/306-u-Modelle bestehen 6+20 Replays, verlieren aber Rand-/Korridorreserve und benötigen sechs Körperkorrekturen. Kamera unverändert. Drei Breiten visuell mit gleichem Renderer/Pixelmaßstab in isolierter Sitzung geprüft. Neue feine Dimensionsmarkierung folgt exakt dem logischen Zustand.
- Singularity: sieben Zeilen um 2–9 u versetzt und vier lokale Minen-Ladezeiten .72–.78 s. Vorher 11 ±50-ms-Ausfälle und Minimum40/20 ms, nachher keine und Minimum50/50 ms. Alle Replay-Tipps unverändert; erste fünf Leveldateien unverändert.
- Infinity: neun bestehende Module lokal korrigiert (max13 u Zeilenversatz, drei Korridorkanten10/26 u, sechs Mine-Timer .72–.82 s); keine neuen Module/Objekte. 26 frühere ±50-ms-Ausfälle beseitigt. 2100 Variationen über alle10-ms-Zwischenwerte und480 Bewegungs-Eingangsfixtures bestanden. Geschlossene Siegel bleiben unpassierbar; Akzent-Rasterzuordnung unverändert. Zusätzlicher mindestens2-s-Nahtvertrag (real2.25 s) und Gewichtung nach schneller Aktionsserie im bestehenden Generator.
- Tests: npm test inkl. bestehender332 Checks +Arena-Analyse78 Replays/18 Bewegungsprofile und24 Flow-Gruppen bestanden; gezielte Input-/Phase-Suite auf34 erweitert und separat bestanden. Browser695 Checks einschließlich39 neuer Fälle, native180-ms-Stall-Eingaben und Zweifinger-Retry. Frühe Browser-Timeout-/Clock-Regressionen untersucht und behoben bzw. isoliert wiederholt. Physische Smartphones bleiben ungetestet; Windows-WebKit prüft Silent-Fallback.
- Performance104-s-Rift-Infinity4×CPU: JS p95 2.0 ms, p99 3.0 ms; 4 Chunks/88 Objekte/Cache2, 0 Quellen nach Pause. Kein Vergleichs-FPS-/Hardwareversprechen. Messungen/Entscheidungen unter docs/M7.8-*; verbliebener Schritt Commit/Push main, frische CI und Liveprüfung.

## M7.7 – Gameplay Refinement (2026-10-26)
- Auftrag: bestehende sechs Levels, Eingaben/Kollisionen/Pulse und Infinity gezielt verbessern; Compact bleibt verborgen, hohe Grafik bleibt fest. M8 existiert bereits und wird erhalten.
- Ausgangspunkt: main 366d1c4, sauber. Sechs reguläre Replays bestanden. Alle Ausgangstests bis einschließlich Infinity bestanden; archivierter Lab-Roundtrip scheiterte unter Windows nur an CRLF (lokal ohne semantischen Diff normalisiert).
- Physik unverändert: 360 u, 90 u pro Spur, 260 u/s, 220 ms bis 95 %, 240 Hz, Radius 8. Kein zusätzlicher Input-Buffer nötig.
- Korrekturen: exakter Circle/Rect-Sweep mit winziger numerischer Tangententoleranz; Pulse-Einmaligkeit; ausdrücklich erneut angeforderte Saw-Zerstörung/Laser-Abschaltung; volle neue Laserwarnung; doppelte Pointer-Kontakte unterdrückt, absichtliche Zwei-Finger-Tipps weiter gültig; keine Tastatur-Autowiederholung auf Retry; keine 450-ms-Sperre echter UI-Taps.
- Bestehende Infinity-Auswahl um begrenzte 8er-Historie, Wiederholungssperre und Gewichte ergänzt. Falsche pauschale 2-s-Ausgangsruhe auf tatsächlich garantierte 1 s berichtigt (späte Tipps bei 6.9/8 s). Alle 20 Chunk-Geometrien unverändert. Nur Singularity saw-82 um 16 u tiefer und mine-88 Ladung .7→.8 s: gemessenes isoliertes Gesamtminimum 20/10→40/20 ms.
- 332 Node-Checks + 8 Leveldefinitionen bestanden. Sechs echte reproduzierbare 100-%-Nachweise mit Fingerprints, fünf Frameprofilen, Start-/Endzustand; JSON-Nachweise unter docs/. Infinity: 400 Paare, 4 Seeds je 53.253 m/256 Übergänge, maximal 4 Chunks/88 Objekte. Separater Generatorstress 10.002 Chunks, kein Spielerlauf.
- Browser 656 Checks bestanden (Kampagne, Erweiterung, Progression, Mobile Forge, Audio, neue Eingaben/Retry/Pixelgleichheit und 100 Legacy-Regressionschecks). Alte Restart-Guard-Erwartung an ausdrücklich verlangten Sofort-Retry angepasst; synthetischer Pointertest gibt seinen Kontakt wieder frei. Echte Zwei-Finger-Eingaben bleiben gültig.
- rAF Infinity 104 s: ungedrosselt JS p95 .60 ms, 4× CPU p95 4.30 ms; Quellen nach Pause 0, Cache 2, keine Chunk-Seeks. Keine physischen Smartphones verfügbar; Windows-WebKit ohne Web Audio prüft nur Silent-Fallback. Screenshots tatsächlich angesehen. Details/Grenzen in docs/M7.7-TEST-REPORT.md.
- Offen: Commit/Push main und Pages-Liveprüfung. Compact bleibt verborgen, hohe Grafik bleibt fest; kein neues Progressionssystem. Physische Smartphone-Tests als spätere Aufgabe empfohlen.

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
## M8 — Originalauftrag
ASCENSION SYSTEM: zentrales versioniertes Fortschrittssystem, Migration M7, Bronze/Silber/Gold, acht Achievements, fünf rein kosmetische Riftling-Designs, Hauptmenü/Levelauswahl/Collection/Profile/Settings, schnelle Ergebnisnavigation, isolierte Practice-/Forge-Läufe; Tests, Dokumentation, Commit und Pages auf main.

### Analyse und erster Systemschritt
- M7 main ist sauber, Physik/Audio/Editor vollständig vorhanden; Statistik bisher best/attempts/clears pro Level, keine Todesfälle/Spielzeit/Zeitpunkte.
- Progression v2 als zentrale Autorität mit M7-Adapter, Backup, Monotonie, Catch-up aus belegten Altleistungen, isolierten Runs und lokalem Warnhinweis. Historische Lücken werden ausdrücklich markiert.
- 18 erste Progressions-Unitchecks bestanden (Medaillen, Idempotenz, Migration, Skins, Fehler, Forge-Isolation).
- Medaillen als neue gezeichnete SVGs; vier neue Farbsätze mit identischen Riftling-Pfaden plus Innen-Gravuren. Gemeinsame Animation und Rastercache bleiben erhalten.

### M8 fertig implementiert und geprüft
- Zentrale v2-Speicherung mit Sicherung, monotoner M7-Migration, einmaligen Run-Ereignissen, präziser Normal-Spielzeit, acht Achievements, fünf Skins und Bronze/Silber/Gold.
- Hauptmenü, echte Levelmotive/Medaille/PLAY+PRACTICE je Karte, animierte Collection, Achievement-Liste, Profil und Settings. Ergebnisnavigation mit sofortigem RETRY; NEXT erhält Normal/Practice und endet nach Overload.
- Benachrichtigungen nur in sicheren Menüzuständen, keine Pointer-Blockierung, je Level nur höchste ausstehende Medaille; kompakte Ergebnis-Chips und freier Bereich für Toasts.
- Final: npm test mit 24 Progressionschecks plus 50 Kampagnen-, 20 Pulse-, 33 Rift- und 17 Physikchecks sowie fünf gültigen Leveln. 15 vollständige Skin×Level-Läufe haben identische Traces bis 100 %.
- 121 M8-Browserchecks in Chromium Desktop, Pixel-7-Touch und Windows-WebKit: vollständige Kampagne, Rewards, Reload, Skin-Ausrüstung, fünf gemeinsame Animationszustände je Design, Practice-NEXT, unmittelbarer Retry, Migration/defekter/blockierter Speicher und bytegleiche Forge-Isolation.
- Regressionen erfolgreich: 100 Gameplay, 141 M7 (186 echte Touch-Eingaben), 70 Forge Desktop, 50 Forge Mobile, 51 M6-Pulse, 25 M5-Grafik. Sechs komplette Audio-Renderings und kombinierte neue Reward-SFX ohne Clipping.
- Zwischenfehler korrigiert: CRLF beim HTML-Umbau, alte Menü-/Speicherselektoren in Tests, M5-Lade-Timeout (anschließend 25/25), Practice→Normal im Headless-Adapter; alle betroffenen Prüfungen bestanden.
- Overload Echtzeit mit Fortschrittsspeicherung: p95 Game-Update+Render 0,40 ms, p95 Frameabstand 4,5 ms, Desktop Ø239,1 rAF-FPS, Heap-Differenz etwa 2,3 MB, 30 aktive Stimmen maximal. Kein echter Telefon-Benchmark.
- M7-Leveldaten, player.js, physics.js und config.js unverändert. Feste hochwertige Darstellung bleibt aktiv; keine Grafikoptionen.
- Skill-Client für Gameplay und Collection-State ausgeführt; Game-Canvas geprüft. Vollständige DOM-Screenshots von Menüs, Sammlung, Profil, Achievements und Ergebnissen separat geprüft.
- Dokumentiert: README, docs/ASCENSION-SYSTEM.md und docs/M8-TEST-REPORT.md. Bekannte Grenzen: keine echte iOS-/Android-Hardware, Windows-WebKit ohne Web Audio, kein Cloudspeicher, historische Todesfälle/Spielzeit unbekannt, menschliche Langzeitabnahme offen.
- Nächster Schritt: M8 auf main committen/pushen, Pages-Workflow und veröffentlichte Spiel-/Forge-Version prüfen. Keine Force-Pushes.
## M7.5 — Originalauftrag aus angehängtem Text
RIFT EXPANSION: drei dynamische Fallen (Phase Saw, Pulse Mine, Sweep Laser), drei weitere handgefertigte Levels, RIFT INFINITY mit mindestens 20 validierten Chunks/Seed-Generierung/separaten Höhenrekorden, kompletter Forge-/Mobile-Support, feste hohe Grafik, Tests/Dokumentation/Commit/Pages. M8 ist bereits vorhanden und wird erhalten sowie für Endless erweitert.

### Architektur und erste Nachweise
- Bestehender main e6d9922 sauber; 260 u/s und 240 Hz bleiben erhalten. Neue TrapField-Logik, gemeinsames Datenmodell/Rendering im Spiel und Forge. Zeit nur aus Simulation; Pulse-Dimension wird an der Welle gespeichert.
- 20 Trap-Tests bestanden: Bewegungsachsen, Dimensionen, Pulse vor Kollisionsauswertung, Minenwarnung/Explosion, Laserwarnung/Erholung, bewegliche Kollisionsflächen und exakte CP-Zustände.
- Levels nacheinander erstellt und geprüft: Shattered Gears 50 s / 31 Impulse / 19 Sägen; danach Voltage Run 60 s / 41 Impulse / 14 Minen und 15 Laser; danach Singularity Rush 75 s / 99 Impulse / alle Fallen. 27 Leveltests inkl. 5/30/60/144 FPS, Practice, Reset, Eingabefenster bestanden.
- 20 handgefertigte datengetriebene Infinity-Phrasen: einzeln regulär bis 100 % geprüft. Streaming in derselben Game-Klasse; maximal fünf gehaltene Chunks, unveränderte Spielersteuerung, 10 u = 1 m.
- Infinity: alle 400 geordneten Modulpaare und vier Seeds mit je 256 Übergängen (1.424 Übergänge insgesamt) regulär simuliert; 11 Prüfungen bestanden. Erholung aus allen acht Spur-/Dimensionszuständen mit regulären Eingaben geprüft. Keine automatische Korrektur von Spielereingaben.
- Separate Endless-Daten im vorhandenen v2-Save; normale Rekorde, Achievements und Skinbedingungen bleiben erhalten. Golden Ascent/Golden Skin beziehen sich weiterhin auf die drei ursprünglichen First-Ascent-Level.

### Abschlussprüfung M7.5
- 21 Fallen-, 27 Level- und 16 Infinity-Prüfungen; 1.424 Übergänge inkl. vier 34-Minuten-Simulationen erfolgreich. Beobachtet: maximal 88 Objekte, vier Chunks; erlaubte Grenzen 140/fünf.
- Browser: Expansion 93, Fallen-Forge 48, ursprüngliche Kampagne 141, Ascension 126, Gameplay 100, Pulse 51, M5-Visuals 25, Desktop-Forge 70, Mobile-Forge 50 erfolgreich. WebKit ohne natives Audio ehrlich als stummer Fallback behandelt.
- Tatsächlichen Maus-Resize-Bug bei außen liegenden Griffen behoben. Enge Membranen/Siegel auf Torbreite begrenzt; alle acht Leveldateien ohne Designwarnung. Practice-/Endless-UI-Zustände sauber zurückgesetzt.
- Zwölf vollständige Audio-Offline-Renders bestanden. Echtzeit-Performance mit 4x CPU: Singularity 75 s p95 JS 7,5 ms, Infinity 104 s p95 JS 4,3 ms. Infinity: ein Start-Seek, maximal zwei Backdrops, null Quellen nach Pause. Keine Smartphone-FPS-Behauptung.
- README, RIFT-EXPANSION.md, M7.5-TEST-REPORT.md aktualisiert. Finale Unit-/Expansion-Runde abgeschlossen, Git-Review erfolgt. Veröffentlichungsschritt: Commit/Push main, Pages und Livesmoke.

## M7.6 — COMPACT MODE (neuer Auftrag)
ARENA LAB als isolierter A/B-Test: Classic unverändert, Compact aus realer 90-u-Zielfeder abgeleitet. Geplant: fünf Ziele im 45-u-Abstand, 18-u-Randabstand, Breite 216 u; Classic 360 u / vier Ziele. Gleiche 220-ms-Feder, Hitbox8, Aufstieg260, Kamera-Skalierung. Konfigurierbare gemeinsame Arena statt zweiter Engine; additive arenaStyle-Metadaten, Forge, lokale isolierte Lab-Statistik im vorhandenen Save. Ein gemeinsamer handgefertigter 30–45-s-Parcours mit je validierter Geometrie/Replays. Vollständige Tests, Dokumentation, Commit und Push auf main/Pages.

### M7.6 Implementierung und Nachweise
- Gemeinsame ARENAS-Parameter, Player/Game/View/Validator/Forge integriert; fehlende Metadaten bleiben Classic. Compact 216 u, 45-u-Schritte, sichere Ziele18..198, unveränderte Feder220ms/Vertikal260/HitRadius8.
- ARENA LAB: ein40s-Parcours mit identischer28-Tipp-Folge, separat gestalteten Toren (Classic96/84/78; Compact64/60/56), vorhandene Musik und alle Mechaniken. Beide100% real; jeder einzelne ausgelassene Tipp lässt die Referenzlösung scheitern.
- Eigenes Lab-Domain im bestehenden Save, zentraler Run-Typ lab, streng isoliert von offiziellen Rewards. Peak-basierter Durchschnitt, Abbruch/Retry/Reload, Auswahl und lokales Feedback.
- 60 Unitprüfungen; 32 Zwei-Tipp-Kombinationen beidseitig bei5/30/60/144FPS und50/100/220/500ms Abstand. Weg220ms85.5005/42.7503, Peak713.905/356.952. CompactPracticeCP ebenfalls100%.
- Browser86 neue Checks, Ascension131, Forge70+50 bestanden. Übrige klassische Browserregression läuft. Skill-Clientbilder beider Varianten sowie Lab-Menü, Wände und Forge angesehen.
- Timing: Classic mindestensfrüh80/spät160ms, Compact180/180ms pro einzeln variiertem Tipp. Unterschiedliche Schwierigkeit/Spuranzahl/Startposition ausdrücklich dokumentiert.
- Performance4xCPU real40s: Classic JS-p9512.3ms/Compact13.0ms. Strenges8ms-Hilfsbudget verfehlt; kein Smartphone60FPS-Nachweis. Keine Grafikreduktion. README und ARENA-LAB-/M7.6-Testdokumentation erstellt.
- Noch: laufende Browserregression abschließen, finaler Review, Commit M7.6 und Push main, Pages und Live-Test.

### M7.6 Abschluss-QA
- Vollständige Node-Grundsuite bestanden, aktuelle Compact-Suite60. Alle Browserregressionen grün: Compact86, Ascension131, Forge70+50, Kampagne141, Expansion93, Pulse51, Visuals25, Fallen-Forge48, Gameplay100 (zusammen795 Browserchecks).
- Zusatzmessung ohne CPU-Drosselung nach Abschluss der anderen Tests: Compact JS-Mittel0.62ms/p951.00ms/p991.90ms, Audio-p958.33ms; 4x-Stressbudget bleibt als verfehlt dokumentiert.
- Sechs Kampagnen-JSONs, Infinity-Daten, config.js und Input unverändert; gesamte Spielphysik Classic und alle ursprünglichen100%-Replays geprüft.
- Abschließender Skill-Client für endgültigen Compact-Parcours und danach Commit/Push/Pages/Live-Lab-Prüfung. Keine neue Architektur, kein Grafikprofil, keine neuen offiziellen Belohnungen.

- Endgültiger Compact-Skill-Client bei54% mit passenden Zuständen/Bild geprüft, keine Konsolenfehler. Review abgeschlossen; Veröffentlichung auf main und anschließender Live-Smoke-Test.

## Breitentest ZWEI TIPPS (2026-10-26)
- Auftrag: das Spielfeld so verkleinern, dass von links nach rechts zwei Tipps statt drei reichen, nur als Test.
- Classic bleibt 360 u / 4 Spuren / 90 u. Neue Lab-Arena `narrow`: 270 u, 3 Spuren, Start Mitte, gleicher 90-u-Tipp. Spur 0 (x=45) bis Spur 2 (x=225) = zwei Impulse. Pixelmaßstab weiter durch 360, Korridor daher 75 % der Handybreite mit dunklen Rändern.
- Kampagne und Infinity unverändert. Arena Lab ist im Hauptmenü sichtbar. Parcours `assets/lab/narrow.json`, 28 Tipps, Replay 100 %. Compact-Suite 61 Checks. Telefonviewport 390×844: linker Rand x=45.05, nach zwei Rechtstipps x=224.98, spielbare Breite 292.5 von 390 px.
- Entscheidung: Zwei Tipps bleiben aktiv. Classic/Compact-Karten, Abstimmungszeile, Arena-Lab- und Infinity-Kachel sind im Menü versteckt. SPIELEN öffnet nur noch die 270-u-Arena. Neue Forge-Level starten mit arenaStyle narrow. Kampagnen-JSONs und Infinity-Daten bleiben auf 360 u und sind über die vorhandenen Seiten weiter ladbar.
