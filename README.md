# RIFT CLIMB: PULSE

Rhythmischer Vertical Climber für Smartphones (HTML5 Canvas, reines JavaScript, keine Abhängigkeiten zur Laufzeit).
Die Figur steigt automatisch mit 260 u/s nach oben; die PULSE ENGINE synchronisiert die Musik dazu. Mit kurzen Flugimpulsen weichst du Hindernissen aus –
jeder Impuls wechselt die aktive Dimension und sendet einen **Rift Pulse**, der goldene Rift-Siegel kurz öffnet.

**Spielen:** https://t0ptyp.github.io/rift-climb/ · **Level-Editor (Desktop & Mobil):** https://t0ptyp.github.io/rift-climb/assets/forge/

## M7.8 – Phase Flow & Fairness

Gültige schnelle Kontakte werden jetzt anhand ihrer **Ereigniszeit** verarbeitet,
auch wenn der Browser sie nach einem kurzen Stall gemeinsam zustellt. Szenenwechsel
halten neue Eingaben von alten getrennt, ohne frische Folgeeingaben einer langsamen
Startaktion zu verlieren. Retry funktioniert auch mit dem zweiten Finger.

Die intern geprüften Breiten **360/324/306 u** bestehen ihre Replays; die schmaleren
Varianten liefern jedoch keinen zusätzlichen Zeitgewinn und verlieren Sicherheitsraum.
Das Hauptspiel bleibt bei **360 u**, derselben Flugphysik und derselben Kamera.
**Input Buffer und Phase Buffer bleiben bei 0 ms**: Impulse sind unterbrechbar,
es gibt keine zusätzliche Kollisions-Unverwundbarkeit. Compact bleibt verborgen,
Grafikqualität bleibt dauerhaft hochwertig und nicht einstellbar.

Gezielte Korrekturen in Singularity Rush und neun bestehenden Infinity-Modulen
verbessern knappe gekoppelte Flug-/Dimensionsfolgen. Alle regulären Replay-Eingaben
und Level-IDs bleiben erhalten. Die 20 Chunks bestehen zusätzlich **2100 einzelne
Timing-Varianten**, **480 bewegte Eingänge** und geprüfte Übergänge. Die Auswahl
berücksichtigt Erholung nach schnellen Aktionsserien; die Schwierigkeit bleibt gedeckelt.

- [Entscheidungen, Vorher/Nachher, Tests und Grenzen](docs/M7.8-PHASE-FLOW.md)
- [Maschinenlesbare Messungen](docs/M7.8-VALIDATION.json)
- [Aktuelle reguläre 100-%-Nachweise](docs/M7.8-REPLAY-PROOFS.json)

`npm run test:flow` prüft die gezielten Fälle, `npm run test:flow:timing` die
Kampagnen-Reserven und `npm run test:flow:e2e` die Browser-Eingaben.

## M7.7 – Gameplay Refinement & Balancing

Direktere schnelle Menü-Taps und Instant Retry, präzise durchgehende Rechteckkollisionen,
zuverlässige Pulse-Treffer und eine abwechslungsreichere, reproduzierbare Infinity-Auswahl.
Die Flugphysik bleibt bei **260 u/s, 90 u Zielschritt, 220 ms bis 95 % und 240 Hz**.
Compact bleibt ausgeblendet. Es gibt weiterhin ausschließlich hochwertige Grafik.

Die aktuellen Pulse-Regeln haben Vorrang vor älteren Meilensteinbeschreibungen:
Passende Wellen zerstören Phase Saws, entschärfen Pulse Mines und schalten
Laserprojektoren vorübergehend ab. Danach warnt der Laser erneut vollständig.
Kein Pulse-Treffer verändert die Flugbahn. Die sechs vorhandenen Levels bleiben
erhalten; nur eine Sägeposition und eine Minenladezeit in Singularity Rush wurden
gezielt entschärft. Fortschrittsdaten, Practice und isolierte Forge-Playtests bleiben erhalten.

Infinity vermeidet die letzten zwei Chunk-IDs, gewichtet kürzliche Wiederholungen
und wechselt zwischen vorhandenen Mechanikmustern. Schwierigkeit und Geschwindigkeit
sind gedeckelt. Alle **400 Chunk-Paare** und reguläre Seed-Läufe über **53.253 m**
sind mit echten Eingaben und aktiven Kollisionen überprüft. Ein separater
10.000-Chunk-Generierungstest ist ausdrücklich kein erfolgreicher Spielerlauf.

- [Architektur, Ausgangswerte und Balancing](docs/GAMEPLAY-REFINEMENT.md)
- [Tatsächliche Testergebnisse und Grenzen](docs/M7.7-TEST-REPORT.md)
- [Reproduzierbare Nachweise aller sechs Levelabschlüsse](docs/M7.7-REPLAY-PROOFS.json)

`npm test` führt alle Node-Regressionen einschließlich `tests/refinement.mjs` aus.
Mit laufendem lokalem Server ergänzt `BASE_URL=http://localhost:8080/ node tests/refinement-e2e.mjs`
die Touch-, Retry- und Pixelvergleichstests (Playwright erforderlich).
`?debug=1` zeigt vorhandene Hitboxen und bietet über `render_game_to_text()` ein
begrenztes lokales Todesprotokoll. Es gibt keine externe Telemetrie.

## COMPACT MODE / ARENA LAB (M7.6)

Der Vergleichsmodus bleibt im Code und in den Lab-Daten, ist im Hauptmenü aber nicht mehr angeboten.
Kampagne und Infinity bleiben vollständig Classic; es gibt keine automatische Verengung vorhandener Levels.
Die letzte Auswahl und optionales Spaß-Feedback bleiben lokal gespeichert, sobald die Lab-Seite geöffnet ist.
Ein Wechsel während des Runs ist gesperrt.

| Variante | Breite | Zielschritt je Impuls | Weg nach 220 ms | Aufstieg / Hitbox |
| --- | --- | --- | --- | --- |
| Classic | 360 u | 90 u | 85,50 u | 260 u/s / Radius 8 u |
| Compact | 216 u | 45 u | 42,75 u | identisch |

Die vorhandene Bewegung ist eine gedämpfte Feder zu Zielspuren. Compact nutzt fünf Ziele im halben Classic-Abstand:
`18, 63, 108, 153, 198`. Von der Mitte 108 führen zwei gleichgerichtete Impulse zum jeweiligen sicheren Randziel.
Die Federzeit bleibt unverändert. Kamera-Pixelskalierung, Figur, Animationen und hochwertige Assets bleiben gleich;
der schmalere Korridor sitzt mittig, die Touch-Zonen bleiben die **gesamten Displayhälften**.

Eine handgefertigte **40-Sekunden-Teststrecke** liegt in beiden Varianten vor. Die Geometrie und freien Korridore
sind einzeln abgestimmt; die aufgezeichneten Läufe sind getrennt, weil ein Rift Pulse Sägen nicht mehr zerstört.
Spieler- und Fallenhitboxen werden nicht verkleinert. Beide regulären Replays erreichen mit echten Kollisionen 100 %.

