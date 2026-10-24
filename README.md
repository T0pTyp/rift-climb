# RIFT CLIMB: PULSE

Rhythmischer Vertical Climber für Smartphones (HTML5 Canvas, reines JavaScript, keine Abhängigkeiten zur Laufzeit).
Die Figur steigt automatisch im 120-BPM-Takt nach oben. Mit kurzen Flugimpulsen weichst du Hindernissen aus –
jeder Impuls wechselt die aktive Dimension und sendet einen **Rift Pulse**, der goldene Rift-Siegel kurz öffnet.

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
Kombination „Spur-Parität + Farbe“ erhalten – nur ein Wand-Tipp kippt sie. Abschnitt C nutzt das gezielt.

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
  Erreicht eine Welle das Siegel, öffnet es sich für 0,5 s: Auflösungsblitz, Partikel, heller Doppelton, danach nur noch
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
- Neustart, Respawn und Practice-Checkpoints schließen alle Siegel und löschen alle Wellen (konsistenter Zustand).

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
| `PULSE_RADIUS` | 120 u | ⅓ Feldbreite: eigene + Nachbarspur (48 u seitlich), nie zwei Spuren (138 u); Tipp bis ~0,49 s vor dem Siegel |
| `PULSE_GROW_SEC` | 0,15 s (easeOutQuad) | schnell und präzise; Logik und sichtbare Welle nutzen dieselbe Kurve |
| `SEAL_OPEN_SEC` | 0,5 s | bei 260 u/s ist die Figur nach jedem erfolgreichen Öffnen sicher durch (Reserve ≥ 0,11 s) |
| `SEAL_WARN_SEC` | 0,15 s | Flackern vor dem Schließen |
| `SEAL_PLAN_DY` | 58 u | Solver-Annahme: Öffnungs-Tipp auf dem Offbeat vor dem Siegel |

`node tests/tune-impulse.mjs` vergleicht die Modelle und Dauern (easeOutCubic 200–340 ms, Feder 180–340 ms).

## Level (44 s, 55 Reihen, Ziel bei Beat 88)

Jede Hindernisreihe liegt exakt auf einem Beat (120 BPM), notiert als 4-Zeichen-Muster (`B`/`R`/`W`/`S`/`.`).
Die Abschnitte folgen dem Fortschritt (A 0–25 %, B 25–60 %, C 60–85 %, D 85–100 %).

- **A – Einführung (2–10 s, alle 1,5 s):** Jede Reihe lehrt eine Regel mit kurzem Hinweis im Level (Tipp rechts = ↖,
  Tipp links = ↗, Geister harmlos, Tipp wechselt die Farbe, Weiß tötet immer). Zum Schluss **ein einzelnes Siegeltor**
  über die ganze Breite, ohne weitere Hindernisse, mit sichtbarem Reichweitenkreis und Hinweis „Jeder Tipp sendet einen
  Pulse / Pulse öffnet Gold-Siegel“ – großzügiges Fenster von ~420 ms.
- **B – Kombination (12–26 s):** die Farb-Herausforderungen aus M2 plus vier Siegel-Reihen (`WSSW`, `RSSB`, `SSRR`, `BSSR`).
  Direkt nach einem Siegel folgt oft eine Farbreihe: Der Öffnungs-Tipp wechselt die Dimension, also muss man vorher in
  der „falschen“ Dimension ankommen. Enthält den Doppel-Tipp aus M2.
- **C – Präzision (27–37 s, jeder Beat):** Wand-Kette mit Siegeln (`SWWW`/`RWWW`/`SWWW` – Wand-Tipps öffnen Siegel ohne
  Spurwechsel), Diagonale durch drei Siegel quer über das Feld (`WSBW` → `WWSR` → `WWWS`), Rückweg mit Richtungswechseln
  und zwei weitere Siegelsegmente. Ein eindeutiger, lesbarer Weg statt verschachtelter Ketten.
