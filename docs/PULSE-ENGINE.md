# PULSE ENGINE – Architektur und Authoring

## Zuständigkeiten

- `js/game.js`, `player.js`, `physics.js`, `rift.js`: vorhandene 240-Hz-Simulation. Keine Audio-Clock wird hier als Bewegungszeit gelesen. Eingaben wirken weiterhin unmittelbar, keine Quantisierung.
- `js/pulse/timeline.js`: reine Beat-Koordinaten und vollständige Enumeration überquerter Sechzehntelgrenzen, unabhängig von Web Audio oder Darstellung.
- `js/pulse/score.js`: eigene deterministische Partitur **NEON ASCENT**. Keine Samples/Netzdienste. Eine gemeinsame Notenfolge für beide Dimensionen.
- `js/audio.js`: Clock-Abbildung, Lookahead, Synthese, getrennte Musik-/SFX-Busse, Gain-Überblendung, Quellenverwaltung und Einstellungen.
- `js/pulse/effects.js`: beobachtet Simulationszeit, liefert Beat-/Akzenthüllkurven. Randfunken und Licht sind rein visuell und liegen unter Hindernissen.
- `js/level-data.js`: geprüftes, gemeinsames Levelmodell. `forge/main.js`, `view.js`, `panels.js`: gemeinsame Partitur und Authoring, echter Game-Playtest im iframe.

## Clocks und Transport

Die vertikale Bewegung ist tatsächlich konstant: `y = t * CLIMB_SPEED`, `CLIMB_SPEED = 260`.
Somit gilt exakt `t = y / 260`, `beat = t * bpm / 60`, `y = beat * 260 * 60 / bpm`.
Seitliche Federbewegung, Wandtipps, Dimensionswechsel und Siegel beeinflussen die Steiggeschwindigkeit nicht.
Das Grid beschreibt den Zeitpunkt, an dem die Spieler-Mitte die Objekt-Mitte erreicht. Hitboxberührung kann
wegen der Ausdehnungen früher beginnen. Das Grid garantiert deshalb allein keine sichere Tippzeit.

Beim Start/Seek wird die Audiozuordnung `anchor = context.currentTime + 0.025 - simulationTime` hergestellt.
Jede Note hat den festen Termin `anchor + step * beatSeconds / 4`. Ein 25-ms-Timer plant 120 ms voraus;
Render-Frames verschieben die bereits vergebenen Termine nicht. Die 25 ms Startreserve vermeiden verspätete
Scheduling-Termine; Audiohardware, Bluetooth und Betriebssystem können zusätzliche Ausgabelatenz verursachen.
Die visuelle Timeline folgt der Simulation und ist immer ohne Ton lesbar.

Frame-Updates liefern regelmäßige Vergleichspunkte. Mehr als 55 ms Clock-Abweichung führt zu einem sanften
Stop der Musikquellen und einer neuen Audiozuordnung. Die Simulation wird dafür weder verschoben noch beschleunigt.
Verspätete Noten werden übersprungen, nie als Klick-/Drum-Lawine nachgeholt. Ein Scheduler ohne Gameplay-Heartbeat
für 250 ms stoppt und fordert Pause an. Die Hauptschleife pausiert bei laufender Partitur auch bei einem Frame-Abstand >250 ms. Ohne Audio bleibt die bestehende Begrenzung auf 100 ms Simulationsfortschritt je Frame erhalten.
Nach Start/Resume beginnt die Frame-Messung neu: Menü-/Pausezeit zählt niemals zum Lauf.

Pause, Tod, Menü und Abschluss beenden den Scheduler und stoppen alle alten Quellen einschließlich zukünftig
geplanter Starts. Ein kurzer Gain-Release vor `stop()` verhindert harte Abbrüche; `onended` trennt Knoten und
entfernt sie aus dem Set. Win-/Death-SFX beginnen erst nach dem Stop. Ein AudioContext je Spiel/Editor wird
wiederverwendet; es gibt keine Node-Erzeugung in der Renderfunktion. Neue Synth-Voices entstehen nur für Noten
und echte Aktionen. `?manual=1` deaktiviert Musik-Scheduling für beschleunigte deterministische Browsertests; die Timeline wird weiter aktualisiert.

Practice-Checkpoints enthalten bereits `t`, Spur und Dimension. Respawn setzt `t` zurück und beendet alte Quellen;
während der bestehenden 0,6-s-Respawnanimation läuft die Partitur nicht. Danach startet der Sequencer an derselben
Sechzehntelposition. Noch klingende Pad-Harmonie wird mit der verbleibenden Dauer rekonstruiert; frühere Drums
werden nicht erneut abgespielt. Oszillatorphasen/Angriffshüllkurven werden neu gestartet: ein Seek ist eine
reproduzierbare Neuinterpretation dieser Partiturposition, kein samplegenaues Zurückspulen einer Audiodatei.

## Partitur und Dimensionsmischung

Am–F–C–G, wiederkehrendes Motiv, feste Harmony pro Takt. Das Hauptlevel dauert 88 Beats / 22 Takte.
Vier gleich lange musikalische Abschnitte beginnen bei Beat 0/22/44/66 (0/11/22/33 s).
Die Viertelgrenzen bei Beat 22 und 66 liegen bewusst innerhalb eines 4/4-Takts; Taktzählung/Harmonie werden
beim Abschnittswechsel nicht zurückgesetzt. Intro: Kick, luftiger Pad und sparsamer Bass. Build: Snare,
Offbeat-Bass und Motiv. Drop: zusätzliche Hats, dichtere Bassfigur und kräftigeres Motiv. Finale: Fill und
zusätzliche hohe Gegenstimme; im letzten Beat beruhigende Akkordauflösung, danach Sieg-Fanfare.
Die bestehenden sicheren Hindernisphrasen bleiben geometrisch erhalten. Die Musik liest die gesetzten Siegel-Mitten
aus dem Laufzeit-Level: vorbereitende Snare ein Viertelbeat vorher, Akkordakzent auf der Durchquerungshöhe.
Bei frei gesetzten Siegeln wird der Akzent auf das nächste Sechzehntel gerundet. Das sind kompositorische Termine; die Musik öffnet keine Siegel.

