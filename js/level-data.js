// Versioniertes JSON-Levelmodell: gemeinsame Grundlage für Spiel, LEVEL FORGE (Editor) und Tests.
//
// Weltkoordinaten (Einheit u, unabhängig von Auflösung und Zoom):
//   x: 0 = linker Spielfeldrand, WORLD_W (360) = rechter Rand
//   y: 0 = Startlinie, wächst nach oben; der Spieler steigt mit CLIMB_SPEED (260 u/s)
// Hindernis/Siegel: x = linke Kante, y = Mittellinie, w/h = sichtbare Breite/Höhe.
// Die Kollision ist horizontal exakt die sichtbare Fläche, vertikal je 2 u kleiner (wie bisher 14 -> 10 u).
import {
  LANES, LANE_W, WORLD_W, UNITS_PER_BEAT, CLIMB_SPEED, BAR_INSET_X, BAR_THICKNESS, HIT_HALF_H,
  SEAL_OPEN_SEC, START_LANE, START_DIM, BPM,
} from './config.js';

export const LEVEL_SCHEMA = 'rift-climb-level';
export const LEVEL_VERSION = 1;
export const INDEX_SCHEMA = 'rift-climb-level-index';

/** Dimension im JSON -> Farbcode im Spiel (W tötet in beiden Dimensionen). */
export const DIMENSION_COLOR = Object.freeze({ both: 'W', blue: 'B', red: 'R' });
export const COLOR_DIMENSION = Object.freeze({ W: 'both', B: 'blue', R: 'red' });
export const START_DIMENSIONS = Object.freeze({ blue: 'B', red: 'R' });
export const OBJECT_TYPES = Object.freeze(['obstacle', 'seal', 'hint']);

export const LIMITS = Object.freeze({
  minW: 8,
  minH: 6,
  maxH: 520,
  bpm: [60, 200],
  finish: [UNITS_PER_BEAT * 4, CLIMB_SPEED * 600],
  sealOpen: [0.3, 1.5],
  hintLen: 40,
  nameLen: 40,
  descLen: 300,
  maxObjects: 5000,
});

const HIT_INSET_Y = BAR_THICKNESS / 2 - HIT_HALF_H;
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const OBJ_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (v) => Math.round(v * 100) / 100;

export function laneCenter(lane) {
  return lane * LANE_W + LANE_W / 2;
}

export function unitsPerBeat(bpm) {
  return CLIMB_SPEED * 60 / bpm;
}

/** Sichtbare und kollidierende Halbhöhe eines Objekts der Höhe h. */
export function halfHeights(h) {
  const hh = h / 2;
  return { hh, chh: Math.max(1, hh - HIT_INSET_Y) };
}

export function createEmptyLevel({ id = 'neues-level', name = 'Neues Level' } = {}) {
  const finishY = UNITS_PER_BEAT * 40;
  return {
    schema: LEVEL_SCHEMA,
    version: LEVEL_VERSION,
    id,
    name,
    description: '',
    bpm: BPM,
    beatsPerBar: 4,
    height: finishY + UNITS_PER_BEAT * 2,
    start: { lane: START_LANE, dimension: START_DIM === 'B' ? 'blue' : 'red' },
    finish: { y: finishY },
    objects: [],
  };
}

/**
 * Migration des bisherigen Reihenformats ([beat, "B.RW"] je Reihe, 120 BPM) ins JSON-Modell.
 * Benachbarte gleiche Zeichen werden wie im alten buildObstacles zu einem Objekt verschmolzen.
 */
