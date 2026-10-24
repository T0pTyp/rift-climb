// LEVEL FORGE – visueller Level-Editor für RIFT CLIMB: PULSE.
// Nutzt dieselben Leveldaten (js/level-data.js), Formen (js/shapes.js) und für den Playtest
// das unveränderte Spiel (index.html?playtest=1) – keine zweite Spiellogik im Editor.
import { WORLD_W, LANES, LANE_W, CLIMB_SPEED, SEAL_OPEN_SEC, BAR_THICKNESS } from '../config.js';
import {
  validateLevelData, parseLevelText, serializeLevel, createEmptyLevel, unitsPerBeat, validateIndex, LIMITS,
} from '../level-data.js';
import { checkPlayability } from '../playcheck.js';
import { LevelDoc } from './history.js';
import { ForgeView, objRect, fmt } from './view.js';
import { ForgeStore } from './store.js';
import { PropsPanel, renderIssues } from './panels.js';

const $ = (s) => document.querySelector(s);
const PLAYTEST_KEY = 'riftforge.playtest';
const PREFS_KEY = 'riftforge.prefs';
const LEVELS_URL = '../levels/';
const GAME_URL = '../../index.html';
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const PSEUDO = new Set(['__start', '__finish', '__test']);
const round2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Palette: nur Objekte, die das Spiel tatsächlich kennt (Barriere = Hindernis mit anderer Höhe). */
const KINDS = {
  neutral: { type: 'obstacle', dimension: 'both', w: 84, h: BAR_THICKNESS, label: 'Neutrales Hindernis' },
  blue: { type: 'obstacle', dimension: 'blue', w: 84, h: BAR_THICKNESS, label: 'Blaues Hindernis' },
  red: { type: 'obstacle', dimension: 'red', w: 84, h: BAR_THICKNESS, label: 'Rotes Hindernis' },
  barrier: { type: 'obstacle', dimension: 'both', w: 84, h: 130, label: 'Rechteckige Barriere' },
  seal: { type: 'seal', w: 84, h: BAR_THICKNESS, openSec: SEAL_OPEN_SEC, label: 'Rift-Siegel' },
  hint: { type: 'hint', text: 'HINWEIS', label: 'Hinweistext' },
  start: { type: 'start', label: 'Startposition' },
  finish: { type: 'finish', label: 'Zielbereich' },
  test: { type: 'test', label: 'Testmarker' },
};
const ID_PREFIX = { obstacle: 'obs', seal: 'seal', hint: 'hint' };

const S = {
  tool: 'select',
  kind: 'neutral',
  selection: new Set(),
  hover: null,
  dimMode: 'both',
  beats: true,
  hitboxes: false,
  showReach: true,
  metronome: false,
  grid: { show: true, enabled: true, size: 10, snapX: 'lane', snapY: 'beat' },
  sealOpen: new Set(),
  testMarker: null,
  ghost: null,
  marquee: null,
  playhead: null,
  drag: null,
  editTx: null,
  issues: [],
  issuesById: new Map(),
  play: null,
  sourceId: null,
  cleanJson: '',
  saveState: 'idle',
  savedAt: null,
  pointer: null,
  altDown: false,
  spaceDown: false,
  clipboard: null,
  pasteCount: 0,
  rhythm: null,
  playtest: null,
  stats: { drawn: 0 },
};

const view = new ForgeView($('#view'));
const store = new ForgeStore();
let doc = null;
let props = null;

// ------------------------------------------------------------------ Hilfen

function toast(msg, kind = 'info') {
  const t = $('#toast');
  t.textContent = msg;
  t.dataset.kind = kind;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), kind === 'error' ? 6000 : 3200);
}