Je Variante werden Versuche, Bestwert, Abschlüsse, Todesfälle und durchschnittlicher gemessener Fortschritt erfasst.
Diese Lab-Daten liegen getrennt von offiziellen Medaillen, Achievements, Designs und Kampagnenstatistiken im
bestehenden Save. LEVEL FORGE unterstützt die additive Metadatenwahl `arenaStyle` inklusive Grenzen, Raster,
JSON, Kamera und Playtest; fehlende Angaben bedeuten Classic. Bestehende Geometrie wird nicht automatisch skaliert.

**Vergleichsgrenze:** Compact hat kürzere Wege und andere Eingabetoleranzen; gleiche Schwierigkeit ist nicht bewiesen.
Classic besitzt vier Zielspuren, Compact fünf halbe Zielschritte. Eine komplette Wand-zu-Wand-Fahrt braucht damit
drei bzw. vier Zielwechsel. Welches Spielgefühl besser ist, muss der persönliche Test zeigen.

[Architektur und Daten](docs/ARENA-LAB.md) · [Tests und Grenzen](docs/M7.6-TEST-REPORT.md)

```sh
npm run test:compact          # reale Impulse, Zwei-Tipp-Test, Lab-Replays, Speicherung/Isolation
npm run test:compact:timing   # vollständige Replays mit einzeln verschobenen Eingaben
npm run test:compact:e2e      # Desktop, Chromium-Touch, WebKit, mobiler Forge
```

## RIFT EXPANSION (M7.5, auf dem bestehenden M8-System)

**Sechs direkt wählbare Levels und RIFT INFINITY.** Die drei ursprünglichen M7-Parcours sind unverändert.

| Neues Level | Schwierigkeit | Gemessene Simulationsdauer | Schwerpunkt |
| --- | --- | --- | --- |
| Shattered Gears | Mittel–Schwer | 50 s, 120 BPM | Pendelnde Phase Saws, Pulse-Zerstörung, Siegelketten |
| Voltage Run | Schwer | 60 s, 132 BPM | Minenwarnung, Laserprojektion, kombinierte Pulse-Fenster |
| Singularity Rush | Extrem | 75 s, 144 BPM | Alle Fallen, schnelle Richtungscluster, Reaktorfinale |

- **Dynamische Fallen:** detaillierte rotierende Phase Saws, aufladende Pulse Mines und schwenkende Sweep Lasers.
  Gemeinsame Simulationszeit, sichtbare Warnungen, passende Pulse-Dimension, vollständiger Reset und Practice-Snapshots.
- **RIFT INFINITY:** 20 handgefertigte JSON-Module, reproduzierbare Seeds, vier begrenzte Schwierigkeitsbereiche,
  Streaming und aus Weltkoordinaten berechnete Meter. RETRY wiederholt denselben Seed; NEUER SEED erzeugt eine andere Folge.
  Eigene Höhenrekorde und Versuche im vorhandenen Ascension-Spielstand; keine Kampagnenbelohnungen.
- **Musik und Grafik:** drei neue Synth-Arrangements, fortlaufender Infinity-Score, Metall-/Hochspannungs-/Reaktormotive
  und sanfte Infinity-Hintergrundwechsel. Weiterhin eine feste hochwertige Darstellung.
- **LEVEL FORGE:** alle drei Fallen samt Bewegung, Dimension, Warn- und Pulse-Parametern bearbeitbar,
  gemeinsames Rendering, verlustfreier JSON-Export, isolierter Playtest und mobile Bottom Sheets.

Alle neuen Levels erreichen mit regulären Eingabereplays und aktiven Kollisionen 100 %. Infinity wurde über
**1.424 Modulübergänge**, einschließlich aller 400 geordneten Modulpaare und vier langen Seed-Läufen, geprüft.
Das ersetzt keine menschliche Balance-Abnahme oder Tests auf echten iOS-/Android-Geräten.

Architektur, Level-/Fallendaten und Modulverträge: [docs/RIFT-EXPANSION.md](docs/RIFT-EXPANSION.md).
Ausgeführte Prüfungen, Messwerte und Grenzen: [docs/M7.5-TEST-REPORT.md](docs/M7.5-TEST-REPORT.md).

```sh
npm test                          # bestehende Tests + Fallen, drei Levelreplays, Infinity/Save
npm run test:expansion:e2e         # Spiel/Practice/Infinity/Forge + neue Fallenbedienung
npm run test:campaign:audio        # sechs komplette Kompositionen, je beide Dimensionen
LEVEL=infinity npm run test:perf  # Shell-abhängig: LEVEL als Umgebungsvariable setzen
```


## ASCENSION SYSTEM (M8)

Das Hauptmenü bietet **PLAY · RIFT INFINITY · RIFTLING COLLECTION · ACHIEVEMENTS · ASCENSION PROFILE · SETTINGS**.
Alle sechs Kampagnenlevels bleiben sofort verfügbar. Ihre Karten zeigen echte Levelmotive, Rekord, höchste Medaille,
Versuche und Abschlussstatus sowie eigene PLAY-/PRACTICE-Aktionen. Die Parcours und Flugphysik sind unverändert.

- **Medaillen:** Bronze ab 50 %, Silber ab 75 %, Gold beim tatsächlichen Abschluss. Höchste Auszeichnung bleibt erhalten.
- **Acht Achievements:** First Flight, Halfway There, First Victory, Pulse Master, Rhythm Breaker, Overloaded,
  Golden Ascent und Persistent Climber. Benachrichtigungen warten bis zum Menü, Tod oder Abschluss.
- **Fünf Riftling-Designs:** Original sofort; Azure für Gold in First Pulse; Crimson für Gold in Fractured Rhythm;
  Void für Overload; Golden für Gold in First Pulse, Fractured Rhythm und Overload. Gleiche Kontur, Größe, Animationen und Hitboxen.
- **Profil:** Normalversuche, Todesfälle, Abschlüsse, unterschiedliche abgeschlossene Levels, Rekorde,
  Goldmedaillen, Erfolge, Designs und aktive Normal-Spielzeit. Pausen/Practice/Forge zählen nicht mit.
- **Schneller Loop:** sofort sichtbarer RETRY-Button nach einem Treffer, Ergebnis mit Medaille und Freischaltungen,
  NEXT LEVEL mit erhaltenem Modus und Rückkehr zur Auswahl. Belohnungen sind vor dem Weiterklicken gespeichert.
- **Versionierter lokaler Spielstand:** `riftclimb.ascension.v2` mit Sicherung und Übernahme belegter M7-Leistungen.
  Frühere unbekannte Todeszahlen, Spielzeit und Zeitpunkte werden nicht erfunden. Bei Schreibfehlern gibt es einen
  Hinweis und weiterhin spielbare Sitzungsdaten. Keine Cloud-Synchronisierung.

Es gibt weiterhin **genau eine hochwertige Grafikdarstellung** und keine Grafikoption oder automatische Herabstufung.

Architektur, Freischaltungen, Datenmodell und Migration: [docs/ASCENSION-SYSTEM.md](docs/ASCENSION-SYSTEM.md).
Ausgeführte Prüfungen und Grenzen: [docs/M8-TEST-REPORT.md](docs/M8-TEST-REPORT.md).