export function levelFromRows(rows, { id = 'migriert', name = 'Migriertes Level', finishBeat = 88, hints = [], sections = null, description = '' } = {}) {
  const objects = [];
  for (const [beat, pattern] of rows) {
    let i = 0;
    while (i < LANES) {
      const c = pattern[i];
      if (c === '.') { i++; continue; }
      let j = i;
      while (j + 1 < LANES && pattern[j + 1] === c) j++;
      const base = { id: `b${beat}-${i}`, x: i * LANE_W + BAR_INSET_X, y: beat * UNITS_PER_BEAT, w: (j - i + 1) * LANE_W - 2 * BAR_INSET_X, h: BAR_THICKNESS };
      if (c === 'S') objects.push({ ...base, type: 'seal', openSec: SEAL_OPEN_SEC });
      else objects.push({ ...base, type: 'obstacle', dimension: COLOR_DIMENSION[c] });
      i = j + 1;
    }
  }
  hints.forEach(([beat, text], k) => objects.push({ id: `hint-${k}`, type: 'hint', y: round2(beat * UNITS_PER_BEAT), text }));
  const level = {
    schema: LEVEL_SCHEMA,
    version: LEVEL_VERSION,
    id,
    name,
    description,
    bpm: BPM,
    beatsPerBar: 4,
    height: finishBeat * UNITS_PER_BEAT,
    start: { lane: START_LANE, dimension: START_DIM === 'B' ? 'blue' : 'red' },
    finish: { y: finishBeat * UNITS_PER_BEAT },
    objects,
  };
  if (sections) level.sections = sections.map((s) => ({ id: s.id, name: s.name, y: s.from * UNITS_PER_BEAT, labelY: round2(s.labelBeat * UNITS_PER_BEAT) }));
  return level;
}

function issue(list, severity, code, message, extra = {}) {
  list.push({ severity, code, message, ...extra });
}

function fmtY(y) {
  return `y ${round2(y)}`;
}

/**
 * Prüft und normalisiert ein Level (beliebige Eingabe, wirft nie).
 * Rückgabe: { ok, level, issues } – ok = keine Fehler. level ist eine bereinigte Kopie (auch bei Fehlern, soweit möglich).
 * severity: 'error' (ungültig, Spiel lädt es nicht) | 'warning' (problematisches Design) | 'info'.
 */
