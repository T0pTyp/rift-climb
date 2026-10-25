# THE FIRST ASCENT — M7

M7 verwendet die vorhandene 240-Hz-Simulation, Spur-Feder, Kreis/Rechteck-Kollision,
RiftField, Riftling, PULSE ENGINE und LEVEL FORGE. Es gibt keine zweite Spielsimulation
und keine neue Engine. M1–M6 waren im Repository tatsächlich vorhanden; M7 ergänzt die
Kampagne und korrigiert die unten beschriebenen Lebenszyklus-Randfälle.

## Die drei Parcours

| Level | Dauer / Zielhöhe | Musik | Eingaben / solide Objekte / Siegel |
| --- | --- | --- | --- |
| First Pulse | 40 s / 10.400 u | 120 BPM, 80 Beats, D-Dur/B-Moll | 23 / 55 / 8 |
| Fractured Rhythm | 56,25 s / 14.625 u | 128 BPM, 120 Beats, D-Moll | 56 / 136 / 12 |
| Overload | 66,6667 s / 17.333,333333 u | 144 BPM, 160 Beats, Fis-Moll | 107 / 249 / 21 |

Die Objektzahl schließt Siegel ein, Hinweise aus. Alle Level starten in Spur 1
(nullbasiert) und Blau. Alle drei sind sofort auswählbar; es gibt keine Freischaltungen.
Die Dauer folgt exakt aus `finish.y / 260`, unabhängig von Musik und Display-Bildrate.

### First Pulse — Einfach

- **0–8 s / AWAKENING:** breite Zwei-Spur-Öffnungen, ruhige Richtungswechsel im
  Zwei-Sekunden-Abstand; kurze Hinweise im Spielfeld statt Tutorialfenster.
- **8–18 s / COLORWAYS:** einzelne blaue und rote Membranen. Der Impuls verändert
  die Flugbahn und die aktive Farbe, die inaktiven Hindernisse bleiben gestrichelt sichtbar.
- **18–28 s / GOLDEN ECHO:** isolierte Goldtore mit 0,75–0,8 s Öffnungsdauer,
  reichlich Erholungszeit und dem bestehenden Pulse-Reichweitenfeedback.
- **28–40 s / FIRST ASCENT:** bekannte Farb- und Goldregeln in einer ruhigeren
  Ein-Sekunden-Kadenz, danach klare freie Auslaufzone und Ziellinie.

Dunkle Turmpaneele, Cyan-Energieschlitze und violette Gegenlichter bilden die
Architektur. Die originale Komposition verwendet D–Bm–G–A, ein helles wiederkehrendes
Motiv, einfache Anfangsdrums und zunehmende Bass-/Synth-Instrumentierung.

### Fractured Rhythm — Mittel

- **0–11,25 s / SHARDLINE:** erkennbare seitliche Bögen und Richtungsumkehrungen.
- **11,25–25,3125 s / CROSSCURRENT:** wechselnde Farbantworten auf der geplanten
  Flugbahn; kleinere zeitliche Reserven ohne neue Steuerungsregeln.
- **25,3125–42,1875 s / PULSE CASCADE:** Siegel mit 0,6 s Öffnung, Farbhindernisse
  und aufeinanderfolgende Entscheidungen über mehrere Spuren.
- **42,1875–56,25 s / REFRACTION:** schnelle Ein-Beat-Dreierfolgen mit bewussten
  Atempausen, wiedererkennbare Gold-/Farbrückwege und Schlussauflösung.

Gebrochene Träger, schwebende Polygonfragmente, blaue Leuchtkanten und magentafarbene
Verbindungen erweitern die Turmarchitektur. Dm–Bb–F–C, eine rhythmische Basslinie,
Synkopen und eine eigene Leadfigur geben dem Level seine Synthwave-Identität.

### Overload — Schwer

