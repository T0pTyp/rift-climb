# M8 — Infinity First

Stand: 28.10.2026. Bestehendes Repository, Ausgang `1e18082` auf main.

## Ausgang und Produktstruktur

Der vorherige Director hatte 49 sehr kurze Varianten aus Schlitz, Farbpaar,
Drehlaser und Windmühle. Die Auswahl verwendete harte Höhenstufen bei 1.500 und
3.000 m. Pulse-Siegel, Sägen und Minen kamen im aktiven Buch nicht vor. Ab
8.000 m stieg die vertikale Geschwindigkeit exponentiell ohne Obergrenze;
vorwärts gestreckte Geometrie kompensierte das nur näherungsweise. Das Menü bot
Kampagne, Sammlung, Achievements, Statistiken und einen zusätzlichen Infinity-Einstieg.

Die öffentliche Seite lädt jetzt nur Infinity-Daten, statt erst sechs Kampagnen,
Test Infinity und drei Arena-Lab-Dateien abzurufen. PLAY startet aus einer
gültigen Touch-Geste direkt einen Run. Erneutes PLAY im Menü wählt einen neuen
Seed; Retry wiederholt den aktuellen. Ein expliziter `?seed=37` macht auch PLAY
reproduzierbar. `?dev=1` öffnet die aufbewahrten Menüs, `?level=<id>` die interne
Kampagne. Compact und Arena-Auswahl bleiben verborgen. Forge ist weiterhin unter
`assets/forge/` erreichbar, jedoch nicht im öffentlichen Menü verlinkt. GitHub
Pages hat hier keine Zugriffskontrolle.

Alle sechs Leveldateien sind unverändert: First Pulse (40 s), Fractured Rhythm
(56,25 s), Overload (66,67 s), Shattered Gears (50 s), Voltage Run (60 s),
Singularity Rush (75 s). Auch Charakterassets, Player, Arena, Physik und
Kollisionsverfahren wurden nicht ersetzt. Die historischen Fortschrittsdaten,
Medaillen und fünf kosmetischen IDs bleiben gespeichert; es gibt im öffentlichen
Infinity-Erlebnis keine Freischaltmechanik. Riftling verwendet sein Originaldesign.

## Bewegung und Höhenmaß

Die kritisch gedämpfte Feder bleibt kontinuierlich und jederzeit neu steuerbar:
270 u Arena, Zielmittelpunkte 45 / 135 / 225 u, Zieländerung 90 u pro gültigem
Impuls, Radius 8 u, 240-Hz-Simulation, 45-ms-Entprellung. Ein Links-Touch bewegt
nach rechts und umgekehrt. An der äußeren Zielposition wechselt ein weiterer
gleichgerichteter Tipp weiterhin Dimension und Pulse. Keine starren Bewegungsschienen,
keine Eingabekorrektur. Nach 220 ms sind rund 85,5 u eines 90-u-Schritts erreicht;
90 u bezeichnet den asymptotischen Zielversatz, keine Teleportstrecke.

Der Aufstieg ist nun dauerhaft 260 u/s, entsprechend 26 m/s. Die vorherige
Infinity-Beschleunigung oberhalb 8.000 m entfällt ausdrücklich. Der Maßstab
`METERS_PER_UNIT=.1` bleibt identisch, daher bleiben frühere Rekorde gültig und
werden nicht umgerechnet oder gelöscht. Frühere Runs unter der alten Spätkurve
sind dadurch hinsichtlich Schwierigkeit nicht exakt vergleichbar.

| Bereich | Dauer dieses Bereichs bei 26 m/s | Gestaltung |
|---|---:|---|
| 0–150 m | 5,77 s | Weite FLOW-Aufgaben, erste neutrale Konturen nach 0,9 s |
| 150–400 m | 9,62 s | PHASE kommt allmählich hinzu |
| 400–900 m | 19,23 s | Siegel und einfache Säge-Ausweichmanöver |
| 900–1.600 m | 26,92 s | Erst einzelne Minen / Sweep Lasers, dann Kombinationen |
| 1.600–2.400 m | 30,77 s | Präzision, längere Entscheidungsfolgen |
| 2.400–3.500 m | 42,31 s | Komplexere COMBO-Aufgaben |
| ab 3.500 m | ab 134,62 s Gesamtzeit | Extreme Muster werden allmählich häufiger |

