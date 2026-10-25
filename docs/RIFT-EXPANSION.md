# RIFT EXPANSION — M7.5

## Tatsächliche Grundlage

Ausgangspunkt ist M8 auf `main` (`e6d9922`): sechs Menüseiten werden aus den vorhandenen
Ascension-Panels erweitert, die drei M7-Levels, 240-Hz-Game-Simulation, Spur-Feder,
RiftField, Practice, Riftling mit fünf Designs, PULSE ENGINE und responsiver LEVEL FORGE
bleiben bestehen. Keine zweite Physik, keine zusätzliche Speicherarchitektur und keine
neuen Skins/Achievements. Die drei ursprünglichen Leveldateien bleiben bytegleich.

## Neue Parcours

| ID | Dauer / Höhe | BPM | Impulse | Sägen / Minen / Laser / Siegel |
| --- | --- | --- | --- | --- |
| `shattered-gears` | 50 s / 13.000 u | 120 | 31 | 19 / 0 / 0 / 6 |
| `voltage-run` | 60 s / 15.600 u | 132 | 41 | 0 / 14 / 15 / 8 |
| `singularity-rush` | 75 s / 19.500 u | 144 | 99 | 21 / 19 / 20 / 30 |

Shattered Gears führt zunächst langsam pendelnde, in der anderen Dimension sichtbare
Sägen ein, dann Quer-/Längsbewegung, Pulse-Zerstörung und Siegelkombinationen. Das
Maschinenfinale verbindet diese Muster. Voltage Run führt Minen, danach Laser und
schließlich gemeinsame Warn-/Pulse-Fenster ein. Singularity Rush verbindet schnelle
Richtungsgruppen, Sägen/Siegel, Minen/Laser und alle Mechaniken im Reaktorfinale.
Es gibt keine Geschwindigkeitsänderung oder neue Finalregel. Kürzester geplanter
Eingabeabstand: 312,5 ms in Singularity Rush. Alle Werte stammen aus realen Replays.

Jeder Parcours liegt vollständig als editierbares JSON unter `assets/levels/` vor.
`tools/author-expansion.mjs gears|voltage|singularity` ist ein Offline-Authoring-Werkzeug
mit expliziten, von Hand gewählten Phrasen. Es simuliert die Eingaben vor dem Schreiben;
das Spiel erzeugt diese Kampagnen nicht beim Laden. Direkte spätere Forge-Änderungen
an den JSON-Dateien nicht versehentlich mit dem Authoring-Werkzeug überschreiben.

## Gemeinsame Fallen

`js/traps.js` enthält Normalisierung, kinematische Posen, Zustand, Reset, Snapshot,
Pulse-Interaktion und Kollision. `js/art/traps.js` zeichnet dieselben Objekte in Spiel
und Forge. Die Zeit stammt ausschließlich aus `Game.t`; Audio/Renderzeit verändert
keine Fallenkollision. Bewegung und Kollisionsprüfung laufen mit 240 Hz auch bei
5 Renderframes/s. Ein langer blinder Browserstillstand pausiert weiterhin sicher.

Reihenfolge: normale Eingabe wechselt Dimension und erzeugt eine Welle, danach
Player-Simulation, RiftField, Fallen-Pulse-Wirkung und Fallen-/statische Kollision.
Die Welle speichert ihre Dimension beim Entstehen. Ihre tatsächlich wachsende
Kreisfront muss den Körper erreichen; es gibt keine unsichtbare Sofortwirkung über
120 u. Passender Treffer entfernt die Gefahr vor der anschließenden Kollision.

- **Phase Saw:** Kreis-Hitbox mit sichtbarem Außenring und Metallzähnen, stationäre
  Rotation oder sinusförmige X-/Y-Bewegung. Passende Welle zerstört sie für den Run.
- **Pulse Mine:** einmalige Zustandsfolge idle → charging → exploding → spent.
  Eintritt in der eigenen Dimension lädt sie standardmäßig 0,7 s auf. Aktivierungsring,
  Ladeanzeige und begrenzter Explosionskreis sind sichtbar. Passende Welle entschärft
  sie dauerhaft für den Run. Nur die Explosion ist gefährlich, nicht der Minenkörper.
- **Sweep Laser:** beweglicher Projektor, sinusförmiger Winkel, Warn-/Aktiv-/Ausphase.
  Die gestrichelte Warnlinie zeigt Einschaltwinkel und vorhergesagte Einschaltposition eines bewegten Projektors; schwächere Randstrahlen markieren
  den anschließenden Schwenkbereich. Gefährlich ist die sichtbare Strahlkapsel.
  Passender Pulse deaktiviert den Projektor standardmäßig 1 s; danach beginnt eine
  vollständige neue Warnung. Bewegte Kapseln werden innerhalb jedes Simulationsschritts
  weiter unterteilt (Endpunktbewegung höchstens etwa 4 u pro Sample).

