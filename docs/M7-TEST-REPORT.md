# M7 — ausgeführte Prüfungen

Stand: 25. Oktober 2026. Windows, Node.js, Playwright mit Chromium 156 und Windows-WebKit.
HTTP-Tests liefen gegen das unveränderte statische Projekt auf einem lokalen Server.
Die folgenden Ergebnisse sind ausgeführt, keine geplante QS-Liste.

## Reguläre Lösbarkeit

`npm test` prüft Leveldaten, Physik, Rift Pulse, PULSE ENGINE und die Kampagne.
`tests/campaign.mjs` enthält 50 zusätzliche erfolgreiche Prüfungen.

| Level | Simulationsdauer | Gültige Impulse | Ziel | Kleinster Tippabstand | Früh-/Spätreserve |
| --- | --- | --- | --- | --- | --- |
| First Pulse | 40,00 s | 23 | 100 % | 1000 ms | ≥200 / 115 ms |
| Fractured Rhythm | 56,25 s | 56 | 100 % | 468,75 ms | 180 / 95 ms |
| Overload | 66,6667 s | 107 | 100 % | 312,5 ms | 115 / 60 ms |

Die Replays benutzen denselben `press()`-Pfad, dieselbe Feder, 8-u-Hitbox und
aktive Hindernis-/Siegel-Kollision wie das Spiel. Sie teleportieren nicht, überspringen
keine Reihen und besitzen keine Sonderfähigkeiten. Alle Taps erfüllen die normale
200-ms-Startsperre und den 45-ms-Doppeltippfilter. Der Replay-Prüfer verwirft illegale
Eingaben. Die vollständigen Sequenzen stehen jeweils in der ausgelieferten JSON-Datei.

Die Reserven wurden mit einer vollständigen Neusimulation für jeden einzelnen Tipp
in 5-ms-Schritten bis maximal ±200 ms ermittelt: jeweils genau ein Tipp wird verschoben,
alle anderen bleiben unverändert. Die Tabelle zeigt das schlechteste zusammenhängende
Fenster der gespeicherten Lösung. Bei First Pulse erreichten alle frühen Verschiebungen
die Messgrenze. Das ist weder ein Beweis aller möglichen Flugwege noch ein menschlicher
Schwierigkeitstest. Mehrere gleichzeitige Fehler können sich anders auswirken.

Je Level wurden 5/10/30/60/144 FPS sowie wechselnde Frameabstände getestet, jeweils
mit ein-/ausgeschaltetem Audio-Stub. Vollständige Positions-/Dimensions-Traces sind
identisch. Der echte Browser-Hauptloop wird zusätzlich mit 200-ms-Frames und einem
300-ms-Stall geprüft: 2 s verstrichene Zeit ergeben 2 s Simulation, der Blind-Stall pausiert.

Weitere erfolgreiche Prüfungen: kein Checkpoint im Normal Mode, echter Tod ohne
Eingaben, Kollision weiterhin aktiv, Neustart bei 0/Blau, Bestwert auch bei sofortiger
Wiederholung und Menüwechsel, Pause erhält Öffnungszeiten. Practice erzwingt bei jedem
neuen Checkpoint einen Restore inklusive x/v, Dimension, offenen Siegeln und Wellen,
erreicht danach 100 % und schreibt keine normalen Statistiken.

## Browser, Eingaben und Editor

`tests/campaign-e2e.mjs` bestand 141 Prüfungen in Desktop-Chromium, Pixel-7-Touchprofil
und iPhone-13-WebKitprofil. Die regulären Touch-Lösungen aller drei Levels verwenden echte
Browser-Taps über das Input-System; die Simulationszeit wird dabei kontrolliert
vorgespult. Jeder der insgesamt 186 Taps wird einzeln mit realem Wallclock-Abstand
über dem Eingabefilter gesendet. Das ist kein Test realer Smartphone-Touchlatenz.

Geprüft werden Levelwechsel ohne Reload/zusätzlichen AudioContext, Startspur/-farbe,
isolierte Bestwerte/Versuche/Abschlüsse, Tod/Retry, Practice ohne Normalrekord,
Pause, Musikstart aus einer Geste und Freigabe alter Quellen beim Stoppen.
Das schmale Layout wurde bei 320×568, 360×640, 390×844, 430×932 und 768×1024 geprüft:
kein horizontaler Überlauf, feste hohe Darstellung und ausreichende Kameravorschau.

Für jedes Level und jedes Browserprofil: alle Objekte in Forge, bytegleicher JSON-Export,
echte Transaktion mit Hindernisverschiebung, Siegel-Öffnungsdauer und BPM-Änderung,
passende Musikvorschau, echter Spiel-Playtest bis 100 %, Rückkehr mit erhaltenen
Änderungen und Undo-History. Abschnittsnamen sind zusätzlich über die tatsächlichen
Eigenschaftsfelder geändert und in der Timeline geprüft. Die bestehenden Import-/
Export-, Touch-Drag-, Pinch-, Bottom-Sheet- und Tastaturtests wurden erneut ausgeführt.

