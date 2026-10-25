// Physik- und Kollisions-Tests ohne Browser. Aufruf: node tests/physics.mjs
import { springStep } from '../js/physics.js';
import { Player } from '../js/player.js';
import { ParticlePool } from '../js/particles.js';
import { laneCenter } from '../js/level.js';
import {
  STEER_OMEGA, SIM_DT, CLIMB_SPEED, HIT_HALF_H, HIT_RADIUS, BAR_THICKNESS, BEAT_SEC, LANE_W, BAR_INSET_X, MAX_FRAME_DT,
} from '../js/config.js';

let failed = 0;
let total = 0;
function check(name, cond, detail = '') {
  total++;
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  – ' + detail : ''}`);
}

function simulate(dt, duration, retarget) {
  const s = { x: 0, v: 0 };
  let target = LANE_W;
  let t = 0;
  let maxX = 0;
  while (t < duration - 1e-12) {
    const h = Math.min(dt, duration - t);
    if (retarget && t < retarget.t && t + h > retarget.t) {
      springStep(s, target, STEER_OMEGA, retarget.t - t);
      target = retarget.to;
      springStep(s, target, STEER_OMEGA, t + h - retarget.t);
    } else {
      springStep(s, target, STEER_OMEGA, h);
    }
    t += h;
    maxX = Math.max(maxX, s.x);
  }
  return { ...s, maxX };
}

// 1. Schrittweiten-Unabhängigkeit der Flugbewegung
const ref = simulate(1 / 1000, 0.3);
for (const dt of [1 / 30, 1 / 60, 1 / 144, 1 / 240]) {
  const r = simulate(dt, 0.3);
  check(`Federbewegung identisch bei dt=1/${Math.round(1 / dt)}`, Math.abs(r.x - ref.x) < 1e-9 && Math.abs(r.v - ref.v) < 1e-7, `x=${r.x.toFixed(9)} ref=${ref.x.toFixed(9)}`);
}
const ref2 = simulate(1 / 1000, 0.5, { t: 0.08, to: 0 });
const r2 = simulate(1 / 30, 0.5, { t: 0.08, to: 0 });
check('Gegen-Tipp mitten im Impuls: identisch bei 30 und 1000 Hz', Math.abs(r2.x - ref2.x) < 1e-9);

// 2. Kein Überschwingen, stetige Geschwindigkeit bei Zielwechsel
const over = simulate(1 / 240, 1.0);
check('Kein Überschwingen über die Zielspur', over.maxX <= LANE_W + 1e-9, `max=${over.maxX.toFixed(4)}`);
{
  const start = { x: 0, v: 0 };
  springStep(start, LANE_W, STEER_OMEGA, SIM_DT);
  const s = { x: 0, v: 0 };
  for (let i = 0; i < 20; i++) springStep(s, LANE_W, STEER_OMEGA, SIM_DT);
  const vBefore = s.v;
  springStep(s, 0, STEER_OMEGA, SIM_DT);
  const jump = Math.abs(s.v - vBefore);
  check('Gegen-Tipp mitten im Impuls: Geschwindigkeitsänderung pro Schritt wie bei normalem Impulsstart (kein Sprung)',
    jump <= start.v * 1.3, `Δv=${jump.toFixed(0)} u/s vs. Impulsstart ${start.v.toFixed(0)} u/s (alter Tween: ~900 u/s Sprung)`);
}

// 3. Spursicherheit innerhalb eines Beats
{
  const p = new Player();
  p.reset(1, 'B', 0);
  p.impulse(1);
  let t = 0;
  const safeDist = LANE_W / 2 + BAR_INSET_X - HIT_RADIUS;
  while (Math.abs(p.x - laneCenter(2)) > safeDist) { p.update(SIM_DT, 0); t += SIM_DT; }
  const window = BEAT_SEC - 2 * (HIT_HALF_H + HIT_RADIUS) / CLIMB_SPEED - t;
  check('Impuls ist nach < 100 ms spursicher', t < 0.1, `${(t * 1000).toFixed(0)} ms`);
  check('Tipp-Fenster bei 1-Beat-Abstand > 250 ms', window > 0.25, `${(window * 1000).toFixed(0)} ms`);
  check('Impuls wechselt Spur + Dimension', p.lane === 2 && p.dim === 'R');
  const atWall = (() => { const q = new Player(); q.reset(0, 'B', 0); const w = q.impulse(-1); return w && q.lane === 0 && q.dim === 'R'; })();
  check('Impuls gegen die Wand: nur Dimensionswechsel', atWall);
}

// 4. Kein Tunneln: Bewegung pro Simulationsschritt << Kollisionsausdehnung
{
  const s = { x: 0, v: 0 };
  let vPeak = 0;
  for (let i = 0; i < 240; i++) { springStep(s, LANE_W, STEER_OMEGA, SIM_DT); vPeak = Math.max(vPeak, Math.abs(s.v)); }
  const dy = CLIMB_SPEED * SIM_DT;
  const dx = vPeak * SIM_DT;
  const extentY = 2 * (HIT_HALF_H + HIT_RADIUS);
  check('Vertikalschritt kleiner als halbe Kollisionsausdehnung', dy < extentY / 2, `${dy.toFixed(2)} u pro Schritt vs. ${extentY} u`);
  check('Seitenschritt kleiner als Spieler-Radius', dx < HIT_RADIUS, `${dx.toFixed(2)} u pro Schritt (vPeak ${vPeak.toFixed(0)} u/s)`);
  check('Bis 250 ms: vollständige Frame-Zeit in höchstens 60 feste Schritte zerlegt', Math.ceil(MAX_FRAME_DT / SIM_DT) <= 60);
}

// 5. Hitboxen nie größer als die sichtbaren Formen
check('Hindernis-Hitbox ≤ sichtbarer Balken', 2 * HIT_HALF_H <= BAR_THICKNESS, `${2 * HIT_HALF_H} ≤ ${BAR_THICKNESS}`);
check('Spieler-Hitbox ≤ sichtbare Figur (Halbbreite 11)', HIT_RADIUS <= 11);

// 6. Partikel-Pool allokiert nicht nach
{
  const pool = new ParticlePool(64);
  const items = pool.items;
  for (let i = 0; i < 500; i++) pool.spawn(0, 0, 1, 1, 0.5, 2, '#fff');
  for (let i = 0; i < 100; i++) pool.update(1 / 60);
  check('Partikel-Pool: feste Größe, keine neuen Objekte', pool.items === items && pool.items.length === 64 && pool.count === 0);
}

console.log(`\n${total - failed}/${total} Physik-Checks bestanden`);
process.exit(failed ? 1 : 0);