Blau/Rot bedeutet dieselbe Gefahrenregel wie bisher; inaktive Fallen bleiben transparent
sichtbar. Säge-Zerstörung, Minenwarnung/-Explosion/-Entschärfung und Laserüberlastung
haben eigene Synthese-Sounds. Alle Sounds nutzen die bestehenden Busse und Lautstärken.
Partikel verwenden den bestehenden Pool mit 320 Slots; sie liegen unter den Gefahren.
Practice speichert alle bewegungsrelevanten Fallenzeitpunkte und Zustände gemeinsam
mit Spieler, Dimension und Rift-Wellen. Volle Neustarts setzen alles zurück.

## JSON und LEVEL FORGE

Das additive Schema bleibt `rift-climb-level`, Version 1. Alte Dateien bleiben lesbar.
Gemeinsam: `id`, `type`, `x` (linke Körperkante), `y` (Mitte), `w`/`h` (gleich, 16–80 u),
`dimension` (`blue`/`red`). Radius = `w / 2`; Gradwinkel beziehen sich auf X nach rechts,
Y nach oben. Alle Dauern in Sekunden, Längen in Welt-u, Rotation in rad/s.

| Typ | Zusätzliche Daten / Grenzen |
| --- | --- |
| saw | axis none/x/y; amplitude 0–100; period 1–12; phase 0–1; spin −12…12 |
| mine | activationRadius 80–220; chargeSec 0,5–1,5; blastRadius 30–160 (≤ Aktivierung); blastSec 0,12–0,4 |
| laser | axis none/x/y; amplitude 0–80; period 1–12; phase 0–1; startAngle/endAngle −180…180; sweepPeriod 1–12; length 40–320; beamWidth 4–18; warnSec 0,5–2; activeSec 0,2–1,5; offSec 0,4–3; disableSec 0,7–2 |

Bewegungsweiten werden im Arena-Boundscheck berücksichtigt. Forge bietet diese Felder
inklusive Radius, Dimension und Bewegung im bestehenden Properties-/Bottom-Sheet.
Sichtbarkeitsprüfung beachtet auch weit ins Bild reichende Strahlen; der Pose-Cache ist
auf 128 Objekte begrenzt. Auswahl, Bewegung, quadratisches Resize, Undo, JSON und
Playtest verwenden weiterhin LevelDoc/Transactions. Kleine außen liegende Resize-Griffe
haben jetzt auch bei Mausbedienung Vorrang vor einer leeren Rahmenauswahl.

Beispiel einer exportierbaren Falle:

```json
{"id":"saw-1","type":"saw","x":111,"y":1040,"w":48,"h":48,"dimension":"blue","amplitude":25,"period":3,"phase":0,"spin":4,"axis":"x"}
```

Neue Themes: gears, voltage, singularity; Musik-IDs entsprechen den drei Level-IDs.
Metadaten, BPM, musikalische Abschnitte und Replays verwenden das bestehende Schema.
Nach Geometrie-/Zeitänderungen die Aufzeichnung neu regulär spielen und prüfen;
ein alter Replay ist kein Nachweis für eine veränderte Falle.

## RIFT INFINITY: Module und Übergänge

`assets/endless/chunks.json` enthält 20 vollständige gemeinsame Leveldefinitionen
mit regulärem Replay, tier, length, entry und exit. `js/endless.js` komponiert und
streamt sie in derselben Game-Klasse. Xorshift32 und Seed bestimmen die Modulfolge,
keine zufällige Geometrie. RETRY verwendet denselben Seed; NEUER SEED ändert ihn.
Eine Adresse `?endless=1&seed=37` öffnet den Infinity-Bereich mit diesem Seed.

Jedes Modul dauert 8 s / 2.080 u. Gemeinsamer Entry/Exit: Spurindex 1, Blau,
ausgependelte horizontale Geschwindigkeit. Die ersten 2 s sind zur Ausrichtung frei,
die letzten 2 s lassen nach den letzten geplanten Eingaben die Feder ausschwingen.
Die Ruhezone zeigt „SPUR 2 / BLAU“. Es gibt keine automatische Korrektur, Teleportation
oder Hilfseingabe. Wer anders eintritt, kann sich in der freien Zone mit normalen
Wand-/Richtungstipps ausrichten. Der Validator prüft alle acht Spur-/Dimensionsstarts
und alle 400 geordneten Modulpaare; die Langläufe benutzen durchgehend die tatsächlichen
Ausgangszustände des vorherigen Moduls. `entryTaps` ist ausschließlich ein Validator-Helfer.

