// Baut den Test-Infinity-Kurs und prüft ihn mit dem echten 240-Hz-Replay.
// 10 Welt-Einheiten = 1 m (METERS_PER_UNIT). Die ersten 200 m = 2000 u bleiben locker.
import { writeFileSync } from 'node:fs';
import { CLIMB_SPEED, HIT_RADIUS, STEER_OMEGA, SIM_DT } from '../js/config.js';
import { serializeLevel, validateLevelData } from '../js/level-data.js';
import { runReplay, headlessGame } from '../js/playcheck.js';
import { makeTrap, trapPose } from '../js/traps.js';
import { METERS_PER_UNIT } from '../js/world-units.js';

const ARENA = 270;
const CENTER = [45, 135, 225];
const RELAXED_Y = 200 / METERS_PER_UNIT;
const T0 = RELAXED_Y / CLIMB_SPEED;
const GAP_EASY = 70;
const GAP_HARD = 40;
const CYCLE = 0.5 + 1.5 + 0.4;
const yOf = (t) => Math.round(t * CLIMB_SPEED);
const remain = (t) => (1 + STEER_OMEGA * t) * Math.exp(-STEER_OMEGA * t);
const wrapDeg = (d) => {
  const x = ((d + 180) % 360 + 360) % 360 - 180;
  return Math.round(Math.max(-180, Math.min(180, x)) * 100) / 100;
};
const phaseFor = (t, pos) => Math.round((((pos - t) % CYCLE + CYCLE) % CYCLE) / CYCLE * 10000) / 10000;

const objects = [];
const taps = [];

function slit(id, y, lane, gap) {
  const c = CENTER[lane], half = gap / 2, right = c + half;
  objects.push(
    { id: `${id}-l`, type: 'obstacle', x: 0, y, w: c - half, h: 14, dimension: 'both' },
    { id: `${id}-r`, type: 'obstacle', x: right, y, w: ARENA - right, h: 14, dimension: 'both' },
  );
}

const easy = [
  [1.2, 0, -1],
  [2.3, 1, 1],
  [3.4, 2, 1],
  [4.5, 1, -1],
  [5.6, 0, -1],
  [6.7, 1, 1],
  [7.5, 1, 0],
];
for (const [i, [t, lane, dir]] of easy.entries()) {
  slit(`easy-${i}`, yOf(t), lane, GAP_EASY);
  if (dir) taps.push({ t: Math.round((t - 0.5) * 1000) / 1000, dir });
}

const hardSlits = [
  [0.55, 0], [1.9, 2], [3.12, 1], [3.55, 0], [4.02, 1], [4.48, 2],
  [4.95, 1], [5.42, 0], [5.9, 1], [6.4, 2], [6.9, 1], [7.38, 0],
];
for (const [i, [t, lane]] of hardSlits.entries()) slit(`slit-${i}`, RELAXED_Y + yOf(t), lane, GAP_HARD);

const bars = [
  ['red-a', 0.95, 'red'],
  ['red-b', 1.28, 'red'],
  ['blue-a', 2.32, 'blue'],
  ['blue-b', 2.64, 'blue'],
];
for (const [id, t, dimension] of bars) {
  objects.push({ id, type: 'obstacle', x: 0, y: RELAXED_Y + yOf(t), w: ARENA, h: 14, dimension });
}

const spinLasers = [
  ['laser-r1', 0.95, 'red', 8, 4.4, 0.95, -119],
  ['laser-r2', 1.28, 'red', 236, -5.1, 1.28, 70],
  ['laser-b1', 2.32, 'blue', 8, 3.8, 0.64, -40],
  ['laser-b2', 2.64, 'blue', 236, -4.6, 0.96, 110],
];
for (const [id, t, dimension, x, spin, pos, start] of spinLasers) {
  const tNew = T0 + t;
  const startNew = wrapDeg(start + spin * (t - tNew) * 180 / Math.PI);
  objects.push({
    id, type: 'laser', x, y: RELAXED_Y + yOf(t) + 30, w: 26, h: 26, dimension, axis: 'none',
    amplitude: 0, period: 4, phase: phaseFor(tNew, pos), startAngle: startNew, endAngle: startNew,
    sweepPeriod: 3, length: 120, beamWidth: 8, warnSec: 0.5, activeSec: 1.5, offSec: 0.4, disableSec: 1, spin,
  });
}

