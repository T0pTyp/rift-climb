// Spielbarkeits-Nachweis ohne Browser-Ausgabe: Spur-Solver oder Wiedergabe eines aufgezeichneten Laufs
// mit der echten Game-Klasse (gleiche Physik, gleiche Kollision, fester 240-Hz-Schritt).
// Genutzt von LEVEL FORGE (Validierung) und tests/validate-level.mjs (Deploy-Prüfung).
import { Game } from './game.js';
import { SIM_DT, CLIMB_SPEED, START_LANE, UNITS_PER_BEAT } from './config.js';
import { laneRows, START_DIMENSIONS } from './level-data.js';
import { validateLevel } from './level.js';

const noop = () => {};

function headlessGame(level) {
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
export function runReplay(level, taps) {
  const g = headlessGame(level);
  g.start('normal');
  const limit = level.finish.y / CLIMB_SPEED + 1;
  let i = 0;
  while (g.state === 'playing' && g.t < limit) {
    while (i < taps.length && taps[i].t <= g.t + SIM_DT / 2) g.press(taps[i++].dir);
    g.step(SIM_DT);
  }
  const k = g.killer;
  return {
    won: g.state === 'won',
    t: g.t,
    y: g.y,
    progress: g.progress,
    tapsUsed: i,
    killer: k ? { id: k.o.id, y: k.o.y, reason: k.reason } : null,
  };
}

/**
 * Nachweis der Durchspielbarkeit (keine Garantie für Fairness oder Spielspaß):
 *  - method 'solver': Level im Spurmodell, Spur-Solver findet eine Lösung (konservativ, ≤ 1 Tipp pro 0,5 s)
 *  - method 'replay': aufgezeichneter Lauf erreicht mit echter Physik das Ziel
 *  - method 'none': weder Spurmodell noch Aufzeichnung -> nicht nachgewiesen
 */
export function checkPlayability(level) {
  const rows = laneRows(level);
  if (rows) {
    const start = { lane: level.start ? level.start.lane : START_LANE, dim: START_DIMENSIONS[level.start && level.start.dimension] || 'B' };
    const v = validateLevel(rows, start);
    const tooLate = rows.length && rows[rows.length - 1][0] * UNITS_PER_BEAT >= level.finish.y;
    if (v.ok && !tooLate) return { method: 'solver', ok: true, message: `Spur-Solver: lösbar (${rows.length} Reihen, Musterlösung mit ${v.solution.flat().length} Tipps).`, solver: v };
    if (!level.replay) {
      return { method: 'solver', ok: false, message: `Spur-Solver: ${v.errors[0] || 'keine Lösung'}.`, solver: v, row: v.errors.length ? firstBadRow(v, rows) : null };
    }
  }
  if (level.replay) {
    const r = runReplay(level, level.replay.taps);
    if (r.won) return { method: 'replay', ok: true, message: `Aufgezeichneter Lauf (${level.replay.taps.length} Tipps) erreicht das Ziel mit echter Physik.`, replay: r };
    return {
      method: 'replay',
      ok: false,
      message: `Aufgezeichneter Lauf scheitert bei ${r.progress} %${r.killer ? ` an „${r.killer.id}“` : ''} – das Level wurde seit der Aufnahme verändert. Bitte neu durchspielen.`,
      replay: r,
    };
  }
  return { method: 'none', ok: null, message: 'Nicht nachgewiesen: freie Maße ohne aufgezeichneten Lauf. Im Playtest einmal komplett durchspielen, um den Lauf zu speichern.' };
}

function firstBadRow(v, rows) {
  const k = Math.min(v.reachable.length - 1, rows.length - 1);
  return k >= 0 ? { y: rows[k][0] * UNITS_PER_BEAT } : null;
}
