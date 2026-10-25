# ASCENSION SYSTEM — M8

M8 ergänzt die bestehende Game-Klasse um normale Run-Ergebnisse. Die drei M7-JSON-
Levels, Spielerphysik, Hitboxen, Dimensionen, Pulse-Reichweite und musikalischen
Partituren bleiben unverändert. Es gibt weiterhin genau eine hochwertige Darstellung.

## Zuständigkeiten

- `js/progression.js`: zentrale Fortschrittsdaten, Run-Lebenszyklus, Migration,
  Sicherung und ein Adapter für die vorhandene `storage.stats`-Schnittstelle.
- `js/rewards.js`: acht datengetriebene Achievements, fünf Skins und Medaillengrenzen.
- `js/ascension-ui.js`: Menüseiten, Sammlungsvorschau, Ergebnisansichten und eine
  zurückgestellte Benachrichtigungsqueue; `js/ui.js` bleibt für HUD/Overlays zuständig.
- `js/art/riftling.js`: vorhandener Renderer und Rastercache, erweitert um Skin-Ebenen.
  `RiftlingAnimator` ist für alle Designs und die Sammlung dieselbe Implementierung.
- `js/storage.js`: ausschließlich Lese-/Migrationshilfen für alte Schlüssel und
  den bestehenden Forge-Handoff. Neue Fortschritte schreibt nur Progression v2.

Die Simulation kennt weder Freischaltbedingungen noch Eigenschaften eines Skins.
Sie liefert Start, Simulationssekunden, Fortschritt und Ausgang eines Runs.
Die leichten Adapter der Headless-Replay-Prüfung bleiben ohne dauerhafte Speicherung.

## Medaillen und Erfolge

Bronze ab **50 %**, Silber ab **75 %**, Gold beim **tatsächlichen erfolgreichen
Abschluss**. Ein Prozentbericht allein verleiht nie Gold. Der Abschluss setzt
Bestwert exakt auf 100, unabhängig von numerischen Rundungen. Bestwerte und Medaillen
werden niemals durch schlechtere Runs herabgesetzt.

| Achievement-ID | Name | Bedingung in regulären Runs |
| --- | --- | --- |
| `first-flight` | First Flight | Erster gestarteter Versuch |
| `halfway-there` | Halfway There | Ein Level erreicht 50 % |
| `first-victory` | First Victory | Erster Levelabschluss |
| `pulse-master` | Pulse Master | First Pulse abgeschlossen |
| `rhythm-breaker` | Rhythm Breaker | Fractured Rhythm abgeschlossen |
| `overloaded` | Overloaded | Overload abgeschlossen |
| `golden-ascent` | Golden Ascent | Gold in First Pulse, Fractured Rhythm und Overload |
| `persistent-climber` | Persistent Climber | 25 gestartete Normalversuche |

Neue Freischaltungen erhalten einen Zeitstempel und werden nur einmal vergeben.
Nachgeholte Freischaltungen aus alten Leistungen erhalten `unlockedAt: null` und
werden als übernommen angezeigt. Eine unbekannte historische Uhrzeit wird nicht erfunden.

Die eigenen Medaillen-SVGs besitzen Metallverläufe, facettierte Rahmen, Bänder und
unterschiedliche Embleme: Bronze-Rune, Silber-Kristall und Gold-Krone. Icons der
Achievements sind eigene Vektorzeichnungen in `js/art/ui-assets.js`.

## Riftling Collection

| Skin-ID | Design | Freischaltung |
| --- | --- | --- |
| `original` | Original Riftling | Sofort verfügbar |
| `azure` | Azure Riftling | Gold in First Pulse |
| `crimson` | Crimson Riftling | Gold in Fractured Rhythm |
| `golden` | Golden Riftling | Gold in allen drei Kampagnenlevels |
| `void` | Void Riftling | Overload abgeschlossen |

