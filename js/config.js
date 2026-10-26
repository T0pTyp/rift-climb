// Zentrale Spielparameter. Werte und Begründungen siehe README ("Physikparameter").

// Rhythmus und Welt
export const BPM = 120;
export const BEAT_SEC = 60 / BPM;
export const UNITS_PER_BEAT = 130;
export const CLIMB_SPEED = UNITS_PER_BEAT / BEAT_SEC; // 260 u/s
export const LANES = 4;
export const LANE_W = 90;
export const WORLD_W = LANES * LANE_W;
export const START_LANE = 1;
export const START_DIM = 'B';

// Flugimpuls: kritisch gedämpfte Feder zur Zielspur. IMPULSE_MS = Zeit bis 95 % der Strecke.
export const IMPULSE_MS = 220;
export const STEER_OMEGA = 4.744 / (IMPULSE_MS / 1000);
export const TILT_PER_SPEED = 0.0011; // Neigung (rad) pro u/s Seitengeschwindigkeit
export const TILT_MAX = 0.55;

// Simulation: fester Zeitschritt, unabhängig von der Bildrate.
export const SIM_HZ = 240;
export const SIM_DT = 1 / SIM_HZ;
// Longer gaps pause the run; shorter frames consume ALL elapsed time at 240 Hz.
export const MAX_FRAME_DT = 0.25;

// Kollision: Hitboxen sind nie größer als die sichtbaren Formen.
export const BAR_THICKNESS = 14; // sichtbare Balkenhöhe
export const BAR_INSET_X = 3; // sichtbarer und kollidierender Seitenabstand je Balken
export const HIT_HALF_H = 5; // halbe Kollisionshöhe eines Balkens (sichtbar: 7)
export const HIT_RADIUS = 8; // Kollisionskreis des Spielers (sichtbare Figur ~22 × 25)

// Eingabe
export const START_GRACE_MS = 200; // Start-Tap zählt nicht als Impuls
export const MIN_PRESS_INTERVAL_MS = 45; // Entprellung nach physischer Ereigniszeit, keine Bewegungssperre

// Tod und Neustart
export const DEATH_FREEZE_SEC = 0.28; // kurzer Treffer-Moment, danach Todesscreen
export const RESTART_GUARD_SEC = 0.22; // frühester Neustart-Tipp nach dem Tod
export const RESPAWN_SEC = 0.6; // Practice: Einfrieren nach Respawn
export const CHECKPOINT_EVERY_BEATS = 8;

// Kamera: Spieler bei 78 % der Höhe, mindestens 100 u Platz nach unten.
export const CAMERA_PLAYER_Y = 0.78;
export const CAMERA_MIN_BOTTOM = 100;

// Rift Pulse: jeder gültige Impuls sendet vom Spieler eine Kreiswelle aus, die Rift-Siegel öffnet.
// 120 u = 1/3 der Spielfeldbreite: erreicht Siegel in der eigenen und der Nachbarspur (48 u seitlich),
// nie zwei Spuren entfernt (138 u). Gemessen bis zum sichtbaren Rand des Siegels.
export const PULSE_RADIUS = 120;
export const PULSE_GROW_SEC = 0.15; // Ausbreitung bis zum vollen Radius (easeOutQuad, Logik = Optik)
export const PULSE_FADE_SEC = 0.22; // nur Optik
export const PULSE_POOL = 6;
// Ein erreichtes Siegel bleibt so lange offen. Bei maximaler Entfernung (Reichweite 120 u, Öffnung nach 0,15 s)
// ist der Spieler 0,54 s nach dem Tipp vollständig durch – 0,11 s vor dem Schließen.
export const SEAL_OPEN_SEC = 0.5;
export const SEAL_WARN_SEC = 0.15; // Flackern kurz vor dem Schließen
// Solver-Annahme: Öffnungs-Tipp etwa auf dem Offbeat vor dem Siegel (halber Beat Abstand zum Siegelrand).
export const SEAL_PLAN_DY = 58;
export const SEAL_STREAK_SHAKE = 0.18; // dezenter Shake nach 3 Siegeln in Folge

// Feedback
export const SWITCH_SHAKE = 0.12; // minimaler Screen-Shake beim Dimensionswechsel (0..1)
export const DEATH_SHAKE = 0.8;
export const SHAKE_PX = 8;
export const PARTICLE_CAP = 320;
export const TRAIL_LEN = 14;
export const TRAIL_SAMPLE_SEC = 1 / 60;
