// Authors the separate Test Infinity course and proves it with the real 240 Hz replay.
import { writeFileSync } from 'node:fs';
import { CLIMB_SPEED, HIT_RADIUS, STEER_OMEGA } from '../js/config.js';
import { serializeLevel, validateLevelData } from '../js/level-data.js';
import { runReplay, headlessGame } from '../js/playcheck.js';
import { makeTrap, trapPose } from '../js/traps.js';
import { SIM_DT } from '../js/config.js';

const GAP = 40;
const ARENA = 270;
const CENTER = [45, 135, 225];
const yOf = (t) => Math.round(t * CLIMB_SPEED);
const remain = (t) => (1 + STEER_OMEGA * t) * Math.exp(-STEER_OMEGA * t);

const slits = [
  [0.55, 0],
  [1.90, 2],
  [3.12, 1],
  [3.55, 0],
  [4.02, 1],
  [4.48, 2],
  [4.95, 1],
  [5.42, 0],
  [5.90, 1],
  [6.40, 2],
  [6.90, 1],
  [7.38, 0],
];
const bars = [
  ['red-a', 0.95, 'red'],
  ['red-b', 1.28, 'red'],
  ['blue-a', 2.32, 'blue'],
  ['blue-b', 2.64, 'blue'],
];
const lasers = [
  ['laser-r1', 0.95, 'red', 8, 4.4, 0, -119],
  ['laser-r2', 1.28, 'red', 236, -5.1, 0, 70],
  ['laser-b1', 2.32, 'blue', 8, 3.8, 0.3, -40],
  ['laser-b2', 2.64, 'blue', 236, -4.6, 0.3, 110],
];
const taps = [
  { t: 0.30, dir: -1 },
  { t: 0.74, dir: -1 },
  { t: 1.42, dir: 1 },
  { t: 1.64, dir: 1 },
  { t: 2.08, dir: 1 },
  { t: 2.86, dir: -1 },
  { t: 3.30, dir: -1 },
  { t: 3.78, dir: 1 },
  { t: 4.22, dir: 1 },
  { t: 4.70, dir: -1 },
  { t: 5.18, dir: -1 },
  { t: 5.66, dir: 1 },
  { t: 6.14, dir: 1 },
  { t: 6.64, dir: -1 },
  { t: 7.14, dir: -1 },
];

const objects = [];
for (const [i, [t, lane]] of slits.entries()) {
  const y = yOf(t), c = CENTER[lane], half = GAP / 2, right = c + half;
  objects.push(
    { id: `slit-${i}-l`, type: 'obstacle', x: 0, y, w: c - half, h: 14, dimension: 'both' },
    { id: `slit-${i}-r`, type: 'obstacle', x: right, y, w: ARENA - right, h: 14, dimension: 'both' },
  );
}
for (const [id, t, dimension] of bars) {
  objects.push({ id, type: 'obstacle', x: 0, y: yOf(t), w: ARENA, h: 14, dimension });
}
for (const [id, t, dimension, x, spin, phase, startAngle] of lasers) {
  objects.push({
    id, type: 'laser', x, y: yOf(t) + 30, w: 26, h: 26, dimension, axis: 'none',
    amplitude: 0, period: 4, phase, startAngle, endAngle: startAngle, sweepPeriod: 3,
    length: 120, beamWidth: 8, warnSec: 0.5, activeSec: 1.5, offSec: 0.4, disableSec: 1, spin,
  });
}

const finishY = yOf(7.75);
const level = {
  schema: 'rift-climb-level',
  version: 1,
  id: 'test-infinity',
  name: 'TEST INFINITY',
  description: 'Separater Test: nur Laser und Blockaden. Blau-Blau, Rot-Rot, enge Schlitze, vier dauerhaft drehende Laser. Kein Infinity-Rekord.',
  bpm: 120,
  beatsPerBar: 4,
  height: finishY + 260,
  theme: 'spire',
  music: 'neon-ascent',
  difficulty: 'extreme',
  arenaStyle: 'narrow',
  start: { lane: 1, dimension: 'blue' },
  finish: { y: finishY },
  objects,
  replay: { taps, recordedAt: '2026-10-27T00:00:00.000Z' },
};

const validated = validateLevelData(level);
if (!validated.ok) {
  console.error(validated.issues.filter((i) => i.severity === 'error'));
  process.exit(1);
}
const play = runReplay(validated.level, taps);
console.log('replay', play);

const g = headlessGame(validated.level);
g.start('normal');
let i = 0;
const rows = [...new Set(validated.level.objects.filter((o) => o.type === 'obstacle').map((o) => o.y))].sort((a, b) => a - b);
const seen = new Set();
while (g.state === 'playing' && g.t < finishY / CLIMB_SPEED + 0.2) {
  while (i < taps.length && taps[i].t <= g.t + SIM_DT / 2) g.press(taps[i++].dir);
  g.step(SIM_DT);
  for (const y of rows) {
    if (seen.has(y) || g.y < y) continue;
    seen.add(y);
    const row = validated.level.objects.filter((o) => o.type === 'obstacle' && o.y === y);
    console.log('pass', y, 't', g.t.toFixed(3), 'x', g.player.x.toFixed(2), 'lane', g.player.lane, 'dim', g.player.dim, 'ids', row.map((o) => o.id + ':' + o.dimension).join(','));
  }
}
if (g.state !== 'won') console.log('died', g.t.toFixed(3), g.killer?.o?.id, g.killer?.reason, 'x', g.player.x.toFixed(2), 'dim', g.player.dim);

for (const [t, lane] of slits) {
  const lead = Math.min(...taps.filter((tap) => tap.t < t).map((tap) => t - tap.t));
  const safe = GAP / 2 - HIT_RADIUS;
  const err = remain(Math.max(0, lead - 13 / CLIMB_SPEED)) * 90;
  console.log('slit', t, 'lane', lane, 'lead', lead.toFixed(3), 'err', err.toFixed(2), 'safe', safe);
}

for (const laser of validated.level.objects.filter((o) => o.type === 'laser')) {
  const o = makeTrap(laser);
  const a = trapPose(o, 0.2), b = trapPose(o, 0.3);
  console.log(laser.id, laser.dimension, 'spin', laser.spin, 'dadt', ((b.angle - a.angle) / 0.1).toFixed(4), 'phase@pass', trapPose(o, (laser.y - 30) / CLIMB_SPEED).phase);
}

if (play.won) writeFileSync('assets/test/test-infinity.json', serializeLevel(validated.level));