- **0–13,3333 s / IGNITION:** schneller Einstieg mit präzisen, bekannten Manövern.
- **13,3333–30 s / POLARITY:** gezielte Wand-Tipps ändern die Farbe ohne Spurwechsel;
  Farbmembranen verlangen geplante Folgen statt bloßer Links/Rechts-Automatik.
- **30–46,6667 s / GOLD CIRCUIT:** Goldketten mit regulären 0,5 s Öffnungsfenstern,
  Wechsel über mehrere Spuren und punktierte 1,5-Beat-Phrasen.
- **46,6667–60 s / OVERLOAD SEQUENCE:** wiederkehrende Vierercluster im
  Dreiviertelbeat-Abstand (312,5 ms) mit Erholungspausen; keine Beschleunigung.
- **60–66,6667 s / CORE RELEASE:** bekannte Farb-/Pulse-Kombinationen als kurze
  Schlussprüfung, kein überraschendes neues Hindernisprinzip.

Neutrale Engstellen ragen ab Abschnitt B um 8 u weiter in die Öffnungen. Die
Spielerhitbox bleibt unverändert. Hexagonale Kernringe, cyan/magentafarbene
Energiebahnen und goldene Gravuren bleiben hinter den klar konturierten Gefahren.
Fis-Moll/D/A/E, kräftigere Drums und Bass, eine eigene Melodie und eine kurze
musikalische Atempause vor der Overload-Passage führen zum dramatischen Schluss.

## Gemeinsame Daten, echte Bearbeitung

Die ausgelieferten Dateien `assets/levels/first-pulse.json`, `fractured-rhythm.json`
und `overload.json` enthalten **alle** Objekte und ihre regulären Lösungs-Replays.
Spiel, Forge, Import/Export und CI lesen dasselbe Version-1-Format. Kein Level wird
im Browser durch einen Hindernisgenerator ersetzt.

Zusätzliche optionale Metadaten:

```json
{
  "theme": "spire",
  "music": "first-pulse",
  "difficulty": "easy",
  "bpm": 120,
  "beatsPerBar": 4,
  "sections": [
    { "id": "A", "name": "AWAKENING", "y": 0, "labelY": -35 },
    { "id": "B", "name": "COLORWAYS", "y": 2080, "labelY": 2045 }
  ],
  "replay": { "taps": [{ "t": 1.75, "dir": 1 }] }
}
```

Das ist ein Metadaten-Ausschnitt, kein vollständiges Level. `theme` erlaubt `spire`,
`fracture`, `core`; `music` erlaubt die drei Kampagnen-IDs sowie `neon-ascent`;
`difficulty` erlaubt `easy`, `medium`, `hard`. Alte Dateien ohne diese Felder behalten
ihre bisherige Darstellung, Musik und Exportstruktur. Die Objekte bleiben freie
Rechtecke mit `x`, `y`, `w`, `h`, `dimension` bzw. `openSec` wie in der README beschrieben.

Forge bietet diese Metadaten, BPM, Abschnittsnamen/-grenzen und alle Objektparameter
in den bestehenden Eigenschaften an, mobil im Bottom Sheet. Beat-Raster und kompakte
Timeline verwenden dieselben Abschnittsdaten; Overload zeigt fünf Abschnitte.
Ändern einer Abschnittsgrenze verschiebt keine Hindernisse. Eine BPM-Änderung
verschiebt ebenfalls keine Geometrie: das musikalische Raster verändert sich.

Playtest verwendet die aktuell bearbeiteten Daten. Rückkehr erhält Entwurf und
Undo-History. Ein erfolgreicher regulärer Playtest kann das Lösungs-Replay erneuern.
Nach jeder geometrischen Änderung prüft Forge den gespeicherten Nachweis erneut.
Ein ungültiges Replay muss neu eingespielt werden; ein früherer Sieg ist kein Beweis
für ein inzwischen geändertes Level. JSON-Import/Export und lokale Autospeicherung
bleiben die bestehenden gemeinsamen Desktop-/Mobile-Funktionen.

