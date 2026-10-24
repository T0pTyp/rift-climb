// Rift Pulse und Rift-Siegel: Logik-Tests ohne Browser (echte Game-Klasse, Stub-Ausgabe).
// Aufruf: node tests/rift-pulse.mjs
import { Game } from '../js/game.js';
import { RiftField, pulseRadius, distToSeal } from '../js/rift.js';
import { laneCenter, validateLevel, sealReachable } from '../js/level.js';
import { laneRows, buildLevelRuntime } from '../js/level-data.js';
import { loadLevel } from './lib/levels.mjs';
import {
  PULSE_RADIUS, PULSE_GROW_SEC, SEAL_OPEN_SEC, UNITS_PER_BEAT, BEAT_SEC, CLIMB_SPEED, HIT_HALF_H, HIT_RADIUS,
  SIM_DT, WORLD_W, LANE_W, BAR_THICKNESS,
} from '../js/config.js';

let failed = 0;
let total = 0;
function check(name, cond, detail = '') {
  total++;
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  – ' + detail : ''}`);
}

const MAIN = loadLevel('rift-main');
const MAIN_RT = buildLevelRuntime(MAIN);
const getRows = () => laneRows(MAIN);
const sectionAt = (beat) => {
  let s = MAIN_RT.sections[0];
  for (const sec of MAIN_RT.sections) if (beat * UNITS_PER_BEAT >= sec.y) s = sec;
  return s;
};

const noop = () => {};
function makeGame({ rows, level, mode = 'normal', autoplay = false, offset = 0.12, lead = 0.25 } = {}) {
  const g = new Game({
    canvas: { getContext: () => ({}), width: 0, height: 0 },
    ui: { show: noop, updateHud: noop, toast: noop, showDeath: noop, showWin: noop, updateMenu: noop },
    audio: { seek: noop, sfx: noop, update: noop, suspend: noop, resume: noop },
    input: { guard: noop, ignored: 0 },
    storage: { stats: { best: 0, attempts: 0, clears: 0 }, save: noop },
    debug: { autoplay, autoplayOffset: offset, sealLead: lead, speed: 1 },
    rows,
    level: rows ? undefined : level || MAIN,
  });
  g.start(mode);
  return g;
}

/** Spielt bis Zustand != playing oder bis Zeit `until`; taps: [{t, dir}] in Spielzeit. */
function run(g, { taps = [], dt = 1 / 60, until = 60, onStep } = {}) {
  const q = taps.slice().sort((a, b) => a.t - b.t);
  while (g.state === 'playing' && g.t < until) {
    g.update(dt);
    while (q.length && q[0].t <= g.t && g.state === 'playing') g.impulse(q.shift().dir);
    if (onStep) onStep(g);
  }
  return g;
}

const sealAt = (beat, pattern = 'SSSS') => [[beat, pattern]];
const T = (beat) => beat * BEAT_SEC;

// 1. Pulse bei gültigem Dimensionswechsel, genau einer pro Impuls, Ursprung = Spielerposition
{
  const g = makeGame({ rows: sealAt(8) });
  run(g, { until: 1 });
  const before = g.rift.emitted;
  const x = g.player.x;
  const y = g.y;
  g.impulse(1);
  const p = g.rift.pulses.find((q) => q.live);
  check('[1] Gültiger Impuls erzeugt einen Rift Pulse am Spieler', g.rift.emitted === before + 1 && p && p.x === x && p.y === y && p.t0 === g.t);
  check('[1] Impuls wechselt weiterhin Spur + Dimension', g.player.lane === 2 && g.player.dim === 'R');
  g.impulse(-1);
  check('[2] Zweiter Impuls = genau ein weiterer Pulse (nie doppelt)', g.rift.emitted === before + 2);
  g.pause();
  g.impulse(1);
  check('[2] Kein Pulse außerhalb des Spiels (Pause)', g.rift.emitted === before + 2);
}

// 3. Pulse verändert nie die Flugrichtung
{
  const a = makeGame({ rows: sealAt(8) });
  const b = makeGame({ rows: sealAt(8) });
  run(a, { until: 1 }); run(b, { until: 1 });
  a.impulse(1); b.player.impulse(1);
  for (let i = 0; i < 120; i++) { a.update(1 / 240); b.player.update(1 / 240, 0); }
  check('[regel 3] Pulse beeinflusst die Flugbahn nicht', Math.abs(a.player.x - b.player.x) < 1e-9 && Math.abs(a.player.vx - b.player.vx) < 1e-9);
}