function modal(title, body, buttons) {
  return new Promise((resolve) => {
    const m = $('#modal');
    $('#modal-title').textContent = title;
    const b = $('#modal-body');
    b.textContent = '';
    if (typeof body === 'string') b.append(Object.assign(document.createElement('p'), { textContent: body }));
    else if (body) b.append(body);
    const actions = $('#modal-actions');
    actions.textContent = '';
    const close = (v) => {
      m.hidden = true;
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(null); }
    };
    for (const [label, value, cls] of buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn ${cls || ''}`;
      btn.textContent = label;
      btn.addEventListener('click', () => close(value));
      actions.append(btn);
    }
    m.close = close;
    m.hidden = false;
    document.addEventListener('keydown', onKey, true);
    const primary = actions.querySelector('.primary') || actions.lastChild;
    if (primary) primary.focus();
  });
}

function upb() {
  return unitsPerBeat(doc.level.bpm);
}

function snapOn() {
  return S.grid.enabled && !S.altDown;
}

/** Horizontal: linke Kante auf Spurkante (90k + 3), Raster oder pixelgenau (0,5 u). */
function snapLeft(x) {
  if (!snapOn() || S.grid.snapX === 'off') return Math.round(x * 2) / 2;
  if (S.grid.snapX === 'lane') return Math.round((x - 3) / LANE_W) * LANE_W + 3;
  return Math.round(x / S.grid.size) * S.grid.size;
}

function snapRight(x) {
  if (!snapOn() || S.grid.snapX === 'off') return Math.round(x * 2) / 2;
  if (S.grid.snapX === 'lane') return Math.round((x + 3) / LANE_W) * LANE_W - 3;
  return Math.round(x / S.grid.size) * S.grid.size;
}

/** Vertikal: Beat-Raster aus BPM (ganz/halb/viertel), Raster oder pixelgenau. */
function snapY(y) {
  if (!snapOn() || S.grid.snapY === 'off') return Math.round(y * 2) / 2;
  if (S.grid.snapY === 'grid') return Math.round(y / S.grid.size) * S.grid.size;
  const step = upb() / ({ beat: 1, half: 2, quarter: 4 }[S.grid.snapY] || 1);
  return round2(Math.round(y / step) * step);
}

function snapStepY() {
  if (!snapOn() || S.grid.snapY === 'off') return 1;
  if (S.grid.snapY === 'grid') return S.grid.size;
  return upb() / ({ beat: 1, half: 2, quarter: 4 }[S.grid.snapY] || 1);
}

function snapStepX() {
  if (!snapOn() || S.grid.snapX === 'off') return 1;
  return S.grid.snapX === 'lane' ? LANE_W : S.grid.size;
}

function laneAt(x) {
  return clamp(Math.floor(x / LANE_W), 0, LANES - 1);
}

const requestRender = (() => {
  let pending = false;
  return () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      render();
    });
  };
})();

function render() {
  if (!doc) return;
  view.render({
    doc, selection: S.selection, hover: S.hover, dimMode: S.dimMode, grid: S.grid, beats: S.beats,
    hitboxes: S.hitboxes, showReach: S.showReach, sealOpen: S.sealOpen, testMarker: S.testMarker,
    ghost: S.ghost, marquee: S.marquee, playhead: S.playhead, issuesById: S.issuesById, stats: S.stats,
  });
  $('#zoom-label').textContent = `${Math.round(view.cam.z / view.fitZoom() * 100)}%`;
  $('#draw-info').textContent = `${S.stats.drawn} von ${doc.objects.length} Objekten gezeichnet`;
}

// ------------------------------------------------------------------ Dokument

function onDocChange(info) {
  for (const id of [...S.selection]) if (!PSEUDO.has(id) && !doc.get(id)) S.selection.delete(id);
  requestRender();
  scheduleValidation();
  if (info.live) {
    props.refresh();
    return;
  }
  setSaveState('pending');
  scheduleAutosave();
  updateButtons();
  if (props.root.contains(document.activeElement)) props.refresh();
  else props.render();
  updateSelInfo();
}

function loadDocument(level, { sourceId = null, clean = true, message } = {}) {
  if (S.editTx) S.editTx = null;
  if (!doc) doc = new LevelDoc(level, onDocChange);
  else doc.load(level);
  S.selection.clear();
  S.sealOpen.clear();
  S.testMarker = null;
  S.hover = null;
  S.sourceId = sourceId || level.id;
  S.cleanJson = clean ? JSON.stringify(doc.level) : '';
  view.resetZoom();
  view.cam.y = view.H / 2 / view.cam.z - 70;
  $('#level-title').textContent = level.name;
  props.render();
  runValidation();
  updateButtons();
  updateSelInfo();
  requestRender();
  scheduleAutosave();
  if (message) toast(message);
}

function setSelection(ids, { add = false } = {}) {
  if (S.editTx) commitEdit();
  if (!add) S.selection.clear();
  for (const id of ids) S.selection.add(id);
  props.render();
  updateSelInfo();
  requestRender();
}

function updateSelInfo() {
  const n = S.selection.size;
  const ids = [...S.selection];
  let text = 'Keine Auswahl – Klick ins Leere zeigt die Level-Einstellungen';
  if (n === 1) {
    const id = ids[0];
    const o = doc.get(id);
    text = id === '__start' ? 'Startposition' : id === '__finish' ? 'Ziellinie' : id === '__test' ? 'Testmarker' : o ? `${o.id} (${o.type === 'seal' ? 'Rift-Siegel' : o.type === 'hint' ? 'Hinweis' : 'Hindernis'})` : '';
  } else if (n > 1) text = `${n} Objekte ausgewählt`;
  $('#sel-info').textContent = text;
}

function updateButtons() {
  $('#btn-undo').disabled = !doc.canUndo;
  $('#btn-redo').disabled = !doc.canRedo;
  const last = doc.undoStack[doc.undoStack.length - 1];
  const next = doc.redoStack[doc.redoStack.length - 1];
  $('#btn-undo').title = `Rückgängig (Strg/Cmd+Z)${last ? ': ' + last.label : ''}`;
  $('#btn-redo').title = `Wiederherstellen (Strg/Cmd+Y)${next ? ': ' + next.label : ''}`;
  $('#level-title').textContent = doc.level.name || '(ohne Namen)';
}

/** Eigenschaftsfeld: Änderungen live anwenden, ein Feld = ein Undo-Schritt. */
function liveEdit(key, label, fn) {
  if (!S.editTx || S.editTx.key !== key || S.editTx.tx.done) {
    if (S.editTx) S.editTx.tx.commit();
    S.editTx = { key, tx: doc.begin(label) };
  }
  fn(S.editTx.tx);
  doc.touched();
}

function commitEdit() {
  if (!S.editTx) return;
  const { tx } = S.editTx;
  S.editTx = null;
  if (!tx.commit()) requestRender();
}

function edit(label, fn) {
  commitEdit();
  const tx = doc.begin(label);
  fn(tx);
  if (!tx.commit()) {
    props.render();
    requestRender();
  }
}

function markEditorState() {
  requestRender();
  scheduleAutosave();
}

// ------------------------------------------------------------------ Validierung

let validationTimer = 0;
function scheduleValidation() {
  clearTimeout(validationTimer);
  validationTimer = setTimeout(runValidation, 300);
}

function runValidation() {
  clearTimeout(validationTimer);
  const res = validateLevelData(doc.level);
  S.play = res.ok ? checkPlayability(res.level) : null;
  S.issues = res.issues;
  S.issuesById = new Map();
  for (const i of res.issues) {
    if (!i.objectId) continue;
    if (i.severity === 'error' || !S.issuesById.has(i.objectId)) S.issuesById.set(i.objectId, i.severity);
  }
  if (S.play && S.play.replay && S.play.replay.killer && !S.issuesById.has(S.play.replay.killer.id)) S.issuesById.set(S.play.replay.killer.id, 'warning');
  renderIssues($('#check-list'), $('#check-summary'), res.issues, S.play, focusIssue);
  const errs = res.issues.filter((i) => i.severity === 'error').length;
  for (const id of ['#btn-playtest', '#btn-playfrom', '#btn-export']) $(id).classList.toggle('blocked', errs > 0);
  requestRender();
  return res;
}

function focusIssue(i) {
  if (i.objectId && doc.get(i.objectId)) {
    setSelection([i.objectId]);
    centerOn(doc.get(i.objectId).y);
  } else if (i.y !== undefined) {
    centerOn(i.y);
  }
  if (i.field) {
    setSelection(i.field === 'start' ? ['__start'] : i.field === 'finish' ? ['__finish'] : []);
    const key = { finish: 'finish', start: 'start-lane' }[i.field] || i.field;
    const input = props.root.querySelector(`[data-key="${key}"]`);
    if (input) input.focus();
  }
}

function centerOn(y) {
  view.cam.y = y;
  view.clampCamera(doc.level.height);
  requestRender();
}

// ------------------------------------------------------------------ Speichern

let autosaveTimer = 0;
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(autosave, 600);
}

async function autosave() {
  if (!store.available) { setSaveState(); return; }
  try {
    await store.saveDraft({ level: doc.level, sourceId: S.sourceId, cleanJson: S.cleanJson, testMarker: S.testMarker, savedAt: new Date().toISOString() });
    S.savedAt = new Date();
    setSaveState('draft');
  } catch (err) {
    console.warn('Autospeicherung fehlgeschlagen:', err);
    setSaveState('failed');
  }
}

function isClean() {
  return S.cleanJson && S.cleanJson === JSON.stringify(doc.level);
}

function setSaveState(state = S.saveState) {
  S.saveState = state;
  const el = $('#save-status');
  const time = S.savedAt ? S.savedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  let text;
  let st;
  if (!store.available) { text = 'Autospeicherung nicht verfügbar – bitte exportieren'; st = 'warn'; }
  else if (state === 'pending') { text = 'Änderungen werden gesichert…'; st = 'pending'; }
  else if (state === 'failed') { text = 'Autospeicherung fehlgeschlagen – bitte exportieren'; st = 'warn'; }
  else if (isClean()) { text = `Gespeichert${time ? ' · ' + time : ''}`; st = 'ok'; }
  else { text = `Entwurf automatisch gesichert${time ? ' · ' + time : ''}`; st = 'draft'; }
  el.textContent = text;
  el.dataset.state = st;
  el.title = 'Lokal im Browser (IndexedDB). „Speichern“ legt das Level in der lokalen Bibliothek ab; veröffentlicht wird nur über Export + Commit ins Repo.';
  $('#btn-save').classList.toggle('dirty', !isClean());
}

async function saveLocal() {
  commitEdit();
  if (!store.available) {
    toast('Lokaler Speicher nicht verfügbar – bitte „Exportieren“ verwenden.', 'error');
    return false;
  }
  if (!ID_RE.test(doc.level.id)) {
    toast('Speichern nicht möglich: Level-ID ungültig (Level-Einstellungen).', 'error');
    focusIssue({ field: 'id' });
    return false;
  }
  try {
    await store.saveLevel(JSON.parse(JSON.stringify(doc.level)));
    S.cleanJson = JSON.stringify(doc.level);
    S.sourceId = doc.level.id;
    await autosave();
    toast(`„${doc.level.name}“ lokal im Browser gespeichert. Ins Spiel kommt es über Exportieren + Commit.`, 'ok');
    return true;
  } catch (err) {
    toast(`Speichern fehlgeschlagen: ${err.message}`, 'error');
    return false;
  }
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportText() {
  const res = validateLevelData(doc.level);
  if (!res.ok) return { ok: false, res };
  const level = res.level;
  const play = checkPlayability(level);
  let dropped = false;
  if (play.method === 'replay' && !play.ok) {
    delete level.replay;
    dropped = true;
  }
  return { ok: true, res, play: dropped ? checkPlayability(level) : play, dropped, text: serializeLevel(level), level };
}

function exportLevel() {
  commitEdit();
  const out = exportText();
  if (!out.ok) {
    const n = out.res.issues.filter((i) => i.severity === 'error').length;
    toast(`Export nicht möglich: ${n} Fehler – siehe Prüfung.`, 'error');
    focusIssue(out.res.issues.find((i) => i.severity === 'error'));
    return null;
  }
  download(`${out.level.id}.json`, out.text);
  let msg = `Exportiert: ${out.level.id}.json`;
  if (out.dropped) msg += ' – veralteter Testlauf entfernt';
  if (out.play.ok !== true) msg += ' · Hinweis: Die Deploy-Prüfung verlangt einen Nachweis (Playtest bis zum Ziel).';
  toast(msg, out.play.ok === true ? 'ok' : 'warn');
  return out;
}

async function importFile(file) {
  let text;
  try {
    text = await file.text();
  } catch (err) {
    toast(`Datei nicht lesbar: ${err.message}`, 'error');
    return;
  }
  importText(text, file.name);
}

const FATAL = new Set(['json', 'legacy', 'schema', 'version', 'start', 'finish', 'objects']);

async function importText(text, name = 'Datei') {
  const res = parseLevelText(text);
  const errors = res.issues.filter((i) => i.severity === 'error');
  const list = document.createElement('ul');
  list.className = 'modal-issues';
  for (const i of res.issues.slice(0, 12)) {
    const li = document.createElement('li');
    li.className = i.severity;
    li.textContent = i.message;
    list.append(li);
  }
  if (res.issues.length > 12) list.append(Object.assign(document.createElement('li'), { textContent: `… und ${res.issues.length - 12} weitere` }));
  if (errors.some((i) => FATAL.has(i.code)) || !res.level || !res.level.start || !res.level.finish) {
    await modal(`Import fehlgeschlagen: ${name}`, list, [['OK', true, 'primary']]);
    return false;
  }
  if (errors.length) {
    const wrap = document.createElement('div');
    wrap.append(Object.assign(document.createElement('p'), { textContent: `Die Datei enthält ${errors.length} Fehler. Ungültige Objekte werden nicht übernommen, der Rest wird geladen und in der Prüfung markiert.` }), list);
    const ok = await modal(`Import mit Fehlern: ${name}`, wrap, [['Abbrechen', false], ['Bereinigt übernehmen', true, 'primary']]);
    if (!ok) return false;
    const l = res.level;
    if (!ID_RE.test(l.id)) l.id = 'importiert';
    if (!l.name.trim()) l.name = 'Importiertes Level';
    l.bpm = clamp(l.bpm, LIMITS.bpm[0], LIMITS.bpm[1]);
    l.height = Math.max(l.height, l.finish.y);
  }
  if (!(await confirmDiscard())) return false;
  loadDocument(res.level, { clean: false, message: `Importiert: ${res.level.name}${res.migrated ? ' (altes Reihenformat migriert)' : ''}${res.issues.length ? ` – ${res.issues.length} Hinweise in der Prüfung` : ''}` });
  return true;
}

/** Vor dem Ersetzen des Dokuments: ungespeicherte Änderungen nicht stillschweigend verwerfen. */
async function confirmDiscard() {
  commitEdit();
  if (isClean() || !doc.canUndo) return true;
  const r = await modal('Ungespeicherte Änderungen', `„${doc.level.name}“ wurde seit dem letzten Speichern verändert. Der automatisch gesicherte Entwurf wird beim Öffnen eines anderen Levels ersetzt.`, [
    ['Abbrechen', null], ['Verwerfen', 'discard', 'danger'], ['Speichern', 'save', 'primary'],
  ]);
  if (r === 'save') return saveLocal();
  return r === 'discard';
}

async function newLevel() {
  if (!(await confirmDiscard())) return;
  const id = `level-${Date.now().toString(36).slice(-6)}`;
  loadDocument(createEmptyLevel({ id, name: 'Neues Level' }), { clean: false, message: 'Neues Level angelegt – Name, ID und BPM in den Level-Einstellungen.' });
}

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function gameLevels() {
  const idx = validateIndex(await fetchJson(`${LEVELS_URL}index.json`));
  if (!idx.index) throw new Error('Levelindex ungültig');
  return idx.index;
}

async function openGameLevel(entry) {
  const res = validateLevelData(await fetchJson(LEVELS_URL + entry.file));
  if (!res.ok) throw new Error(res.issues.find((i) => i.severity === 'error').message);
  loadDocument(res.level, { sourceId: entry.id, message: `Spiel-Level geöffnet: ${res.level.name}` });
  return res.level;
}

async function openDialog() {
  commitEdit();
  const body = document.createElement('div');
  body.className = 'open-dialog';
  const mkList = (title, note) => {
    const sec = document.createElement('section');
    sec.innerHTML = `<h3></h3><p class="note"></p><ul class="open-list"></ul>`;
    sec.querySelector('h3').textContent = title;
    sec.querySelector('.note').textContent = note;
    body.append(sec);
    return sec.querySelector('ul');
  };
  const gameList = mkList('Spiel-Level', 'Veröffentlichte Level aus assets/levels/ – Änderungen bleiben lokal, bis du exportierst und committest.');
  const localList = mkList('Lokal gespeichert', 'In diesem Browser gespeicherte Level (IndexedDB).');
  const item = (list, label, sub, actions) => {
    const li = document.createElement('li');
    const t = document.createElement('div');
    t.className = 'open-name';
    t.textContent = label;
    const s = document.createElement('div');
    s.className = 'open-sub';
    s.textContent = sub;
    t.append(s);
    li.append(t);
    for (const [txt, fn, cls] of actions) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn small ${cls || ''}`;
      b.textContent = txt;
      b.addEventListener('click', fn);
      li.append(b);
    }
    list.append(li);
    return li;
  };
  const done = modal('Level öffnen', body, [['Datei importieren…', 'import'], ['Schließen', null, 'primary']]);
  const close = (v) => $('#modal').close(v);
  try {
    const idx = await gameLevels();
    for (const entry of idx.levels) {
      item(gameList, entry.name, `${entry.id} · assets/levels/${entry.file}`, [['Öffnen', async () => {
        close('opened');
        if (!(await confirmDiscard())) return;
        try { await openGameLevel(entry); } catch (err) { toast(`Öffnen fehlgeschlagen: ${err.message}`, 'error'); }
      }, 'primary']]);
    }
  } catch (err) {
    item(gameList, 'Levelindex nicht erreichbar', err.message, []);
  }
  if (store.available) {
    const levels = (await store.listLevels()).sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
    if (!levels.length) item(localList, 'Noch nichts gespeichert', 'Strg/Cmd+S speichert das aktuelle Level hier.', []);
    for (const rec of levels) {
      const li = item(localList, rec.name, `${rec.id} · ${new Date(rec.savedAt).toLocaleString('de-DE')}`, [
        ['Öffnen', async () => {
          close('opened');
          if (!(await confirmDiscard())) return;
          const res = validateLevelData(rec.level);
          if (!res.level || !res.level.start || !res.level.finish) { toast('Gespeicherter Stand ist beschädigt.', 'error'); return; }
          loadDocument(res.level, { sourceId: rec.id, message: `Lokal gespeichertes Level geöffnet: ${rec.name}` });
        }, 'primary'],
        ['Löschen', async () => {
          await store.deleteLevel(rec.id);
          li.remove();
          toast(`„${rec.name}“ aus dem lokalen Speicher gelöscht.`);
        }, 'danger'],
      ]);
    }
  } else {
    item(localList, 'Lokaler Speicher nicht verfügbar', 'Der Browser blockiert IndexedDB (z. B. privater Modus).', []);
  }
  const r = await done;
  if (r === 'import') $('#file-import').click();
}