Beide Dimensionen verwenden dieselben Step-Indizes und Akkorde. Basis: Drums, melodischer Bass, Pad und Motiv.
Blau: hohe Sinus-Stimmen, heller oberer Pad. Rot: gefilterte Sägezahn-Stimmen und tieferer Subbass.
Zwei Gain-Busse überblenden mit 25 ms Zeitkonstante (etwa 75 ms bis 95 %); Basis bleibt konsistent.
Kein Neustart und keine voneinander abweichenden Songs beim Wechsel.

Rauschpuffer wird einmal mit festem Seed erzeugt. Konservative Voice-Pegel, Master 0,55, Kompressor
(-16 dB / 8:1) und Ausgangsreserve 0,8 begrenzen die Mischung. Die getestete Standardmischung clippt nicht;
der Kompressor ist kein mathematischer Brickwall-Limiter für beliebige künftige Instrumente.

## Daten und LEVEL FORGE

Schema v1 bleibt kompatibel. Optionales `beatsPerBar` (ganze Zahl 2–7, Default 4) wird geprüft, exportiert,
autospeichert, im Playtest übernommen und per Undo/Redo behandelt. `bpm` bleibt 60–200. Positionen `x/y/w/h`
bleiben maßgeblich: BPM-Änderung verändert keine Objekte oder Flugphysik. Ein geändertes Tempo benötigt bewusstes
Neuarrangieren und erneuten Spielbarkeitsnachweis. Der bisherige Solver prüft weiterhin sein unverändertes
Spurmodell; freie Positionen benötigen wie bisher einen erfolgreichen Replay-Nachweis.

Objektfelder „Musik-Beat“ (ab 0, Schritt 0,25), „Musik-Takt“ (ab 1) und „Musikabschnitt“ setzen die echte `y`-Position.
Snap unterstützt ganze, halbe, Viertelbeats und ganze Takte. „Abschnitt“ meint die vier gleich langen
Musikphasen; ältere frei gesetzte `sections` bleiben vorhandene Gameplay-Beschriftungen. Im Hauptlevel sind beide
seit M6 deckungsgleich. Timeline zeigt Phasen, Beat-/Taktstriche, aktuelle Position und einen Positionsregler.
Vorschau startet/pausiert am Regler, Kamera folgt `y=t*260`. Die Vorschau simuliert keine seitlichen Eingaben;
der Playtest verwendet die echte Simulation. Editor-Änderung stoppt die Vorschau, um keine alte Partitur weiterzuspielen.
Mobil bleiben 70 px Timeline sichtbar, Detailfelder liegen im vorhandenen Bottom Sheet.

## Audiozugriff und Unterbrechungen

AudioContext wird erst im synchronen Gesture-Handler erzeugt/resumiert; fehlendes oder abgelehntes Audio führt
nicht zu Spielausfall. `suspended`, `interrupted`, `closed` während einer laufenden Partitur stoppen und pausieren.
`visibilitychange`/`pagehide` stoppen auch ohne Audio. Rückkehr setzt den Lauf nicht automatisch fort; „Weiter“
ist die neue Benutzeraktion und setzt die Zuordnung erneut. Das iframe wartet ebenfalls auf „Weiter“.
Das folgt dem [AudioContext-Zustandsmodell](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state)
und dem [Lookahead-Prinzip von Web Audio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Advanced_techniques).
Ein gesperrter Context kann immer durch erneute Benutzerinteraktion versucht werden; ohne Audio bleibt das Spiel steuerbar.

Einstellungen: `riftclimb.audio.v1` in localStorage mit `music`, `sfx`, `muted`. Browser mit blockiertem Speicher
verwenden Sessionwerte. Bestehende Mute-Einstellung wird übernommen. Audioeinstellungen sind global, auch im
Playtest; Spielbestleistungen und Editorentwürfe bleiben wie bisher getrennt.

## Debug und Reproduktion

`window.__RIFT.audio.status()` liefert Transport, Quellenzahl, geplante Schritte, Drift/Resyncs und SFX-Zähler.
`render_game_to_text()` liefert Position, aktive Hindernisse und musikalischen Zustand. `advanceTime(ms)` dient
mit `?manual=1` dem Skill-Testclient. Die virtuelle Zeit dieses Hooks ist nicht die Echtzeit der Audiohardware;
Driftmessungen aus beschleunigten Tests dürfen nicht als Hörlatenz ausgegeben werden.

`npm test` prüft Daten, Physik, Siegel und Audio-/Beat-Logik ohne Netzwerk oder Browser. Browserprüfungen benötigen
Playwright (nur devDependency), einen HTTP-Server und installierte Chromium-/WebKit-Browser. `npm run test:audio:e2e`
prüft Desktop/Touch, Editor und Audio-Graph und rendert den kompletten Soundtrack als WAV unter
`test-results/m6/neon-ascent.wav` mit Peak-/RMS-Messung. Ergebnisse und Hardwaregrenzen stehen im Testbericht.