```sh
npm test                         # inklusive Progression/Migration und 15 vollständiger Skin-Replays
# HTTP-Server separat starten; Browser wie unten installieren
npm run test:ascension:e2e        # Menüs, Rewards, Persistenz, Touch, WebKit, Forge-Isolation
```

## THE FIRST ASCENT (M7)

Drei handgefertigte, sofort auswählbare Levels mit eigener Musik, Architektur und lokal gespeicherter
Bestleistung, Versuchszahl und Abschlussmarkierung. Wechsel und Wiederholung benötigen keinen Seiten-Reload.

| Level | Schwierigkeit | Dauer | Tempo | Regulärer Nachweis |
| --- | --- | --- | --- | --- |
| **First Pulse** | Einfach | 40,00 s | 120 BPM | 23 Impulse → 100 % |
| **Fractured Rhythm** | Mittel | 56,25 s | 128 BPM | 56 Impulse → 100 % |
| **Overload** | Schwer | 66,67 s | 144 BPM | 107 Impulse → 100 % |

First Pulse führt von breiten Flugwegen über Farbhindernisse zu großzügigen Goldpassagen. Fractured Rhythm
verbindet seitliche Bögen, Farbwechsel und Siegel mit schnellen Dreierfolgen. Overload fordert Wand-Wechsel,
Siegelketten und wiederkehrende 312,5-ms-Cluster vor einem Finale aus bekannten Regeln.
Die Replays verwenden reguläre Eingaben, unveränderte Physik und aktive Kollisionen. Sie sind technische
Lösbarkeitsnachweise; menschliche Spielspaß- und Schwierigkeitstests stehen noch aus.

**Eine feste hochwertige Darstellung:** sämtliche Grafikstufen, Auswahlknöpfe, Geräteprofile und automatische
Herabstufungen sind entfernt. Alte gespeicherte Grafikwerte werden bereinigt, Fortschritt bleibt erhalten.
Immer aktiv: beide Parallax-Ebenen, 26 Hintergrundfragmente, Riftling-SVG/Animationen, Doppel-Glow,
Schweif-Kern und der 320er-Partikelpool. Fester DPR-Grenzwert 2,5 auf allen Geräten; keine Leistungsautomatik.
Canvas-Hintergründe werden vorgerastert, Hindernisse ausgeschnitten und Partikel wiederverwendet.

Die drei JSON-Dateien sind vollständig in LEVEL FORGE bearbeitbar. Eigenschaften enthalten zusätzlich
Architektur, Komposition, Schwierigkeit und Abschnittsnamen/-grenzen. Die kompakte Timeline verwendet die
wirklichen vier bzw. fünf Levelabschnitte. Im Öffnen-Dialog bleiben die beiden früheren Testlevel erhalten.

Leveldesign und Datenstruktur: [docs/FIRST-ASCENT.md](docs/FIRST-ASCENT.md).
Tatsächlich ausgeführte Prüfungen und Grenzen: [docs/M7-TEST-REPORT.md](docs/M7-TEST-REPORT.md).

```sh
npm ci
npm test                          # inklusive aller Kampagnen-Replays und Timing-Sweeps
# Lokalen HTTP-Server separat starten; dann:
npx playwright install chromium webkit
npm run test:campaign:e2e          # echte Touch-Eingaben, Levelwechsel, Forge, Browser-Lifecycle
npm run test:campaign:audio        # sechs vollständige Audio-Renderings (drei Songs × zwei Dimensionen)
```

## PULSE ENGINE (M6)

**„Neon Ascent“** ist eine eigene, offline erzeugte elektronische Komposition: 44 Sekunden, 120 BPM,
4/4, Am–F–C–G, Kick/Snare/Hi-Hat, Bass, Pad und wiederkehrendes Synth-Motiv. INTRO (0–11 s),
BUILD (11–22 s), DROP (22–33 s), FINALE (33–44 s) steigern die Instrumentierung. Siegeltore
haben bewusst gesetzte musikalische Akzente. Der letzte Beat löst die Musik auf, der Abschluss spielt eine kurze Fanfare.

- **Simulation:** unverändert 240 Hz, konstante 260 u/s, direkte Eingaben. Kein Beat steuert Kollisionen oder korrigiert Tipps.
- **Zeitbasis:** `BeatTimeline` berechnet Beats, Takte, Achtelnoten, Viertelbeats und Abschnitt aus Simulationssekunden.
  Feste Zuordnung zu `AudioContext.currentTime`, 25-ms-Scheduler / 120-ms-Lookahead; Abweichungen korrigieren nur Audio.
- **Dimensionen:** gemeinsame Melodie und Drums; Blau mischt luftige Höhen und hohe Sinus-Synths dazu,
  Rot warme gefilterte Synths und Subbass. 25-ms-Zeitkonstante beim Überblenden, identische Notentermine.
- **Effekte:** Flug, Wechsel, Pulse, Siegel auf/zu, Kollision, Tod, Respawn, Checkpoint und Abschluss.
  Dezente Beat-/Akzentlichter und Randfunken liegen unter den Hindernissen, auch bei stummem Audio.
- **Lautstärke:** Musik und Effekte getrennt unter SETTINGS → „Lautstärke“ und in der Pause; lokal gespeichert.
  „Sound AUS“ schaltet beide stumm. Keine Samples, externen Dienste oder Laufzeitpakete.
- **Mobile:** AudioContext erst nach einer Benutzeraktion. Hintergrundwechsel, unterbrochener Context oder lange
  Browser-Stalls pausieren den Lauf; „Weiter“ ordnet Audio erneut zu. Playtests warten ebenfalls auf „Weiter“.
- **Practice:** Checkpoints speichern Spielzeit, Dimension, exakte Seitenposition/-geschwindigkeit und Rift-Zustände. Respawn stoppt alte Quellen,
  wartet die vorhandene Wiederaufbauanimation ab und rekonstruiert die Partitur an genau dieser Position.
- **LEVEL FORGE:** BPM und Beats/Takt in Eigenschaften, normale/Beat/kombinierte Raster, Snap bis Viertelbeat
  oder ganzer Takt, Objektposition über Beat/Takt/Abschnitt. Kompakte Timeline mit Musikvorschau, Pause und
  Positionsregler; dieselben Daten und Funktionen auf dem Smartphone. Änderungen während der Vorschau stoppen sie.

Technik, Datenmodell, Clock-Grenzen und Tests: [docs/PULSE-ENGINE.md](docs/PULSE-ENGINE.md).
Testprotokoll: [docs/M6-TEST-REPORT.md](docs/M6-TEST-REPORT.md).

```sh
npm ci
npm test
npx playwright install chromium webkit
# Separat einen lokalen HTTP-Server auf Port 8080 starten, z. B. python -m http.server 8080
npm run test:audio:e2e
```

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Tipp linke Bildschirmhälfte | Impuls schräg **rechts** oben + Dimensionswechsel |
| Tipp rechte Bildschirmhälfte | Impuls schräg **links** oben + Dimensionswechsel |
| `D` / `→` (Desktop) | Impuls rechts oben + Dimensionswechsel |
| `A` / `←` (Desktop) | Impuls links oben + Dimensionswechsel |
| Tipp / `A` / `D` / `Enter` nach dem Tod | sofortiger Neustart (Practice: Respawn am Checkpoint) |
| `Esc` / `P` | Pause / Weiter (im Editor-Playtest: `Esc` = zurück zum Editor, `P` = Pause) |
| `Enter` / `Leertaste` / `R` | Levelauswahl öffnen, dort Start; Neustart, Weiter in der Pause |