Die erste eigentliche Wegentscheidung folgt je nach FLOW-Muster ungefähr
3,5 Sekunden nach Start. Die 2,55-s-Eröffnung erlaubt auch frühe ein- und
zweifache Probetipps zu beiden Seiten ohne Tod. Das ist geometrische Sicherheit,
keine Unverwundbarkeit. Das Tutorial blockiert keine Kontakte und erscheint nur
einmal; die Bedienung bleibt in Sound & Hilfe lesbar.

## RIFT DIRECTOR und Bibliothek

`EndlessWorld` und `RiftDirector` bleiben die gemeinsame Laufzeitarchitektur.
`assets/endless/director.json` enthält 20 gestaltete Aufgaben, bestehend aus einer
Eröffnung und 19 Mustern mit je einer getrennt simulierten Spiegelvariante:
insgesamt **39 zertifizierte Chunks**. Keine Zufallsplatzierung und keine
ungeprüfte Laufzeitspiegelung. `tools/build-infinity-first.mjs` erzeugt das Buch
offline und verweigert die Ausgabe bei fehlgeschlagenen Simulationen.

| Kategorie | Aufgaben (ohne Spiegel) | erste Inhaltsstufe |
|---|---|---:|
| FLOW | opening, wide-arc, double-arc, echo, breathing-room | 0 |
| PHASE | polarity, phase-weave, color-echo | 1 |
| PULSE | gold-door, twin-seals | 2 |
| SAW | gear-drift, gear-release | 2 / 3 |
| VOLTAGE | capacitor, warning-ray, discharge | 3 / 4 |
| PRECISION | needle-turn, cross-current | 4 / 5 |
| COMBO | reactor, storm-weave, core-cascade | 5 / 6 |

Unterschiede sind Richtungsmuster, 2–8 Eingaben, Zeitabstände, Farbzustände,
Siegel, bewegte Gefahren und Kombinationen. FLOW hat weite Öffnungen; Präzision
geht bis 42 u, bei weiterhin 16 u Spielerdurchmesser. Die Figur wird nicht
verkleinert. Vorbereitete Entwürfe benötigen keine Sucharbeit während des Spiels.

Chunk-Metadaten umfassen ID, `pattern`, Spiegelkennzeichen, Kategorie, `tier`,
Anzahl Aktionen/Wechsel, `interactions`, Beat-Metadaten, Entry/Exit, Fixtures,
Replay und Zertifikat. Die alten Kategorien bleiben im Schema lesbar, neue
Stufen reichen von 0 bis 6. Forge verwendet dieselben Leveldaten, validiert
editiertes JSON, zeichnet Eingaben auf und kann Chunks neu zertifizieren.
Objektänderungen machen den semantischen Hash ungültig.

### Auswahl und Erholung

Die zentrale Konfiguration liegt in `js/infinity-balance.js`. Zwischen den
Zonengrenzen wird `smoothstep` verwendet. Neue Inhaltsstufen haben exakt an ihrer
Grenze Gewicht null und steigen innerhalb der folgenden Zone stetig an. Bei
4.400 m erreicht die kontinuierliche Schwierigkeit den festen Wert 7.

Das Gewicht berücksichtigt Inhaltsstufe, Wiederholungen in zwölf letzten
Einträgen und die vorherige Kategorie. Die letzten drei Aufgaben werden auch
über Spiegelvarianten hinweg ausgeschlossen. Nach höchstens vier Nicht-FLOW-
Chunks folgt eine einfachere FLOW-Aufgabe. Erholung verändert weder Geschwindigkeit
noch Kollisionsschutz. Ist der normale Pool erschöpft, wird ein kompatibler,
zertifizierter FLOW-Anschluss verwendet. Fehlt auch dieser, wird ein Datenfehler
gemeldet, statt ungeprüfte Geometrie einzusetzen.

