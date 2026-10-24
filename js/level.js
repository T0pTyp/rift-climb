// Handgebautes Level. Jede Reihe liegt exakt auf einem Beat (120 BPM).
// Zeichen je Spur (4 Spuren, links -> rechts):
//   .  frei   B  blaues Hindernis   R  rotes Hindernis   W  weißes Hindernis (immer tödlich)
//   S  Rift-Siegel (gold, in beiden Dimensionen tödlich, solange es nicht von einem Rift Pulse geöffnet ist)
import {
  LANES, LANE_W, UNITS_PER_BEAT, START_LANE, START_DIM, BAR_INSET_X, PULSE_RADIUS, SEAL_PLAN_DY,
} from './config.js';

export {
  BPM, BEAT_SEC, UNITS_PER_BEAT, CLIMB_SPEED, LANES, LANE_W, WORLD_W, START_LANE, START_DIM,
  BAR_THICKNESS, CHECKPOINT_EVERY_BEATS,
} from './config.js';

// labelBeat: Position der Abschnittsmarke im Level (zwischen zwei Reihen, nie auf einem Hindernis)
// Abschnittsgrenzen nach Fortschritt: A 0–25 %, B 25–60 %, C 60–85 %, D 85–100 %.
export const SECTIONS = [
  { id: 'A', name: 'Einführung', from: 0, labelBeat: 0 },
  { id: 'B', name: 'Kombination', from: 22, labelBeat: 22 },
  { id: 'C', name: 'Präzision', from: 53, labelBeat: 52.6 },
  { id: 'D', name: 'Abschluss', from: 75, labelBeat: 75 },
];

const ROWS = [
  // --- A: Einführung – alle 3 Beats, jede Reihe lehrt genau eine Regel, zum Schluss ein einzelnes Siegel
  [4, '.WWW'], //  Tipp rechts -> schräg links hoch
  [7, 'W.WW'], //  Tipp links -> schräg rechts hoch
  [10, 'RRRR'], // Geister (inaktive Farbe) sind harmlos -> nicht tippen
  [13, 'BBBB'], // alles aktiv -> tippen = Dimension wechseln
  [16, 'W..W'], // Weiß tötet immer, zurück in die Mitte
  [20, 'SSSS'], // Rift-Siegel über die ganze Breite: kurz davor tippen, die Welle öffnet es
  // --- B: Kombination – Farbregeln aus M2 plus Siegel, deren Öffnungs-Tipp die Dimension mitwechselt
  [24, 'RBBR'],
  [26, 'BBRR'],
  [28, 'RRBB'],
  [30, 'W..W'],
  [32, 'BRRB'],
  [33, 'RBBR'],
  [35, 'WSSW'], // Siegel in der Mitte ...
  [36, 'BBRR'], // ... und direkt danach zählt die neue Dimension
  [38, 'RSSB'],
  [40, 'BRRW'],
  [42, 'BBWW'],
  [44, 'SSRR'],
  [45, 'RBWW'],
  [46, 'WWRR'],
  [48, 'RBWW'],
  [49, 'BRWW'],
  [51, 'BSSR'],
  [52, 'RRBB'],
  // --- C: Präzision – jeder Beat; Wand-Tipps öffnen Siegel, Diagonale durch Siegel, Richtungswechsel
  [54, '.WWW'],
  [55, 'SWWW'],
  [56, 'RWWW'],
  [57, 'SWWW'],
  [58, 'BWWW'],
  [59, 'BBWW'],
  [60, 'WSBW'],
  [61, 'WWSR'],
  [62, 'WWWS'],
  [63, 'WWRB'],
  [64, 'WBRW'],
  [65, 'BSWW'],
  [66, 'RBWW'],
  [67, 'WBRW'],
  [68, 'WRSW'],
  [69, 'WWRB'],
  [70, 'WWRR'],
  [71, 'RBSW'],
  [72, 'BRRW'],
  [73, 'BBRW'],
  [74, 'RBWW'],
  // --- D: Abschluss – nur Bekanntes, dicht und rhythmisch
  [76, 'RRRR'],
  [77, 'SSSS'],
  [78, 'BBBB'],
  [79, 'W..W'],
  [80, 'WSSW'],
  [81, 'RBBR'],
  [82, 'BRRB'],
  [83, 'SSSS'],
  [84, 'RRBB'],
  [85, 'W..W'],
];

/** Kurze Hinweise im Abschnitt A (dimensionsunabhängig formuliert). */
export const HINTS = [
  [2, 'TIPP RECHTS = ↖'],
  [5.5, 'TIPP LINKS = ↗'],
  [8.5, 'GESTRICHELT = HARMLOS'],
  [11.5, 'JEDER TIPP WECHSELT DIE FARBE'],
  [14.5, 'WEISS TÖTET IMMER'],
  [18, 'JEDER TIPP SENDET EINEN PULSE'],
  [18.7, 'PULSE ÖFFNET GOLD-SIEGEL'],
  [53.4, 'TIPP ZUR WAND = NUR FARBWECHSEL'],
];

export const FINISH_BEAT = 88;
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
