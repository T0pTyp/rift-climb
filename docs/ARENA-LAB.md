# M7.6 — Compact Arena und lokaler Gameplay-Vergleich

## Grundlage und Entscheidung

Ausgangspunkt: M7.5 auf `main`, Commit `99628ef`, mit sechs Kampagnenlevels, Infinity,
M8-Progression, PULSE ENGINE und mobilem LEVEL FORGE. Classic nutzt vier Zielspuren
mit 90 u Abstand; eine kritisch gedämpfte Feder führt die Figur zu einem Ziel. Ein
Impuls hat keine ballistische Reichweite und keinen harten Abschaltzeitpunkt. Nach
220 ms sind ungefähr 95 % der Strecke zurückgelegt; langfristig ist die Reichweite
genau der Zielabstand. Physik und Eingaben sind von der Audio-Clock unabhängig.

Eine bloße Verengung bei unverändertem 90-u-Zielschritt kann nicht zugleich deutlich
schmaler sein und zwei volle symmetrische Schritte pro Seite der Mitte anbieten:
vier Schritte beanspruchen bereits 360 u, noch ohne Randabstand. Deshalb wird **nur
in Compact** der räumliche Zielschritt halbiert. Federfrequenz, Vertikalspeed, Hitbox,
Eingabesperren, Dim-Wechsel, Pulse und alle übrigen Systeme bleiben gemeinsam.

## Gemeinsame Arena-Konfiguration

`js/arena.js` stellt unveränderliche Konfigurationen bereit. `arenaFor` fällt bei
fehlenden Angaben auf Classic zurück. Der Levelvalidator weist unbekannte Styles ab.
Es gibt weder ein global umgeschaltetes WORLD_W noch eine zweite Player-/Game-Klasse.

| Parameter | Classic | Compact |
| --- | --- | --- |
| Arena-Breite | 360 u | 216 u = 4 × (90 / 2) + 2 × 18 |
| Zielanzahl | 4 | 5 |
| Zielabstand | 90 u | 45 u |
| Zielpositionen | 45, 135, 225, 315 | 18, 63, 108, 153, 198 |
| Standardstart | Spurindex 1, x=135 | Spurindex 2, x=108 (geometrische Mitte) |
| Randabstand der Zielmitte | 45 u | 18 u |
| Spieler-Hitbox | Kreisradius 8 u | identisch |
| Federfrequenz ω | 4,744 / 0,22 ≈21,56 /s | identisch |
| Weg nach 220 ms | 85,5005 u | 42,7503 u |
| Ausgependelte Reichweite | 90 u | 45 u |
| Bei 240 Hz gemessene Spitzengeschwindigkeit | 713,905 u/s | 356,952 u/s |
| Vertikaler Aufstieg | 260 u/s | identisch |

18 u Randabstand enthält den Kollisionskreis und den sichtbaren Riftling samt
typischer Flugneigung. Die sichtbare Figur bleibt gleich groß. Glow außerhalb der
Arena wird an der Grenze geclippt. Zwei gültige gleichgerichtete Impulse führen
von x=108 zum Ziel 18 bzw. 198. Die Feder nähert sich dem Ziel kontinuierlich an;
„Rand erreicht“ heißt dieses sichere Randziel, nicht das Eindringen der Hitbox in
die gezeichnete Wand. Ein weiterer Wandtipp bleibt ein gültiger Dimensions-/Pulse-
Impuls. Wände töten nicht und stoßen nicht zurück. Compact begrenzt auch sehr schnelle
Gegenimpulse auf die sicheren Zielgrenzen, ohne eine reflektierte Geschwindigkeit.
Classic behält seine bisherige Bewegung ohne diese zusätzliche Begrenzung.

## Kamera und Steuerung