export function validateLevelData(raw) {
  const issues = [];
  const err = (code, msg, extra) => issue(issues, 'error', code, msg, extra);
  const warn = (code, msg, extra) => issue(issues, 'warning', code, msg, extra);

  if (Array.isArray(raw)) {
    err('legacy', 'Altes Reihenformat – bitte über „Importieren“ laden (wird dort automatisch migriert).');
    return { ok: false, level: null, issues };
  }
  if (!raw || typeof raw !== 'object') {
    err('json', 'Die Datei enthält kein Level-Objekt.');
    return { ok: false, level: null, issues };
  }
  if (raw.schema !== LEVEL_SCHEMA) err('schema', `Unbekanntes Schema „${raw.schema ?? '–'}“ (erwartet „${LEVEL_SCHEMA}“).`);
  if (!Number.isInteger(raw.version) || raw.version < 1) err('version', 'Schema-Version fehlt oder ist ungültig.');
  else if (raw.version > LEVEL_VERSION) err('version', `Schema-Version ${raw.version} ist neuer als diese Spielversion (${LEVEL_VERSION}).`);

  const level = {
    schema: LEVEL_SCHEMA,
    version: LEVEL_VERSION,
    id: typeof raw.id === 'string' ? raw.id : '',
    name: typeof raw.name === 'string' ? raw.name : '',
    description: typeof raw.description === 'string' ? raw.description : '',
    bpm: isNum(raw.bpm) ? raw.bpm : BPM,
    beatsPerBar: raw.beatsPerBar ?? 4,
    height: isNum(raw.height) ? raw.height : NaN,
    start: null,
    finish: null,
    objects: [],
  };
  if (!ID_RE.test(level.id)) err('id', 'Level-ID fehlt oder ist ungültig (a–z, 0–9, Bindestrich, max. 40 Zeichen).', { field: 'id' });
  if (!level.name.trim() || level.name.length > LIMITS.nameLen) err('name', `Levelname fehlt oder ist länger als ${LIMITS.nameLen} Zeichen.`, { field: 'name' });
  if (level.description.length > LIMITS.descLen) warn('desc', `Beschreibung ist länger als ${LIMITS.descLen} Zeichen.`, { field: 'description' });
  if (!isNum(raw.bpm)) warn('bpm', `BPM fehlt – ${BPM} wird verwendet.`, { field: 'bpm' });
  else if (raw.bpm < LIMITS.bpm[0] || raw.bpm > LIMITS.bpm[1]) err('bpm', `BPM ${raw.bpm} liegt außerhalb ${LIMITS.bpm[0]}–${LIMITS.bpm[1]}.`, { field: 'bpm' });

  if (!Number.isInteger(level.beatsPerBar) || level.beatsPerBar < 2 || level.beatsPerBar > 7) err('meter', 'Beats pro Takt muss eine ganze Zahl von 2 bis 7 sein.', { field: 'beatsPerBar' });

  const s = raw.start;
  if (!s || typeof s !== 'object') {
    err('start', 'Startposition fehlt.', { field: 'start' });
  } else if (!Number.isInteger(s.lane) || s.lane < 0 || s.lane >= LANES || !START_DIMENSIONS[s.dimension]) {
    err('start', `Startposition ungültig (Spur 0–${LANES - 1}, Dimension „blue“ oder „red“).`, { field: 'start' });
  } else {
    level.start = { lane: s.lane, dimension: s.dimension };
  }

  const f = raw.finish;
  if (!f || typeof f !== 'object' || !isNum(f.y)) {
    err('finish', 'Zielbereich (finish.y) fehlt.', { field: 'finish' });
  } else if (f.y < LIMITS.finish[0] || f.y > LIMITS.finish[1]) {
    err('finish', `Ziellinie bei ${fmtY(f.y)} liegt außerhalb ${LIMITS.finish[0]}–${LIMITS.finish[1]} u.`, { field: 'finish', y: f.y });
  } else {
    level.finish = { y: f.y };
  }
  if (!isNum(level.height)) level.height = level.finish ? level.finish.y : LIMITS.finish[0];
  if (level.finish && level.height < level.finish.y) err('height', 'Spielbare Höhe ist kleiner als die Ziellinie.', { field: 'height' });
  if (level.height > LIMITS.finish[1] + UNITS_PER_BEAT * 8) err('height', 'Spielbare Höhe ist zu groß.', { field: 'height' });

  if (!Array.isArray(raw.objects)) {
    err('objects', 'Objektliste (objects) fehlt.');
  } else if (raw.objects.length > LIMITS.maxObjects) {
    err('objects', `Zu viele Objekte (max. ${LIMITS.maxObjects}).`);
  } else {
    const ids = new Set();
    raw.objects.forEach((o, i) => {
      const at = `Objekt ${i + 1}`;
      if (!o || typeof o !== 'object') { err('object', `${at} ist kein Objekt.`); return; }
      const id = typeof o.id === 'string' && OBJ_ID_RE.test(o.id) ? o.id : null;
      const ref = { objectId: id, y: isNum(o.y) ? o.y : undefined };
      const name = id ? `„${id}“` : at;
      if (!id) { err('object-id', `${at}: ID fehlt oder ist ungültig.`, ref); return; }
      if (ids.has(id)) { err('object-id', `${name}: ID ist doppelt vergeben.`, ref); return; }
      ids.add(id);
      if (!OBJECT_TYPES.includes(o.type)) {
        err('type', `${name}: Typ „${o.type}“ wird vom Spiel nicht unterstützt (vorhanden: Hindernis, Rift-Siegel, Hinweis).`, ref);
        return;
      }
      if (o.rotation !== undefined && o.rotation !== 0) { err('rotation', `${name}: Rotation wird vom Spiel nicht unterstützt (Objekt nicht übernommen).`, ref); return; }
      if (o.type === 'hint') {
        if (!isNum(o.y)) { err('pos', `${name}: Position y fehlt.`, ref); return; }
        if (typeof o.text !== 'string' || !o.text.trim()) { err('hint', `${name}: Hinweistext fehlt.`, ref); return; }
        if (o.text.length > LIMITS.hintLen) warn('hint', `${name}: Hinweis länger als ${LIMITS.hintLen} Zeichen (wird abgeschnitten).`, ref);
        if (o.y < 0 || o.y > level.height) err('bounds', `${name}: liegt außerhalb der spielbaren Höhe.`, ref);
        level.objects.push({ id, type: 'hint', y: o.y, text: o.text.slice(0, LIMITS.hintLen) });
        return;
      }
      if (![o.x, o.y, o.w, o.h].every(isNum)) { err('pos', `${name}: x, y, Breite und Höhe müssen Zahlen sein.`, ref); return; }
      const clean = { id, type: o.type, x: o.x, y: o.y, w: o.w, h: o.h };
      if (o.type === 'obstacle') {
        if (!DIMENSION_COLOR[o.dimension]) { err('dimension', `${name}: Dimension „${o.dimension}“ ungültig (both, blue, red).`, ref); return; }
        clean.dimension = o.dimension;
      } else {
        const open = o.openSec === undefined ? SEAL_OPEN_SEC : o.openSec;
        if (!isNum(open) || open < LIMITS.sealOpen[0] || open > LIMITS.sealOpen[1]) {
          err('seal', `${name}: Öffnungsdauer muss zwischen ${LIMITS.sealOpen[0]} und ${LIMITS.sealOpen[1]} s liegen.`, ref);
          return;
        }
        if (open < SEAL_OPEN_SEC) warn('seal-fair', `${name}: Öffnungsdauer unter ${SEAL_OPEN_SEC} s – die Fairness-Garantie („leuchtet = Tipp reicht“) gilt dann nicht mehr sicher.`, ref);
        clean.openSec = open;
      }
      if (o.w < LIMITS.minW || o.h < LIMITS.minH || o.h > LIMITS.maxH) {
        err('size', `${name}: ungültige Größe (Breite ≥ ${LIMITS.minW}, Höhe ${LIMITS.minH}–${LIMITS.maxH} u).`, ref);
        return;
      }
      if (o.x < -1e-6 || o.x + o.w > WORLD_W + 1e-6) err('bounds', `${name}: ragt aus der Spielfeldbreite (0–${WORLD_W} u).`, ref);
      if (o.y - o.h / 2 < 0 || o.y + o.h / 2 > level.height + 1e-6) err('bounds', `${name}: liegt außerhalb der spielbaren Höhe.`, ref);
      level.objects.push(clean);
    });
  }

  if (raw.sections !== undefined) {
    const ok = Array.isArray(raw.sections) && raw.sections.every((x, i, a) => x && typeof x.id === 'string' && typeof x.name === 'string' &&
      isNum(x.y) && (i === 0 || x.y > a[i - 1].y));
    if (ok) level.sections = raw.sections.map((x) => ({ id: x.id.slice(0, 3), name: x.name.slice(0, 24), y: x.y, labelY: isNum(x.labelY) ? x.labelY : x.y }));
    else warn('sections', 'Abschnittsliste ist ungültig und wird ignoriert.');
  }
  if (raw.replay !== undefined) {
    const r = raw.replay;
    const ok = r && Array.isArray(r.taps) && r.taps.every((t, i, a) => t && isNum(t.t) && t.t >= 0 && (t.dir === 1 || t.dir === -1) && (i === 0 || t.t >= a[i - 1].t));
    if (ok) level.replay = { taps: r.taps.map((t) => ({ t: t.t, dir: t.dir })), recordedAt: typeof r.recordedAt === 'string' ? r.recordedAt : undefined };
    else warn('replay', 'Aufgezeichneter Lauf ist ungültig und wird ignoriert.');
  }

  if (!issues.some((x) => x.severity === 'error')) designWarnings(level, warn);
  return { ok: !issues.some((x) => x.severity === 'error'), level, issues };
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y - a.h / 2 < b.y + b.h / 2 && b.y - b.h / 2 < a.y + a.h / 2;
}

