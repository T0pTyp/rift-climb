import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLIMB_SPEED, HIT_RADIUS, SIM_DT } from '../js/config.js';
import { validateLevelData, serializeLevel } from '../js/level-data.js';
import { headlessGame, runReplay } from '../js/playcheck.js';
import { TrapField, makeTrap, trapPose } from '../js/traps.js';
import { METERS_PER_UNIT, worldMeters } from '../js/world-units.js';

const RELAXED_Y = 200 / METERS_PER_UNIT;
const raw = JSON.parse(readFileSync('assets/test/test-infinity.json', 'utf8'));
const validated = validateLevelData(raw);
assert.equal(validated.ok, true, validated.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; '));
const level = validated.level;
assert.equal(serializeLevel(level), readFileSync('assets/test/test-infinity.json', 'utf8'));
const taps = level.replay.taps;
const obstacles = level.objects.filter((o) => o.type === 'obstacle');
const lasers = level.objects.filter((o) => o.type === 'laser');
const spins = lasers.filter((o) => o.id.startsWith('laser-'));
const mills = lasers.filter((o) => o.id.startsWith('mill-'));
const rows = [...new Set(obstacles.map((o) => o.y))].sort((a, b) => a - b);

assert.equal(METERS_PER_UNIT, 0.1);
assert.equal(RELAXED_Y, 2000);
assert.equal(worldMeters(RELAXED_Y), 200);
assert.equal(worldMeters(RELAXED_Y - 1), 199);
assert.equal(level.id, 'test-infinity');
assert.equal(level.arenaStyle, 'narrow');
assert.equal(level.start.lane, 1);
assert.equal(level.start.dimension, 'blue');
assert.ok(level.finish.y / CLIMB_SPEED > 16);
assert.ok(worldMeters(level.finish.y) > 400);
assert.deepEqual([...new Set(level.objects.map((o) => o.type))].sort(), ['laser', 'obstacle']);
assert.ok(!JSON.parse(readFileSync('assets/levels/index.json', 'utf8')).levels.some((l) => l.id === 'test-infinity'));

const early = obstacles.filter((o) => o.y < RELAXED_Y);
assert.ok(early.length >= 8);
assert.ok(early.every((o) => o.dimension === 'both'));
assert.ok(lasers.every((o) => o.y >= RELAXED_Y));
assert.equal(spins.length, 4);
assert.equal(spins.filter((o) => o.dimension === 'blue').length, 2);
assert.equal(spins.filter((o) => o.dimension === 'red').length, 2);
assert.ok(spins.every((o) => Math.abs(o.spin) >= 3 && Math.abs(o.spin) <= 12));
assert.deepEqual(mills.map((o) => o.id), ['mill-0', 'mill-1', 'mill-2', 'mill-3']);
assert.equal(mills.filter((o) => o.dimension === 'red').length, 2);
assert.equal(mills.filter((o) => o.dimension === 'blue').length, 2);
assert.equal(new Set(mills.map((o) => o.x)).size, 1);
assert.equal(new Set(mills.map((o) => o.y)).size, 1);
assert.equal(new Set(mills.map((o) => o.spin)).size, 1);
assert.equal(new Set(mills.map((o) => o.phase)).size, 1);
assert.ok(mills.every((o) => o.length >= 90));

const html = readFileSync('index.html', 'utf8');
const main = readFileSync('js/main.js', 'utf8');
const lab = html.slice(html.indexOf('<button id="nav-lab"'), html.indexOf('>', html.indexOf('<button id="nav-lab"')));
const testNav = html.slice(html.indexOf('<button id="nav-test-infinity"'), html.indexOf('>', html.indexOf('<button id="nav-test-infinity"')));
assert.match(lab, /(?:^|\s)hidden(?:\s|$)/);
assert.doesNotMatch(testNav, /(?:^|\s)hidden(?:\s|$)/);
assert.match(html, /id="nav-test-infinity"[\s\S]{0,180}TEST INFINITY/);
assert.match(html, /id="btn-test-infinity-start"[\s\S]{0,80}TEST INFINITY STARTEN/);
assert.match(html, /id="page-test-infinity"/);
assert.match(html, /200 Meter sind 2000 Einheiten/);
assert.match(main, /get\('test'\)==='infinity'/);
const handler = main.slice(main.indexOf('onTestInfinity'), main.indexOf('onTestInfinity') + 520);
assert.match(handler, /start\('normal'\)/);
assert.match(handler, /save\(\)\{\}/);
assert.doesNotMatch(handler, /startEndless|infinityStorage|setLabStyle/);

const hubT = mills[0].y / CLIMB_SPEED;
const hubPoses = mills.map((laser) => trapPose(makeTrap(laser), hubT));
assert.ok(hubPoses.every((pose) => pose.phase === 'active'));
assert.equal(new Set(hubPoses.map((pose) => pose.x.toFixed(3))).size, 1);
assert.equal(new Set(hubPoses.map((pose) => pose.y.toFixed(3))).size, 1);
for (let i = 0; i < 4; i++) {
  const gap = Math.atan2(Math.sin(hubPoses[(i + 1) % 4].angle - hubPoses[i].angle), Math.cos(hubPoses[(i + 1) % 4].angle - hubPoses[i].angle));
  assert.ok(Math.abs(Math.abs(gap) - Math.PI / 2) < 1e-9, mills[i].id);
}
const quarter = (Math.PI / 2) / mills[0].spin;
const sample = hubT - 0.5;
const before = trapPose(makeTrap(mills[0]), sample);
const after = trapPose(makeTrap(mills[0]), sample + quarter);
assert.equal(before.phase, 'active');
assert.equal(after.phase, 'active');
assert.ok(Math.abs((after.angle - before.angle) - Math.PI / 2) < 1e-9);
const rider = { x: (before.x + before.endX) / 2, y: (before.y + before.endY) / 2, dim: 'R' };
{
  const live = makeTrap(mills[0]);
  assert.equal(new TrapField([live]).step(sample, SIM_DT, rider, rider.x, rider.y, []), live);
  assert.equal(new TrapField([makeTrap(mills[0])]).step(sample + quarter, SIM_DT, rider, rider.x, rider.y, []), null);
  const arrived = makeTrap(mills[3]);
  assert.equal(new TrapField([arrived]).step(sample + quarter, SIM_DT, { ...rider, dim: arrived.color }, rider.x, rider.y, []), arrived);
}
const quarterTurned = structuredClone(level);
for (const o of quarterTurned.objects) if (o.id.startsWith('mill-')) {
  o.startAngle = ((o.startAngle + 90 + 180) % 360 + 360) % 360 - 180;
  o.endAngle = o.startAngle;
}
assert.ok(runReplay(quarterTurned, taps).killer.id.startsWith('mill-'));

for (const laser of spins) {
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
  const turn = Math.PI / Math.abs(laser.spin);
  let t = null;
  for (let s = 0.05; s < 6; s += 0.01) {
    if (trapPose(o, s).phase === 'active' && trapPose(o, s + turn).phase === 'active') { t = s; break; }
  }
  assert.ok(t != null, laser.id);
  const beam = trapPose(o, t);
  const rider = { x: (beam.x + beam.endX) / 2, y: (beam.y + beam.endY) / 2, dim: o.color };
  const live = makeTrap(laser);
  assert.equal(new TrapField([live]).step(t, SIM_DT, rider, rider.x, rider.y, []), live);
  assert.equal(new TrapField([makeTrap(laser)]).step(t + turn, SIM_DT, rider, rider.x, rider.y, []), null);
}

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
function gapAt(y) {
  const row = obstacles.filter((o) => o.y === y && o.dimension === 'both');
  if (row.length !== 2) return null;
  const left = row.find((o) => o.x === 0);
  const right = row.find((o) => o.x > 0);
  return { left, right, gap: right.x - left.w };
}

const easyRows = rows.filter((y) => y < RELAXED_Y);
const hardRows = rows.filter((y) => y >= RELAXED_Y);
assert.ok(easyRows[0] / CLIMB_SPEED >= 1 && easyRows[0] / CLIMB_SPEED <= 1.4);
for (let i = 1; i < easyRows.length; i++) assert.ok((easyRows[i] - easyRows[i - 1]) / CLIMB_SPEED >= 0.75);
for (let i = 1; i < hardRows.length; i++) assert.ok((hardRows[i] - hardRows[i - 1]) / CLIMB_SPEED <= 0.65);
for (const y of easyRows) {
  const slit = gapAt(y);
  assert.equal(slit.gap, 70);
  assert.ok(slit.gap / 2 - HIT_RADIUS >= 27);
}
for (const y of hardRows) {
  const slit = gapAt(y);
  if (!slit) continue;
  assert.equal(slit.gap, 40);
}

const opening = trace(taps);
assert.equal(opening.state, 'won');
let easyClear = Infinity;
let hardClear = Infinity;
for (const y of rows) {
  const slit = gapAt(y);
  if (!slit) continue;
  const rec = opening.band.get(y);
  const clear = Math.min(rec.min - slit.left.w - HIT_RADIUS, slit.right.x - HIT_RADIUS - rec.max);
  if (y < RELAXED_Y) easyClear = Math.min(easyClear, clear);
  else hardClear = Math.min(hardClear, clear);
}
assert.ok(easyClear >= 18, `lockere Passage ${easyClear}`);
assert.ok(hardClear >= 3, `harte Passage ${hardClear}`);

const reds = obstacles.filter((o) => o.dimension === 'red').sort((a, b) => a.y - b.y);
const blues = obstacles.filter((o) => o.dimension === 'blue').sort((a, b) => a.y - b.y);
assert.deepEqual(reds.map((o) => o.id), ['red-a', 'red-b']);
assert.deepEqual(blues.map((o) => o.id), ['blue-a', 'blue-b']);
assert.ok(reds[0].y >= RELAXED_Y && blues[0].y >= RELAXED_Y);
assert.deepEqual([...opening.band.get(reds[0].y).dims], ['B']);
assert.deepEqual([...opening.band.get(blues[0].y).dims], ['R']);

const omitLastBefore = (id) => {
  const ty = level.objects.find((o) => o.id === id).y / CLIMB_SPEED;
  const save = taps.filter((tap) => tap.t < ty - 0.04).at(-1);
  return runReplay(level, taps.filter((tap) => tap !== save));
};
const addAt = (y0, y1, dir) => runReplay(level, [...taps, { t: (y0 + y1) / 2 / CLIMB_SPEED, dir }].sort((a, b) => a.t - b.t));
assert.equal(omitLastBefore('red-a').killer.id, 'red-a');
assert.equal(addAt(reds[0].y, reds[1].y, -1).killer.id, 'red-b');
assert.equal(omitLastBefore('blue-a').killer.id, 'blue-a');
assert.equal(addAt(blues[0].y, blues[1].y, 1).killer.id, 'blue-b');
const slitT = level.objects.find((o) => o.id === 'slit-0-l').y / CLIMB_SPEED;
const aimTap = taps.filter((tap) => tap.t < slitT).at(-1);
const late = taps.map((tap) => tap === aimTap ? { t: Math.round((slitT - 0.12) * 1000) / 1000, dir: tap.dir } : tap);
assert.equal(runReplay(level, late).killer.id, 'slit-0-r');
assert.ok(runReplay(level, []).killer.id.startsWith('easy-'));
assert.equal(runReplay(level, taps).won, true);
console.log(`Test Infinity: 200 m = ${RELAXED_Y} u, Ziel ${(level.finish.y / CLIMB_SPEED).toFixed(2)} s, locker ${easyClear.toFixed(1)} u, hart ${hardClear.toFixed(1)} u`);
