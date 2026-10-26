# M7.7 – Gameplay Refinement & Balancing

Stand: 26.10.2026. Ausgangspunkt: `366d1c4` auf `main`.

## Tatsächlicher Projektstand

Alle sechs Kampagnenlevels, dynamische Fallen, Infinity mit 20 handgefertigten
Chunks, PULSE ENGINE, Practice und mobiler LEVEL FORGE waren implementiert.
Auch ASCENSION aus M8 war bereits vorhanden und bleibt erhalten. Compact bleibt
im Hauptmenü verborgen; seine Implementierung und Lab-Daten werden nicht verändert.
Es gibt weiterhin genau eine hochwertige Darstellung, ohne Geräteprofile.

Die letzten beiden Fixes vor M7.7 hatten Pulse-Zerstörung von Sägen und Abschaltung
von Lasern ausgeschaltet. Der neue M7.7-Auftrag fordert diese Interaktionen
ausdrücklich erneut. Deshalb gelten jetzt folgende gemeinsame Regeln in Spiel,
Infinity und Forge-Playtest:

- Siegel: jede wachsende Welle öffnet die sichtbare Fläche wie bisher.
- Säge: Welle in der **Dimension der Säge** zerstört sie dauerhaft für diesen Run.
- Mine: passende Welle entschärft sie, auch während der Aufladung.
- Laser: passende Welle muss den **Projektor** erreichen; sie schaltet ihn für
  `disableSec` ab. Danach folgt die vollständige `warnSec` vor dem nächsten Strahl.
- Die Welle behält die Dimension ihres Auslösezeitpunkts. Ein späterer Wechsel
  ändert keine schon fliegende Welle. Der verblassende Ring verursacht keine neuen Treffer.

## Flugbewegung: gemessen und unverändert

| Parameter | Vorher | M7.7 |
|---|---:|---:|
| Arena / Spuren | 360 u / 4 | identisch |
| Zielschritt je Impuls | 90 u | identisch |
| Strecke nach 220 ms | 85,5005035 u | identisch |
| Ausgeschwungene Strecke | 90 u | identisch |
| Gemessene Spitzengeschwindigkeit bei 240 Hz | 713,9047 u/s | identisch |
| Federkonstante | 4,744 / 0,22 s | identisch |
| Vertikaler Aufstieg | 260 u/s | identisch |
| Simulationsschritt | 1/240 s | identisch |
| Spielerhitbox | Kreis, Radius 8 u | identisch |
| Pulse | Radius 120 u, Wachstum 0,15 s | identisch |
| Touch-Mindestabstand / Startschutz | 45 / 200 ms | identisch |

Die analytische kritisch gedämpfte Feder hält Position und Geschwindigkeit bei
Zielwechseln stetig. Ein Buffer würde die bereits direkte Eingabe verzögern;
deshalb wurde keiner ergänzt. Die Eingabe wird auf ihren Ereigniszeitpunkt
bezogen verarbeitet, ohne Beat-Quantisierung. Links auf dem Display bleibt
rechts oben, rechts bleibt links oben. Randziele sind 45 und 315 u; Wandkontakte
ändern die Dimension, ohne Abprall, Tod oder Verlassen der Arena.

Korrekturen an der Eingabeverarbeitung:

- Doppelte Pointer-Down-Ereignisse desselben gehaltenen Kontakts werden ignoriert.
  Bewusste abwechselnde Zwei-Finger-Tipps bleiben mit dem normalen 45-ms-Abstand gültig.
- Tastatur-Autowiederholung löst keine mehrfachen Bestätigungen/Restarts aus.
- Echte aufeinanderfolgende UI-Taps haben keine pauschale 450-ms-Sperre mehr.
  Der bestehende Schutz gegen nachgelagerte Touch-Kompatibilitätsklicks bleibt.
- Ein neuer Canvas-Tipp oder Retry-Key darf sofort nach dem Tod neu starten.
  Derselbe Tipp löst dabei keinen Flugimpuls aus. Wird der Tod erst beim
  zeitlichen Aufholen des Eingabeereignisses erkannt, bleibt er zunächst sichtbar.