const hardTaps = [
  [0.3, -1], [0.74, -1], [1.42, 1], [1.64, 1], [2.08, 1], [2.86, -1], [3.3, -1],
  [3.78, 1], [4.22, 1], [4.7, -1], [5.18, -1], [5.66, 1], [6.14, 1], [6.64, -1], [7.14, -1],
];
for (const [t, dir] of hardTaps) taps.push({ t: Math.round((T0 + t) * 1000) / 1000, dir });

const Yc = RELAXED_Y + yOf(7.38) + yOf(1.2);
// Four wings on one hub. Opposite wings share a color, neighbors sit 90° apart, and one spin turns the whole cross.
const MILL_SPIN = 1.8;
const MILL_LENGTH = 110;
const millPhase = phaseFor(Yc / CLIMB_SPEED, 1.15);
for (const [i, offset, dimension] of [[0, 0, 'red'], [1, 90, 'blue'], [2, 180, 'red'], [3, -90, 'blue']]) {
  const angle = wrapDeg(30 + offset);
  objects.push({
    id: `mill-${i}`, type: 'laser', x: 122, y: Yc, w: 26, h: 26, dimension, axis: 'none',
    amplitude: 0, period: 4, phase: millPhase, startAngle: angle, endAngle: angle,
    sweepPeriod: 3, length: MILL_LENGTH, beamWidth: 8, warnSec: 0.5, activeSec: 1.5, offSec: 0.4, disableSec: 1,
    spin: MILL_SPIN,
  });
}

const finishY = Yc + 240;
const level = {
  schema: 'rift-climb-level',
  version: 1,
  id: 'test-infinity',
  name: 'TEST INFINITY',
  description: 'Test: erste 200 m (10 u = 1 m, also 2000 u) mit weiten Schlitzen. Danach enge Schlitze, Blau-Blau, Rot-Rot, Drehlaser und eine Windmühle aus vier Strahlen. Kein Rekord.',
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
console.log('relaxedY', RELAXED_Y, 'T0', T0.toFixed(3), 'Yc', Yc, 'finish', finishY, 'seconds', (finishY / CLIMB_SPEED).toFixed(2));
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
    console.log('pass', y, 'm', (y * METERS_PER_UNIT).toFixed(1), 't', g.t.toFixed(3), 'x', g.player.x.toFixed(1), 'dim', g.player.dim, row.map((o) => o.id).join(','));
  }
  for (const laser of validated.level.objects.filter((o) => o.id.startsWith('mill-'))) {
    if (seen.has(laser.id) || Math.abs(g.y - laser.y) > 8) continue;
    seen.add(laser.id);
    const pose = trapPose(makeTrap(laser), g.t);
    console.log('mill', laser.id, laser.dimension, 'phase', pose.phase, 'angle', pose.angle.toFixed(2), 'x', g.player.x.toFixed(1), 'dim', g.player.dim, 'disabled', g.traps.traps.find((o) => o.id === laser.id).disabledUntil > g.t);
  }
}
if (g.state !== 'won') console.log('died', g.t.toFixed(3), g.y.toFixed(1), g.killer?.o?.id, g.player.dim, g.player.x.toFixed(1));

for (const [t, lane] of easy) {
  const lead = Math.min(...taps.filter((tap) => tap.t < t).map((tap) => t - tap.t));
  console.log('easy', t, 'lane', lane, 'lead', lead.toFixed(3), 'err', (remain(Math.max(0, lead - 13 / CLIMB_SPEED)) * 90).toFixed(2), 'safe', GAP_EASY / 2 - HIT_RADIUS);
}

if (play.won) writeFileSync('assets/test/test-infinity.json', serializeLevel(validated.level));
