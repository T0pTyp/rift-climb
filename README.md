# RIFT CLIMB: PULSE

Rhythmischer Vertical Climber für Smartphones (HTML5 Canvas, reines JavaScript, keine Abhängigkeiten zur Laufzeit).
Die Figur steigt automatisch im 120-BPM-Takt nach oben. Mit kurzen Flugimpulsen weichst du Hindernissen aus –
und jeder Impuls wechselt die aktive Dimension.

**Spielen:** https://t0ptyp.github.io/rift-climb/

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Tipp linke Bildschirmhälfte | Impuls schräg **rechts** oben + Dimensionswechsel |
| Tipp rechte Bildschirmhälfte | Impuls schräg **links** oben + Dimensionswechsel |
| `D` / `→` (Desktop) | Impuls rechts oben + Dimensionswechsel |
| `A` / `←` (Desktop) | Impuls links oben + Dimensionswechsel |
| Tipp / `A` / `D` / `Enter` nach dem Tod | sofortiger Neustart (Practice: Respawn am Checkpoint) |
| `Esc` / `P` | Pause / Weiter |
| `Enter` / `Leertaste` / `R` | Start im Menü, Neustart, Weiter in der Pause |

Das Spielfeld hat vier Spuren. Ein Impuls gegen die Wand bewegt die Figur nicht, wechselt aber trotzdem die Dimension.
Das ist eine zentrale Technik: Weil jeder normale Impuls Spur **und** Farbe gleichzeitig ändert, bleibt die
Kombination „Spur-Parität + Farbe“ erhalten – nur ein Wand-Tipp kippt sie. Das Finale nutzt das gezielt.

## Dimensionssystem

- **Blau aktiv:** blaue Hindernisse sind tödlich (massiv, leuchtend), rote sind inaktive „Geister“ (gestrichelt, blass).
- **Rot aktiv:** umgekehrt. **Weiß:** in beiden Dimensionen tödlich.
- Feedback je Wechsel: Figur blinkt weiß und skaliert kurz, Energiering, Partikel-Burst, kurzer Farbimpuls,
  Hintergrund-Überblendung, aufleuchtende neu aktive Hindernisse, minimaler Screen-Shake, Ton (Blau hoch, Rot tief).
  Alle Effekte werden **unter** den Hindernissen gezeichnet und verdecken sie nie.
- Doppelt verarbeitete Touches (zwei Eingaben < 45 ms) werden verworfen – die Dimension kann nicht doppelt wechseln.

## Spielmodi

- **Normal:** Start bei 0 %, keine Checkpoints, ein Fehler beendet den Versuch. Bestleistung (%), Versuche und
  Abschlüsse liegen in `localStorage`.
- **Übungsmodus (Practice):** automatische Checkpoints (frühestens alle 8 Beats, nur an Stellen, von denen das Ziel
  nachweislich erreichbar ist), nach einem Fehler Respawn am letzten Checkpoint. Zählt nicht in die Normal-Statistik.

## Tod und Neustart

Treffer-Moment 0,28 s (Explosion, Treffer-Ton, getroffenes Hindernis blinkt, ✕ an der Kollisionsstelle), danach ein
kompakter Todesscreen oben – die Unfallstelle bleibt sichtbar – mit Prozent, Bestleistung und **Todesgrund**
(z. B. „BLAU ist in der blauen Dimension aktiv“). Ab 0,22 s nach dem Tod startet **jeder Tipp** sofort neu
(kein Menü, kein Neuladen). iOS-Geister-Klicks nach dem Neustart werden abgefangen.

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

`node tests/tune-impulse.mjs` vergleicht die Modelle und Dauern (easeOutCubic 200–340 ms, Feder 180–340 ms).

## Level (≈ 42 s, 45 Reihen, Ziel bei Beat 84)

Jede Hindernisreihe liegt exakt auf einem Beat (120 BPM), notiert als 4-Zeichen-Muster (`B`/`R`/`W`/`.`).

- **A – Einstieg (0–13 s, alle 2 s):** Jede Reihe lehrt eine Regel, mit kurzen Hinweisen im Level:
  Tipp rechts = ↖, Tipp links = ↗, Geister sind harmlos, Tipp wechselt die Farbe, Weiß tötet immer, Richtung + Farbe kombinieren.
- **B – Herausforderung (15–28,5 s, alle 1 s):** Farbwechsel-Paare, enge weiße Wände, rhythmische Doppelreihen im
  0,5-s-Abstand, ein Doppel-Tipp zwischen zwei Reihen; 12 von 15 Reihen erzwingen eine Aktion.
- **C – Finale (29,5–41 s, alle 0,5 s):** Wand-Tipp-Kette an der linken Wand, Diagonale quer über alle Spuren mit
  Wand-Wechsel rechts, Farbwechsel-Ketten und eine letzte Richtungsentscheidung; 18 von 24 Reihen erzwingen eine Aktion.
  Danach Ziellinie „RIFT CLEARED · 100 %“.

Der Solver (`validateLevel`) beweist mit höchstens einem Tipp pro Beat, dass jede Reihe erreichbar ist und an jeder
Reihe mindestens ein Zustand zum Ziel führt (im Debug-Modus als „Solver: lösbar/Sackgasse“ sichtbar). `node tests/level-report.mjs` zeigt Reihe für Reihe
die erreichbaren Zustände und die Musterlösung. Zusätzlich spielt der Autopilot das Level mit echter Physik bei Tipps
70 ms und 300 ms nach der vorigen Reihe bis 100 %.

