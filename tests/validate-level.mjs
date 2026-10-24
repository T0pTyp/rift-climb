import { validateLevel, getRows, FINISH_BEAT } from '../js/level.js';

const rows = getRows();
const res = validateLevel(rows);
let ok = res.ok;
const beats = rows.map((r) => r[0]);
if (beats.some((b, i) => i > 0 && b <= beats[i - 1])) { ok = false; console.error('Reihen nicht aufsteigend'); }
if (beats[beats.length - 1] >= FINISH_BEAT) { ok = false; console.error('Reihe hinter der Ziellinie'); }
if (res.alive && res.alive.some((s) => s.size === 0)) { ok = false; console.error('Reihe ohne lebendigen Zustand'); }
console.log(`${rows.length} Reihen, Ziel bei Beat ${FINISH_BEAT}: ${ok ? 'lösbar' : 'FEHLER'}`);
if (!ok) console.error(res.errors);
process.exit(ok ? 0 : 1);