function publishHelp() {
  const body = document.createElement('div');
  body.className = 'help-body';
  body.innerHTML = `
    <p>GitHub Pages ist statisch: LEVEL FORGE speichert <b>nur lokal im Browser</b> und kann nicht direkt auf GitHub schreiben.</p>
    <ol>
      <li><b>Exportieren</b> lädt <code>&lt;level-id&gt;.json</code> herunter.</li>
      <li>Datei nach <code>assets/levels/</code> im Repo legen.</li>
      <li>In <code>assets/levels/index.json</code> unter <code>levels</code> eintragen: <code>{ "id", "name", "file" }</code>.</li>
      <li>Committen und auf <code>main</code> pushen. Der Pages-Workflow prüft alle Level (<code>node tests/validate-level.mjs</code>) und veröffentlicht sie.</li>
    </ol>
    <p>Die Prüfung verlangt einen Spielbarkeits-Nachweis: entweder spurgenaue Objekte (Spur-Solver) oder einen im <b>PLAYTEST</b> bis zum Ziel gespielten Lauf (wird automatisch im Level gespeichert).</p>
    <p>Im Spiel erscheint das Level danach in der Levelauswahl des Menüs (oder direkt über <code>?level=&lt;id&gt;</code>).</p>`;
  modal('Level veröffentlichen', body, [['Verstanden', true, 'primary']]);
}

