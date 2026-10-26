# Official Riftling – CLASSIC BLOB

Die unveränderte `riftling_reference.png` ist die vom Nutzer ausgewählte
Konzeptgrafik. Ausschließlich CLASSIC BLOB (unten links / große Hauptillustration)
wird verwendet. Andere Konzepte wurden nicht umgesetzt.

| Datei | Verwendung |
|---|---|
| `riftling-master.png` | Referenzbasiert erzeugter transparenter Körper, 1254×1254 RGBA; Quelldatei, wird im Spiel nicht geladen |
| `body-blue.webp` | 512×512, 68.968 Bytes, Cyan-/Blau-Körper |
| `body-red.webp` | 512×512, 65.640 Bytes, gleiche Alphageometrie in Magenta/Rot |
| `eyes-blue.svg` | Zwei cyanfarbene Augen mit Glow, Vektorebene |
| `eyes-red.svg` | Identische Augengeometrie in warmem Pink |

Der Master wurde mit dem eingebauten Imagegen-Werkzeug auf Grundlage der
bereitgestellten Referenz erzeugt. Das dunkle Gesicht ist absichtlich leer:
beide Augen werden als getrennte Ebene animiert. Die Referenz wurde nicht als
rechteckiger Ausschnitt verwendet. Alle Laufzeitdateien haben echte Transparenz.

`tools/build-riftling.mjs` verpackt den Master mit Canvas/Playwright und der
gemeinsamen Palette in die beiden WebP-Dateien. Der rote Körper wird deterministisch
aus demselben Körper gefärbt; es gibt keine zweite generierte Silhouette.
Lokalen HTTP-Server starten, `BASE_URL` setzen und das Werkzeug ausführen.
Keine externen Dienste werden zur Laufzeit benötigt.

Der Renderer interpretiert das Quadrat als 64×64 Asseteinheiten mit Anker
(38,38) und 0,52 Welteinheiten je Asseteinheit. Das vollständige Bild ist
33,28 u groß; die zentrale Gelmasse ca. 23 u. Die bestehende Kollisionshitbox
bleibt ein Kreis mit Radius 8 u. Kopfzipfel, Licht und Ausläufer sind dekorativ.

`js/art/riftling.js` enthält Laden, Auflösungs-Cache und gemeinsames Zeichnen;
`riftling-anim.js` enthält ausschließlich visuelle Zustände;
`riftling-palette.js` enthält kosmetische Farben. Vorhandene M8-IDs bleiben
erhalten; ihre Texturen werden einmal aus derselben Geometrie abgeleitet.

Das Ergebnis ist ein referenzbasiertes KI-Sprite mit prozeduraler Layeranimation,
kein handgezeichneter Einzelbild-Animationsatlas. Ein professioneller Artist
kann später Texturen oder eine Gelenk-/Frameanimation ergänzen, ohne Physik oder
Kollisionsgeometrie zu ändern.