const DIM_NAME = { both: 'neutral', blue: 'blau', red: 'rot' };

/** Design-Warnungen (keine Spielbarkeitsgarantie – nur bekannte Problemmuster). */
function designWarnings(level, warn) {
  const solid = level.objects.filter((o) => o.type !== 'hint').sort((a, b) => a.y - b.y);
  const finishY = level.finish.y;
  for (const o of level.objects) {
    if (o.y > finishY) warn('after-finish', `„${o.id}“ liegt hinter der Ziellinie und wird nie erreicht.`, { objectId: o.id, y: o.y });
  }
  for (const o of solid) {
    if (o.y - o.h / 2 < UNITS_PER_BEAT) warn('near-start', `„${o.id}“ liegt sehr nah am Start (< 0,5 s Reaktionszeit).`, { objectId: o.id, y: o.y });
  }
  // Überlappungen mit widersprüchlichen Zuständen (Sweep über y)
  let maxH = 0;
  for (const o of solid) maxH = Math.max(maxH, o.h);
  let reported = 0;
  for (let i = 0; i < solid.length && reported < 30; i++) {
    const a = solid[i];
    for (let j = i + 1; j < solid.length; j++) {
      const b = solid[j];
      if (b.y - a.y > (a.h + maxH) / 2) break;
      if (!rectsOverlap(a, b)) continue;
      let msg = null;
      if (a.type === 'seal' || b.type === 'seal') {
        const other = a.type === 'seal' ? b : a;
        if (other.type === 'obstacle') msg = `Rift-Siegel überlappt Hindernis „${other.id}“: dort bleibt die Fläche trotz Öffnen tödlich.`;
        else msg = 'zwei Rift-Siegel überlappen sich.';
      } else if (a.dimension !== b.dimension) {
        msg = `überlappt „${b.id}“ mit widersprüchlicher Dimension (${DIM_NAME[a.dimension]}/${DIM_NAME[b.dimension]}) – dort tödlich in beiden Dimensionen.`;
      } else {
        msg = `überlappt „${b.id}“ (gleiche Dimension) – besser zu einem Objekt zusammenfassen.`;
      }
      warn('overlap', `„${a.id}“ ${msg}`, { objectId: a.id, y: a.y });
      reported++;
    }
  }
  // Reihen, die auf allen Spuren in beiden Dimensionen dauerhaft tödlich sind
  const byY = new Map();
  for (const o of solid) {
    if (o.type !== 'obstacle') continue;
    if (!byY.has(o.y)) byY.set(o.y, []);
    byY.get(o.y).push(o);
  }
  for (const [y, objs] of byY) {
    const blocked = (dimColor) => [...Array(LANES).keys()].every((lane) => {
      const c = laneCenter(lane);
      return objs.some((o) => {
        const col = DIMENSION_COLOR[o.dimension];
        return (col === 'W' || col === dimColor) && o.x < c + 8 && o.x + o.w > c - 8;
      });
    });
    if (blocked('B') && blocked('R')) warn('blocked', `Reihe bei ${fmtY(y)} ist auf allen Spuren in beiden Dimensionen tödlich – unpassierbar.`, { objectId: objs[0].id, y });
  }
}