// ------------------------------------------------------------------ Aktionen

function deleteSelection() {
  commitEdit();
  const ids = [...S.selection];
  if (!ids.length) return;
  if (ids.includes('__test')) removeTestMarker();
  const real = ids.filter((id) => !PSEUDO.has(id));
  if (ids.includes('__start') || ids.includes('__finish')) toast('Start und Ziel sind Pflicht und können nur verschoben werden.', 'warn');
  if (!real.length) return;
  const tx = doc.begin(real.length > 1 ? `${real.length} Objekte löschen` : 'Löschen');
  for (const id of real) tx.remove(id);
  tx.commit();
  S.selection.clear();
  props.render();
  updateSelInfo();
}

function cloneObjects(objs, dy, label) {
  const tx = doc.begin(label);
  const ids = [];
  for (const o of objs) {
    const c = JSON.parse(JSON.stringify(o));
    c.id = doc.newId(ID_PREFIX[c.type] || 'obj');
    c.y = round2(c.y + dy);
    tx.create(c);
    ids.push(c.id);
  }
  tx.commit();
  setSelection(ids);
  return ids;
}

function selectedObjects() {
  return [...S.selection].map((id) => doc.get(id)).filter(Boolean);
}

function duplicate() {
  commitEdit();
  const objs = selectedObjects();
  if (!objs.length) return;
  const ids = cloneObjects(objs, upb(), objs.length > 1 ? `${objs.length} Objekte duplizieren` : 'Duplizieren');
  toast(`${ids.length} Objekt${ids.length > 1 ? 'e' : ''} dupliziert (1 Beat höher)`);
}

function copy() {
  const objs = selectedObjects();
  if (!objs.length) return;
  S.clipboard = JSON.parse(JSON.stringify(objs));
  S.pasteCount = 0;
  toast(`${objs.length} Objekt${objs.length > 1 ? 'e' : ''} kopiert`);
}

function paste() {
  commitEdit();
  if (!S.clipboard || !S.clipboard.length) { toast('Zwischenablage ist leer (Strg/Cmd+C kopiert die Auswahl).', 'warn'); return; }
  const minY = Math.min(...S.clipboard.map((o) => o.y));
  let dy;
  if (S.pointer && S.pointer.inside) dy = snapY(S.pointer.wy) - minY;
  else dy = upb() * (++S.pasteCount);
  cloneObjects(S.clipboard, dy, S.clipboard.length > 1 ? `${S.clipboard.length} Objekte einfügen` : 'Einfügen');
}

function nudge(dx, dy) {
  const objs = selectedObjects();
  if (!objs.length) {
    if (S.selection.has('__finish')) edit('Ziel verschieben', (tx) => { const l = tx.touchMeta(); l.finish.y = Math.max(LIMITS.finish[0], round2(l.finish.y + dy)); if (l.height < l.finish.y) l.height = l.finish.y; });
    else if (S.selection.has('__test') && S.testMarker) { S.testMarker.y = Math.max(0, round2(S.testMarker.y + dy)); props.refresh(); markEditorState(); }
    return;
  }
  edit('Verschieben', (tx) => {
    for (const o of objs) {
      const x = tx.touch(o.id);
      if (x.type !== 'hint') x.x = clamp(round2(x.x + dx), 0, WORLD_W - x.w);
      x.y = Math.max(0, round2(x.y + dy));
    }
  });
}

function removeTestMarker() {
  S.testMarker = null;
  S.selection.delete('__test');
  props.render();
  markEditorState();
}

function clearReplay() {
  edit('Aufzeichnung entfernen', (tx) => { delete tx.touchMeta().replay; });
}

function setTool(tool) {
  S.tool = tool;
  for (const b of document.querySelectorAll('.tool[data-tool]')) b.classList.toggle('active', b.dataset.tool === tool);
  for (const b of document.querySelectorAll('.pal')) b.classList.toggle('active', tool === 'place' && b.dataset.kind === S.kind);
  if (tool !== 'place') S.ghost = null;
  updateCursor();
  requestRender();
}

function setKind(kind) {
  if (!KINDS[kind]) {
    toast('Dreieckige Stacheln gibt es im Spiel nicht – LEVEL FORGE erfindet keine neuen Mechaniken. Nutze Hindernisse oder Barrieren.', 'warn');
    return;
  }
  S.kind = kind;
  setTool('place');
}

function setDimMode(m) {
  S.dimMode = m;
  for (const b of document.querySelectorAll('.seg [data-dim]')) b.classList.toggle('active', b.dataset.dim === m);
  savePrefs();
  requestRender();
}

function setToggle(key, v) {
  S[key] = v;
  const map = { beats: '#tg-beats', hitboxes: '#tg-hitboxes', showReach: '#tg-reach', metronome: '#tg-metronome' };
  if (map[key]) $(map[key]).checked = v;
  savePrefs();
  props.refresh();
  requestRender();
}

function setGrid(patch) {
  Object.assign(S.grid, patch);
  $('#grid-size').value = String(S.grid.size);
  $('#snap-x').value = S.grid.snapX;
  $('#snap-y').value = S.grid.snapY;
  $('#grid-show').checked = S.grid.show;
  $('#snap-on').checked = S.grid.enabled;
  const tg = $('#btn-grid-toggle');
  tg.setAttribute('aria-pressed', String(S.grid.enabled));
  tg.classList.toggle('active', S.grid.enabled);
  savePrefs();
  requestRender();
}

function savePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ grid: S.grid, dimMode: S.dimMode, beats: S.beats, hitboxes: S.hitboxes, showReach: S.showReach, metronome: S.metronome }));
  } catch { /* optional */ }
}

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (!p) return;
    if (p.grid) Object.assign(S.grid, p.grid);
    for (const k of ['dimMode', 'beats', 'hitboxes', 'showReach', 'metronome']) if (k in p) S[k] = p[k];
  } catch { /* optional */ }
}

// ------------------------------------------------------------------ Platzieren und Ziehen

function ghostFor(kind, wx, wy) {
  const k = KINDS[kind];
  if (!k) return null;
  if (k.type === 'obstacle' || k.type === 'seal') {
    const x = clamp(snapLeft(wx - k.w / 2), 0, WORLD_W - k.w);
    return { ...k, x, y: Math.max(k.h / 2, snapY(wy)) };
  }
  if (k.type === 'hint') return { ...k, y: Math.max(0, snapY(wy)) };
  if (k.type === 'start') return { type: 'start', lane: laneAt(wx), y: 0, dim: doc.level.start.dimension === 'red' ? 'R' : 'B' };
  if (k.type === 'finish') return { type: 'finish', y: Math.max(LIMITS.finish[0], snapY(wy)) };
  return { type: 'test', lane: laneAt(wx), y: Math.max(0, snapY(wy)), dim: S.dimMode === 'R' ? 'R' : 'B' };
}

/** Setzt ein Palettenobjekt; liefert eine offene Transaktion, damit direkt weitergezogen werden kann. */
function placeAt(kind, wx, wy) {
  commitEdit();
  const g = ghostFor(kind, wx, wy);
  if (!g) return null;
  if (g.type === 'start') {
    edit('Start setzen', (tx) => { tx.touchMeta().start.lane = g.lane; });
    setSelection(['__start']);
    return null;
  }
  if (g.type === 'finish') {
    edit('Ziel setzen', (tx) => { const l = tx.touchMeta(); l.finish.y = g.y; if (l.height < g.y) l.height = g.y; });
    setSelection(['__finish']);
    return null;
  }
  if (g.type === 'test') {
    S.testMarker = { y: g.y, lane: g.lane, dim: g.dim };
    setSelection(['__test']);
    markEditorState();
    return null;
  }
  const tx = doc.begin(`${KINDS[kind].label} platzieren`);
  const obj = g.type === 'hint'
    ? { id: doc.newId('hint'), type: 'hint', y: g.y, text: g.text }
    : g.type === 'seal'
      ? { id: doc.newId('seal'), type: 'seal', x: g.x, y: g.y, w: g.w, h: g.h, openSec: g.openSec }
      : { id: doc.newId('obs'), type: 'obstacle', x: g.x, y: g.y, w: g.w, h: g.h, dimension: g.dimension };
  tx.create(obj);
  S.selection.clear();
  S.selection.add(obj.id);
  doc.touched();
  return { tx, obj };
}

function startMove(tx, wx, wy, sx, sy, anchorId) {
  const orig = new Map();
  for (const id of S.selection) {
    const o = tx.touch(id);
    if (o) orig.set(id, { x: o.x, y: o.y, w: o.w, h: o.h, type: o.type });
  }
  S.drag = { kind: 'move', tx, wx, wy, sx, sy, orig, anchorId, moved: false };
}

function updateMove(d, wx, wy, sx, sy) {
  if (!d.moved && Math.hypot(sx - d.sx, sy - d.sy) < 3) return;
  d.moved = true;
  const a = d.orig.get(d.anchorId) || d.orig.values().next().value;
  if (!a) return;
  let dx = 0;
  if (a.type !== 'hint') dx = snapLeft(a.x + wx - d.wx) - a.x;
  let dy = snapY(a.y + wy - d.wy) - a.y;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  for (const o of d.orig.values()) {
    if (o.type === 'hint') { minY = Math.min(minY, o.y); continue; }
    minX = Math.min(minX, o.x);
    maxX = Math.max(maxX, o.x + o.w);
    minY = Math.min(minY, o.y - o.h / 2);
  }
  if (minX !== Infinity) dx = clamp(dx, -minX, WORLD_W - maxX);
  dy = Math.max(dy, -minY);
  for (const [id, o] of d.orig) {
    const x = doc.get(id);
    if (!x) continue;
    if (o.type !== 'hint') x.x = round2(o.x + dx);
    x.y = round2(o.y + dy);
  }
  doc.touched();
}

function startResize(o, handle, wx, wy) {
  const tx = doc.begin('Größe ändern');
  tx.touch(o.id);
  S.drag = { kind: 'resize', tx, id: o.id, handle, orig: { x: o.x, y: o.y, w: o.w, h: o.h } };
}

function updateResize(d, wx, wy) {
  const o = doc.get(d.id);
  const g = d.orig;
  const right = g.x + g.w;
  const top = g.y + g.h / 2;
  const bottom = g.y - g.h / 2;
  const snapH = (v) => (!snapOn() || S.grid.snapY !== 'grid' ? Math.round(v) : Math.round(v / S.grid.size) * S.grid.size);
  if (d.handle === 'r') {
    const edge = clamp(snapRight(wx), g.x + LIMITS.minW, WORLD_W);
    o.w = round2(edge - g.x);
  } else if (d.handle === 'l') {
    const edge = clamp(snapLeft(wx), 0, right - LIMITS.minW);
    o.x = round2(edge);
    o.w = round2(right - edge);
  } else if (d.handle === 't') {
    const h = clamp(snapH(wy - bottom), LIMITS.minH, LIMITS.maxH);
    o.h = h;
    o.y = round2(bottom + h / 2);
  } else if (d.handle === 'b') {
    const h = clamp(snapH(top - wy), LIMITS.minH, Math.min(LIMITS.maxH, top * 2));
    o.h = h;
    o.y = round2(top - h / 2);
  }
  doc.touched();
}

function marqueeSelect(m, add) {
  const a = view.toWorld(Math.min(m.x0, m.x1), Math.max(m.y0, m.y1));
  const b = view.toWorld(Math.max(m.x0, m.x1), Math.min(m.y0, m.y1));
  const ids = [];
  for (const o of doc.objects) {
    const r = objRect(o);
    if (r.x1 >= a.x && r.x0 <= b.x && r.y1 >= a.y && r.y0 <= b.y) ids.push(o.id);
  }
  setSelection(ids, { add });
}

function pointerWorld(e) {
  const r = view.canvas.getBoundingClientRect();
  const sx = e.clientX - r.left;
  const sy = e.clientY - r.top;
  const w = view.toWorld(sx, sy);
  return { sx, sy, wx: w.x, wy: w.y, inside: sx >= 0 && sy >= 0 && sx <= r.width && sy <= r.height };
}

function updateCursor() {
  const c = view.canvas;
  if (S.drag && S.drag.kind === 'pan') c.style.cursor = 'grabbing';
  else if (S.tool === 'hand' || S.spaceDown) c.style.cursor = 'grab';
  else if (S.tool === 'place') c.style.cursor = 'crosshair';
  else if (S.tool === 'delete') c.style.cursor = S.hover ? 'not-allowed' : 'default';
  else if (S.hoverHandle) c.style.cursor = S.hoverHandle === 'l' || S.hoverHandle === 'r' ? 'ew-resize' : 'ns-resize';
  else if (S.hover) c.style.cursor = 'move';
  else c.style.cursor = S.tool === 'marquee' ? 'crosshair' : 'default';
}

