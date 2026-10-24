// Handgebautes Level. Jede Reihe liegt exakt auf einem Beat (120 BPM).
// Zeichen je Spur (4 Spuren, links -> rechts):
//   .  frei   B  blaues Hindernis   R  rotes Hindernis   W  weißes Hindernis (immer tödlich)

export const BPM = 120;
export const BEAT_SEC = 60 / BPM;
export const UNITS_PER_BEAT = 130;
export const CLIMB_SPEED = UNITS_PER_BEAT / BEAT_SEC;
export const LANES = 4;
export const LANE_W = 90;
export const WORLD_W = LANES * LANE_W;
export const START_LANE = 1;
export const START_DIM = 'B';
export const BAR_THICKNESS = 14;
export const CHECKPOINT_EVERY_BEATS = 8;

const ROWS = [
  // --- Abschnitt 1: Einführung (alle 4 Beats, eine Farbe pro Reihe)
  [8, 'BB..'],
  [12, '..RR'],
  [16, 'BBB.'],
  [20, '.RRR'],
  [24, 'BB..'],
  [28, '..RR'],
  // --- Abschnitt 2: Zwei Farben (alle 2 Beats)
  [32, 'BBRR'],
  [34, 'RRBB'],
  [36, 'BBBB'],
  [38, 'RRRR'],
  [40, 'BBRR'],
  [42, 'RBBR'],
  [44, 'BRRB'],
  [46, 'RRBB'],
  [48, 'BBBR'],
  [50, 'RBBB'],
  [52, 'RRRR'],
  [54, 'BBBB'],
  [56, 'BRBR'],
  [58, 'RBRB'],
  [60, 'BBRR'],
  [62, 'RRBB'],
  // --- Abschnitt 3: Weiß kommt dazu (alle 2 Beats, erste 1-Beat-Folgen)
  [64, 'W.BB'],
  [66, 'WRRW'],
  [68, 'BBWW'],
  [70, 'W..W'],
  [72, 'RRRW'],
  [74, 'WBBB'],
  [76, 'WW.R'],
  [77, 'WWB.'],
  [78, 'WRRR'],
  [80, 'BBWW'],
  [82, 'RRBW'],
  [84, 'WBRR'],
  [85, 'WRBB'],
  [86, 'W.WW'],
  [88, 'RRWW'],
  [90, 'BRWW'],
  [92, 'WRBW'],
  [93, 'BRBW'],
  [94, 'WWBR'],
  // --- Abschnitt 4: Finale (jeder Beat)
  [96, 'BBBB'],
  [97, 'RRRR'],
  [98, 'BBBB'],
  [99, 'RRRR'],
  [100, 'WBBW'],
  [101, 'WRRW'],
  [102, 'BRWW'],
  [103, 'RB.W'],
  [104, 'WW.R'],
  [105, 'WWBR'],
  [106, 'W.RR'],
  [107, 'WBRB'],
  [108, 'BBRW'],
  [109, 'RBRW'],
  [110, 'BWRR'],
  [111, 'RWBB'],
  [112, 'WRRR'],
  [113, 'WBBB'],
  [114, 'WRWB'],
  [115, 'WBWR'],
  [116, 'RRRR'],
  [117, 'BBBB'],
  [118, 'RRWW'],
  [119, 'BBWW'],
  [120, 'BRWW'],
  [121, 'W.RR'],
  [122, 'WRBW'],
  [123, 'BRBW'],
  [124, 'BBBB'],
  [125, 'RRRR'],
  [126, 'BBBB'],
  [127, 'RRRR'],
];

export const FINISH_BEAT = 132;
export const LEVEL_LENGTH = FINISH_BEAT * UNITS_PER_BEAT;

export function laneCenter(lane) {
  return lane * LANE_W + LANE_W / 2;
}

/** Wandelt die Reihen in Hindernis-Rechtecke um (benachbarte gleiche Farben verschmelzen). */
export function buildObstacles(rows = ROWS) {
  const obstacles = [];
  rows.forEach(([beat, pattern], rowIndex) => {
    let i = 0;
    while (i < LANES) {
      const c = pattern[i];
      if (c === '.') { i++; continue; }
      let j = i;
      while (j + 1 < LANES && pattern[j + 1] === c) j++;
      obstacles.push({
        rowIndex,
        beat,
        color: c,
        y: beat * UNITS_PER_BEAT,
        x0: i * LANE_W,
        x1: (j + 1) * LANE_W,
      });
      i = j + 1;
    }
  });
  return obstacles;
}

export function getRows() {
  return ROWS;
}

function stateKey(lane, dim) {
  return lane + dim;
}

function applyTaps(lane, dim, taps) {
  for (const t of taps) {
    lane = Math.max(0, Math.min(LANES - 1, lane + (t === 'R' ? 1 : -1)));
    dim = dim === 'B' ? 'R' : 'B';
  }
  return { lane, dim };
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

export function survivesRow(pattern, lane, dim) {
  const c = pattern[lane];
  return c === '.' || (c !== 'W' && c !== dim);
}

/**
 * Prüft das Level auf Lösbarkeit. Konservatives Modell: höchstens ein Tipp
 * pro Beat zwischen zwei Reihen (ein Impuls dauert 340 ms, ein Beat 500 ms).
 * Liefert pro Reihe die "lebendigen" Zustände (von dort ist das Ziel erreichbar)
 * und eine Musterlösung mit minimaler Tippanzahl.
 */
export function validateLevel(rows = ROWS) {
  const errors = [];
  const layers = [];
  let current = new Map([[stateKey(START_LANE, START_DIM), { lane: START_LANE, dim: START_DIM, parentKey: null, taps: [], cost: 0 }]]);
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
        if (!survivesRow(pattern, r.lane, r.dim)) continue;
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
          if (alive[k + 1].has(stateKey(r.lane, r.dim)) && survivesRow(rows[k + 1][1], r.lane, r.dim)) {
            alive[k].add(key);
            break;
          }
        }
      }
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
