import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIMB_SPEED, HIT_RADIUS, SIM_DT } from '../js/config.js';
import { validateLevelData, serializeLevel } from '../js/level-data.js';
import { headlessGame, runReplay } from '../js/playcheck.js';
import { TrapField, makeTrap, trapPose } from '../js/traps.js';

const raw = JSON.parse(readFileSync('assets/test/test-infinity.json', 'utf8'));
const validated = validateLevelData(raw);
assert.equal(validated.ok, true, validated.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
const level = validated.level;
assert.equal(serializeLevel(level), readFileSync('assets/test/test-infinity.json', 'utf8'));
const taps = level.replay.taps;
const obstacles = level.objects.filter((o) => o.type === 'obstacle');
const lasers = level.objects.filter((o) => o.type === 'laser');
const rows = [...new Set(obstacles.map((o) => o.y))].sort((a, b) => a - b);

assert.equal(level.id, 'test-infinity');
assert.equal(level.arenaStyle, 'narrow');
assert.equal(level.start.lane, 1);
assert.equal(level.start.dimension, 'blue');
assert.deepEqual([...new Set(level.objects.map((o) => o.type))].sort(), ['laser', 'obstacle']);
assert.equal(lasers.length, 4);
assert.equal(lasers.filter((o) => o.dimension === 'blue').length, 2);
assert.equal(lasers.filter((o) => o.dimension === 'red').length, 2);
assert.ok(lasers.every((o) => Number.isFinite(o.spin) && o.spin !== 0 && Math.abs(o.spin) >= 3 && Math.abs(o.spin) <= 12));
assert.ok(!JSON.parse(readFileSync('assets/levels/index.json', 'utf8')).levels.some((l) => l.id === 'test-infinity'));

const html = readFileSync('index.html', 'utf8');
const main = readFileSync('js/main.js', 'utf8');
const lab = html.slice(html.indexOf('<button id="nav-lab"'), html.indexOf('>', html.indexOf('<button id="nav-lab"')));
const testNav = html.slice(html.indexOf('<button id="nav-test-infinity"'), html.indexOf('>', html.indexOf('<button id="nav-test-infinity"')));
assert.match(lab, /(?:^|\s)hidden(?:\s|$)/);
assert.doesNotMatch(testNav, /(?:^|\s)hidden(?:\s|$)/);
assert.match(html, /id="nav-test-infinity"[\s\S]{0,180}TEST INFINITY/);
assert.match(html, /id="btn-test-infinity-start"[\s\S]{0,80}TEST INFINITY STARTEN/);
assert.match(html, /id="page-test-infinity"/);
const handler = main.slice(main.indexOf('onTestInfinity'), main.indexOf('onTestInfinity') + 520);
assert.match(handler, /start\('normal'\)/);
assert.match(handler, /save\(\)\{\}/);
assert.doesNotMatch(handler, /startEndless|infinityStorage|setLabStyle/);

let warned = 0;
for (const laser of lasers) {
  const o = makeTrap(laser);
  let sawWarning = false;
  let prev = trapPose(o, 0.02);
  for (let t = 0.04; t <= 3; t += 0.02) {
    const pose = trapPose(o, t);
    assert.ok(Math.abs((pose.angle - prev.angle) / 0.02 - laser.spin) < 1e-6, laser.id);
    if (pose.phase === 'warning') sawWarning = true;
    prev = pose;
  }
  assert.equal(sawWarning, true, laser.id);
  warned++;
  const turn = Math.PI / Math.abs(laser.spin);
  let t = null;
  for (let s = 0.05; s < 4; s += 0.01) {
    if (trapPose(o, s).phase === 'active' && trapPose(o, s + turn).phase === 'active') { t = s; break; }
  }
  assert.ok(t != null, laser.id);
  const beam = trapPose(o, t);
  const rider = { x: (beam.x + beam.endX) / 2, y: (beam.y + beam.endY) / 2, dim: o.color };
  const live = makeTrap(laser);
  assert.equal(new TrapField([live]).step(t, SIM_DT, rider, rider.x, rider.y, []), live);
  const ghost = { ...rider, dim: o.color === 'B' ? 'R' : 'B' };
  assert.equal(new TrapField([makeTrap(laser)]).step(t, SIM_DT, ghost, ghost.x, ghost.y, []), null);
  assert.equal(new TrapField([makeTrap(laser)]).step(t + turn, SIM_DT, rider, rider.x, rider.y, []), null);
}
assert.equal(warned, 4);

const chh = 5;
function trace(list) {
  const g = headlessGame(level);
  g.start('normal');
  let i = 0;
  const band = new Map();
  while (g.state === 'playing' && g.t < level.finish.y / CLIMB_SPEED + 0.2) {
    while (i < list.length && list[i].t <= g.t + SIM_DT / 2) g.press(list[i++].dir);
    g.step(SIM_DT);
    for (const y of rows) {
      if (Math.abs(g.y - y) > chh + HIT_RADIUS) continue;
      const rec = band.get(y) || { min: Infinity, max: -Infinity, dims: new Set() };
      rec.min = Math.min(rec.min, g.player.x);
      rec.max = Math.max(rec.max, g.player.x);
      rec.dims.add(g.player.dim);
      band.set(y, rec);
    }
  }
  return { state: g.state, killer: g.killer?.o?.id || null, band };
}

let slits = 0;
let worst = Infinity;
for (const y of rows) {
  const row = obstacles.filter((o) => o.y === y && o.dimension === 'both');
  if (row.length !== 2) continue;
  const left = row.find((o) => o.x === 0);
  const right = row.find((o) => o.x > 0);
  const gap = right.x - left.w;
  assert.equal(gap, 40);
  assert.ok(gap / 2 - HIT_RADIUS >= 12);
  slits++;
}
assert.ok(slits >= 8);
const opening = trace(taps);
assert.equal(opening.state, 'won');
for (const y of rows) {
  const row = obstacles.filter((o) => o.y === y && o.dimension === 'both');
  if (row.length !== 2) continue;
  const left = row.find((o) => o.x === 0);
  const right = row.find((o) => o.x > 0);
  const rec = opening.band.get(y);
  const clear = Math.min(rec.min - left.w - HIT_RADIUS, right.x - HIT_RADIUS - rec.max);
  worst = Math.min(worst, clear);
  assert.ok(clear >= 3, `Schlitz y ${y} frei ${clear}`);
}
assert.ok(rows[0] / CLIMB_SPEED < 0.7 && rows[0] / CLIMB_SPEED > 0.4);
for (let i = 1; i < rows.length; i++) assert.ok((rows[i] - rows[i - 1]) / CLIMB_SPEED <= 0.65);

const reds = obstacles.filter((o) => o.dimension === 'red').sort((a, b) => a.y - b.y);
const blues = obstacles.filter((o) => o.dimension === 'blue').sort((a, b) => a.y - b.y);
assert.deepEqual(reds.map((o) => o.id), ['red-a', 'red-b']);
assert.deepEqual(blues.map((o) => o.id), ['blue-a', 'blue-b']);
assert.deepEqual([...opening.band.get(reds[0].y).dims], ['B']);
assert.deepEqual([...opening.band.get(blues[0].y).dims], ['R']);

const drop = (t) => taps.filter((tap) => tap.t !== t);
const add = (t, dir) => [...taps, { t, dir }].sort((a, b) => a.t - b.t);
assert.equal(runReplay(level, drop(0.74)).killer.id, 'red-a');
assert.equal(runReplay(level, add(1.1, -1)).killer.id, 'red-b');
assert.equal(runReplay(level, drop(2.08)).killer.id, 'blue-a');
assert.equal(runReplay(level, add(2.48, 1)).killer.id, 'blue-b');
const late = taps.map((tap, i) => i ? tap : { t: 0.43, dir: tap.dir });
assert.equal(runReplay(level, late).killer.id, 'slit-0-r');
assert.equal(runReplay(level, taps).won, true);
console.log(`Test Infinity: 2+2 Laser, ${slits} Schlitze, engste Passage ${worst.toFixed(2)} u, Lauf gewinnt`);
