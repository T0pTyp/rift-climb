// Spielbarkeits-Nachweis ohne Browser-Ausgabe: Spur-Solver oder Wiedergabe eines aufgezeichneten Laufs
// mit der echten Game-Klasse (gleiche Physik, gleiche Kollision, fester 240-Hz-Schritt).
// Genutzt von LEVEL FORGE (Validierung) und tests/validate-level.mjs (Deploy-Prüfung).
import { Game } from './game.js';
import { SIM_DT, CLIMB_SPEED, START_LANE, UNITS_PER_BEAT, MIN_PRESS_INTERVAL_MS, START_GRACE_MS, STEER_OMEGA, HIT_RADIUS, PULSE_RADIUS, PULSE_GROW_SEC } from './config.js';
import { laneRows, START_DIMENSIONS } from './level-data.js';
import { validateLevel } from './level.js';

const noop = () => {};

export function headlessGame(level) {
  return new Game({
    canvas: { getContext: () => null, width: 0, height: 0 },
    ui: { show: noop, updateHud: noop, toast: noop, showDeath: noop, showWin: noop, updateMenu: noop },
    audio: { seek: noop, sfx: noop, update: noop, suspend: noop, resume: noop },
    input: { guard: noop, ignored: 0 },
    storage: { stats: { best: 0, attempts: 0, clears: 0 }, save: noop },
    debug: {},
    level,
  });
}

/**
 * Spielt taps ([{ t, dir }], Spielzeit in s) ab Levelstart im Normalmodus ab.
 * Ein Tipp wirkt vor dem Simulationsschritt, in dem er aufgezeichnet wurde (wie im Spiel: Eingabe -> Schritt).
 */
export function runReplay(level, taps, { proof = false } = {}) {
  const legal = Array.isArray(taps) && taps.every((tap, i) =>
    Number.isFinite(tap.t) && (tap.dir === 1 || tap.dir === -1) &&
    tap.t >= START_GRACE_MS / 1000 && (!i || tap.t - taps[i - 1].t >= MIN_PRESS_INTERVAL_MS / 1000 - 1e-8));
  if (!legal) return { won: false, progress: 0, tapsUsed: 0, killer: null, error: 'Ungültige Eingabefolge (Startschutz / Mindestabstand / Richtung).' };
  const g = headlessGame(level);
  g.start('normal');
  const start = proof ? {t:g.t,x:g.player.x,y:g.y,vx:g.player.vx,lane:g.player.lane,dimension:g.player.dim} : null;
  const limit = level.finish.y / CLIMB_SPEED + 1;
  let i = 0;
  while (g.state === 'playing' && g.t < limit) {
    while (i < taps.length && taps[i].t <= g.t + SIM_DT / 2) g.press(taps[i++].dir);
    g.step(SIM_DT);
  }
  const k = g.killer;
  const result = {
    won: g.state === 'won',
    t: g.t,
    y: g.y,
    progress: g.progress,
    tapsUsed: i,
    killer: k ? { id: k.o.id, y: k.o.y, reason: k.reason } : null,
  };
  if(proof)result.proof={schema:'rift-replay-proof',version:1,levelId:level.id,levelHash:replayFingerprint(level),inputHash:replayFingerprint(taps),seed:null,
    config:{simDt:SIM_DT,climbSpeed:CLIMB_SPEED,steerOmega:STEER_OMEGA,hitRadius:HIT_RADIUS,pulseRadius:PULSE_RADIUS,pulseGrowSec:PULSE_GROW_SEC},
    start,finish:{...result,x:g.player.x,vx:g.player.vx,dimension:g.player.dim,steps:g.stats.steps,pulses:g.rift.emitted}};
  return result;
}

/** Deterministic audit fingerprint, not a security or anti-cheat signature. */
export function replayFingerprint(value) {
  let hash=2166136261;const text=JSON.stringify(value);
  for(let i=0;i<text.length;i++)hash=Math.imul(hash^text.charCodeAt(i),16777619);
  return (hash>>>0).toString(16).padStart(8,'0');
}

/**
 * Nachweis der Durchspielbarkeit (keine Garantie für Fairness oder Spielspaß):
 *  - method 'solver': Level im Spurmodell, Spur-Solver findet eine Lösung (konservativ, ≤ 1 Tipp pro 0,5 s)
 *  - method 'replay': aufgezeichneter Lauf erreicht mit echter Physik das Ziel
 *  - method 'none': weder Spurmodell noch Aufzeichnung -> nicht nachgewiesen
 */
export function checkPlayability(level) {
  // Prefer an actual simulation proof over the coarse lane abstraction.
  if (level.replay) {
    const replay = runReplay(level, level.replay.taps);
    if (replay.won) return { method: 'replay', ok: true, message: `Regulärer Lauf (${level.replay.taps.length} Tipps) erreicht 100 % mit echter Physik.`, replay };
    return { method: 'replay', ok: false, message: replay.error || `Aufgezeichneter Lauf scheitert bei ${replay.progress} %${replay.killer ? ` an „${replay.killer.id}“` : ''}. Bitte neu durchspielen.`, replay };
  }
  const rows = laneRows(level);
  if (rows) {
    const start = { lane: level.start ? level.start.lane : START_LANE, dim: START_DIMENSIONS[level.start && level.start.dimension] || 'B' };
    const v = validateLevel(rows, start);
    const tooLate = rows.length && rows[rows.length - 1][0] * UNITS_PER_BEAT >= level.finish.y;
    if (v.ok && !tooLate) return { method: 'solver', ok: true, message: `Spur-Solver: lösbar (${rows.length} Reihen, Musterlösung mit ${v.solution.flat().length} Tipps).`, solver: v };
    return { method: 'solver', ok: false, message: `Spur-Solver: ${v.errors[0] || 'keine Lösung'}.`, solver: v, row: v.errors.length ? firstBadRow(v, rows) : null };
  }
  return { method: 'none', ok: null, message: 'Nicht nachgewiesen: freie Maße ohne aufgezeichneten Lauf. Im Playtest einmal komplett durchspielen, um den Lauf zu speichern.' };
}

function firstBadRow(v, rows) {
  const k = Math.min(v.reachable.length - 1, rows.length - 1);
  return k >= 0 ? { y: rows[k][0] * UNITS_PER_BEAT } : null;
}