// 3./4. Reichweite: innerhalb öffnet, außerhalb bleibt zu (RiftField direkt)
{
  const mk = (lane0, lane1, beat) => ({ color: 'S', beat, y: beat * UNITS_PER_BEAT, x0: lane0 * LANE_W + 3, x1: (lane1 + 1) * LANE_W - 3, hh: BAR_THICKNESS / 2, chh: HIT_HALF_H, openSec: SEAL_OPEN_SEC });
  const seals = [mk(1, 1, 2), mk(3, 3, 2), mk(0, 3, 4)];
  const rf = new RiftField(seals);
  const y0 = 2 * UNITS_PER_BEAT - 60;
  rf.emit(laneCenter(0), y0, 0, '#fff');
  for (let t = SIM_DT; t <= PULSE_GROW_SEC + 0.05; t += SIM_DT) rf.step(t);
  check('[4] Siegel in der Nachbarspur (in Reichweite) öffnet sich', rf.isOpen(seals[0], 0.2), `d=${distToSeal(laneCenter(0), y0, seals[0]).toFixed(1)} u`);
  check('[3] Siegel drei Spuren entfernt bleibt geschlossen', !rf.isOpen(seals[1], 0.2), `d=${distToSeal(laneCenter(0), y0, seals[1]).toFixed(1)} u > ${PULSE_RADIUS}`);
  check('[3] Siegel weiter voraus (> Radius) bleibt geschlossen', !rf.isOpen(seals[2], 0.2), `d=${distToSeal(laneCenter(0), y0, seals[2]).toFixed(1)} u`);
  check('[3] Zwei Spuren entfernt ist nie erreichbar (Solver-Modell = Spiel)', !sealReachable('...S', 3, 1) && sealReachable('..S.', 2, 1) && sealReachable('S...', 0, 0));
  check('Wirkungsradius kleiner als die Spielfeldbreite', PULSE_RADIUS * 2 < WORLD_W * 0.7, `${PULSE_RADIUS} u Radius bei ${WORLD_W} u Breite`);
  check('Wellenradius wächst monoton bis zum Maximum', pulseRadius(0) === 0 && pulseRadius(PULSE_GROW_SEC / 2) < PULSE_RADIUS && pulseRadius(PULSE_GROW_SEC) === PULSE_RADIUS && pulseRadius(1) === PULSE_RADIUS);
}

// 5. Geschlossenes Siegel tötet (in beiden Dimensionen)
for (const startDimTap of [false, true]) {
  const g = makeGame({ rows: [[4, '....'], [8, 'SSSS']] });
  run(g, { taps: startDimTap ? [{ t: T(5), dir: 1 }] : [] });
  check(`[5] Geschlossenes Siegel kollidiert (Dimension ${startDimTap ? 'Rot' : 'Blau'})`,
    g.state === 'dying' && g.killer.o.color === 'S' && g.killer.o.beat === 8 && /war zu/.test(g.killer.reason), `${g.state} ${g.killer && g.killer.reason}`);
}

// 6. Geöffnetes Siegel passierbar + Zeitfenster für den Öffnungs-Tipp ermitteln
{
  const okLeads = [];
  for (let lead = 0.02; lead <= 0.7 + 1e-9; lead += 0.01) {
    const g = makeGame({ rows: sealAt(8) });
    run(g, { taps: [{ t: T(8) - lead, dir: 1 }], until: T(8) + 0.4 });
    if (g.state === 'playing') okLeads.push(+lead.toFixed(2));
  }
  const lo = Math.min(...okLeads);
  const hi = Math.max(...okLeads);
  const contiguous = okLeads.length === Math.round((hi - lo) / 0.01) + 1;
  check('[6] Geöffnetes Siegel ist gefahrlos passierbar', okLeads.includes(0.25), `Offbeat-Tipp 0,25 s vorher`);
  check('[6] Öffnungsfenster zusammenhängend und großzügig (≥ 350 ms)', contiguous && hi - lo >= 0.35, `Tipp ${(hi * 1000).toFixed(0)}–${(lo * 1000).toFixed(0)} ms vor dem Siegel`);
}