Das Spielfeld hat vier Spuren. Ein Impuls gegen die Wand bewegt die Figur nicht, wechselt aber trotzdem die Dimension.
Das ist eine zentrale Technik: Weil jeder normale Impuls Spur **und** Farbe gleichzeitig ändert, bleibt die
Kombination „Spur-Parität + Farbe“ erhalten – nur ein Wand-Tipp kippt sie. Overloads Abschnitt B nutzt das gezielt.

## Dimensionssystem

- **Blau aktiv:** blaue Hindernisse sind tödlich (massiv, leuchtend), rote sind inaktive „Geister“ (gestrichelt, blass).
- **Rot aktiv:** umgekehrt. **Weiß:** in beiden Dimensionen tödlich.
- Feedback je Wechsel: Figur blinkt weiß und skaliert kurz, Energiering, Partikel-Burst, kurzer Farbimpuls,
  Hintergrund-Überblendung, aufleuchtende neu aktive Hindernisse, minimaler Screen-Shake, Ton (Blau hoch, Rot tief).
  Alle Effekte werden **unter** den Hindernissen gezeichnet und verdecken sie nie.
- Doppelt verarbeitete Touches (zwei Eingaben < 45 ms) werden verworfen – die Dimension kann nicht doppelt wechseln.

## Rift Pulse und Rift-Siegel (M3)

Jeder gültige Impuls (auch ein Wand-Tipp) sendet automatisch genau **eine** kreisförmige Energiewelle von der
aktuellen Spielerposition aus. Keine Zusatztaste, kein Zufall, keine Wirkung auf die Flugrichtung.

- **Rift-Siegel (Gold):** geschlossen in **beiden** Dimensionen tödlich – massives Gold mit Rautenmuster und heller Kontur.
  Erreicht eine Welle das Siegel, öffnet es sich für seine konfigurierte Dauer (Standard 0,5 s): Auflösungsblitz, Partikel, heller Doppelton, danach nur noch
  ein gestrichelter Rahmen mit schrumpfendem Countdown-Balken (flackert kurz vor dem Schließen). Offen = keine Kollision.
- **Typen:** *Siegeltor* (volle Breite, `SSSS` – nur mit Pulse passierbar) und *Siegelsegment* (Teil einer Reihe,
  kombiniert mit blauen/roten/weißen Hindernissen, z. B. `RSSB`, `SWWW`).
- **Reichweite:** 120 u (⅓ der Spielfeldbreite), gemessen bis zum sichtbaren Rand des Siegels. Ein Pulse erreicht Siegel
  in der eigenen und der Nachbarspur, aber nie zwei Spuren entfernt. Normale Hindernisse ignoriert er vollständig.
- **Lesbarkeit:** Nähert sich ein geschlossenes Siegel, erscheint ein dezenter goldener Reichweitenkreis um die Figur.
  Liegt es in Reichweite, **leuchtet es weiß auf** – ein Tipp jetzt öffnet es garantiert, und die Figur ist vor dem
  Schließen hindurch (0,11 s Reserve bei maximaler Entfernung). Ohne Leuchten öffnet kein Tipp das Siegel.
- **Zeitfenster:** Öffnungs-Tipp ca. 490–70 ms vor dem Siegel (mit gleichzeitigem Spurwechsel bis ca. 140 ms vorher);
  rhythmisch ideal ist der Offbeat (halber Beat) vor dem Siegel.
- **Kombination:** Der Öffnungs-Tipp wechselt immer auch Dimension und Spur – wer durch ein Siegel fliegt, muss vorher
  planen, in welcher Dimension die nächste Reihe wartet. Ein Wand-Tipp öffnet ein Siegel ohne Spurwechsel.
- Drei Siegel in Folge: sehr dezenter Screen-Shake. Todesgrund am Siegel: „GOLD-SIEGEL war zu – tippe, wenn es aufleuchtet“.
- Neustart schließt alle Siegel und löscht alle Wellen. Practice stellt die gespeicherten Öffnungszeiten und laufenden Wellen exakt wieder her.

## Spielmodi

- **Normal:** Start bei 0 %, keine Checkpoints, ein Fehler beendet den Versuch. Bestleistung (%), Versuche und
  Abschlüsse liegen in `localStorage`.
- **Übungsmodus (Practice):** automatische Checkpoints (frühestens alle 1040 u = 4 s, nach einer passierten Reihe), nach einem Fehler Respawn am letzten Checkpoint. Zählt nicht in die Normal-Statistik.

## Tod und Neustart

Trefferanimation 0,28 s (Explosion, Treffer-Ton, getroffenes Hindernis blinkt, ✕ an der Kollisionsstelle), parallel sofort ein
kompakter Todesscreen oben – die Unfallstelle bleibt sichtbar – mit Prozent, Bestleistung, Medaille, Versuchen und **Todesgrund**
(z. B. „BLAU ist in der blauen Dimension aktiv“). Ab 0,22 s nach dem Tod startet **jeder Tipp** sofort neu
(kein Menü, kein Neuladen). Der RETRY-Button startet sofort ohne diesen Schutz für beliebige Tipps.
iOS-Geister-Klicks nach dem Neustart werden abgefangen.

## Physikparameter (zentral in `js/config.js`)

| Parameter | Wert | Begründung |
| --- | --- | --- |
| Bewegungsmodell | kritisch gedämpfte Feder zur Zielspur | stetige Geschwindigkeit, kein Überschwingen, flüssige Ketten-Impulse |
| `IMPULSE_MS` | 220 ms (bis 95 %) | M1 (easeOutCubic 340 ms) war faktisch nach 215 ms fertig, startete mit unendlicher Beschleunigung und sprang beim Gegen-Tipp um ~900 u/s; 220 ms ist spursicher nach 86 ms, Sprung nur ~70 u/s |
| `SIM_HZ` | 240 Hz fester Zeitschritt | identische Flugbahn bei 30/60/144 FPS; max. 1,1 u vertikal und 3 u seitlich pro Schritt → kein Tunneln |
| Eingabe-Zeitstempel | Simulation wird bis zum Event-Zeitpunkt vorgespult | Impuls wirkt dort, wo die Figur beim Tipp war (keine Frame-Latenz) |
| `HIT_RADIUS` | 8 u (Figur sichtbar ~22 × 25 u) | Kern-Hitbox, nie größer als die Figur |
| Balken-Hitbox | 10 u hoch (sichtbar 14 u), seitlich exakt sichtbar | sichtbar ≥ kollidierend, keine unsichtbaren Kollisionen |
| Tipp-Fenster | ~310 ms je 1-Beat-Reihe | Zeit zwischen „vorige Reihe passiert“ und „spätester sicherer Tipp“ |
| Kamera | Spieler bei 78 % Höhe, ≥ 100 u nach unten | ≥ 1,8 s Vorschau auf Smartphones, ruhiges konstantes Scrolling |
| `PULSE_RADIUS` | 120 u | ⅓ Feldbreite: eigene + Nachbarspur (48 u seitlich), nie zwei Spuren (138 u); Tipp bis ~0,49 s vor dem Siegel |
| `PULSE_GROW_SEC` | 0,15 s (easeOutQuad) | schnell und präzise; Logik und sichtbare Welle nutzen dieselbe Kurve |
| `SEAL_OPEN_SEC` | 0,5 s | bei 260 u/s ist die Figur nach jedem erfolgreichen Öffnen sicher durch (Reserve ≥ 0,11 s) |
| `SEAL_WARN_SEC` | 0,15 s | Flackern vor dem Schließen |
| `SEAL_PLAN_DY` | 58 u | Solver-Annahme: Öffnungs-Tipp auf dem Offbeat vor dem Siegel |