Musik und Effekte werden prozedural per WebAudio erzeugt; die Intensität steigt mit den Abschnitten A/B/C.

## Debug-Modus

`?debug=1` zeigt Hitboxen (gelb = aktiv, grau = inaktiv, grün = Spieler), den Geschwindigkeitsvektor und Bewegungsdaten
(FPS, Simulationsschritte, t, Beat, x, vx, Spur, Dimension, Vorschauzeit, verworfene Eingaben, Solver-Status).
Weitere Parameter: `?autoplay=1` (Solver-Lösung), `&offset=0.3` (Tipp-Zeitpunkt des Autopiloten), `?speed=2` (Zeitraffer),
`?manual=1` (Zeit nur per `window.__RIFT.update(dt)`), `?trace=1` (Flugbahn-Protokoll für Tests).

## Mobile-Optimierung

- **iOS-Safari-Button-Fix:** Overlay-Buttons reagieren auf `pointerup` *und* `click`, lösen aber nur einmal aus;
  Hover nur auf echten Hover-Geräten; `touch-action: manipulation`; Klick-Schutz gegen Geister-Klicks nach Overlay-Wechsel.
  AudioContext wird synchron in der Geste entsperrt.
- Spiel-Eingabe nur über Pointer Events (Touch-Events nur als Fallback), 200 ms Sperre nach Start, 45-ms-Doppel-Filter.
- Canvas mit Device Pixel Ratio (max. 2,5); Hintergrund und Vignette als CSS-Ebenen (spart Vollbild-Gradients im Canvas).
- Partikel-Pool fester Größe, Schweif als Ringpuffer – keine Allokationen im Game Loop.
- Kein Scrollen/Zoomen, Safe Areas, Portrait-Layout, Querformat-Hinweis, Auto-Pause bei `visibilitychange`/`pagehide`.

## Lokal starten

```bash
python3 -m http.server 8080
# dann http://localhost:8080 öffnen
```

### Tests

```bash
node tests/validate-level.mjs        # Level-Lösbarkeit + Dauer 30–45 s (läuft auch im Deploy-Workflow)
node tests/level-report.mjs          # Reihe-für-Reihe-Analyse der Abschnitte A/B/C
node tests/physics.mjs               # Flugphysik, Bildratenunabhängigkeit, Tunneln, Hitboxen, Partikel-Pool
node tests/tune-impulse.mjs          # Vergleich der Impulsmodelle
npm i --no-save playwright && npx playwright install chromium webkit
python3 -m http.server 8080 &
node tests/e2e.mjs                   # 90 Browser-Checks (Szenarien, Bildraten, Desktop, Practice, 100 %, iPhone/Pixel)
node tests/perf.mjs                  # Frame-Zeiten im echten rAF-Loop (Pixel 7, 4× CPU-Drosselung)
node tests/screenshots.mjs           # Portrait-Screenshots (Menü, Gameplay, Debug, Tod)
```

## Projektstruktur

```
rift-climb/
├── index.html                 # Einstieg, Overlays (Menü, Pause, Tod, Ziel), HUD
├── css/style.css              # Neon-Stil, Hintergrund-Ebenen, Safe Areas, Touch-Optimierung
├── js/
│   ├── config.js              # Zentrale Spiel- und Physikparameter
│   ├── main.js                # Bootstrap, Uhr/Game-Loop, Eingabe-Zeitstempel, Resize/DPR, Visibility, Speicher
│   ├── game.js                # Zustände, feste Simulationsschritte, Kollision, Checkpoints, Effekte, Rendering, Debug
│   ├── player.js              # Spur, Feder-Flugimpuls, Dimension, Schweif
│   ├── physics.js             # Kollision Kreis/Rechteck, exakte Feder-Integration
│   ├── particles.js           # Partikel-Pool
│   ├── level.js               # Handgebautes Level (A/B/C), Hinweise, Solver
│   ├── dimensions.js          # Farben + Tödlichkeitsregel
│   ├── input.js               # Pointer/Touch/Tastatur, Doppel-Filter
│   ├── audio.js               # Prozedurale WebAudio-Musik + SFX
│   └── ui.js                  # DOM-Overlays, HUD, robuster Tap-Handler, Klick-Schutz
├── assets/icon.svg
├── tests/                     # Solver, Physik, Playwright-E2E, Performance, Screenshots
├── .github/workflows/deploy.yml
└── README.md
```

## Deployment

Jeder Push auf `main` startet `.github/workflows/deploy.yml`: Level-Check → statische Seite zusammenstellen →
Deployment auf GitHub Pages (HTTPS). Alle Pfade sind relativ, die Seite läuft daher unter `/rift-climb/`.

## Bekannte Probleme / Einschränkungen

- Auf echten iPhones/Android-Geräten noch nicht getestet – nur per Playwright-Emulation (WebKit + Chromium, Touch).
- Audio-Latenz kann je nach Gerät variieren; das Gameplay folgt der Spielzeit, nicht der Audio-Uhr.
- Ein Tipp wird mit dem Zeitstempel des Browser-Events verarbeitet; auf Geräten mit hoher Touch-Latenz
  (Hardware/Compositor) bleibt diese Latenz natürlich bestehen.
- Nur ein Level; kein Kalibrierungsmenü für Audio-Latenz.