Keine Stufe verkleinert später Öffnungen oder verkürzt Warnzeiten. Die Auswahl
ändert sich ab 4.400 m nicht mehr. Die sechs vorhandenen Hintergrundthemen werden
alle 32 s weiterverwendet, über vier Sekunden überblendet und mit maximal zwei
gecachten Themen vorbereitet. Riftling und alle bestehenden Effekte bleiben in
der einzigen hohen Darstellung aktiv.

### Fallen und Audio

Neue Infinity-Sägen setzen `pulseBreakable:true`: Ein passender Pulse zerstört
sie genau einmal und entfernt sofort ihre Kollision. Die bisherigen Kampagnen-
Sägen ohne dieses Feld bleiben unverändert unzerstörbar. `durable:true` bleibt
ein expliziter Schutz. Forge bietet die Eigenschaft an. Minen und Laser verwenden
weiterhin die vorhandenen Warn-, Entschärfungs- und Abschaltmechanismen.

PULSE ENGINE, gemeinsamer Transport, Blau/Rot-Überblendung und zustandslose
Infinity-Partitur bleiben erhalten. Die aktuelle Chunk-Stufe beeinflusst die
Arrangementdichte; FLOW nimmt Energie zurück. Keine Physik hängt von Audio ab.
Pause, Tod und Retry stoppen alte Quellen. Rein virtuelle Entwickler-Replays
zählen SFX, erzeugen jedoch keine Echtzeit-Audioquellen für Minuten simulierter
Eingaben. Normale Wiedergabe bleibt hörbar.

## Übergangsbeweise und Grenzen

Die Verträge enthalten kontinuierliches x/vx, Zielindex, Dimension,
Flugrichtung, Impulsstatus, Mindestfreiheit und Zustand der Fallen. Im Release-
Buch gilt Entry: x=135±1,5 u, vx=±12 u/s, Ziel 1, Blau, idle, alle drei letzten
Richtungen; Exit: x=135±0,15 u, vx=±1 u/s, Ziel 1, Blau, idle. Die jeweils
getesteten neun Kreuzkombinationen x/vx stehen im JSON. Die normalen Inputs
bringen den Körper an den Ausgang; an der Naht findet kein Reset statt.

**Nachgewiesen:** 39 × 9 reale Eintrittssimulationen, 288 einzelne
Timingvariationen ±40 ms und 39 × 38 = 1.482 geordnete Paar-Läufe. Die Eröffnung
ist ausschließlich am Runanfang zulässig. Nachbarn laufen ohne Teleports,
Kollisionsabschaltung oder Sonderfähigkeiten. Vier Seeds erreichen mit normalen
Eingaben 10.001 m und prüfen unterwegs 500 / 1.000 / 2.500 / 5.000 m.

Diese Stichproben sind keine mathematische Garantie für jeden Punkt des
kontinuierlichen Zustandsraums. Besonders freie, vom nachgewiesenen Weg abweichende
Eintritte sind nicht automatisch erfolgreich. Der Director korrigiert weder
Spielereingaben noch Dimensionen heimlich. Seed/Input-Replays und die bestehenden
Debug-Todesberichte bleiben für die Analyse solcher Stellen verfügbar.

## Lokaler Spielstand und Retry

Das vorhandene `riftclimb.ascension.v2` bleibt die einzige zentrale Speicherung.
Additiv: `endless.deaths` und `endless.tutorialSeen`. Alte Saves erhalten null
gemessene Todesfälle seit diesem Update und ein noch nicht gesehenes Tutorial;
keine erfundene historische Zahl. Rekord, Versuche, letzte Höhe und Seed bleiben
erhalten. Backup-Merging nimmt monotone Bestwerte. Speicherfehler führen zu einem
sichtbaren Sitzungshinweis. Keine Cloud-Synchronisierung.

Ein Run beginnt genau einmal; doppeltes PLAY bei bereits laufender Simulation
wird ignoriert. `finish` schließt einen Run nur einmal, Tod zählt genau einmal.
Retry setzt Spieler, Dimension, Pulse, Fallen, Partikel, Kamera, Chunks und
Audiozeit zurück. Der auslösende Kontakt fliegt nicht zusätzlich los. Eine freie
Stelle des Todesbildschirms und RETRY sind sofort bedienbar.