- Run-Diagnosezähler und Pulse-IDs werden beim Neustart reproduzierbar zurückgesetzt.
  Practice stellt die exakten gespeicherten Wellen, Zähler und Fallen wieder her.

## Kollisionen und Pulse

Statische Balken/Siegel verwenden jetzt einen geometrisch exakten Circle/Rect-Sweep
zwischen vorheriger und aktueller Spielerposition. Er umfasst abgerundete Ecken
statt einer vergrößerten rechteckigen Hitbox. Dadurch werden schnelle
Eckdurchquerungen erfasst, ohne den sichtbaren freien Bereich zu verkleinern.
Die numerische Toleranz von `1e-7 u²` verhindert, dass reine Tangenten durch
Fließkommafehler nach Weltverschiebungen als Treffer zählen.

Sägen verwenden weiterhin relative bewegte Kreise; explodierende Minen einen
Kreis-Segment-Test mit ihrem sichtbaren Explosionsradius. Laser verwenden die
vorhandenen adaptiv unterteilten bewegten Strahlkapseln. Ihre runden Enden werden
nun ausdrücklich auch so gezeichnet. Dreieckige Gefahren existieren in dieser
Codebasis nicht; ein zusätzliches Hindernissystem wurde nicht erfunden.

Pulse-Treffer an rotierenden Laserprojektoren messen den Abstand zum tatsächlich
gedrehten Quadrat. Sie wirken vor der Kollisionsprüfung im selben Simulationsschritt;
eine gerade abgeschaltete Gefahr hinterlässt keine Ein-Schritt-Hitbox. Monotone
Wellen-IDs verhindern wiederholte Treffer durch überlappende ältere Wellen.
Das gilt auch für Siegel und ihre Sounds/Öffnungszähler.

## Gezieltes Balancing und Feedback

Globale Fallenparameter bleiben unverändert: standardmäßig Sägebewegung 3 s,
Minenladung 0,7 s, Laservorwarnung 0,7 s. Alle Bewegungen bleiben sinusförmig und
an die Simulationszeit gebunden. Wiederholte Laser-Pulse dürfen den Cooldown
verlängern, eine alte Welle darf ihn nicht fortlaufend neu starten.

Nur zwei Werte in **Singularity Rush** wurden korrigiert:

| Objekt | Vorher | Jetzt | Grund |
|---|---|---|---|
| `saw-82` | y = 17008,333333 | y = 16992,333333 | Mehr Abstand beim frühen Dimensionswechsel |
| `mine-88` | `chargeSec = 0.7` | `chargeSec = 0.8` | Mehr Zeit zum Eintreffen der passenden Pulswelle |

Alle anderen fünf Leveldateien, alle Replay-Eingaben und sämtliche Chunk-Geometrien
bleiben unverändert. Singularity bleibt sehr schwer; die isolierten Timing-Tests
ersetzen keinen menschlichen Schwierigkeitstest.

Minen zeigen die steigende Ladung zusätzlich am tatsächlichen Explosionskreis.
Abgeschaltete Projektoren zeigen ihren Cooldown. Minenentladung zieht Partikel
zusammen; Sägen zerbrechen mit metallischen Fragmenten. Bestehende individuelle
SFX werden verwendet. Effekte bleiben kurz, aus dem bestehenden Partikelpool und
ohne Einfluss auf Kollisionen. Die Sägezähne werden als maximal 32 wiederverwendbare
Path2D-Geometrien vorgehalten; die Darstellung ist im Browser pixelidentisch zum
bisherigen Zeichenpfad. Es werden keine Effekte zur Leistungsanpassung abgeschaltet.

## Infinity: Auswahl und sichere Übergänge

Die bestehende `EndlessWorld` bleibt die einzige Generatorarchitektur. Die 20
vorhandenen Module werden in vier Pools vorgruppiert. Die Auswahl verwendet
weiterhin den Xorshift-Seed und zusätzlich eine auf acht Einträge begrenzte Historie:

