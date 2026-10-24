// Deploy-Prüfung (läuft im GitHub-Actions-Workflow vor dem Veröffentlichen, Node ohne Browser):
// Levelindex und alle Level-Dateien in assets/levels/ müssen gültig und nachweislich durchspielbar sein.
// Aufruf: node tests/validate-level.mjs
import { validateLevelData, laneRows } from '../js/level-data.js';
import { checkPlayability } from '../js/playcheck.js';
import { CLIMB_SPEED, UNITS_PER_BEAT } from '../js/config.js';
import { loadIndex, readJson } from './lib/levels.mjs';

let ok = true;
const fail = (msg) => { ok = false; console.error(`FEHLER  ${msg}`); };

const idx = loadIndex();
if (!idx.ok) idx.errors.forEach(fail);
const levels = idx.index ? idx.index.levels : [];
const ids = new Set();

for (const entry of levels) {
  if (ids.has(entry.id)) fail(`${entry.id}: doppelte ID im Index`);
  ids.add(entry.id);
  let raw;
  try {
    raw = readJson(entry.file);
  } catch (e) {
    fail(`${entry.file}: nicht lesbar (${e.message})`);
    continue;
  }
  const res = validateLevelData(raw);
  for (const i of res.issues) {
    if (i.severity === 'error') fail(`${entry.file}: ${i.message}`);
    else console.log(`Hinweis ${entry.file}: ${i.message}`);
  }
  if (!res.ok) continue;
  const level = res.level;
  if (level.id !== entry.id) fail(`${entry.file}: ID „${level.id}“ passt nicht zum Index („${entry.id}“)`);
  const duration = level.finish.y / CLIMB_SPEED;
  const play = checkPlayability(level);
  if (play.ok !== true) fail(`${entry.file}: ${play.message}`);

  if (entry.id === idx.index.default) {
    // Hauptlevel: strenger Spur-Nachweis wie bisher (Dauer, Reihenfolge, lebendige Zustände)
    const rows = laneRows(level);
    if (!rows) fail(`${entry.file}: Hauptlevel muss im Spurmodell liegen (Spur-Solver-Nachweis)`);
    else {
      if (duration < 30 || duration > 45) fail(`${entry.file}: Leveldauer ${duration} s außerhalb 30–45 s`);
      const beats = rows.map((r) => r[0]);
      if (beats.some((b, i) => i > 0 && b <= beats[i - 1])) fail(`${entry.file}: Reihen nicht aufsteigend`);
      if (beats[beats.length - 1] * UNITS_PER_BEAT >= level.finish.y) fail(`${entry.file}: Reihe hinter der Ziellinie`);
      if (play.solver && play.solver.alive.some((s) => s.size === 0)) fail(`${entry.file}: Reihe ohne lebendigen Zustand`);
    }
  }
  const solids = level.objects.filter((o) => o.type !== 'hint').length;
  console.log(`${entry.id}: ${solids} Objekte, Ziel bei y ${level.finish.y} (${duration.toFixed(1)} s, ${level.bpm} BPM) – ${play.ok ? 'durchspielbar' : 'FEHLER'} [${play.method}] ${play.message}`);
}

if (!levels.length) fail('keine Level im Index');
console.log(ok ? `${levels.length} Level geprüft: alle gültig und durchspielbar` : 'Level-Prüfung FEHLGESCHLAGEN');
process.exit(ok ? 0 : 1);