Die Pixelskalierung bleibt die Classic-Referenz `min(Displaybreite / 360, Displayhöhe / 600)`.
Nur der horizontale Offset verwendet die tatsächliche Arena-Breite. Deshalb bleiben
Figur, Fallengrößen und vertikale Sichtweite gleich; es gibt keinen Zoom auf 216 u.
Der restliche Bildschirm zeigt abgedunkelte hochwertige Turmarchitektur und zusätzliche
dekorative Außenlinien. Die leuchtenden Arena-Grenzen markieren den spielbaren Bereich.

Input verwendet unverändert das Rechteck des gesamten Game-Canvas: links → rechts,
rechts → links. Auch ein Tipp neben der schmalen Arena bewegt die Figur. Die bestehenden
200-ms-Startfreigabe und 45-ms-Doppelereignissperre bleiben unverändert. Der Arena-
Schalter befindet sich ausschließlich im Menü und verweigert Änderungen bei einem
laufenden oder pausierten Versuch. Neustart bleibt in derselben Variante.

Es gibt weiterhin genau eine hochwertige Grafik, keine Qualitätsprofile und keine
automatisch entfernten Effekte. Partikelpool und Riftling-Rastercache werden wiederverwendet.

## Eine gemeinsame Teststrecke, zwei Geometrien

`assets/lab/classic.json` und `assets/lab/compact.json` verwenden das vorhandene
Levelschema. Sie stehen außerhalb des Kampagnenindex; die sechs normalen Leveldateien
und Infinity-Chunks bleiben unverändert. `tools/author-arena-lab.mjs` enthält eine
explizite handgefertigte Phrasenliste und schreibt erst nach erfolgreicher echter Simulation.
Die Dateien lassen sich anschließend normal in Forge importieren und bearbeiten.

Beide Varianten: 40 s / 10.400 u, 120 BPM, 28 identische Richtungen und Eingabezeiten,
gleiche Musik/Abschnitte und Reihenfolge der Mechaniken:

- TURN: erste Richtungsfolgen und Seitenhindernisse.
- DIMENSIONS: blaue/rote Durchgänge, jeder Impuls verändert den Gefahrenzustand.
- PULSE: Siegel und stationäre zerstörbare Phase Saws.
- PRECISION: engere Richtungswechsel, Siegel, Sägen, Minen und Sweep Lasers im Abschluss.

Die freie Torbreite beträgt in Classic 96/84/78 u, in Compact 64/60/56 u.
Diese Sicherheitsräume sind einzeln abgestimmt, keine proportionale Skalierung aller
Hitboxen. Spieler bleibt Ø16 u; Minen-/Säge-/Projektorkörper bleiben 32 u in beiden
Varianten, Warnzeiten und Explosionsradien sind gleich. Neutrale Wandstücke enden an
den sichtbaren Toren. Die Kollision entspricht weiterhin der sichtbaren Geometrie.

Der unveränderte Pulse-Radius von 120 u erfasst einen größeren Anteil der Compact-
Arena. Er beeinflusst aber keine neutralen Wände; vertikal aufeinanderfolgende
Aufgaben bleiben auseinander. Vom Rand aus ist die gegenüberliegende Randzone nicht
pauschal erreichbar. Es gibt keine unsichtbare Balancekorrektur oder Rhythmus-Eingabekorrektur.

**A/B-Konfounder:** Classic startet wie bisher x=135, nicht geometrisch x=180. Compact
startet mittig x=108. Classic besitzt vier, Compact fünf Zielstellen; über die gesamte
Breite sind drei bzw. vier Zielwechsel nötig. Kürzere Weltwege bedeuten daher nicht
automatisch weniger Tipps oder höhere absolute Seitengeschwindigkeit. In beiden
vorgegebenen Replays sind alle 28 Eingaben relevant: Entfernen eines einzelnen Tipps
führt zum Scheitern. Eine globale Minimalzahl beliebig anderer Lösungen wurde nicht bewiesen.
Gemessene frühe Eingabetoleranz ist in Compact größer. Diese Version ermöglicht den
persönlichen Vergleich und behauptet keine identische Schwierigkeit oder höhere Beliebtheit.

## Lab-Daten im bestehenden lokalen Save