`node tests/tune-impulse.mjs` vergleicht die Modelle und Dauern (easeOutCubic 200–340 ms, Feder 180–340 ms).

## Früheres Testlevel (Archiv: rift-main, 44 s)

Das Hauptlevel liegt seit M4 als JSON in `assets/levels/rift-main.json` (verlustfrei aus dem alten Reihenformat migriert,
spielt sich identisch). Jede Hindernisreihe liegt exakt auf einem Beat (120 BPM) und belegt die vier Spuren als
Muster aus Blau/Rot/Weiß/Siegel/leer. Die musikalischen Abschnitte folgen seit M6 jeweils 25 % des Fortschritts: INTRO, BUILD, DROP, FINALE. Die bewährten Hindernisphrasen unten behalten ihre Positionen.
Das Kampagnenmenü zeigt die mit `campaign: true` markierten Level aus `assets/levels/index.json` (direkt: `?level=<id>`); Bestleistung,
Versuche und Abschlüsse werden pro Level gespeichert.

- **Lernphrase (2–10 s, alle 1,5 s):** Jede Reihe lehrt eine Regel mit kurzem Hinweis im Level (Tipp rechts = ↖,
  Tipp links = ↗, Geister harmlos, Tipp wechselt die Farbe, Weiß tötet immer). Zum Schluss **ein einzelnes Siegeltor**
  über die ganze Breite, ohne weitere Hindernisse, mit sichtbarem Reichweitenkreis und Hinweis „Jeder Tipp sendet einen
  Pulse / Pulse öffnet Gold-Siegel“ – großzügiges Fenster von ~420 ms.
- **Kombinationsphrase (12–26 s):** die Farb-Herausforderungen aus M2 plus vier Siegel-Reihen (`WSSW`, `RSSB`, `SSRR`, `BSSR`).
  Direkt nach einem Siegel folgt oft eine Farbreihe: Der Öffnungs-Tipp wechselt die Dimension, also muss man vorher in
  der „falschen“ Dimension ankommen. Enthält den Doppel-Tipp aus M2.
- **Präzisionsphrase (27–37 s, jeder Beat):** Wand-Kette mit Siegeln (`SWWW`/`RWWW`/`SWWW` – Wand-Tipps öffnen Siegel ohne
  Spurwechsel), Diagonale durch drei Siegel quer über das Feld (`WSBW` → `WWSR` → `WWWS`), Rückweg mit Richtungswechseln
  und zwei weitere Siegelsegmente. Ein eindeutiger, lesbarer Weg statt verschachtelter Ketten.
- **Schlussphrase (38–42,5 s, jeder Beat):** dichter Höhepunkt nur aus Bekanntem: drei Siegel im 1,5-s-Rhythmus
  (`SSSS`, `WSSW`, `SSSS`), jeweils eingerahmt von Farbreihen. Keine neue Mechanik. Danach „RIFT CLEARED · 100 %“.

Der Solver (`validateLevel`) beweist mit höchstens einem Tipp pro Beat, dass jede Reihe erreichbar ist und an jeder
Reihe mindestens ein Zustand zum Ziel führt; ein Siegel gilt nur als passierbar, wenn der letzte Tipp davor (aus der
Spur vor dem Tipp) es mit seiner Welle erreicht. `node tests/level-report.mjs` zeigt Reihe für Reihe die erreichbaren
Zustände, die Musterlösung und die Siegel-Durchflüge. Zusätzlich spielt der Autopilot das Level mit echter Physik
(Tipps 70/300 ms nach der vorigen Reihe, Siegel-Tipps 160/250/400 ms vor dem Siegel) bis 100 %.

M6 verbindet diese bereits auf Beats gesetzten Hindernisphrasen mit der neuen Komposition: Jedes Siegeltor erhält einen vorbereitenden Drum-Pickup und einen harmonischen Akzent bei der Durchquerungshöhe. Die Musikabschnitte beginnen exakt bei 0, 11, 22 und 33 s.

## Grafik und Riftling (M5/M7)

- **Riftling:** die Spielfigur ist ein Tropfenwesen aus echten SVG-Ebenen (`assets/riftling/body-blue.svg`,
  `body-red.svg`, `eye.svg`), die einmal je Zoomstufe gerastert und dann als Bild gezeichnet werden (`js/art/riftling.js`).
  Die Hitbox bleibt der Kreis aus `js/config.js` – Optik und Kollision sind getrennt.
- **Animationen** (`js/art/riftling-anim.js`): Idle-Atmen, Flug links/rechts (Neigung, Flossen), Dimensionswechsel
  (Weiß-Blitz, Ebenen-Überblendung), Pulse-Rückstoß, Tod (Zerplatzen in Splitter, Ausblenden) und Respawn (Einblenden).
  Alle Animationen laufen auf der Spielzeit, nicht auf der Bildrate.
- **Effekte** (`js/art/effects.js`, `js/particles.js`): Schweif-Band, Funken, Splitter, Pulse-Ringe, Siegel-Öffnung;
  Hindernisse als Neonröhren mit Kern und Glow (`js/shapes.js`, gemeinsam mit dem Editor).
- **Hintergrund** (`js/art/backdrop.js`): mehrlagige Parallax-Türme je Dimension, vorgerastert; gezeichnet werden nur
  die belegten Streifen und nur der sichtbare Teil jeder Kachel.
- Seit M7 gibt es genau eine hochwertige Darstellung. Alte `gfx`-URL-/Speicherwerte haben keine Wirkung.
  Die Auflösung ist für alle Geräte einheitlich auf DPR 2,5 begrenzt; kein visuelles Detail wird nach Bildrate abgeschaltet.

## LEVEL FORGE – visueller Level-Editor (M4, mobil seit M4.5)