Jedes neue Design besitzt zwei passende SVG-Farbsätze. Körper, Flossen, Rahmen,
Anker und Größe stammen exakt aus dem Original; hinzu kommen Farben und innere
Gravuren. Augen, Flug, Wechsel, Tod, Respawn und Pulsreaktion verwenden die bisherigen
Ebenen/Animationen. Gold erhält eine zusätzliche vorberechnete Aura. Der Rastercache
ist auf zwölf Auflösungs-/Skin-Kombinationen begrenzt; die acht neuen SVG-Dateien
werden je Skin einmal bei Bedarf geladen.

Die große Sammlungsvorschau zeigt Idle, einen seitlichen Flugimpuls und den Wechsel
zwischen beiden Dimensionen. Gesperrte Designs können betrachtet, aber nicht angelegt
werden. Auswahl, Hauptmenü-Abzeichen und Spielfigur übernehmen dasselbe Design.
HUD, Gefahrenfarben, Pulse und Dimensionsfeedback behalten ihre klaren Blau-/Rot-Regeln.

## Menüs und Wiederspielen

Das Hauptmenü bietet PLAY, RIFTLING COLLECTION, ACHIEVEMENTS, ASCENSION PROFILE und
SETTINGS. Alle drei Levels bleiben ohne Freischaltbarriere verfügbar. Karten zeigen
eigene, mit dem bestehenden Backdrop und echten Hindernisdaten gerenderte Motive,
Bestwert, höchste Medaille, Versuche, Schwierigkeit, Abschlussstatus und je einen
PLAY-/PRACTICE-Button. Längere Ansichten scrollen vertikal; keine neue Texteingabe ist nötig.

Der Todesscreen erscheint sofort nach dem Treffer. Der explizite RETRY-Button startet
unmittelbar, während die vorhandene 0,28-s-Trefferanimation im Hintergrund laufen kann.
Der bisherige kurze Schutz für einen beliebigen Tipp nach einem Tod bleibt erhalten,
damit die tödliche Eingabe nicht versehentlich sofort einen weiteren Run startet.
LEVEL SELECT und MAIN MENU sind getrennte Ziele.

Der Abschluss zeigt 100 %, Medaille, Rekord und neue Achievements/Designs. RETRY,
NEXT LEVEL und LEVEL SELECT bleiben direkt nutzbar. Nach Overload gibt es kein NEXT.
NEXT erhält den aktuellen Modus: ein Practice-Abschluss führt weiterhin in Practice.
Alle Belohnungen sind vor dem Aufbau des Ergebnisbildschirms gespeichert.

Benachrichtigungen werden bei laufendem Spiel, Respawn, Trefferanimation und Pause
zurückgestellt. Sie erscheinen nur im Menü, beim Tod oder am Ziel, nacheinander und
ohne Pointer-Ereignisse zu blockieren. Noch ausstehende Medaillen desselben Levels
werden zur höchsten zusammengefasst. Die Queue liegt nur in der Sitzung; verdiente
Leistungen und Freischaltungen sind davon unabhängig dauerhaft gespeichert.

## Speicherung, Migration und historische Lücken

Der einzige aktuelle Fortschrittsschlüssel ist **`riftclimb.ascension.v2`**.
`riftclimb.ascension.v2.backup` enthält eine zusätzliche lokale Sicherung. Beispiel:

```json
{
  "schemaVersion": 2,
  "profile": { "activePlaytimeMs": 40000, "historyIncomplete": false },
  "levels": {
    "first-pulse": {
      "id": "first-pulse", "best": 100, "attempts": 1, "clears": 1,
      "deaths": 0, "completed": true, "medal": "gold",
      "firstCompletedAt": "2026-10-25T12:00:00.000Z",
      "lastPlayedAt": "2026-10-25T11:59:20.000Z", "historyIncomplete": false
    }
  },
  "achievements": {
    "first-flight": { "unlocked": true, "unlockedAt": "2026-10-25T11:59:20.000Z" }
  },
  "cosmetics": { "selectedSkinId": "azure", "unlockedSkinIds": ["original", "azure"] }
}
```