Progression bleibt der einzige Speicherdienst. Das optionale Feld `lab` wird im
bestehenden `riftclimb.ascension.v2` und dessen Backup gespeichert:

```json
{
  "lab": {
    "style": "classic",
    "feedback": null,
    "stats": {
      "classic": {"attempts":0,"best":0,"clears":0,"deaths":0,"sumProgress":0},
      "compact": {"attempts":0,"best":0,"clears":0,"deaths":0,"sumProgress":0}
    }
  }
}
```

`js/lab-stats.js` kapselt Normalisierung und Reports; die Game-Adapter melden den
ausdrücklichen Run-Typ `lab` an Progression. Der Normal-Adapter lehnt Lab-Runs ab.
Ein realer Start zählt genau einmal; Tod/Abschluss können je Run nur einmal schließen.
Reports erhöhen `sumProgress` nur um den tatsächlich neu gemessenen Peak dieses Runs.
Der Durchschnitt lautet `sumProgress / attempts` und enthält damit auch den bislang
erfassten Fortschritt abgebrochener oder gerade gestarteter Versuche. Er ist keine
Durchschnittszeit und kein erfundener historischer Wert. Reports speichern regelmäßig
und bei Abschluss/Pause/Abbruch; direktes Weiterklicken verliert kein verdientes Ergebnis.

Bestehende Saves erhalten neutrale Defaults. Fehlerhafte Felder werden begrenzt;
Backup, Storage-Fehlerwarnung und schreibgeschützte zukünftige Versionen werden vom
bestehenden Store übernommen. Das Feedback kennt nur classic/compact/equal und ist
rein lokal. Kein Voting-Service, kein Server, keine Konten oder Cloud-Synchronisierung.

Lab-Runs vergeben keine Medaillen, Achievements, Designs oder Normal-Spielzeit.
Practice und ausdrücklich isolierte Forge-Playtests verändern auch keine Lab-Statistik.
Die Menüansicht zeigt beide echten Statistiken und eine klare aktive Arena-Markierung.

## LEVEL FORGE

Optionale additive Metadaten: `"arenaStyle": "classic"` oder `"compact"`.
Fehlendes Feld bleibt Classic und wird beim Export nicht ergänzt; alle ursprünglichen
JSON-Dateien bleiben verlustfrei exportierbar. Neue Kompaktlevels verwenden dieselbe
Schema-Version 1 und gemeinsame Objekttypen.

Der Arena-Selektor liegt in den Level-Eigenschaften / mobilen Bottom Sheets. Er ändert
sichtbare Grenzen, Zielraster, Start-/Testmarker-Auswahl, Platzierungs-/Bewegungsgrenzen,
Validierung, Export und Playtest. Der Bildmaßstab bleibt als Vergleich stabil.
Platzieren in der Compact-Dekoration außerhalb der Arena setzt kein Objekt.

Beim Wechsel werden bestehende Objekte nicht skaliert oder verschoben. Ragt Geometrie
in die neue Grenze, wird die Änderung mit erklärendem Hinweis verweigert. Erst Objekte
bewusst bearbeiten oder ein leeres Testlevel erstellen. Eine Änderung verwirft einen
alten Replay-Nachweis; danach regulär neu testen. Arena und Startmetadaten sind mit
derselben Transaktion rückgängig machbar. Ein Testmarker wird in die erlaubten Ziele
begrenzt. Compact verwendet keinen unzutreffenden klassischen Vier-Spur-Solver;
ein erfolgreicher Replay/Playtest liefert den Nachweis.

## Prüfungen und Veröffentlichungsweg

Siehe [M7.6-TEST-REPORT.md](M7.6-TEST-REPORT.md). `npm test` enthält die Compact-
Physik-/Speicher-/Replayprüfungen; Browser- und Timingtests haben eigene npm-Skripte.
Die bestehenden GitHub-Pages-Jobs veröffentlichen weiterhin das vorhandene Projekt
von `main`, ohne neues Repository oder Force-Push.
