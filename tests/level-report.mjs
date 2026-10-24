// Ausführlicher Level-Bericht: Erreichbarkeit pro Reihe, Abschnitte, Musterlösung, Zwangsaktionen, Rift-Siegel.
// Aufruf: node tests/level-report.mjs
// Aufruf mit Level-ID: node tests/level-report.mjs rift-main
import { validateLevel, survivesRow } from '../js/level.js';
import { laneRows, buildLevelRuntime } from '../js/level-data.js';
import { BEAT_SEC, UNITS_PER_BEAT } from '../js/config.js';
import { loadLevel } from './lib/levels.mjs';

const level = loadLevel(process.argv[2] || 'rift-main');
const rt = buildLevelRuntime(level);
const rows = laneRows(level);
if (!rows) {
  console.log(`${level.id}: freie Maße – kein Spur-Bericht möglich (Nachweis über aufgezeichneten Lauf, siehe validate-level.mjs)`);
  process.exit(0);
}
const FINISH_BEAT = level.finish.y / UNITS_PER_BEAT;
const SECTIONS = rt.sections.map((s) => ({ ...s, from: s.y / UNITS_PER_BEAT }));
const sectionAt = (beat) => {
  let s = SECTIONS[0];
  for (const sec of SECTIONS) if (beat >= sec.from) s = sec;
  return s;
};
const START_LANE = rt.start.lane;
const START_DIM = rt.start.dim;
const v = validateLevel(rows, rt.start);
console.log(`Level: ${rows.length} Reihen, Ziel bei Beat ${FINISH_BEAT} = ${(FINISH_BEAT * BEAT_SEC).toFixed(1)} s, lösbar: ${v.ok}`);
if (!v.ok) {
  console.log(v.errors.join('\n'));
  process.exit(1);
}

let lane = START_LANE;
let dim = START_DIM;
let prevBeat = 0;
const perSection = {};
for (let k = 0; k < rows.length; k++) {
  const [beat, pattern] = rows[k];
  const taps = v.solution[k];
  const idleDies = !survivesRow(pattern, lane, dim);
  for (const t of taps) {
    lane = Math.max(0, Math.min(3, lane + (t === 'R' ? 1 : -1)));
    dim = dim === 'B' ? 'R' : 'B';
  }
  const hasSeal = pattern.includes('S');
  const throughSeal = pattern[lane] === 'S';
  const sec = sectionAt(beat);
  const s = (perSection[sec.id] ||= { rows: 0, taps: 0, forced: 0, minGap: Infinity, from: beat, to: beat, seals: 0, through: 0 });
  s.seals += hasSeal ? 1 : 0;
  s.through += throughSeal ? 1 : 0;
  s.rows++;
  s.taps += taps.length;
  s.forced += idleDies ? 1 : 0;
  s.minGap = Math.min(s.minGap, beat - prevBeat);
  s.to = beat;
  console.log(`${sec.id} Beat ${String(beat).padStart(3)}  ${pattern}  Lösung: ${(taps.join('') || '-').padEnd(3)} -> Spur ${lane} ${dim}  ` +
    `erreichbar: ${v.reachable[k].join(',').padEnd(24)} lebendig: ${[...v.alive[k]].join(',')}${idleDies ? '  [Aktion nötig]' : ''}${throughSeal ? '  [durch Siegel]' : ''}`);
  prevBeat = beat;
}
console.log('\nAbschnitte:');
for (const sec of SECTIONS) {
  const s = perSection[sec.id];
  console.log(`  ${sec.id} ${sec.name.padEnd(16)} Beat ${s.from}-${s.to} (${(s.from * BEAT_SEC).toFixed(1)}-${(s.to * BEAT_SEC).toFixed(1)} s): ` +
    `${s.rows} Reihen, ${s.taps} Tipps in der Musterlösung, ${s.forced} Reihen erzwingen eine Aktion, kleinster Abstand ${s.minGap} Beat(s), ` +
    `${s.seals} Siegel-Reihen (Musterlösung fliegt ${s.through}× durch ein Siegel)`);
}