function updateCursorReadout(p) {
  if (!p || !p.inside) { $('#cursor-pos').textContent = 'x – · y –'; return; }
  const beat = p.wy / upb();
  $('#cursor-pos').textContent = `x ${fmt(Math.round(p.wx))} · y ${fmt(Math.round(p.wy))} u · ${(p.wy / CLIMB_SPEED).toFixed(2)} s · Beat ${beat.toFixed(2)} · Spur ${laneAt(p.wx) + 1}`;
}

function onPointerDown(e) {
  if (S.rhythm) stopRhythm();
  view.canvas.focus();
  const p = pointerWorld(e);
  S.pointer = p;
  if (e.button === 1 || e.button === 0 && (S.tool === 'hand' || S.spaceDown)) {
    S.drag = { kind: 'pan', sx: p.sx, sy: p.sy, cx: view.cam.x, cy: view.cam.y };
    view.canvas.setPointerCapture(e.pointerId);
    updateCursor();
    e.preventDefault();
    return;
  }
  if (e.button !== 0) return;
  commitEdit();
  view.canvas.setPointerCapture(e.pointerId);
  const hit = view.hitTest(doc, p.wx, p.wy, { testMarker: S.testMarker });
  const multi = e.shiftKey || e.ctrlKey || e.metaKey;

  if (S.tool === 'place') {
    const placed = placeAt(S.kind, p.wx, p.wy);
    if (placed) startMove(placed.tx, p.wx, p.wy, p.sx, p.sy, placed.obj.id);
    props.render();
    updateSelInfo();
    return;
  }
  if (S.tool === 'delete') {
    if (hit && !PSEUDO.has(hit)) {
      S.selection = new Set([hit]);
      deleteSelection();
    } else if (hit === '__test') removeTestMarker();
    else if (hit) toast('Start und Ziel können nicht gelöscht werden.', 'warn');
    return;
  }
  if (S.tool === 'marquee' || (S.tool === 'select' && !hit)) {
    if (!multi && S.tool === 'select') setSelection([]);
    S.drag = { kind: 'marquee', add: multi || S.tool === 'marquee' && e.shiftKey };
    S.marquee = { x0: p.sx, y0: p.sy, x1: p.sx, y1: p.sy };
    return;
  }
  // Auswahl / Bewegen
  const single = S.selection.size === 1 ? doc.get([...S.selection][0]) : null;
  const handle = view.handleAt(single, p.sx, p.sy);
  if (handle && S.tool === 'select') {
    startResize(single, handle, p.wx, p.wy);
    return;
  }
  if (hit === '__start' || hit === '__finish' || hit === '__test') {
    setSelection([hit]);
    S.drag = { kind: hit, tx: hit === '__test' ? null : doc.begin(hit === '__start' ? 'Start verschieben' : 'Ziel verschieben'), sx: p.sx, sy: p.sy, moved: false };
    return;
  }
  if (hit) {
    if (multi) {
      if (S.selection.has(hit)) { S.selection.delete(hit); setSelection([], { add: true }); return; }
      setSelection([hit], { add: true });
    } else if (!S.selection.has(hit)) setSelection([hit]);
  }
  const real = [...S.selection].filter((id) => !PSEUDO.has(id));
  if (!real.length) return;
  if (!hit && S.tool !== 'move') return;
  S.selection = new Set(real);
  startMove(doc.begin(real.length > 1 ? `${real.length} Objekte verschieben` : 'Verschieben'), p.wx, p.wy, p.sx, p.sy, hit && !PSEUDO.has(hit) ? hit : real[0]);
}

function onPointerMove(e) {
  const p = pointerWorld(e);
  S.pointer = p;
  S.altDown = e.altKey;
  updateCursorReadout(p);
  const d = S.drag;
  if (d) {
    if (d.kind === 'pan') {
      view.cam.x = d.cx - (p.sx - d.sx) / view.cam.z;
      view.cam.y = d.cy + (p.sy - d.sy) / view.cam.z;
      view.clampCamera(doc.level.height);
      requestRender();
    } else if (d.kind === 'marquee') {
      S.marquee.x1 = p.sx;
      S.marquee.y1 = p.sy;
      requestRender();
    } else if (d.kind === 'move') {
      updateMove(d, p.wx, p.wy, p.sx, p.sy);
      props.refresh();
    } else if (d.kind === 'resize') {
      updateResize(d, p.wx, p.wy);
      props.refresh();
    } else if (d.kind === '__start') {
      d.tx.touchMeta();
      doc.level.start.lane = laneAt(p.wx);
      doc.touched();
      props.refresh();
    } else if (d.kind === '__finish') {
      d.tx.touchMeta();
      const y = Math.max(LIMITS.finish[0], snapY(p.wy));
      doc.level.finish.y = y;
      if (doc.level.height < y) doc.level.height = y;
      doc.touched();
      props.refresh();
    } else if (d.kind === '__test' && S.testMarker) {
      S.testMarker.y = Math.max(0, snapY(p.wy));
      S.testMarker.lane = laneAt(p.wx);
      props.refresh();
      requestRender();
    }
    return;
  }
  if (S.tool === 'place') {
    S.ghost = p.inside ? ghostFor(S.kind, p.wx, p.wy) : null;
    requestRender();
    return;
  }
  const hit = p.inside ? view.hitTest(doc, p.wx, p.wy, { testMarker: S.testMarker }) : null;
  const single = S.selection.size === 1 ? doc.get([...S.selection][0]) : null;
  const handle = S.tool === 'select' ? view.handleAt(single, p.sx, p.sy) : null;
  if (hit !== S.hover || handle !== S.hoverHandle) {
    S.hover = hit;
    S.hoverHandle = handle;
    updateCursor();
    requestRender();
  }
}

function onPointerUp(e) {
  const d = S.drag;
  if (!d) return;
  S.drag = null;
  try { view.canvas.releasePointerCapture(e.pointerId); } catch { /* bereits freigegeben */ }
  if (d.kind === 'marquee') {
    const m = S.marquee;
    S.marquee = null;
    if (Math.hypot(m.x1 - m.x0, m.y1 - m.y0) > 3) marqueeSelect(m, d.add);
    requestRender();
  } else if (d.tx) {
    d.tx.commit();
  } else if (d.kind === '__test') {
    markEditorState();
  }
  updateCursor();
}

function onWheel(e) {
  e.preventDefault();
  if (S.rhythm) stopRhythm();
  const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.H : 1;
  const dy = e.deltaY * scale;
  const p = pointerWorld(e);
  if (e.ctrlKey || e.metaKey) view.zoomAt(p.sx, p.sy, Math.exp(-dy * 0.0015));
  else if (e.shiftKey) view.cam.x += dy / view.cam.z;
  else {
    view.cam.y -= dy / view.cam.z;
    view.cam.x += (e.deltaX * scale) / view.cam.z;
  }
  view.clampCamera(doc.level.height);
  requestRender();
}

// ------------------------------------------------------------------ Tastatur