// Fairness: Leuchtet ein Siegel (in Reichweite), öffnet ein Tipp es IMMER rechtzeitig; ohne Leuchten nie.
{
  let glowFail = 0;
  let glowCount = 0;
  let darkOpened = 0;
  for (const lane of [0, 1]) {
    for (let k = 1; k <= 70; k++) {
      const g = makeGame({ rows: [[8, 'SS..']] });
      g.player.reset(lane, 'B', 0);
      const tapT = T(8) - k * 0.01;
      let glowing = false;
      run(g, { until: tapT });
      if (g.state !== 'playing') continue;
      glowing = g.rift.inReach(g.seals[0], g.player.x, g.y);
      g.impulse(lane === 0 ? 1 : -1);
      run(g, { until: T(8) + 0.4 });
      if (glowing) { glowCount++; if (g.state !== 'playing') glowFail++; }
      else if (g.seals[0].timesOpened > 0) darkOpened++;
    }
  }
  check('[fair] Jeder Tipp, während das Siegel leuchtet, öffnet es rechtzeitig', glowCount > 50 && glowFail === 0, `${glowCount} Tipp-Zeitpunkte, ${glowFail} Fehler`);
  check('[fair] Ohne Leuchten öffnet kein Tipp das Siegel (Hinweis = Regel)', darkOpened === 0);
}

// 7. Siegel schließt nach Ablauf exakt; Grenzfall: Schließen während der Berührung
{
  const g = makeGame({ rows: sealAt(8) });
  run(g, { taps: [{ t: T(8) - 0.25, dir: 1 }], until: T(8) - 0.2 });
  const s = g.seals[0];
  const until = s.openUntil;
  check('[7] Öffnungsdauer = SEAL_OPEN_SEC', Math.abs(until - s.openedAt - SEAL_OPEN_SEC) < 1e-9);
  check('[7] Zustand zeitbasiert: offen kurz vor Ablauf, zu ab Ablauf', g.rift.isOpen(s, until - 1e-6) && !g.rift.isOpen(s, until));

  // Spielerkreis berührt das Siegel im Bereich [yTouch0, yTouch1]
  const touch0 = (s.y - HIT_HALF_H - HIT_RADIUS) / CLIMB_SPEED;
  const touch1 = (s.y + HIT_HALF_H + HIT_RADIUS) / CLIMB_SPEED;
  const mid = (touch0 + touch1) / 2;
  const g2 = makeGame({ rows: sealAt(8) });
  run(g2, { until: touch0 - 0.05 });
  g2.seals[0].openUntil = mid;
  g2.seals[0].openedAt = mid - SEAL_OPEN_SEC;
  g2.seals[0].timesOpened = 1;
  run(g2, { dt: SIM_DT, until: touch1 + 0.1 });
  check('[grenzfall] Siegel schließt während der Berührung -> Kollision im selben Schritt',
    g2.state === 'dying' && Math.abs(g2.t - mid) <= SIM_DT + 1e-9 && /wieder geschlossen/.test(g2.killer.reason), `t=${g2.t.toFixed(4)} Schließen=${mid.toFixed(4)}`);
  const g3 = makeGame({ rows: sealAt(8) });
  run(g3, { until: touch0 - 0.05 });
  g3.seals[0].openUntil = touch1 + SIM_DT;
  run(g3, { dt: SIM_DT, until: touch1 + 0.1 });
  check('[grenzfall] Siegel schließt direkt nach dem Verlassen -> keine Kollision', g3.state === 'playing');
}

// 8. Normale Hindernisse werden nicht beeinflusst
{
  const g = makeGame({ rows: [[8, 'BSSR'], [12, 'WRBW']] });
  run(g, { until: T(8) - 0.3 });
  const normals = g.obstacles.filter((o) => o.color !== 'S');
  const before = normals.map((o) => [g.deadlyNow(o, 'B'), g.deadlyNow(o, 'R')].join());
  g.impulse(1);
  run(g, { until: T(8) - 0.05 });
  const after = normals.map((o) => [g.deadlyNow(o, 'B'), g.deadlyNow(o, 'R')].join());
  check('[8] Blaue/rote/weiße Hindernisse unverändert, Siegel geöffnet', before.join('|') === after.join('|') && normals.every((o) => o.openUntil === undefined) && g.rift.isOpen(g.seals[0], g.t));
}

// 9. Neustart setzt alle Siegel und Wellen zurück
{
  const g = makeGame({ rows: [[8, 'SSSS'], [12, 'SSSS']] });
  run(g, { taps: [{ t: T(8) - 0.25, dir: 1 }] });
  const opened = g.seals[0].timesOpened > 0;
  check('[9] Testlauf: erstes Siegel offen, zweites tötet', opened && g.state === 'dying' && g.killer.o.beat === 12);
  g.deathAge = 1;
  g.press(1);
  check('[9] Sofort-Neustart: alle Siegel geschlossen, keine Wellen', g.state === 'playing' && g.seals.every((s) => !g.rift.isOpen(s, g.t) && s.timesOpened === 0) && g.rift.pulses.every((p) => !p.live));
}