| Stufe | Auswahl ab geplanter Modul-Starthöhe | Muster |
| --- | --- | --- |
| Einfach | 0 m | open-arch, left-echo, right-return, pendulum-hall, blue-stair |
| Mittel | ≥250 m | gear-bridge, gold-switch, shaft-cross, double-lock, fracture-steps |
| Schwer | ≥750 m | capacitor-walk, laser-lattice, ionic-return, charged-arches, reactor-fold |
| Sehr schwer | ≥1.500 m | core-cascade, polarity-chain, voltage-crown, rift-weave, singular-flight |

Stufen ändern sich nur am nächsten vollen Modulanfang: effektiv 416 / 832 / 1.664 m.
Das HUD zeigt die tatsächlich betretene Modulstufe. Ab Stufe 3 bleibt die Schwierigkeit
begrenzt: höchstens acht geplante Impulse je Modul, kürzester Abstand 0,5 s,
keine Beschleunigung und keine weiter schrumpfenden Korridore. Die Muster variieren.

18 s werden vorab gebaut; alte Chunks werden 520 u hinter ihrem Ende entfernt.
Jede Falle erhält den lokalen Simulations-Ursprung ihres Moduls, damit Bewegung und
Laserphase mit der einzeln geprüften Version identisch bleiben. Mutable Zustände
überleben Array-Neuaufbau beim Streamen. Weltarrays, Audio-Akzente und Debug-Replays
bleiben begrenzt. Es gibt weder Finish noch Completion-Event oder Prozentanzeige.
10 u = 1 m; HUD und Speicher nutzen dieselbe Umrechnung aus `t * 260`.

Zum Bearbeiten eines Chunks dessen `level`-Objekt als gemeinsames Level-JSON in Forge
importieren; nach Änderung wieder in das Modulbuch einsetzen und `npm run test:infinity`
ausführen. Entry-/Exit-/Längenvertrag erhalten. `tools/author-infinity.mjs` beschreibt
die 20 expliziten Phrasen als kompatible Offline-Authoring-Struktur, keine Runtime-Zufallslevel.

## Musik, Visuals und Ressourcen

Die neuen elektronischen Arrangements liegen in der bestehenden Synthese-PULSE-ENGINE:
Gears E-Moll, Voltage Cis-Moll, Singularity G-Moll mit eigenen Bass-/Lead-Motiven.
Dimensionen blenden weiterhin Spuren derselben Timeline. Infinity wiederholt gemeinsame
harmonische Phrasen und steigert die Instrumentierung bis zur gedeckelten Vollbesetzung.
Beim Chunkwechsel gibt es kein Audio-seek, keinen Context-Neustart und keinen Song-Neustart.

Gecachte Maschinenarchitektur mit rotierenden Randzahnrädern, Spulenbänke und violette
Containment-Reaktoren erweitern den bestehenden Backdrop. Infinity wechselt alle 32 s
zwischen Spire/Gears/Voltage/Singularity, bereitet die nächste Ebene vor und blendet
die letzten 4 s über. Maximal zwei Hintergrundvarianten bleiben im Cache.
Hindernisse werden darüber mit voller Lesbarkeit gezeichnet. Eine feste hohe Darstellung,
unveränderte DPR-Grenzen und gleiche Effekte auf allen Geräten; keine Qualitätsprofile.

## Speicher und M8-Verträglichkeit

Der bestehende versionierte Schlüssel `riftclimb.ascension.v2` erhält ein optionales Feld:

```json
{"endless":{"bestHeight":0,"attempts":0,"lastHeight":0,"recordAt":null,"lastSeed":null}}
```

Alte v2-Daten erhalten neutrale Defaults. Sicherung, Wiederherstellung, Quota-Fehlerhinweise
und schreibgeschützte zukünftige Versionen verwenden weiter Progression. Infinity meldet
Höhen an diesen zentralen Store; der Adapter zählt nur Endless-Versuche. Normale Statistiken,
Medaillen, Achievements, Designs und aktive Normal-Spielzeit werden dabei nicht verändert.
Auch bei sofortigem Retry bleiben Rekorde gespeichert. Daten sind lokal, keine Cloud.

Alle sechs Normallevel vergeben bestehende Prozentmedaillen und allgemeine Erfolge.
Golden Ascent und Golden Riftling behalten ausdrücklich die drei ursprünglichen IDs
First Pulse, Fractured Rhythm und Overload als Bedingung. Bereits verdiente Belohnungen
gehen nicht verloren. Practice und Forge bleiben isoliert.