function isTyping(t) {
  return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

function onKeyDown(e) {
  if (!$('#modal').hidden) return;
  if (S.playtest) {
    if (e.key === 'Escape') { e.preventDefault(); closePlaytest(); }
    return;
  }
  const mod = e.ctrlKey || e.metaKey;
  const k = e.key.toLowerCase();
  if (isTyping(e.target)) {
    // In Eingabefeldern keine Editor-Shortcuts; nur „Seite speichern“ des Browsers unterdrücken.
    if (mod && k === 's') e.preventDefault();
    return;
  }
  S.altDown = e.altKey;
  if (mod) {
    if (k === 'z' && e.shiftKey) { e.preventDefault(); doc.redo(); return; }
    if (k === 'z') { e.preventDefault(); doc.undo(); return; }
    if (k === 'y') { e.preventDefault(); doc.redo(); return; }
    if (k === 's') { e.preventDefault(); saveLocal(); return; }
    if (k === 'c') { e.preventDefault(); copy(); return; }
    if (k === 'v') { e.preventDefault(); paste(); return; }
    if (k === 'd') { e.preventDefault(); duplicate(); return; }
    if (k === 'a') { e.preventDefault(); setSelection(doc.objects.map((o) => o.id)); return; }
    return;
  }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
  if (e.key === 'Escape') {
    if (S.drag && S.drag.tx) { S.drag.tx.cancel(); S.drag = null; return; }
    if (S.rhythm) { stopRhythm(); return; }
    if (S.tool !== 'select') setTool('select');
    else setSelection([]);
    return;
  }
  if (e.key === ' ') { e.preventDefault(); S.spaceDown = true; updateCursor(); return; }
  if (e.key.startsWith('Arrow')) {
    e.preventDefault();
    const fine = e.altKey;
    const sx = fine ? 1 : snapStepX();
    const sy = fine ? 1 : snapStepY();
    if (e.key === 'ArrowLeft') nudge(-sx, 0);
    if (e.key === 'ArrowRight') nudge(sx, 0);
    if (e.key === 'ArrowUp') nudge(0, sy);
    if (e.key === 'ArrowDown') nudge(0, -sy);
    return;
  }
  const tools = { v: 'select', m: 'move', p: 'place', r: 'marquee', x: 'delete', h: 'hand' };
  if (tools[k]) { setTool(tools[k]); return; }
  if (k === 'g') { setGrid({ enabled: !S.grid.enabled }); toast(`Snap ${S.grid.enabled ? 'an' : 'aus'}`); return; }
  if (k === '1') setDimMode('both');
  if (k === '2') setDimMode('B');
  if (k === '3') setDimMode('R');
  if (k === '0') { view.resetZoom(); view.clampCamera(doc.level.height); requestRender(); }
  if (k === '+' || k === '=') { view.zoomAt(view.W / 2, view.H / 2, 1.25); requestRender(); }
  if (k === '-') { view.zoomAt(view.W / 2, view.H / 2, 0.8); requestRender(); }
}

function onKeyUp(e) {
  if (e.key === ' ') { S.spaceDown = false; updateCursor(); }
  S.altDown = e.altKey;
}

// ------------------------------------------------------------------ Playtest

function stripReplay(level) {
  const c = JSON.parse(JSON.stringify(level));
  delete c.replay;
  return JSON.stringify(c);
}

function playtest(fromHere = false) {
  commitEdit();
  if (S.rhythm) stopRhythm();
  const res = runValidation();
  if (!res.ok) {
    const n = res.issues.filter((i) => i.severity === 'error').length;
    toast(`Playtest nicht möglich: ${n} Fehler – siehe Prüfung.`, 'error');
    focusIssue(res.issues.find((i) => i.severity === 'error'));
    return false;
  }
  let from = null;
  if (fromHere) {
    if (!S.testMarker) {
      S.testMarker = { y: Math.max(0, snapY(view.cam.y)), lane: doc.level.start.lane, dim: doc.level.start.dimension === 'red' ? 'R' : 'B' };
      markEditorState();
      toast('Kein Testmarker gesetzt – Start ab Bildmitte (Marker angelegt).');
    }
    const t = S.testMarker;
    if (t.y >= res.level.finish.y) { toast('Testmarker liegt hinter dem Ziel.', 'error'); return false; }
    from = { y: t.y, lane: t.lane, dim: t.dim };
  }
  const mode = $('#pt-mode').value;
  try {
    localStorage.setItem(PLAYTEST_KEY, JSON.stringify({ level: res.level, from, mode, debug: $('#pt-debug').checked }));
  } catch (err) {
    toast(`Playtest nicht möglich: Browser-Speicher blockiert (${err.message}).`, 'error');
    return false;
  }
  S.playtest = { from, mode, levelJson: stripReplay(res.level) };
  $('#pt-title').textContent = `PLAYTEST · ${res.level.name}${from ? ` · ab y ${fmt(from.y)}` : ''}`;
  $('#playtest').hidden = false;
  const frame = $('#pt-frame');
  frame.src = `${GAME_URL}?playtest=1&r=${Date.now()}`;
  return true;
}

function closePlaytest() {
  if (!S.playtest) return;
  S.playtest = null;
  $('#playtest').hidden = true;
  $('#pt-frame').src = 'about:blank';
  view.canvas.focus();
  requestRender();
}

function onMessage(e) {
  if (e.origin !== location.origin || e.source !== $('#pt-frame').contentWindow) return;
  const m = e.data || {};
  if (m.type === 'forge:ready') {
    $('#pt-frame').contentWindow.focus();
  } else if (m.type === 'forge:exit') {
    closePlaytest();
  } else if (m.type === 'forge:error') {
    toast(`Playtest-Fehler: ${m.message}`, 'error');
    closePlaytest();
  } else if (m.type === 'forge:result' && m.won) {
    const pt = S.playtest;
    if (pt && !m.from && m.mode === 'normal' && m.replay && Array.isArray(m.replay.taps) && stripReplay(doc.level) === pt.levelJson) {
      edit('Testlauf aufzeichnen', (tx) => {
        tx.touchMeta().replay = { taps: m.replay.taps.map((t) => ({ t: t.t, dir: t.dir })), recordedAt: new Date().toISOString() };
      });
      runValidation();
      toast(`Ziel erreicht – Lauf (${m.replay.taps.length} Tipps) als Spielbarkeits-Nachweis im Level gespeichert.`, 'ok');
    } else {
      toast(m.from ? 'Ziel erreicht (ab Testmarker – zählt nicht als Nachweis).' : m.mode === 'practice' ? 'Ziel erreicht (Übungsmodus – zählt nicht als Nachweis).' : 'Ziel erreicht.', 'ok');
    }
  }
}

// ------------------------------------------------------------------ Rhythmus-Vorschau

let audioCtx = null;
function click(accent) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state !== 'running') audioCtx.resume();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1568 : 1046.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.09, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.06);
  } catch { /* ohne Audio weiter */ }
}