- **D – Abschluss (38–42,5 s, jeder Beat):** dichter Höhepunkt nur aus Bekanntem: drei Siegel im 1,5-s-Rhythmus
  (`SSSS`, `WSSW`, `SSSS`), jeweils eingerahmt von Farbreihen. Keine neue Mechanik. Danach „RIFT CLEARED · 100 %“.

Der Solver (`validateLevel`) beweist mit höchstens einem Tipp pro Beat, dass jede Reihe erreichbar ist und an jeder
Reihe mindestens ein Zustand zum Ziel führt; ein Siegel gilt nur als passierbar, wenn der letzte Tipp davor (aus der
Spur vor dem Tipp) es mit seiner Welle erreicht. `node tests/level-report.mjs` zeigt Reihe für Reihe die erreichbaren
Zustände, die Musterlösung und die Siegel-Durchflüge. Zusätzlich spielt der Autopilot das Level mit echter Physik
(Tipps 70/300 ms nach der vorigen Reihe, Siegel-Tipps 160/250/400 ms vor dem Siegel) bis 100 %.

Musik und Effekte werden prozedural per WebAudio erzeugt; die Intensität steigt mit den Abschnitten A–D.

## Debug-Modus

`?debug=1` zeigt Hitboxen (gelb = aktiv, grau = inaktiv, grün = Spieler), den Geschwindigkeitsvektor und Bewegungsdaten
(FPS, Simulationsschritte, t, Beat, x, y, vx, Spur, Dimension, Vorschauzeit, verworfene Eingaben, Solver-Status).
Rift Pulse: gestrichelter Kreis = Pulse-Radius, magenta = aktuell wachsende Wellen, Siegel-Hitboxen (orange = zu,
grau = offen) mit Status „ZU“ / „OFFEN 0,32 s“ und Abstand zum Spieler; im Panel Radius, Öffnungsdauer, aktive und
gesendete Wellen sowie Zustand, Restzeit und Reichweite des nächsten Siegels. Im regulären Spiel unsichtbar.
Alle Werte stehen zentral in `js/config.js`.
Weitere Parameter: `?autoplay=1` (Solver-Lösung), `&offset=0.3` (Tipp-Zeitpunkt des Autopiloten nach der vorigen Reihe),
`&lead=0.25` (Öffnungs-Tipp des Autopiloten vor einem Siegel), `?speed=2` (Zeitraffer),
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
node tests/level-report.mjs          # Reihe-für-Reihe-Analyse der Abschnitte A–D
node tests/physics.mjs               # Flugphysik, Bildratenunabhängigkeit, Tunneln, Hitboxen, Partikel-Pool
node tests/rift-pulse.mjs            # Rift Pulse/Siegel: Reichweite, Öffnen/Schließen, Grenzfälle, Practice, Bildraten
node tests/tune-impulse.mjs          # Vergleich der Impulsmodelle
npm i --no-save playwright && npx playwright install chromium webkit
python3 -m http.server 8080 &
node tests/e2e.mjs                   # 96 Browser-Checks (Szenarien inkl. Siegel, Bildraten, Desktop, Practice, 100 %, iPhone/Pixel)
node tests/perf.mjs                  # Frame-Zeiten im echten rAF-Loop (Pixel 7, 4× CPU-Drosselung)
node tests/screenshots.mjs           # Portrait-Screenshots (Menü, Pulse öffnet Siegel, Reichweite, Debug, Tod)
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
│   │                          #   (bindet Rift Pulse ein: Wellen, Siegel-Kollision, Siegel-Darstellung)
│   ├── player.js              # Spur, Feder-Flugimpuls, Dimension, Schweif
│   ├── physics.js             # Kollision Kreis/Rechteck, exakte Feder-Integration
│   ├── particles.js           # Partikel-Pool
│   ├── rift.js                # Rift Pulse (Wellen) und Rift-Siegel-Zustände
│   ├── level.js               # Handgebautes Level (A/B/C/D), Hinweise, Solver inkl. Siegel
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
- Schwierigkeit der Siegel-Passagen (v. a. Abschnitt C) ist per Solver/Autopilot abgesichert, aber noch nicht mit
  echten Spielern getestet.
