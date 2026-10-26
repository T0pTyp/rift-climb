// Rebuild the six campaign levels onto the two-tap arena.
// The recorded taps stay. Each row is recentered on the path those taps
// actually fly on three lanes, so the same input still clears the level.
import { readFileSync, writeFileSync } from 'node:fs';
import { Player } from '../js/player.js';
import { SIM_DT, CLIMB_SPEED } from '../js/config.js';
import { validateLevelData, serializeLevel } from '../js/level-data.js';
import { runReplay } from '../js/playcheck.js';
import { isTrap } from '../js/traps.js';

const WIDTH = 270;
const IDS = ['first-pulse', 'fractured-rhythm', 'overload', 'shattered-gears', 'voltage-run', 'singularity-rush'];
const round = (v) => Math.round(v * 100) / 100;

function dimCode(dimension) {
  return dimension === 'red' ? 'R' : 'B';
}

function pathOf(startLane, startDim, taps, seconds) {
  const player = new Player('narrow');
  player.reset(startLane, startDim, 0);
  const samples = [];
  let t = 0;
  let i = 0;
  while (t < seconds + 1) {
    while (i < taps.length && taps[i].t <= t + SIM_DT / 2) player.impulse(taps[i++].dir);
    player.update(SIM_DT, t * CLIMB_SPEED);
    t += SIM_DT;
    samples.push({ y: t * CLIMB_SPEED, x: player.x, dim: player.dim, lane: player.lane });
  }
  return samples;
}

function atY(samples, y) {
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].y < y) lo = mid + 1;
    else hi = mid;
  }
  return samples[Math.max(0, lo)];
}

function contains(object, x) {
  return x >= object.x - 1 && x <= object.x + object.w + 1;
}

function deadly(object, dim) {
  if (object.type !== 'obstacle' || object.dimension === 'both') return object.type === 'obstacle' && object.dimension === 'both';
  return dimCode(object.dimension) === dim;
}

function openingAround(bars, x) {
  let spans = [[0, 360]];
  for (const bar of bars) {
    const next = [];
    for (const [a, b] of spans) {
      if (bar.x + bar.w <= a || bar.x >= b) next.push([a, b]);
      else {
        if (bar.x > a) next.push([a, bar.x]);
        if (bar.x + bar.w < b) next.push([bar.x + bar.w, b]);
      }
    }
    spans = next.filter(([a, b]) => b - a > 1);
  }
  return spans.find(([a, b]) => x >= a - 2 && x <= b + 2) || null;
}

function placeOpening(y, center, width, height) {
  const gap = Math.min(WIDTH - 16, Math.max(48, width));
  let left = round(center - gap / 2);
  if (left < 0) left = 0;
  if (left + gap > WIDTH) left = round(WIDTH - gap);
  const right = round(left + gap);
  return { left, right, y, height };
}

function clampTrap(object, narrowX, classicX) {
  const amp = object.axis === 'x' ? object.amplitude || 0 : 0;
  const offset = (object.x + object.w / 2) - classicX;
  let center = narrowX + offset * (WIDTH / 360);
  const min = amp + object.w / 2;
  const max = WIDTH - amp - object.w / 2;
  center = Math.min(max, Math.max(min, center));
  return round(center - object.w / 2);
}

export function portLevel(raw) {
  const taps = raw.replay.taps;
  const startDim = dimCode(raw.start.dimension);
  const samples = pathOf(Math.min(2, raw.start.lane), startDim, taps, raw.finish.y / CLIMB_SPEED);
  const classic = pathOfClassic(raw.start.lane, startDim, taps, raw.finish.y / CLIMB_SPEED);
  const byY = new Map();
  for (const object of raw.objects) {
    if (object.type === 'hint' || isTrap(object)) continue;
    const key = object.y;
    if (!byY.has(key)) byY.set(key, []);
    byY.get(key).push(object);
  }
  const objects = [];
  for (const object of raw.objects) {
    if (object.type === 'hint') {
      objects.push({ ...object });
      continue;
    }
    if (isTrap(object)) {
      const here = atY(samples, object.y);
      const there = atY(classic, object.y);
      objects.push({ ...object, x: clampTrap(object, here.x, there.x) });
    }
  }
  let row = 0;
  for (const [y, bars] of byY) {
    const here = atY(samples, y);
    const there = atY(classic, y);
    const solids = bars.filter((bar) => deadly(bar, there.dim));
    const passage = bars.find((bar) => contains(bar, there.x) && !deadly(bar, there.dim));
    const gap = openingAround(solids, there.x);
    const width = gap ? gap[1] - gap[0] : passage ? passage.w : 84;
    const placed = placeOpening(y, here.x, width, bars[0].h || 14);
    const height = bars.reduce((max, bar) => Math.max(max, bar.h || 14), 14);
    const index = row++;
    if (placed.left >= 8) {
      objects.push({ id: `gate${index}l`, type: 'obstacle', x: 0, y, w: placed.left, h: height, dimension: 'both' });
    }
    if (WIDTH - placed.right >= 8) {
      objects.push({ id: `gate${index}r`, type: 'obstacle', x: placed.right, y, w: round(WIDTH - placed.right), h: height, dimension: 'both' });
    }
    if (passage) {
      const fill = { id: passage.id, type: passage.type, x: placed.left, y, w: round(placed.right - placed.left - 0.05), h: height };
      if (passage.type === 'obstacle') fill.dimension = passage.dimension;
      else fill.openSec = passage.openSec ?? 0.5;
      objects.push(fill);
    }
  }
  const level = { ...raw, arenaStyle: 'narrow', start: { ...raw.start, lane: Math.min(2, raw.start.lane) }, objects };
  return level;
}

function pathOfClassic(startLane, startDim, taps, seconds) {
  const player = new Player('classic');
  player.reset(startLane, startDim, 0);
  const samples = [];
  let t = 0;
  let i = 0;
  while (t < seconds + 1) {
    while (i < taps.length && taps[i].t <= t + SIM_DT / 2) player.impulse(taps[i++].dir);
    player.update(SIM_DT, t * CLIMB_SPEED);
    t += SIM_DT;
    samples.push({ y: t * CLIMB_SPEED, x: player.x, dim: player.dim, lane: player.lane });
  }
  return samples;
}

if (process.argv[1] && process.argv[1].endsWith('port-campaign-narrow.mjs')) {
  for (const id of IDS) {
    const raw = JSON.parse(readFileSync(`assets/levels/${id}.json`, 'utf8'));
    const level = portLevel(raw);
    const validated = validateLevelData(level);
    if (!validated.ok) {
      console.log(id, 'INVALID', JSON.stringify(validated.issues.slice(0, 6)));
      continue;
    }
    const replay = runReplay(validated.level, validated.level.replay.taps);
    console.log(id, replay.won ? 'WON' : `FAIL ${replay.progress}% ${replay.killer?.id || ''} ${replay.killer?.reason || ''}`);
    if (replay.won && process.argv.includes('--write')) {
      writeFileSync(`assets/levels/${id}.json`, serializeLevel(validated.level));
      console.log('  wrote', id);
    }
  }
}