## Tatsächlich ausgeführte Prüfungen

- Node-Director: **20 Prüfgruppen**, 351 Eintritte, 288 Timingproben, 1.482 Paare,
  vier reguläre 10.000-m-Runs, identische Zustände bei 5/30/60/144 FPS.
- Separater deterministischer Generierungsstress: 10.002 Chunks, maximal sieben
  gleichzeitig geladen. Das ist ein technischer Test, kein zusätzlicher Spieler-Run.
- Verteilung: je Höhe 2.400 Auswahlen über 40 Seeds, bei Grenzen ±1 m sowie
  4.400/10.000 m. Keine beobachtete Änderung der Durchschnittsstufe an den sechs
  ±1-m-Grenzen. Dynamische Muster bleiben unterhalb 400 m ausgeschlossen.
- Browser: 75 Infinity-First-Prüfungen über Chromium/Pixel 7, Windows-WebKit/
  iPhone 13 und Chromium/320×568. Reale Touch-Kontakte, Pause, Tod, Retry, Reload,
  alle sechs Level-Replays, 10.000-m-Replay je Profil, neuer Chunk im mobilen
  Forge editiert, exportiert/importiert, zertifiziert, gespielt und zurückgekehrt.
- Vollständiges `npm test` erfolgreich (415 PASS-Ausgaben einschließlich der
  eingebetteten Simulationsgruppen). Zusätzlich 51 Audio-, 48 Riftling- und
  131 Archiv-/Ascension-Browserprüfungen über den expliziten Entwicklungszugang.
  Bestehende Navigationsprüfungen wurden an die neue öffentliche Struktur angepasst.
- Bestehender mobiler Forge: 50/50 Prüfungen bestanden. Unveränderter
  Develop-web-game-Client gestartet, Spielzustand und Screenshots tatsächlich
  angesehen. Das öffentliche Menü und Ergebnisbildschirme wurden ebenfalls
  visuell geprüft.
- Native rAF-Messung mit Audio, 104 s, Pixel-7-Browserprofil, keine CPU-Drosselung:
  JS Ø0,68 ms / p95 1,1 ms / p99 1,9 ms; Headless217 FPS, kein physischer
  Gerätebenchmark. Audio max27 Quellen, nach Pause0, Drift p95 13,83 ms,
  vier Neuzuordnungen. Heap-Enddifferenz ca.2,1 MB ist eine Momentaufnahme
  einschließlich Caches/GC, kein Speicherlecknachweis.

Rohberichte liegen unter ignoriertem `test-results/m8/`; der zusammengefasste
Director-Nachweis liegt in `M8-VALIDATION.json`. Der Abschlussbericht enthält
zusätzlich den endgültigen Status der vollständigen Tests und des Deployments.

### Beispiel der gemessenen Inhaltsverteilung

| Höhe | Ø Inhaltsstufe (0–6) | Anteil Chunks mit dynamischer Falle |
|---|---:|---:|
| 150 m | 0,00 | 0 % |
| 400 m | 0,51 | 0 % |
| 900 m | 1,06 | 12,5 % |
| 1.600 m | 1,56 | 36,3 % |
| 2.400 m | 2,00 | 38,9 % |
| 3.500 m | 2,57 | 52,5 % |
| 4.400 / 10.000 m | 3,11 | 58,8 % |

Die Inhaltsstufe ist kein menschlich gemessener Schwierigkeitswert. Erholung und
ältere Muster bleiben auch bei EXTREM absichtlich enthalten.

## Bekannte Grenzen und nächster Schritt

Keine physischen iPhone-/Android-Geräte getestet. Windows-WebKit stellt in diesem
Build kein Web Audio bereit; dort wurde der stille Fallback geprüft. Chromium
prüft den echten AudioContext. Keine Behauptung über Spaß, Retention oder die
Leistung echter Menschen. Sinnvoller nächster Schritt: kurze Blindtests auf echten
Telefonen, Todesstellen anhand lokaler Replays analysieren und ausschließlich
die zentrale Gewichtung bzw. einzelne Chunks nachjustieren. Keine zusätzlichen
Progressionssysteme vor dieser Rückmeldung.