`tools/author-campaign.mjs` dokumentiert die explizit von Hand entworfenen Phrasen
und kann die ursprünglichen JSON-Dateien offline reproduzieren. Es wird weder vom
Spiel noch vom Editor geladen. Nicht nach manuellen Forge-Änderungen ausführen,
wenn diese erhalten bleiben sollen: die ausgelieferten JSON-Dateien sind die Quelle.

## Rhythmus ohne Einfluss auf die Steuerung

Der automatische Aufstieg ist konstant: `y = 260 × Simulationssekunden`. Damit kann
jede Hindernishöhe exakt auf einen Viertelbeat gelegt werden. Der seitliche Federflug
bleibt die echte Simulation; aus einem Beat wird kein automatischer Seitentipp.
Die Replays enthalten bewusst vorgezogene Eingaben, damit die Figur rechtzeitig
durch die musikalisch positionierte Reihe fliegt und Pulse ihre Siegel erreichen.

Alle Kompositionen laufen auf derselben M6-Timeline und demselben Web-Audio-Scheduler.
Blau mischt helle/luftige Synthesizer, Rot warme Synthesizer/Subbass. Noten und
Hauptrhythmus bleiben gemeinsam; die Busse blenden weich über. Keine zwei Songs
laufen unabhängig. Abschnittsintensität und Beat-Lichter verwenden die wirklichen
Levelphasen. Die kurze Siegfanfare passt jeweils zur Tonart. Musik und Effekte lassen
sich getrennt regeln und vollständig stummschalten. Visuelles Pulse-Feedback bleibt aktiv.

## Lebenszyklus und Ergebnisse

Ein Game-/Input-/AudioEngine-Objekt wird beim Levelwechsel weiterverwendet; alte
Musikquellen werden gestoppt. Normal-Runs starten bei 0, Practice stellt exakte
Position, Geschwindigkeit, Dimension, Spielzeit, offene Siegel und aktive Wellen
wieder her. Auch schnelle Wiederholungen speichern den normalen Bestwert; Practice
und Forge-Playtests schreiben keine regulären Rekorde.

Speicher: `riftclimb.pulse.v1.<level-id>` enthält `stats.best` (0–100), `attempts`,
`clears`. Das Archiv `rift-main` behält seinen bisherigen Schlüssel
`riftclimb.pulse.v1`. Audioeinstellungen bleiben global unter `riftclimb.audio.v1`.
Alte `gfx`-/`gfxManual`-Felder werden entfernt, andere Fortschrittsdaten erhalten.
Bei blockiertem localStorage bleiben Ergebnisse innerhalb der Sitzung verfügbar.

## Eine hochwertige Darstellung

Es gibt keine Grafikprofile, keinen Auswahlknopf und keine Geräte-/FPS-Automatik.
Beide gecachten Parallax-Ebenen, 26 Fragmente, volle Neonbeleuchtung, Riftling,
Schweifkern und der feste 320-Partikel-Pool sind immer aktiv. Der gleiche feste
DPR-Grenzwert 2,5 gilt auf allen Geräten. Alte Grafikparameter ändern nichts.

Optimiert werden technische Kosten: Farbverlauf/Vignette und Architektur werden
vorgerastert, Partikel und Schweif wiederverwendet, unsichtbare Reihen per binärer
Suche ausgeschnitten. Ein Abschluss zeigt expandierende Neonringe, Goldfunken,
Riftling-Animation, 100 % und Ergebnisanzeige. Effekte bleiben hinter Hindernissen.

Bildraten bis 5 FPS werden vollständig in festen 240-Hz-Schritten simuliert.
Ein einzelner blinder Frame über 250 ms pausiert den aktiven Run, auch ohne Audio.
Die Hardware darf die Darstellung verlangsamen, niemals die Spielgeschwindigkeit.
Messungen, Lösbarkeitsnachweise und echte Hardwaregrenzen: [M7-TEST-REPORT.md](M7-TEST-REPORT.md).
