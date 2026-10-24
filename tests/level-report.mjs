// Ausführlicher Level-Bericht: Erreichbarkeit pro Reihe, Abschnitte, Musterlösung, Zwangsaktionen, Rift-Siegel.
// Aufruf: node tests/level-report.mjs
import { getRows, validateLevel, SECTIONS, sectionAt, FINISH_BEAT, BEAT_SEC, START_LANE, START_DIM, survivesRow } from '../js/level.js';

const rows = getRows();
const v = validateLevel(rows);
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
