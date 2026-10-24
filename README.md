# RIFT CLIMB: PULSE

Rhythmischer Vertical Climber für Smartphones (HTML5 Canvas, reines JavaScript, keine Abhängigkeiten zur Laufzeit).
Die Figur steigt automatisch im 120-BPM-Takt nach oben. Mit kurzen Flugimpulsen weichst du Hindernissen aus –
und jeder Impuls wechselt die aktive Dimension.

**Spielen:** https://t0ptyp.github.io/rift-climb/

## Steuerung

| Eingabe | Wirkung |
| --- | --- |
| Tipp linke Bildschirmhälfte | Impuls schräg **rechts** oben (ca. 340 ms) + Dimensionswechsel |
| Tipp rechte Bildschirmhälfte | Impuls schräg **links** oben + Dimensionswechsel |
| `D` / `→` (Desktop) | Impuls rechts oben + Dimensionswechsel |
| `A` / `←` (Desktop) | Impuls links oben + Dimensionswechsel |
| `Esc` / `P` | Pause / Weiter |
| `Enter` / `Leertaste` / `R` | Start im Menü, Sofort-Neustart nach Tod, Weiter in der Pause |

Das Spielfeld hat vier Spuren. Ein Impuls gegen die Wand bewegt die Figur nicht, wechselt aber trotzdem die Dimension –
das ist ein bewusst nutzbarer Trick.

## Dimensionssystem

- **Blau aktiv:** blaue Hindernisse sind tödlich, rote sind inaktive „Geister“ (gestrichelt) und können durchflogen werden.
- **Rot aktiv:** umgekehrt.
- **Weiß:** in beiden Dimensionen tödlich.
- Jeder Tipp wechselt die Dimension. Der Wechsel ist sichtbar über Figurenfarbe, Partikel-Burst, Hintergrund-Überblendung,
  kurzen Farb-Flash, Rand-Vignette und den Dimensions-Chip im HUD.

## Spielmodi

- **Normal:** Start bei 0 %, keine Checkpoints, ein Fehler beendet den Versuch. Sofort-Neustart per Button/Enter.
  Bestleistung (%) und Versuchsanzahl werden in `localStorage` gespeichert.
- **Übungsmodus (Practice):** automatische Checkpoints (frühestens alle 8 Beats, nur an Stellen, von denen das Ziel
  nachweislich erreichbar ist), nach einem Fehler Respawn am letzten Checkpoint. Keine reguläre Bestleistung.
  Im HUD durch den grünen „PRACTICE“-Chip gekennzeichnet.

## Level und Rhythmus

Ein festes, handgebautes Level (`js/level.js`, 73 Reihen, Ziel bei Beat 132 ≈ 66 s). Jede Hindernisreihe liegt exakt auf
einem Beat (120 BPM) und ist als 4-Zeichen-Muster notiert (`B` blau, `R` rot, `W` weiß, `.` frei).
Abschnitte: Einführung (alle 4 Beats) → zwei Farben (alle 2 Beats) → Weiß kommt dazu → Finale (jeder Beat).

Ein eingebauter Solver (`validateLevel`) beweist, dass das Level mit höchstens einem Tipp pro Beat lösbar ist –
es gibt also keine unmöglichen Kombinationen. Er läuft in den Tests und im Deploy-Workflow.

Musik und Effekte werden prozedural per WebAudio erzeugt (Kick, Hi-Hat, Snare, Bass, Arpeggio – keine Samples,
keine geschützte Musik). Sound ist im Menü abschaltbar; die Einstellung wird gespeichert.

## Mobile-Optimierung

- **iOS-Safari-Start-Button-Fix:** Overlay-Buttons reagieren auf `pointerup` *und* `click`, lösen aber nur einmal aus;
  Hover-Styles nur auf echten Hover-Geräten (verhindert das „erst Hover, dann Klick“-Doppeltippen auf iOS);
  `touch-action: manipulation`; kein globales `preventDefault` auf Touch-Events. Der AudioContext wird synchron in
  der Geste entsperrt.