/** JSON-Text -> Level (inkl. Migration des alten Reihenformats). Wirft nie. */
export function parseLevelText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, level: null, issues: [{ severity: 'error', code: 'json', message: `Fehlerhafte JSON-Struktur: ${e.message}` }], migrated: false };
  }
  if (Array.isArray(raw) && raw.length && raw.every((r) => Array.isArray(r) && isNum(r[0]) && typeof r[1] === 'string' && /^[.BRWS]{4}$/.test(r[1]))) {
    const res = validateLevelData(levelFromRows(raw));
    res.migrated = true;
    res.issues.unshift({ severity: 'info', code: 'migrated', message: 'Altes Reihenformat erkannt und ins JSON-Modell migriert.' });
    return res;
  }
  return { ...validateLevelData(raw), migrated: false };
}

/** Feste Schlüsselreihenfolge für Export und Repo-Dateien. */
export function serializeLevel(level) {
  const out = {
    schema: LEVEL_SCHEMA,
    version: LEVEL_VERSION,
    id: level.id,
    name: level.name,
    description: level.description || '',
    bpm: level.bpm,
    beatsPerBar: level.beatsPerBar || 4,
    height: level.height,
    start: level.start,
    finish: level.finish,
  };
  if (level.sections) out.sections = level.sections;
  out.objects = level.objects.map((o) => {
    if (o.type === 'hint') return { id: o.id, type: o.type, y: o.y, text: o.text };
    const base = { id: o.id, type: o.type, x: o.x, y: o.y, w: o.w, h: o.h };
    if (o.type === 'obstacle') base.dimension = o.dimension;
    else base.openSec = o.openSec;
    return base;
  });
  if (level.replay) out.replay = level.replay;
  return JSON.stringify(out, null, 2) + '\n';
}

const DEFAULT_SECTION_FRACTIONS = [0, 0.25, 0.6, 0.85];

/**
 * Spur-Modell: Liegen alle Hindernisse/Siegel auf ganzen Spuren (Standardhöhe, y auf dem 0,5-s-Raster),
 * lässt sich das Level als Reihenliste [schritt, "B.RW"] darstellen und mit dem Spur-Solver beweisen.
 * Sonst null (freie Maße – Nachweis dann über einen aufgezeichneten Lauf).
 */
