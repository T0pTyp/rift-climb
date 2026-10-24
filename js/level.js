// Spur-Solver: beweist die Lösbarkeit eines Levels im Spur- und Reihenmodell.
// Eingabe: Reihen [schritt, "B.RW"] (ein Schritt = 0,5 s = 130 u, siehe laneRows in level-data.js).
// Zeichen je Spur (4 Spuren, links -> rechts):
//   .  frei   B  blaues Hindernis   R  rotes Hindernis   W  weißes Hindernis (immer tödlich)
//   S  Rift-Siegel (gold, in beiden Dimensionen tödlich, solange es nicht von einem Rift Pulse geöffnet ist)
import {
  LANES, LANE_W, START_LANE, START_DIM, BAR_INSET_X, PULSE_RADIUS, SEAL_PLAN_DY,
} from './config.js';
import { laneCenter } from './level-data.js';

export { laneCenter };

function stateKey(lane, dim) {
  return lane + dim;
}

/** origin = Spur vor dem letzten Tipp (Ursprung der letzten Welle), null ohne Tipp. */
function applyTaps(lane, dim, taps) {
  let origin = null;
  for (const t of taps) {
    origin = lane;
    lane = Math.max(0, Math.min(LANES - 1, lane + (t === 'R' ? 1 : -1)));
    dim = dim === 'B' ? 'R' : 'B';
  }
  return { lane, dim, origin };
}

/**
 * Öffnet die letzte Welle (aus Spur `origin`, Offbeat vor der Reihe) das Siegel-Segment, das `lane` enthält?
 * Die eigentliche Prüfung läuft gegen dieselben Konfigurationswerte wie das Spiel.
 */
export function sealReachable(pattern, lane, origin) {
  if (origin === null || origin === undefined || pattern[lane] !== 'S') return false;
  let i = lane;
  let j = lane;
  while (i > 0 && pattern[i - 1] === 'S') i--;
  while (j < LANES - 1 && pattern[j + 1] === 'S') j++;
  const ox = laneCenter(origin);
  const dx = Math.max(i * LANE_W + BAR_INSET_X - ox, 0, ox - ((j + 1) * LANE_W - BAR_INSET_X));
  return Math.hypot(dx, SEAL_PLAN_DY) <= PULSE_RADIUS;
}

function tapSequences(maxTaps) {
  const seqs = [[]];
  let frontier = [[]];
  for (let n = 0; n < maxTaps; n++) {
    const next = [];
    for (const s of frontier) {
      next.push([...s, 'L'], [...s, 'R']);
    }
    seqs.push(...next);
    frontier = next;
  }
  return seqs;
}

export function survivesRow(pattern, lane, dim, origin = null) {
  const c = pattern[lane];
  if (c === 'S') return sealReachable(pattern, lane, origin);
  return c === '.' || (c !== 'W' && c !== dim);
}

/**
 * Prüft das Level auf Lösbarkeit. Konservatives Modell: höchstens ein Tipp
 * pro Beat zwischen zwei Reihen (ein Impuls ist nach ~90 ms spursicher, ein Beat dauert 500 ms).
 * Rift-Siegel: passierbar nur, wenn der letzte Tipp vor der Reihe (Offbeat) es mit seiner Welle erreicht.
 * Liefert pro Reihe die "lebendigen" Zustände (von dort ist das Ziel erreichbar)
 * und eine Musterlösung mit minimaler Tippanzahl.
 */
export function validateLevel(rows, start = { lane: START_LANE, dim: START_DIM }) {
  const errors = [];
  const layers = [];
  let current = new Map([[stateKey(start.lane, start.dim), { lane: start.lane, dim: start.dim, parentKey: null, taps: [], cost: 0 }]]);
  let prevBeat = 0;
  for (let k = 0; k < rows.length; k++) {
    const [beat, pattern] = rows[k];
    if (pattern.length !== LANES) errors.push(`Reihe ${k}: Muster hat nicht ${LANES} Spuren`);
    const gap = beat - prevBeat;
    if (gap < 1) errors.push(`Reihe ${k}: Abstand < 1 Beat`);
    const maxTaps = Math.min(gap, 3);
    const seqs = tapSequences(maxTaps);
    const next = new Map();
    for (const [key, st] of current) {
      for (const seq of seqs) {
        const r = applyTaps(st.lane, st.dim, seq);
        if (!survivesRow(pattern, r.lane, r.dim, r.origin)) continue;
        const nk = stateKey(r.lane, r.dim);
        const prev = next.get(nk);
        const cost = st.cost + seq.length;
        if (!prev || cost < prev.cost) {
          next.set(nk, { lane: r.lane, dim: r.dim, parentKey: key, taps: seq, cost });
        }
      }
    }
    if (next.size === 0) {
      errors.push(`Reihe ${k} (Beat ${beat}, "${pattern}") ist unerreichbar`);
      layers.push(next);
      break;
    }
    layers.push(next);
    current = next;
    prevBeat = beat;
  }

  const alive = layers.map(() => new Set());
  if (errors.length === 0) {
    const last = layers.length - 1;
    for (const k of layers[last].keys()) alive[last].add(k);
    for (let k = last - 1; k >= 0; k--) {
      const gap = rows[k + 1][0] - rows[k][0];
      const seqs = tapSequences(Math.min(gap, 3));
      for (const [key, st] of layers[k]) {
        for (const seq of seqs) {
          const r = applyTaps(st.lane, st.dim, seq);
          if (alive[k + 1].has(stateKey(r.lane, r.dim)) && survivesRow(rows[k + 1][1], r.lane, r.dim, r.origin)) {
            alive[k].add(key);
            break;
          }
        }
      }
    }
    for (let k = 0; k < rows.length; k++) {
      if (alive[k].size === 0) errors.push(`Reihe ${k}: kein Zustand führt zum Ziel`);
    }
  }

  let solution = null;
  if (errors.length === 0) {
    const last = layers.length - 1;
    let best = null;
    for (const st of layers[last].values()) if (!best || st.cost < best.cost) best = st;
    solution = new Array(rows.length);
    let st = best;
    for (let k = last; k >= 0; k--) {
      solution[k] = st.taps;
      if (k > 0) st = layers[k - 1].get(st.parentKey);
    }
  }

  return { ok: errors.length === 0, errors, alive, solution, reachable: layers.map((l) => [...l.keys()]) };
}