function startRhythm() {
  if (S.rhythm) { stopRhythm(); return; }
  if (S.metronome && !audioCtx) click(false);
  const y = Math.max(0, view.cam.y - view.H * 0.25 / view.cam.z);
  S.rhythm = { y, last: performance.now(), beat: Math.floor(y / upb()) };
  $('#btn-rhythm').classList.add('active');
  const step = (now) => {
    const r = S.rhythm;
    if (!r) return;
    const dt = Math.min(0.1, (now - r.last) / 1000);
    r.last = now;
    r.y += CLIMB_SPEED * dt;
    const b = Math.floor(r.y / upb() + 1e-9);
    if (b > r.beat) {
      r.beat = b;
      if (S.metronome) click(b % 4 === 0);
    }
    S.playhead = r.y;
    view.cam.y = r.y + view.H * 0.25 / view.cam.z;
    requestRender();
    if (r.y > doc.level.finish.y + upb()) { stopRhythm(); return; }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function stopRhythm() {
  S.rhythm = null;
  S.playhead = null;
  $('#btn-rhythm').classList.remove('active');
  requestRender();
}

// ------------------------------------------------------------------ Palette-Drag (aus der Palette ins Feld ziehen)

function bindPalette() {
  for (const b of document.querySelectorAll('.pal')) {
    b.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const kind = b.dataset.kind;
      if (!KINDS[kind]) return;
      const start = { x: e.clientX, y: e.clientY };
      let dragging = false;
      const move = (ev) => {
        if (!dragging && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) {
          dragging = true;
          S.kind = kind;
          setTool('place');
        }
        if (dragging) {
          const p = pointerWorld(ev);
          S.ghost = p.inside ? ghostFor(kind, p.wx, p.wy) : null;
          requestRender();
        }
      };
      const up = (ev) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        if (!dragging) return;
        const p = pointerWorld(ev);
        if (p.inside) {
          const placed = placeAt(kind, p.wx, p.wy);
          if (placed) placed.tx.commit();
          props.render();
          updateSelInfo();
        }
        S.ghost = null;
        requestRender();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    b.addEventListener('click', () => setKind(b.dataset.kind));
  }
}

// ------------------------------------------------------------------ Start

const app = {
  S, get doc() { return doc; }, liveEdit, commitEdit, edit, toast, duplicate, deleteSelection, setToggle, playtest,
  removeTestMarker, clearReplay, markEditorState,
};

function bindUi() {
  const cv = view.canvas;
  cv.addEventListener('pointerdown', onPointerDown);
  cv.addEventListener('pointermove', onPointerMove);
  cv.addEventListener('pointerup', onPointerUp);
  cv.addEventListener('pointercancel', onPointerUp);
  cv.addEventListener('pointerleave', () => { if (!S.drag) { S.ghost = null; S.hover = null; S.pointer = null; updateCursorReadout(null); requestRender(); } });
  cv.addEventListener('wheel', onWheel, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('message', onMessage);
  window.addEventListener('resize', () => { view.resize(); view.clampCamera(doc.level.height); requestRender(); });
  window.addEventListener('beforeunload', () => { clearTimeout(autosaveTimer); if (doc && store.available) store.saveDraft({ level: doc.level, sourceId: S.sourceId, cleanJson: S.cleanJson, testMarker: S.testMarker, savedAt: new Date().toISOString() }); });

  for (const b of document.querySelectorAll('.tool[data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
  $('#btn-grid-toggle').addEventListener('click', () => setGrid({ enabled: !S.grid.enabled }));
  bindPalette();
  for (const b of document.querySelectorAll('.seg [data-dim]')) b.addEventListener('click', () => setDimMode(b.dataset.dim));
  $('#tg-beats').addEventListener('change', (e) => setToggle('beats', e.target.checked));
  $('#tg-hitboxes').addEventListener('change', (e) => setToggle('hitboxes', e.target.checked));
  $('#tg-reach').addEventListener('change', (e) => setToggle('showReach', e.target.checked));
  $('#tg-metronome').addEventListener('change', (e) => { setToggle('metronome', e.target.checked); if (e.target.checked) click(true); });
  $('#btn-rhythm').addEventListener('click', startRhythm);

  $('#btn-new').addEventListener('click', newLevel);
  $('#btn-open').addEventListener('click', openDialog);
  $('#btn-save').addEventListener('click', saveLocal);
  $('#btn-import').addEventListener('click', () => $('#file-import').click());
  $('#file-import').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) importFile(f); });
  $('#btn-export').addEventListener('click', exportLevel);
  $('#btn-publish').addEventListener('click', publishHelp);
  $('#btn-undo').addEventListener('click', () => doc.undo());
  $('#btn-redo').addEventListener('click', () => doc.redo());
  $('#btn-playtest').addEventListener('click', () => playtest(false));
  $('#btn-playfrom').addEventListener('click', () => playtest(true));
  $('#btn-zoom-reset').addEventListener('click', () => { view.resetZoom(); view.clampCamera(doc.level.height); requestRender(); });
  $('#pt-exit').addEventListener('click', closePlaytest);
  $('#pt-restart').addEventListener('click', () => { const from = S.playtest && S.playtest.from; closePlaytest(); playtest(!!from); });

  const pop = $('#grid-pop');
  const popBtn = $('#btn-grid-settings');
  popBtn.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; popBtn.setAttribute('aria-expanded', String(!pop.hidden)); });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== popBtn) { pop.hidden = true; popBtn.setAttribute('aria-expanded', 'false'); } });
  $('#grid-size').addEventListener('change', (e) => setGrid({ size: Number(e.target.value) }));
  $('#snap-x').addEventListener('change', (e) => setGrid({ snapX: e.target.value }));
  $('#snap-y').addEventListener('change', (e) => setGrid({ snapY: e.target.value }));
  $('#grid-show').addEventListener('change', (e) => setGrid({ show: e.target.checked }));
  $('#snap-on').addEventListener('change', (e) => setGrid({ enabled: e.target.checked }));

  // Drag-and-drop einer JSON-Datei direkt auf den Editor = Import
  document.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    e.preventDefault();
    importFile(f);
  });
}

async function boot() {
  loadPrefs();
  props = new PropsPanel($('#props-body'), app);
  view.resize();
  bindUi();
  setGrid({});
  setDimMode(S.dimMode);
  for (const [k, id] of [['beats', '#tg-beats'], ['hitboxes', '#tg-hitboxes'], ['showReach', '#tg-reach'], ['metronome', '#tg-metronome']]) $(id).checked = S[k];
  setTool('select');

  await store.open();
  let restored = false;
  if (store.available) {
    try {
      const draft = await store.loadDraft();
      if (draft && draft.level) {
        const res = validateLevelData(draft.level);
        if (res.level && res.level.start && res.level.finish && Array.isArray(res.level.objects)) {
          loadDocument(res.level, { sourceId: draft.sourceId, clean: false });
          S.cleanJson = draft.cleanJson || '';
          S.testMarker = draft.testMarker || null;
          S.savedAt = draft.savedAt ? new Date(draft.savedAt) : null;
          restored = true;
          toast(`Letzter Stand wiederhergestellt: ${res.level.name}`, 'ok');
        }
      }
    } catch (err) {
      console.warn('Entwurf nicht lesbar:', err);
    }
  }
  if (!restored) {
    try {
      const idx = await gameLevels();
      const entry = idx.levels.find((l) => l.id === 'rift-forge-test') || idx.levels[0];
      await openGameLevel(entry);
    } catch (err) {
      loadDocument(createEmptyLevel({ id: 'neues-level', name: 'Neues Level' }), { clean: false, message: `Spiel-Level nicht erreichbar (${err.message}) – leeres Level angelegt.` });
    }
  }
  setSaveState(restored ? 'draft' : S.saveState);
  document.body.dataset.ready = '1';
}

window.__FORGE = {
  S, view, store, app,
  get doc() { return doc; },
  actions: { requestRender, loadDocument, setSelection, placeAt, exportText, importText, playtest, closePlaytest, saveLocal, newLevel, duplicate, copy, paste, deleteSelection, runValidation, setTool, setKind, setDimMode, setGrid, startRhythm, stopRhythm, openGameLevel, gameLevels },
  ready: boot(),
};