1. Die letzten zwei Modul-IDs erhalten Gewicht 0.
2. Gleiche Mechanikfamilie wie zuletzt: Faktor 0,65.
3. Weniger Replay-Aktionen als im letzten Modul: Faktor 1,35 (Atempause).
4. Wiederholungen in der Historie: Division durch `1 + 2 * Häufigkeit`.
5. Ein Seed-Zufallswert wählt aus den verbleibenden Gewichten.

Familien werden aus den vorhandenen Fallentypen abgeleitet. Keine Hindernisse
werden im Run zufällig verschoben, keine Eingaben automatisch korrigiert.

| Höhe | Zielbereich | Tatsächlicher erster Chunk-Start in diesem Bereich |
|---|---|---|
| 0–250 m | Einfach | 0 m |
| 250–750 m | Mittel | 416 m |
| 750–1500 m | Schwer | 832 m |
| ab 1500 m | Sehr schwer, gedeckelt | 1664 m |

Die Grenzen werden beim Start eines 208-m-Moduls ausgewertet, daher wird ein
bereits begonnenes Modul niemals verschärft. Geschwindigkeit und Anzahl der
Objekte wachsen nach Tier 3 nicht weiter. Es gibt keinen zwangsläufig tödlichen
Geschwindigkeitsanstieg.

Jedes Modul muss Spur 2/Blau als Eingang und Ausgang, gültige reguläre Tipps,
mindestens 2 s Eintrittsruhe und 1 s nach dem letzten Tipp ausweisen. Die bisher
pauschal eingetragenen 2 s Ausgangsruhe waren bei Tipps bis 6,9 von 8 s sachlich
falsch und wurden auf die tatsächlich eingehaltene 1 s berichtigt. Die gemeinsame
Validierung prüft Schema, IDs, Zeitschranken, Grundpositionen und den aus den
Eingaben resultierenden Ausgangszustand; vollständige echte Simulation prüft
zusätzlich alle 400 geordneten Übergänge. Das ist ein Existenznachweis geeigneter
Eingaben, keine Garantie für beliebige falsche Eingangszustände.

18 s werden vorausgeneriert, 2 s Rückraum behalten. In den Tests bleiben maximal
vier Chunks und 88 Kollisionsobjekte geladen (zulässige Sicherheitsgrenze fünf
Chunks). Partikelpool 320, Wellenpool 6, Historie 8, Sägepfade 32 und vorhandener
Hintergrundcache bleiben begrenzt. Die Musik wird beim Chunk-Wechsel nicht neu gestartet.

## Prüfwerkzeuge und Editor

`runReplay(level, taps, { proof: true })` führt dieselbe `Game`-Simulation aus.
Der optionale Nachweis enthält Level-ID, Daten-/Eingabefingerprints, relevante
Physikparameter, Startzustand, Endzustand, Simulationsschritte und Anzahl der Pulse.
Die Fingerprints sind Prüfhilfen, keine Sicherheits- oder Anti-Cheat-Signaturen.
Die JSON-Levels enthalten nach wie vor die vollständigen regulären Eingaben.

`?debug=1` bzw. `?trace=1` aktiviert zusätzlich ein lokales Todesprotokoll mit
maximal 32 Einträgen: Typ/ID, Position/Geschwindigkeit, Dimension, Simulationszeit,
Level und gegebenenfalls Chunk/Seed. Es erscheint in `render_game_to_text()`.
Ohne Debug werden keine solchen Einträge erfasst; sie werden weder gespeichert
noch übertragen. Vorhandene Hitbox-, Pulse- und FPS-Anzeigen bleiben nutzbar.

LEVEL FORGE nutzt weiterhin dieselbe Physik, Validierung und Fallenzeichnung.
Die Beschreibungen erläutern die aktuellen Pulse-Reaktionen und Abschaltdauer.
JSON bleibt Version 1, alte Levels bleiben gültig. Kanonische JSON-Dateien unter
`assets/` werden auch auf Windows mit LF ausgecheckt, damit Import/Export-Tests
keine bloßen Zeilenendenunterschiede als Inhaltsänderung melden.

Ausführliche tatsächlich ausgeführte Prüfungen und Grenzen:
[M7.7-Testbericht](M7.7-TEST-REPORT.md).
