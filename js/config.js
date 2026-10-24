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
export const MAX_FRAME_DT = 0.1;

// Kollision: Hitboxen sind nie größer als die sichtbaren Formen.
export const BAR_THICKNESS = 14; // sichtbare Balkenhöhe
export const BAR_INSET_X = 3; // sichtbarer und kollidierender Seitenabstand je Balken
export const HIT_HALF_H = 5; // halbe Kollisionshöhe eines Balkens (sichtbar: 7)
export const HIT_RADIUS = 8; // Kollisionskreis des Spielers (sichtbare Figur ~22 × 25)

// Eingabe
export const START_GRACE_MS = 200; // Start-Tap zählt nicht als Impuls
export const MIN_PRESS_INTERVAL_MS = 45; // doppelt verarbeitete Touches ignorieren

// Tod und Neustart
export const DEATH_FREEZE_SEC = 0.28; // kurzer Treffer-Moment, danach Todesscreen
export const RESTART_GUARD_SEC = 0.22; // frühester Neustart-Tipp nach dem Tod
export const RESPAWN_SEC = 0.6; // Practice: Einfrieren nach Respawn
export const CHECKPOINT_EVERY_BEATS = 8;

// Kamera: Spieler bei 78 % der Höhe, mindestens 100 u Platz nach unten.
export const CAMERA_PLAYER_Y = 0.78;
export const CAMERA_MIN_BOTTOM = 100;

// Feedback
export const SWITCH_SHAKE = 0.12; // minimaler Screen-Shake beim Dimensionswechsel (0..1)
export const DEATH_SHAKE = 0.8;
export const SHAKE_PX = 8;
export const PARTICLE_CAP = 320;
export const TRAIL_LEN = 14;
export const TRAIL_SAMPLE_SEC = 1 / 60;
