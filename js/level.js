// Handgebautes Level. Jede Reihe liegt exakt auf einem Beat (120 BPM).
// Zeichen je Spur (4 Spuren, links -> rechts):
//   .  frei   B  blaues Hindernis   R  rotes Hindernis   W  weißes Hindernis (immer tödlich)
import { LANES, LANE_W, UNITS_PER_BEAT, START_LANE, START_DIM } from './config.js';

export {
  BPM, BEAT_SEC, UNITS_PER_BEAT, CLIMB_SPEED, LANES, LANE_W, WORLD_W, START_LANE, START_DIM,
  BAR_THICKNESS, CHECKPOINT_EVERY_BEATS,
} from './config.js';

// labelBeat: Position der Abschnittsmarke im Level (zwischen zwei Reihen, nie auf einem Hindernis)
export const SECTIONS = [
  { id: 'A', name: 'Einstieg', from: 0, labelBeat: 0 },
  { id: 'B', name: 'Herausforderung', from: 30, labelBeat: 28 },
  { id: 'C', name: 'Finale', from: 58, labelBeat: 57.6 },
];

const ROWS = [
  // --- A: Einstieg – alle 4 Beats (2 s), jede Reihe lehrt genau eine Regel
  [6, '.WWW'], //  Tipp rechts -> schräg links hoch
  [10, 'W.WW'], // Tipp links -> schräg rechts hoch
  [14, 'RRRR'], // Geister (inaktive Farbe) sind harmlos -> nicht tippen
  [18, 'BBBB'], // alles aktiv -> tippen = Dimension wechseln
  [22, 'W..W'], // Weiß tötet immer, zurück in die Mitte
  [26, 'RBBR'], // Richtung und Dimension kombinieren
  // --- B: Herausforderung – alle 2 Beats, rhythmische Doppel-Reihen im 1-Beat-Abstand
  [30, 'BBRR'],
  [32, 'RRBB'],
  [34, 'W..W'],
  [36, 'BRRB'],
  [37, 'RBBR'],
  [40, 'WBRW'],
  [42, 'BRRW'],
  [44, 'BBWW'],
  [46, 'WWRR'],
  [48, 'RBWW'],
  [49, 'BRWW'],
  [52, 'W.BR'],
  [54, 'RB.W'],
  [56, 'RRRR'],
  [57, 'BBBB'],
  // --- C: Finale – jeder Beat; Wand-Tipps, Farbwechsel-Ketten, Kreuzungen
  [59, '.WWW'],
  [60, 'BWWW'],
  [61, 'RWWW'],
  [62, 'BWWW'],
  [63, 'RWWW'],
  [64, 'BBWW'],
  [65, 'WRBW'],
  [66, 'WWBR'],
  [67, 'WWRR'],
  [68, 'WWWB'],
  [69, 'WWWR'],
  [70, 'RWBB'],
  [71, 'BRRW'],
  [72, 'BBRW'],
  [73, 'RBWW'],
  [74, 'WBRB'],
  [75, 'WRRB'],
  [76, 'WBBB'],
  [77, 'RRRR'],
  [78, 'BBBB'],
  [79, 'RRRR'],
  [80, 'W..W'],
  [81, 'WBRW'],
  [82, 'RRBB'],
];

/** Kurze Hinweise im Abschnitt A (dimensionsunabhängig formuliert). */
export const HINTS = [
  [3, 'TIPP RECHTS = ↖'],
  [8, 'TIPP LINKS = ↗'],
  [12, 'GESTRICHELT = HARMLOS'],
  [16, 'JEDER TIPP WECHSELT DIE FARBE'],
  [20, 'WEISS TÖTET IMMER'],
  [24, 'RICHTUNG + FARBE WÄHLEN'],
  [58.35, 'TIPP ZUR WAND = NUR FARBWECHSEL'],
];

export const FINISH_BEAT = 84;
export const LEVEL_LENGTH = FINISH_BEAT * UNITS_PER_BEAT;

export function laneCenter(lane) {
  return lane * LANE_W + LANE_W / 2;
}

export function sectionAt(beat) {
  let s = SECTIONS[0];
  for (const sec of SECTIONS) if (beat >= sec.from) s = sec;
  return s;
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
 * pro Beat zwischen zwei Reihen (ein Impuls ist nach ~90 ms spursicher, ein Beat dauert 500 ms).
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