// 9. Practice: Respawn am Checkpoint mit konsistenten Siegel-Zuständen, danach bis 100 %
{
  const g = makeGame({ mode: 'practice', autoplay: true });
  let kills = 0;
  let inconsistent = 0;
  let lastCp = 0;
  while (g.state !== 'won' && g.t < 120) {
    g.update(1 / 60);
    if (g.state === 'playing' && g.checkpoint.beat > lastCp) {
      lastCp = g.checkpoint.beat;
      // Tod kurz nach dem Checkpoint, während ein Siegel offen sein kann
      g.update(0.2);
      if (g.state === 'playing') { g.die(g.obstacles[0]); kills++; }
      while (g.state !== 'playing' && g.state !== 'won') {
        g.update(1 / 60);
        if (g.state === 'respawn') {
          const bad = g.seals.some((s) => g.rift.isOpen(s, g.t) || s.timesOpened) || g.rift.pulses.some((p) => p.live);
          if (bad || Math.abs(g.t - g.checkpoint.t) > 1e-9) inconsistent++;
        }
      }
    }
  }
  check('[9] Practice: mehrere Respawns an Checkpoints, Siegel konsistent zurückgesetzt', kills >= 4 && inconsistent === 0, `${kills} Respawns, Checkpoint zuletzt Beat ${lastCp}`);
  check('[9] Practice: nach Respawns weiter bis 100 %', g.state === 'won' && g.progress === 100);
}

// 10. Bildratenunabhängigkeit inkl. Siegel-Öffnungszeitpunkten
{
  const sig = (dts) => {
    const g = makeGame({ autoplay: true });
    let i = 0;
    while (g.state === 'playing' && g.t < 60) g.update(dts[i++ % dts.length]);
    return { state: g.state, opens: g.seals.map((s) => `${s.beat}:${s.openedAt.toFixed(6)}:${s.timesOpened}`).join('|') };
  };
  const ref = sig([1 / 60]);
  const variants = [[1 / 30], [1 / 144], [1 / 20, 1 / 200, 1 / 61, 1 / 33, 1 / 144, 1 / 90]].map(sig);
  check('[10] Autopilot schafft 100 % bei 30/60/144 FPS und unregelmäßigen Frames', ref.state === 'won' && variants.every((v) => v.state === 'won'));
  check('[10] Siegel öffnen bei allen Bildraten im identischen Simulationsschritt', variants.every((v) => v.opens === ref.opens), `${ref.opens.split('|').length} Siegel`);
}

// 12. Level unter echten Bewegungsregeln erreichbar (verschiedene Tipp-Zeitpunkte)
{
  const v = validateLevel(getRows());
  check('[12] Solver: Level mit Siegeln lösbar', v.ok, v.errors.join(','));
  const results = [];
  for (const offset of [0.07, 0.3]) {
    // 160 ms: spätester Öffnungs-Tipp, der zusätzlich einen Spurwechsel enthält (Spursicherheit ~90 ms + Berührung)
    for (const lead of [0.16, 0.25, 0.4]) {
      const g = makeGame({ autoplay: true, offset, lead });
      run(g, { until: 60 });
      results.push(`${offset}/${lead}:${g.state}${g.killer ? '@' + g.killer.o.beat : ''}`);
    }
  }
  check('[12] Autopilot mit echter Physik: 100 % bei Tipps 70/300 ms nach der Reihe und Siegel-Tipps 160/250/400 ms davor',
    results.every((r) => r.includes(':won')), results.join(' '));
  const sealRows = getRows().filter(([, p]) => p.includes('S'));
  const sealSections = new Set(sealRows.map(([beat]) => sectionAt(beat).id));
  check('Level enthält Siegel in allen Abschnitten A–D', ['A', 'B', 'C', 'D'].every((id) => sealSections.has(id)), `${sealRows.length} Siegel-Reihen`);
}

// Sichtbarkeit: Hitbox nie größer als die sichtbare Siegel-Form
check('Siegel-Hitbox ≤ sichtbares Siegel', 2 * HIT_HALF_H <= BAR_THICKNESS);
check('Fairness-Reserve: max. Distanz -> Spieler ist vor dem Schließen durch',
  (PULSE_RADIUS + BAR_THICKNESS / 2 + HIT_HALF_H + HIT_RADIUS) / CLIMB_SPEED < PULSE_GROW_SEC + SEAL_OPEN_SEC - 0.08);

console.log(`\n${total - failed}/${total} Rift-Pulse-Checks bestanden`);
process.exit(failed ? 1 : 0);