**Öffnen:** https://t0ptyp.github.io/rift-climb/assets/forge/ (lokal: `http://localhost:8080/assets/forge/`), oder im
Spielmenü über „Level-Editor“. Am Desktop mit Maus und Tastatur, auf Smartphones und Tablets per Touch
(siehe [Bedienung auf dem Smartphone](#bedienung-auf-dem-smartphone)).

Aufbau: oben Datei-Aktionen, Undo/Redo, **PLAYTEST** / **AB HIER**, Raster und Zoom · links Werkzeuge und Objektpalette ·
Mitte das Spielfeld (360 u breit, 4 Spuren, Beat-Linien mit Zeitangabe) · rechts Eigenschaften und die Live-Prüfung.

### Positionsmodell

Freie Rechtecke (`x` = linke Kante, `y` = Mitte, `w`, `h` in Spieleinheiten u). Das verallgemeinert das Spielformat
ohne neue Mechanik: Spiel und Editor nutzen dieselbe Kollision (Kreis gegen Rechteck), dieselben Zeichenfunktionen
(`js/shapes.js`) und dieselbe Physik. Standard-Snap ist **Spur + ganzer Beat** – genau das Raster des Hauptlevels –,
abschaltbar bis pixelgenau (0,5 u). Nicht vorhandene Spielelemente erfindet der Editor nicht:
**Stacheln** sind in der Palette als „nicht verfügbar“ markiert, **Rotation** ist ein gesperrtes Feld
(das Spiel kennt nur achsenparallele Hindernisse); Importe mit solchen Elementen werden abgelehnt bzw. bereinigt.

### Objekte

| Palette | Typ im JSON | Wirkung im Spiel |
| --- | --- | --- |
| Neutral / Blau / Rot | `obstacle` mit `dimension` `both`/`blue`/`red` | tödlich in beiden / nur der blauen / nur der roten Dimension |
| Barriere | `obstacle` (hoch, z. B. 84 × 130 u) | wie ein Hindernis, nur größer |
| Rift-Siegel | `seal` mit `openSec` (0,3–1,5 s, Standard 0,5) | geschlossen in beiden Dimensionen tödlich, ein Rift Pulse (120 u) öffnet es |
| Hinweis | `hint` mit `text` (≤ 40 Zeichen) | nur Anzeige, keine Kollision |
| Start / Ziel | `start.lane` + `start.dimension`, `finish.y` | Startspur und -dimension auf der Startlinie, Ziellinie (Pflicht) |
| Testmarker | – (nur Editor) | Starthöhe und -spur für **AB HIER** (Play from here) |

### Bedienung

| Eingabe | Wirkung |
| --- | --- |
| Palette anklicken, dann ins Feld klicken – oder direkt aus der Palette ziehen | Objekt setzen (mit Vorschau am Mauszeiger) |
| Klick / Shift-Klick / Rahmen ins Leere ziehen | auswählen / zur Auswahl hinzufügen bzw. entfernen / Mehrfachauswahl |
| Ziehen | verschieben (ein Drag = ein Undo-Schritt); Griffe an den Kanten ändern die Größe |
| Pfeiltasten (Alt = 1 u) | Auswahl um einen Snap-Schritt verschieben |
| `Strg/Cmd+Z`, `Strg/Cmd+Y` bzw. `Strg/Cmd+Shift+Z` | Rückgängig / Wiederholen (bis 300 Schritte) |
| `Strg/Cmd+C`, `Strg/Cmd+V`, `Strg/Cmd+D`, `Strg/Cmd+A` | kopieren, an der Mausposition einfügen, duplizieren (einen Beat höher), alles wählen |
| `Entf` / `Rücktaste` | Auswahl löschen |
| `Strg/Cmd+S` | lokal speichern |
| `V` `M` `P` `R` `X` `H` | Werkzeuge Auswahl, Bewegen, Setzen, Rahmen, Löschen, Hand |
| `G`, Alt halten | Snap an/aus, Snap kurz aus |
| Mausrad, Shift+Mausrad, Strg/Cmd+Mausrad | vertikal scrollen, horizontal scrollen, um den Mauszeiger zoomen |
| Leertaste + Ziehen, mittlere Maustaste | Kamera schieben |
| `1` `2` `3`, `0`, `+` `-` | Ansicht Beide/Blau/Rot, Zoom zurücksetzen, Zoom |
| `Esc` | Platzieren abbrechen bzw. Auswahl aufheben; im Playtest: zurück zum Editor |

In Eingabefeldern lösen Editor-Kürzel nicht aus. Die Dimensionsansicht (Beide/Blau/Rot) zeigt wie im Spiel, was in der
gewählten Dimension tödlich ist (massiv) und was ein Geist ist (blass, gestrichelt); sie verändert keine Leveldaten.
Optional: Hitboxen, Pulse-Reichweite und die gemeinsame **Musikvorschau** mit zuschaltbarem Metronom. Die Kamera steigt wie die echte vertikale Simulation mit 260 u/s. Seitliche Manöver prüft der echte Playtest.

### Bedienung auf dem Smartphone

Layout ab ≤ 760 px Breite (oder Touch-Querformat bis 520 px Höhe): oben Titel, Undo/Redo, Speichern und Menü ·
Mitte das Spielfeld · darunter eine waagerecht scrollbare Leiste mit Werkzeugen und Palette · unten das Dock
**Eigenschaften · Prüfung · Ansicht (Beide/Blau/Rot) · Playtest**. Tablets (761–1024 px) behalten das Desktop-Layout
mit schmaleren Spalten und größeren Touch-Zielen. Alle Bedienelemente sind mindestens 44 px groß, Safe Areas werden beachtet.

| Geste | Wirkung |
| --- | --- |
| Palette antippen, dann ins Feld tippen | Objekt setzen (erneutes Antippen der Palette beendet das Setzen) |
| Tippen auf ein Objekt / ins Leere | auswählen / Auswahl aufheben |
| Ein Finger auf einem Objekt ziehen | verschieben (ein Undo-Schritt); runde Griffe ändern die Größe |
| Ein Finger im Leeren ziehen | Kamera schieben (mit Werkzeug „Rahmen“: Mehrfachauswahl) |
| Zwei Finger | schieben und zoomen (Pinch) um die Fingermitte |
| Lange drücken (≈ 0,5 s) auf ein Objekt | Kontextmenü: Duplizieren, Löschen, Eigenschaften |
| Knopf „⤢“ rechts oben im Feld | Zoom einpassen |

- **Eigenschaften** öffnen sich als Bottom Sheet; Zahlenfelder haben −/+-Knöpfe (je Tipp ein Undo-Schritt).
  Bei offener Bildschirmtastatur rückt das Sheet über die Tastatur (`visualViewport`), das aktive Feld bleibt sichtbar.
- **Menü (☰):** Neu, Öffnen, Importieren, Exportieren, Ab hier testen, Rhythmus-Vorschau, Playtest-Modus, Raster/Snap
  und Anzeigeoptionen – dieselben Funktionen wie am Desktop.
- **Speichern:** Autospeicherung wie am Desktop (IndexedDB), zusätzlich wird dauerhafter Speicher angefragt
  (`navigator.storage.persist`). Browser – v. a. iOS Safari – können lokale Daten trotzdem löschen; der Editor weist
  darauf hin. Sichern daher per **Exportieren**: auf Touch-Geräten mit Teilen-Dialog (Web Share, z. B. „In Dateien sichern“),
  sonst als Download. Das exportierte JSON ist identisch mit dem Desktop-Export.
- **Playtest** läuft im Vollbild; der große Button „Zurück zum Editor“ beendet ihn jederzeit, Änderungen bleiben erhalten.

### Prüfung, Playtest und Nachweis

Die Prüfung läuft live: **Fehler** (z. B. außerhalb der Feldbreite, ungültige Maße, fehlender Start/Ziel) sperren
Playtest und Export, **Warnungen** (z. B. überlappende Objekte, Siegel außerhalb jeder Pulse-Reichweite) weisen auf
problematisches Design hin. Ein Klick auf einen Eintrag springt zum Objekt.

**PLAYTEST** startet das echte Spiel (gleiche Dateien, gleiche Physik) in einem Overlay mit dem aktuellen Stand –
ohne Export. Der Testzustand ist isoliert: keine Bestleistung, kein Fortschritt im Spielspeicher. **AB HIER** startet
an der Höhe und Spur des Testmarkers. `Esc`, „Zurück zum Editor“ oder der Editor-Button im Spiel beenden den Test;
ungespeicherte Änderungen und die Undo-History bleiben erhalten.

Spielbarkeits-Nachweis (Pflicht für die Veröffentlichung):
1. **Spur-Solver** – liegen alle Objekte spurgenau auf ganzen Beats (120 BPM), beweist derselbe Solver wie in M3 die Lösbarkeit;
2. **Aufzeichnung** – bevorzugter Nachweis, sobald vorhanden; sonst einmal im Playtest (Modus Normal, ab Start) bis zum Ziel spielen. Der Lauf (`replay.taps`)
   wird im Level gespeichert und in CI mit der echten 240-Hz-Simulation nachgespielt. Jede spätere Änderung wird erneut mit dieser Aufzeichnung simuliert; ein fehlgeschlagener Lauf muss neu aufgenommen werden.

### Speichern und Veröffentlichen

GitHub Pages ist statisch – der Editor schreibt **nie** direkt ins Repository.
- **Autospeicherung:** der aktuelle Entwurf liegt in IndexedDB und wird beim nächsten Öffnen wiederhergestellt.
- **Speichern** (`Strg/Cmd+S`): benannte Level lokal im Browser; **Öffnen** listet lokale Level und alle Spiel-Level.
- **Exportieren:** lädt `<level-id>.json` herunter. **Importieren:** JSON-Datei (auch das alte Reihenformat aus M1–M3)
  laden; fehlerhafte Dateien werden mit verständlicher Meldung abgelehnt, nicht unterstützte Objekte nur nach Bestätigung verworfen.

Ein Level ins Spiel bringen:
1. Im Editor **Exportieren**.
2. Datei nach `assets/levels/` legen und in `assets/levels/index.json` unter `levels` eintragen: `{ "id": "…", "name": "…", "file": "….json", "campaign": true }` (ohne `campaign` nur Archiv/Forge/URL).
3. `node tests/validate-level.mjs` lokal ausführen (optional), committen und auf `main` pushen.
4. Der Pages-Workflow prüft alle Level und veröffentlicht sie; das Level erscheint in der Levelauswahl.

### JSON-Format (Version 1)

```json
{
  "schema": "rift-climb-level",
  "version": 1,
  "id": "rift-forge-test",
  "name": "RIFT FORGE TEST",
  "description": "…",
  "bpm": 120,
  "height": 4290,
  "start": { "lane": 1, "dimension": "blue" },
  "finish": { "y": 4160 },
  "objects": [
    { "id": "blue-a", "type": "obstacle", "x": 3, "y": 910, "w": 150, "h": 14, "dimension": "blue" },
    { "id": "seal-a", "type": "seal", "x": 93, "y": 1690, "w": 174, "h": 14, "openSec": 0.5 },
    { "id": "hint-intro", "type": "hint", "y": 130, "text": "RIFT FORGE TEST" }
  ],
  "replay": { "taps": [{ "t": 1, "dir": 1 }, { "t": 4.3, "dir": -1 }] }
}
```

- Einheiten: u (Spielfeld 360 u breit, Spur 90 u, Steiggeschwindigkeit 260 u/s, bei 120 BPM 130 u pro Beat).
  `y` wächst nach oben, die Startlinie liegt bei 0. `bpm` (60–200) bestimmt Musik und Beat-Raster, nicht das Tempo der Figur.
- Grenzen: Breite/Höhe ≥ 8 × 6 u, Höhe ≤ 520 u, Objekte vollständig im Feld, Ziellinie ab 520 u (4 Beats) bis 600 s Spielzeit, höchstens 5000 Objekte,
  IDs `a-z0-9-` (Level) bzw. `A-Za-z0-9_-` (Objekte), eindeutig.
- `replay` ist optional (Nachweis per Aufzeichnung, `dir` −1 = links, 1 = rechts); `sections` optional (Abschnitte für Musik-Intensität).
- Die Schlüsselreihenfolge ist fest (`serializeLevel`), ein unverändert exportiertes Level ist byte-gleich mit der Repo-Datei.
- `js/level-data.js` validiert, normalisiert, migriert und serialisiert – dieselbe Funktion nutzen Spiel, Editor und CI.

## Debug-Modus

`?debug=1` zeigt Hitboxen (gelb = aktiv, grau = inaktiv, grün = Spieler), den Geschwindigkeitsvektor und Bewegungsdaten
(FPS, Simulationsschritte, t, Beat, x, y, vx, Spur, Dimension, Vorschauzeit, verworfene Eingaben, Solver-Status).
Rift Pulse: gestrichelter Kreis = Pulse-Radius, magenta = aktuell wachsende Wellen, Siegel-Hitboxen (orange = zu,
grau = offen) mit Status „ZU“ / „OFFEN 0,32 s“ und Abstand zum Spieler; im Panel Radius, Öffnungsdauer, aktive und
gesendete Wellen sowie Zustand, Restzeit und Reichweite des nächsten Siegels. Im regulären Spiel unsichtbar.
Alle Werte stehen zentral in `js/config.js`.
Weitere Parameter: `?autoplay=1` (regulärer JSON-Replay, sonst Legacy-Solver-Lösung), `&offset=0.3` (Tipp-Zeitpunkt des Autopiloten nach der vorigen Reihe),
`&lead=0.25` (Öffnungs-Tipp des Autopiloten vor einem Siegel), `?speed=2` (Zeitraffer),
`?manual=1` (Zeit nur per `window.__RIFT.update(dt)`), `?trace=1` (Flugbahn-Protokoll für Tests).

## Mobile-Optimierung

- **iOS-Safari-Button-Fix:** Overlay-Buttons reagieren auf `pointerup` *und* `click`, lösen aber nur einmal aus;
  Hover nur auf echten Hover-Geräten; `touch-action: manipulation`; Klick-Schutz gegen Geister-Klicks nach Overlay-Wechsel.
  AudioContext wird synchron in der Geste entsperrt.
- Spiel-Eingabe nur über Pointer Events (Touch-Events nur als Fallback), 200 ms Sperre nach Start, 45-ms-Doppel-Filter.
- Canvas mit festem DPR-Limit 2,5; Farbverlauf, Vignette und beide Parallax-Ebenen im Canvas vorgerastert.
- Partikel-Pool fester Größe, Schweif als Ringpuffer – keine neuen Partikelobjekte pro Frame.
- Kein Scrollen/Zoomen, Safe Areas, Portrait-Layout, Querformat-Hinweis, Auto-Pause bei `visibilitychange`/`pagehide`.

## Lokal starten

```bash
python3 -m http.server 8080
# Spiel: http://localhost:8080 · Editor: http://localhost:8080/assets/forge/
```

### Tests

```bash
node tests/validate-level.mjs        # alle Level aus assets/levels/: Schema, Nachweis (Solver/Aufzeichnung), Legacy-Level 30–45 s (läuft im Deploy-Workflow)
node tests/level-report.mjs          # Reihe-für-Reihe-Analyse der Abschnitte A–D
node tests/physics.mjs               # Flugphysik, Bildratenunabhängigkeit, Tunneln, Hitboxen, Partikel-Pool
node tests/rift-pulse.mjs            # Rift Pulse/Siegel: Reichweite, Öffnen/Schließen, Grenzfälle, Practice, Bildraten
node tests/tune-impulse.mjs          # Vergleich der Impulsmodelle
npm ci && npx playwright install chromium webkit
python3 -m http.server 8080 &
node tests/e2e.mjs                   # 100 Browser-Checks (Szenarien inkl. Siegel, Bildraten, Desktop, Practice, 100 %, iPhone/Pixel, feste Grafik)
node tests/perf.mjs                  # Frame-Zeiten im echten rAF-Loop (Pixel 7, 4× CPU-Drosselung); LEVEL=overload, THROTTLE=1 optional
node tests/m5-visuals.mjs            # 25 Checks Grafik/Riftling: Animationen, feste Darstellung, Lesbarkeit auf 320 px, Gameplay unverändert
node tests/screenshots.mjs           # Portrait-Screenshots (Menü, Pulse öffnet Siegel, Reichweite, Debug, Tod)
node tests/m5-screenshots.mjs        # Riftling-Übersicht, Gameplay, mobiler Editor (SHOT_DIR=… setzt den Zielordner)
node tests/forge-e2e.mjs             # 70 LEVEL-FORGE-Checks mit echten Maus-/Tastatureingaben (QS-Liste M4 inkl. Playtest, Import/Export)
node tests/forge-mobile-e2e.mjs      # 50 Touch-Checks des mobilen Editors (iPhone 13, Querformat, Tablet, Desktop, WebKit)
node tests/forge-screenshots.mjs     # Editor-Screenshots (Editor, Playtest, Prüfung)
```

## Projektstruktur

```
rift-climb/
├── index.html                 # Einstieg, Overlays (Menü mit Levelauswahl, Pause, Tod, Ziel), HUD
├── css/style.css              # Neon-Stil, Kampagnenmenü, Safe Areas, Touch-Optimierung
├── css/forge.css              # LEVEL FORGE
├── js/
│   ├── config.js              # Zentrale Spiel- und Physikparameter
│   ├── main.js                # Bootstrap (Level laden), Uhr/Game-Loop, Eingabe-Zeitstempel, Resize/DPR, Speicher, Playtest-Modus
│   ├── game.js                # Zustände, feste Simulationsschritte, Kollision, Checkpoints, Effekte, Rendering, Debug
│   │                          #   (bindet Rift Pulse ein: Wellen, Siegel-Kollision, Siegel-Darstellung)
│   ├── player.js              # Spur, Feder-Flugimpuls, Dimension, Schweif
│   ├── physics.js             # Kollision Kreis/Rechteck, exakte Feder-Integration
│   ├── particles.js           # Partikel-Pool
│   ├── rift.js                # Rift Pulse (Wellen) und Rift-Siegel-Zustände
│   ├── level-data.js          # JSON-Levelformat: Validierung, Normalisierung, Migration, Serialisierung, Laufzeitdaten
│   ├── level.js               # Spur-Solver inkl. Siegel
│   ├── playcheck.js           # Nachweis: Aufzeichnung mit echter Simulation nachspielen
│   ├── shapes.js              # Gemeinsame Zeichenfunktionen (Spiel + Editor)
│   ├── dimensions.js          # Farben + Tödlichkeitsregel
│   ├── input.js               # Pointer/Touch/Tastatur, Doppel-Filter
│   ├── audio.js               # Prozedurale WebAudio-Musik + SFX
│   ├── ui.js                  # DOM-Overlays, HUD, robuster Tap-Handler, Klick-Schutz
│   ├── art/                   # Grafik: riftling (SVG-Figur), riftling-anim, effects, backdrop
│   └── forge/                 # LEVEL FORGE: main (Steuerung), view (Kamera/Rendering), history (Undo/Redo),
│                              #   panels (Eigenschaften/Prüfung), store (IndexedDB), touch (Gesten)
├── assets/
│   ├── icon.svg
│   ├── riftling/              # SVG-Ebenen der Spielfigur
│   ├── forge/index.html       # Editor-Seite
│   └── levels/                # index.json + drei Kampagnen- und zwei Archiv-Level
├── tests/                     # Solver, Physik, Playwright-E2E, Performance, Screenshots
├── .github/workflows/deploy.yml
└── README.md
```

## Deployment

Jeder Push auf `main` startet `.github/workflows/deploy.yml`: npm test (Level, Physik, Rift, Timeline, Kampagnen-Replays) → statische Seite zusammenstellen →
Deployment auf GitHub Pages (HTTPS). `npm test` enthält seit M8 zusätzlich die Fortschritts-/Migrationsprüfungen.
Alle Pfade sind relativ, die Seite läuft daher unter `/rift-climb/`.

## Bekannte Probleme / Einschränkungen

- Auf echten iPhones/Android-Geräten noch nicht getestet – nur per Playwright-Emulation (WebKit + Chromium, Touch).
- Audio-Latenz kann je nach Gerät variieren; das Gameplay folgt der Spielzeit, nicht der Audio-Uhr.
- Ein Tipp wird mit dem Zeitstempel des Browser-Events verarbeitet; auf Geräten mit hoher Touch-Latenz
  (Hardware/Compositor) bleibt diese Latenz natürlich bestehen.
- Kein Kalibrierungsmenü für Audio-Latenz.
- Der mobile Editor ist nur in Emulation getestet (Chromium mit echten CDP-Touch-Events, WebKit-Smoke-Test);
  Bildschirmtastatur und Web Share sind in den Tests simuliert. Ein echtes iOS Safari stand nicht zur Verfügung.
- Bildrate auf echten Smartphone-GPUs noch nicht gemessen. Es gibt keine automatische Grafikreduktion.
  Die Simulation verarbeitet bis 250 ms Frame-Abstand vollständig in 240-Hz-Schritten; längere Blind-Stalls pausieren auch ohne Audio.
- Veröffentlichen geht bewusst nur über Export + Commit (statisches Hosting, keine Schreibrechte im Browser).
- Level mit freien Maßen beweist kein Solver; ihr Nachweis ist ein aufgezeichneter Lauf. Er belegt Lösbarkeit,
  nicht Fairness – Warnungen der Prüfung ersetzen kein Playtesting mit Menschen.
- Schwierigkeit der Siegel-Passagen (v. a. Abschnitt C) ist per Solver/Autopilot abgesichert, aber noch nicht mit
  echten Spielern getestet.