- Spiel-Eingabe nur über Pointer Events (Touch-Events nur als Fallback ohne PointerEvent) → keine Doppelauslösung;
  200 ms Sperre nach Start, damit der Start-Tap nicht als Impuls zählt.
- Canvas mit Device Pixel Ratio (max. 2,5) skaliert, `visualViewport`-Resize.
- Kein Scrollen/Zoomen (`position: fixed`, `overscroll-behavior: none`, `touch-action: none`, Gesture-Blocker).
- Safe Areas über `env(safe-area-inset-*)` und `viewport-fit=cover`.
- Portrait-Layout; im Querformat auf kleinen Touch-Geräten Hinweis + Auto-Pause.
- Auto-Pause bei `visibilitychange`/`pagehide` (App- oder Tab-Wechsel), Audio wird angehalten.

## Lokal starten

ES-Module brauchen einen HTTP-Server (Öffnen per `file://` funktioniert nicht):

```bash
python3 -m http.server 8080
# dann http://localhost:8080 öffnen
```

Debug-Parameter: `?autoplay=1` (spielt die Solver-Lösung ab), `?speed=2` (Zeitraffer, 0.25–8).

### Tests

```bash
node tests/validate-level.mjs        # Level-Lösbarkeit
npm i --no-save playwright && npx playwright install chromium webkit
python3 -m http.server 8080 &
node tests/e2e.mjs                   # 73 End-to-End-Checks (Desktop, Practice, 100 %, iPhone/Pixel-Emulation)
node tests/screenshots.mjs           # Screenshots Menü + Gameplay (Portrait)
```

## Projektstruktur

```
rift-climb/
├── index.html                 # Einstieg, Overlays (Menü, Pause, Tod, Ziel), HUD
├── css/style.css              # Neon-Stil, Safe Areas, Touch-Optimierung
├── js/
│   ├── main.js                # Bootstrap, Game-Loop, Resize/DPR, Visibility, Speicher
│   ├── game.js                # Zustände, Kollision, Checkpoints, Rendering
│   ├── player.js              # Spur, Flugimpuls (340 ms), Dimension
│   ├── physics.js             # Kollision Kreis/Rechteck, Easing
│   ├── level.js               # Handgebautes Level, Konstanten, Solver
│   ├── dimensions.js          # Farben + Tödlichkeitsregel
│   ├── input.js               # Pointer/Touch/Tastatur
│   ├── audio.js               # Prozedurale WebAudio-Musik + SFX
│   └── ui.js                  # DOM-Overlays, HUD, robuster Tap-Handler
├── assets/icon.svg
├── tests/                     # Solver-Check, Playwright-E2E, Screenshots
├── .github/workflows/deploy.yml
└── README.md
```

## Deployment

Jeder Push auf `main` startet `.github/workflows/deploy.yml`: Level-Check → statische Seite zusammenstellen →
Deployment auf GitHub Pages (HTTPS). Alle Pfade sind relativ, die Seite läuft daher unter `/rift-climb/`.

## Bekannte Probleme / Einschränkungen

- Auf echten iPhones/Android-Geräten noch nicht getestet – nur per Playwright-Emulation (WebKit + Chromium, Touch).
- Audio-Latenz kann je nach Gerät variieren; das Gameplay ist von der Audio-Uhr entkoppelt (Spielzeit führt),
  daher kann die Musik bei starken Framedrops leicht vom Spiel abweichen.
- Nur ein Level; kein Kalibrierungsmenü für Audio-Latenz.

## Nächste Schritte

1. Test auf echten Geräten (iPhone Safari, Android Chrome) inkl. Audio-Sync und Notch/Safe Areas.
2. Feintuning von Schwierigkeit und Hitboxen anhand von Spieltests.
3. Optional: Audio-Latenz-Offset, PWA-Manifest/Offline-Cache, später Unity-Portierung.