export function laneRows(level) {
  const rows = new Map();
  for (const o of level.objects) {
    if (o.type === 'hint') continue;
    const lane0 = (o.x - BAR_INSET_X) / LANE_W;
    const lanes = (o.w + 2 * BAR_INSET_X) / LANE_W;
    const step = o.y / UNITS_PER_BEAT;
    const int = (v) => Math.abs(v - Math.round(v)) < 1e-6;
    if (o.h !== BAR_THICKNESS || !int(lane0) || !int(lanes) || !int(step) || step < 1) return null;
    const k = Math.round(step);
    const row = rows.get(k) || ['.', '.', '.', '.'];
    const ch = o.type === 'seal' ? 'S' : DIMENSION_COLOR[o.dimension];
    for (let l = Math.round(lane0); l < Math.round(lane0 + lanes); l++) {
      if (row[l] !== '.') return null;
      row[l] = ch;
    }
    rows.set(k, row);
  }
  if (rows.size === 0) return null;
  const seals = level.objects.filter((o) => o.type === 'seal');
  if (seals.some((o) => o.openSec !== SEAL_OPEN_SEC)) return null;
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([k, r]) => [k, r.join('')]);
}

/** Laufzeitdaten fürs Spiel (aus einem gültigen, normalisierten Level). */
export function buildLevelRuntime(level) {
  const bpm = level.bpm;
  const upb = unitsPerBeat(bpm);
  const obstacles = [];
  const hints = [];
  for (const o of level.objects) {
    if (o.type === 'hint') { hints.push([o.y, o.text]); continue; }
    const { hh, chh } = halfHeights(o.h);
    obstacles.push({
      id: o.id,
      color: o.type === 'seal' ? 'S' : DIMENSION_COLOR[o.dimension],
      y: o.y,
      x0: o.x,
      x1: o.x + o.w,
      hh,
      chh,
      beat: round2(o.y / upb),
      openSec: o.type === 'seal' ? o.openSec : 0,
    });
  }
  obstacles.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  hints.sort((a, b) => a[0] - b[0]);
  // Linien: alle Objekte mit gleicher Mittellinie (für Checkpoints, Siegel-Serie, Solver-Zuordnung)
  const lines = [];
  for (const o of obstacles) {
    const last = lines[lines.length - 1];
    if (last && last.y === o.y) { last.objs.push(o); last.chh = Math.max(last.chh, o.chh); } else lines.push({ y: o.y, chh: o.chh, objs: [o] });
  }
  let maxChh = 0;
  let maxHh = 0;
  for (const o of obstacles) { maxChh = Math.max(maxChh, o.chh); maxHh = Math.max(maxHh, o.hh); }
  const finishY = level.finish.y;
  const sections = level.sections
    ? level.sections.map((s) => ({ ...s, auto: false }))
    : DEFAULT_SECTION_FRACTIONS.map((f, i) => ({ id: 'ABCD'[i], name: '', y: Math.round(finishY * f / upb) * upb, labelY: 0, auto: true }));
  return {
    id: level.id,
    name: level.name,
    bpm,
    beatSec: 60 / bpm,
    beatsPerBar: level.beatsPerBar || 4,
    unitsPerBeat: upb,
    finishY,
    finishBeat: finishY / upb,
    height: level.height,
    start: { lane: level.start.lane, dim: START_DIMENSIONS[level.start.dimension] },
    obstacles,
    seals: obstacles.filter((o) => o.color === 'S'),
    lines,
    maxChh,
    maxHh,
    hints,
    sections,
    rows: laneRows(level),
    replay: level.replay || null,
  };
}

/** Prüft einen Levelindex (assets/levels/index.json). */
export function validateIndex(raw) {
  const errors = [];
  if (!raw || raw.schema !== INDEX_SCHEMA || !Array.isArray(raw.levels) || raw.levels.length === 0) {
    errors.push('Levelindex ungültig');
    return { ok: false, errors, index: null };
  }
  const levels = raw.levels.filter((l) => l && ID_RE.test(l.id) && typeof l.file === 'string' && /^[a-z0-9-]+\.json$/.test(l.file));
  if (levels.length !== raw.levels.length) errors.push('Levelindex enthält ungültige Einträge');
  const def = levels.find((l) => l.id === raw.default) ? raw.default : levels[0] && levels[0].id;
  return { ok: errors.length === 0, errors, index: { default: def, levels: levels.map((l) => ({ id: l.id, name: typeof l.name === 'string' ? l.name : l.id, file: l.file })) } };
}