Bestehende Regressionssuiten bestanden: 100 Gameplay-, 70 Desktop-Forge-, 50 Mobile-
Forge-, 51 M6-Pulse- und 25 Grafik-/Riftling-Browserprüfungen. Alte `gfx`-Parameter und
gespeicherte Werte verändern Darstellung/Partikeldichte nicht; der Grafikknopf fehlt.
Screenshots von Menü, allen drei Architekturen, Abschluss und Forge wurden visuell geprüft.

## Hörbare Musik und Synchronisation

`tests/campaign-audio.mjs` rendert alle drei vollständigen Stücke jeweils im blauen und
roten Mix durch den wirklichen Web-Audio-Graphen inklusive Abschlussfanfare.
Alle sechs Renderings sind nicht stumm, alle Abschnitte hörbar, Signale enden sauber
und es gibt kein digitales Clipping. Höchster gemessener Sample-Peak: 0,364881
(Overload, blauer Mix); RMS liegt je Mix ungefähr zwischen 0,028 und 0,035.
Das ersetzt keine subjektive Hörbewertung auf Telefonlautsprechern/Kopfhörern.

Echte Echtzeit-Audiostarts für alle drei Tracks wurden in Chromium per Touchgeste
geprüft: richtiger Score, geplante Stimmen und Simulation als Timeline. Alte Quellen
werden bei Pause vollständig freigegeben. M6-Tests prüfen zusätzlich Stummschaltung,
persistierte Buslautstärken, Layer-Crossfade, Restart, Seek, Context-Unterbrechung
und Editorvorschau. Keine Audio-Abhängigkeit der Kollisionen.

Die Leitmelodien folgen jeweils den tatsächlichen Dur-/Moll-Terzen des aktuellen
Akkords; das wird zusätzlich in der Partiturprüfung kontrolliert. Die finalen sechs
Audio-Renderings wurden nach dieser harmonischen Bereinigung erneut ausgeführt.

## Performance und Grenzen

Ein vollständiger Overload-Lauf im echten requestAnimationFrame-Loop mit Musik und
fester hoher Darstellung wurde im Pixel-7-Profil auf der Windows-Desktop-CPU/GPU
gemessen, ohne CPU-Drosselung: rund 239 mittlere rAF-FPS, 4,4 ms p95-Frameabstand,
0,30 ms p95-JavaScript-Framezeit, etwa 2,0 MB Heap-Differenz und höchstens 30 gleichzeitig
aktive Stimmen. P95 der beobachteten Audio-Clock-Abweichung war im finalen Lauf 17,8 ms,
mit vier Audio-Neuzuordnungen; der größte Einzelwert lag bei 125 ms beim Start.
Dies misst Browser-/Schedulingkosten, keine reale Ausgabe-/Bluetooth-Latenz.

**Das ist keine Messung auf einem echten Pixel und kein Nachweis von 60 FPS auf
Smartphone-GPUs.** Die Emulation nutzt den Desktop-Rechner. Reale iPhone-Safari- und
Android-Chrome-Geräte standen nicht zur Verfügung. Windows-WebKit bietet in dieser
Installation keine Web Audio API: dort wurden Darstellung, Eingaben, Forge und
stummer Betrieb geprüft, iOS-Audio ausdrücklich nicht bestätigt. Safe-Area-/Touch-
Emulation ersetzt weder Notch-Hardware noch Bildschirmtastatur/Web-Share-Tests.

Technische Erreichbarkeit von 100 % ist für alle drei Level bestätigt. Menschliche
Playtests für Lernkurve, empfundene Fairness, Spaß und die endgültige Einstufung
Einfach/Mittel/Schwer stehen noch aus. Insbesondere Overloads schnelle Folgen sollen
auf echten Geräten mit mehreren Spielern bewertet werden. Hohe Darstellung bleibt
auch auf langsameren Geräten aktiv; lange Blind-Stalls pausieren statt das Spiel
unbemerkt weiterlaufen oder langsamer werden zu lassen.

## Reproduktion

```sh
npm ci
npm test
npx playwright install chromium webkit
# Separat: python -m http.server 8080
npm run test:campaign:e2e
npm run test:campaign:audio
node tests/e2e.mjs
node tests/forge-e2e.mjs
node tests/forge-mobile-e2e.mjs
node tests/pulse-e2e.mjs
node tests/m5-visuals.mjs
# Performance ohne CPU-Drosselung: Umgebungsvariablen LEVEL=overload, THROTTLE=1
node tests/perf.mjs
```

`BASE_URL` überschreibt die Serveradresse. Lokale Browserpfade können über den
Playwright-Launch-Preload der jeweiligen Umgebung gesetzt werden. Artefakte werden
unter dem ignorierten `test-results/m7/` abgelegt: Replay-/Timingbericht, Browser-
Ergebnisse/Screenshots, WAV-Dateien mit Audio-Metriken und Performance-JSON.
Sie werden nicht als Spielassets oder Laufzeitabhängigkeiten ausgeliefert.