Das ist ein verkürztes Beispiel, keine vollständige Liste aller verdienten Erfolge.
Gesamtversuche, Todesfälle und Abschlüsse werden aus den Levelzählern abgeleitet;
es gibt keine widersprüchlichen zusätzlich gepflegten Summen. Spielzeit zählt
ausschließlich vorangeschrittene Simulationssekunden berechtigter Normal-Runs.
Pausen, Menüs, Respawn-Animation und Practice zählen nicht mit.

Ein laufender Run erhält ein einmaliges Sitzungsobjekt. `begin` zählt den echten
Start; `finish` schließt dieses Objekt genau einmal. Doppelte Todes-/Abschlussaufrufe
werden sowohl vom Game-Zustand als auch von `run.closed` abgefangen. Ein Neustart
beendet den alten Run und eröffnet einen neuen. Verlassen zählt nicht als Tod.

Ein JSON-Snapshot enthält alle konsistenten Daten. Gespeichert wird bei Starts,
neuen Bestwerten/Freischaltungen, Tod, Abschluss, Pause, Verlassen und Anlegen eines
Skins; reine Spielzeit zusätzlich spätestens nach einer weiteren Simulationssekunde.
Die primäre `localStorage.setItem`-Operation ersetzt einen vollständigen Snapshot.
Die Sicherung wird anschließend aktualisiert. Bei Schreibfehlern bleiben Sitzungsdaten
spielbar und ein Hinweis erscheint. Ein abrupt beendeter Browser kann die zuletzt
noch nicht gespeicherte Spielzeit verlieren; abgeschlossene Belohnungen sind vor
Navigation geschrieben, sofern der Browser Speicherung zulässt.

Alte Schlüssel `riftclimb.pulse.v1` (`rift-main`) und `riftclimb.pulse.v1.<id>`
werden anhand stabiler IDs eingelesen. Bestwert, Versuche und Abschlüsse werden
monoton übernommen, nicht addiert. Dadurch ist die Migration wiederholbar.
Archivleistungen bleiben erhalten und zählen zu globalen Summen. Belegte 100 %
oder Abschlüsse ermöglichen Gold und passende Erfolge/Skins. Aus bloßen Versuchen
werden keine Todeszahlen berechnet. Historische Todesfälle, Spielzeit und fehlende
Zeitpunkte bleiben unbekannt; das Profil kennzeichnet die seit M8 erfassten Werte.

Fehlerhafte Felder werden einzeln normalisiert. Bei beschädigtem JSON kann die
Sicherung wiederherstellen; gültige monotone Evidenz wird aus beiden Version-2-
Snapshots zusammengeführt. Unbekannte zukünftige Versionen werden nicht überschrieben.
Die alten Quellen bleiben erhalten; nur überholte Grafikfelder werden entfernt.
Audioeinstellungen bleiben separat unter `riftclimb.audio.v1`; eine explizite neue
Audioeinstellung hat Vorrang vor einem alten Mute-Wert.

Practice verwendet keine berechtigten Run-Objekte. Forge-Playtests instanziieren
explizit **`Progression({isolated:true})`**, lesen/migrieren keinen regulären Spielstand
und schreiben weder Zähler noch Medaillen, Erfolge oder Designs. Editorentwürfe und
Audioeinstellungen behalten ihre bisherigen eigenen Speicherwege.

Alles liegt im aktuellen Browser auf dem aktuellen Gerät. Es gibt keinen Server,
keine Accounts und keine Cloud-Synchronisierung. Löschen von Browserdaten entfernt
auch die Sicherung. Prüfungen und reale Hardwaregrenzen: [M8-TEST-REPORT.md](M8-TEST-REPORT.md).
