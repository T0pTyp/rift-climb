// LEVEL FORGE: Eigenschaftenleiste und Prüfliste.
// Eingaben wirken sofort (live), ein abgeschlossenes Feld ergibt genau einen Undo-Schritt.
import { WORLD_W, LANES, LANE_W, CLIMB_SPEED, PULSE_RADIUS, SEAL_OPEN_SEC, BAR_INSET_X, BAR_THICKNESS, UNITS_PER_BEAT } from '../config.js';
import { LIMITS, unitsPerBeat, DIMENSION_COLOR } from '../level-data.js';
import { fmt } from './view.js';

const DIM_OPTIONS = [['both', 'Neutral (beide Dimensionen)'], ['blue', 'Blau'], ['red', 'Rot']];
const START_DIM_OPTIONS = [['blue', 'Blau'], ['red', 'Rot']];
const LANE_OPTIONS = [...Array(LANES).keys()].map((l) => [String(l), `Spur ${l + 1}${l === 0 ? ' (links)' : l === LANES - 1 ? ' (rechts)' : ''}`]);

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids) if (kid) e.append(kid);
  return e;
}

let fieldSeq = 0;
const secs = (y) => `${(y / CLIMB_SPEED).toFixed(2).replace('.', ',')} s`;

/** Spurinfo: welche Spuren ein Objekt sichtbar abdeckt und ob es exakt spurgenau liegt (Spur-Solver). */
function laneInfo(o) {
  const lanes = [];
  for (let l = 0; l < LANES; l++) {
    const c = l * LANE_W + LANE_W / 2;
    if (o.x < c && o.x + o.w > c) lanes.push(l + 1);
  }
  const exact = Math.abs((o.x - BAR_INSET_X) / LANE_W - Math.round((o.x - BAR_INSET_X) / LANE_W)) < 1e-6 &&
    Math.abs((o.w + 2 * BAR_INSET_X) / LANE_W - Math.round((o.w + 2 * BAR_INSET_X) / LANE_W)) < 1e-6 &&
    o.h === BAR_THICKNESS && Math.abs(o.y / UNITS_PER_BEAT - Math.round(o.y / UNITS_PER_BEAT)) < 1e-6;
  const cover = lanes.length ? `Spur ${lanes[0]}${lanes.length > 1 ? '–' + lanes[lanes.length - 1] : ''}` : 'zwischen den Spurmitten';
  return `${cover} · ${exact ? 'spurgenau' : 'freie Position'}`;
}

function activeIn(o) {
  if (o.type === 'seal') return 'geschlossen: Blau + Rot tödlich · offen: passierbar';
  const c = DIMENSION_COLOR[o.dimension];
  if (c === 'W') return 'tödlich in Blau und Rot';
  return c === 'B' ? 'tödlich in Blau · Geist in Rot' : 'tödlich in Rot · Geist in Blau';
}

export class PropsPanel {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.inputs = [];
  }

  render() {
    const { app } = this;
    const S = app.S;
    this.root.textContent = '';
    this.inputs = [];
    const ids = [...S.selection];
    const objs = ids.map((id) => app.doc.get(id)).filter(Boolean);
    let title = 'Level';
    let body;
    if (ids.length === 1 && ids[0] === '__start') { title = 'Startposition'; body = this.startFields(); }
    else if (ids.length === 1 && ids[0] === '__finish') { title = 'Zielbereich'; body = this.finishFields(); }
    else if (ids.length === 1 && ids[0] === '__test') { title = 'Testmarker'; body = this.testFields(); }
    else if (objs.length === 1) {
      const o = objs[0];
      title = o.type === 'seal' ? 'Rift-Siegel' : o.type === 'hint' ? 'Hinweistext' : 'Hindernis';
      body = o.type === 'hint' ? this.hintFields(o) : this.solidFields(o);
    } else if (objs.length > 1) { title = `${objs.length} Objekte`; body = this.multiFields(objs); }
    else body = this.levelFields();
    this.root.append(el('h2', { class: 'panel-title', text: title }), ...body);
    this.refresh();
  }

  /** Werte aller nicht fokussierten Felder aktualisieren (z. B. nach Drag oder Undo). */
  refresh() {
    for (const f of this.inputs) {
      if (document.activeElement === f.input) continue;
      const v = f.get();
      if (f.input.type === 'checkbox') f.input.checked = !!v;
      else f.input.value = v === undefined || v === null ? '' : typeof v === 'number' ? fmtNum(v) : String(v);
      f.input.classList.remove('invalid');
      if (f.info) f.info.textContent = f.info.compute();
    }
    for (const i of this.root.querySelectorAll('[data-compute]')) i.textContent = i.compute();
  }

  // ---------------------------------------------------------------- Feldbausteine

  field(label, input, { hint, unit, title } = {}) {
    return el('label', { class: 'field', title },
      el('span', { class: 'field-label', text: label }),
      el('span', { class: 'field-input' }, input, unit ? el('span', { class: 'unit', text: unit }) : null),
      hint ? el('span', { class: 'field-hint', text: hint }) : null);
  }

  num(label, { get, set, min, max, step = 1, unit, hint, key, title }) {
    const input = el('input', { type: 'number', min, max, step, inputmode: 'decimal', 'data-key': key });
    const f = { input, get };
    const parse = () => {
      const v = parseFloat(input.value.replace(',', '.'));
      return Number.isFinite(v) && v >= min - 1e-9 && v <= max + 1e-9 ? v : null;
    };
    input.addEventListener('input', () => {
      const v = parse();
      input.classList.toggle('invalid', v === null);
      if (v !== null) this.app.liveEdit(key || label, label, (tx) => set(tx, v));
    });
    input.addEventListener('change', () => {
      if (parse() === null) {
        input.classList.remove('invalid');
        input.value = fmtNum(get());
        this.app.toast(`${label}: erlaubt ${min}–${max}${unit ? ' ' + unit : ''}`, 'warn');
      }
      this.app.commitEdit();
    });
    this.inputs.push(f);
    // Touch: −/+ ändern in groben Schritten (ein Tipp = ein Undo-Schritt), ohne Bildschirmtastatur
    const coarse = unit === 'u' ? 10 : step;
    const stepBtn = (sign) => el('button', {
      type: 'button', class: 'step-btn', 'aria-label': `${label} ${sign < 0 ? 'verringern' : 'erhöhen'}`, text: sign < 0 ? '−' : '+',
      onclick: (e) => {
        e.preventDefault();
        const cur = Number(get());
        const v = Math.min(max, Math.max(min, Math.round((cur + sign * coarse) / coarse) * coarse));
        if (Number.isFinite(v) && v !== cur) this.app.edit(label, (tx) => set(tx, v));
      },
    });
    const row = this.field(label, input, { unit, hint, title });
    // Label gehört explizit zum Zahlenfeld, sonst würde ein Tipp auf den Text den ersten Button auslösen
    input.id = `pf-${++fieldSeq}`;
    row.htmlFor = input.id;
    const box = row.querySelector('.field-input');
    box.prepend(stepBtn(-1));
    box.insertBefore(stepBtn(1), input.nextSibling);
    return row;
  }

  text(label, { get, set, maxLength, hint, key, validate, multiline, title }) {
    const input = multiline ? el('textarea', { rows: 3, maxlength: maxLength, 'data-key': key }) : el('input', { type: 'text', maxlength: maxLength, spellcheck: 'false', 'data-key': key });
    const f = { input, get };
    input.addEventListener('input', () => {
      const ok = !validate || validate(input.value);
      input.classList.toggle('invalid', !ok);
      if (ok) this.app.liveEdit(key || label, label, (tx) => set(tx, input.value));
    });
    input.addEventListener('change', () => {
      if (validate && !validate(input.value)) {
        input.classList.remove('invalid');
        input.value = get();
        this.app.toast(`${label}: ungültige Eingabe – zurückgesetzt`, 'warn');
      }
      this.app.commitEdit();
    });
    this.inputs.push(f);
    return this.field(label, input, { hint, title });
  }

  select(label, { get, set, options, hint, key, title }) {
    const input = el('select', { 'data-key': key });
    for (const [v, t] of options) input.append(el('option', { value: v, text: t }));
    input.addEventListener('change', () => this.app.edit(label, (tx) => set(tx, input.value)));
    this.inputs.push({ input, get });
    return this.field(label, input, { hint, title });
  }

  check(label, { get, set, hint, key }) {
    const input = el('input', { type: 'checkbox', 'data-key': key });
    input.addEventListener('change', () => set(input.checked));
    this.inputs.push({ input, get });
    return el('label', { class: 'field check' }, input, el('span', { class: 'field-label', text: label }), hint ? el('span', { class: 'field-hint', text: hint }) : null);
  }

  info(label, compute, { title } = {}) {
    const v = el('span', { class: 'info-value' });
    v.compute = compute;
    v.dataset.compute = '1';
    return el('div', { class: 'field info', title }, el('span', { class: 'field-label', text: label }), v);
  }

  disabled(label, value, title) {
    return el('label', { class: 'field disabled', title }, el('span', { class: 'field-label', text: label }),
      el('span', { class: 'field-input' }, el('input', { type: 'text', value, disabled: true })));
  }

  group(title, ...rows) {
    return el('section', { class: 'prop-group' }, el('h3', { text: title }), ...rows);
  }

  buttons(...defs) {
    return el('div', { class: 'prop-buttons' }, ...defs.map(([text, fn, cls, title]) => el('button', { type: 'button', class: `btn ${cls || ''}`, title, onclick: fn, text })));
  }

  // ---------------------------------------------------------------- Typen

  objSetter(id, fn) {
    return (tx, v) => { const o = tx.touch(id); if (o) fn(o, v); };
  }

  solidFields(o) {
    const id = o.id;
    const app = this.app;
    const get = (k) => () => { const x = app.doc.get(id); return x ? x[k] : ''; };
    const rows = [];
    rows.push(this.group('Objekt',
      this.info('ID', () => id, { title: 'Stabile, eindeutige Objekt-ID (bleibt beim Verschieben und Speichern erhalten)' }),
      this.select('Typ', {
        key: 'type',
        get: get('type'),
        options: [['obstacle', 'Hindernis (Balken / Barriere)'], ['seal', 'Rift-Siegel']],
        set: this.objSetter(id, (x, v) => {
          if (x.type === v) return;
          x.type = v;
          if (v === 'seal') { delete x.dimension; x.openSec = SEAL_OPEN_SEC; } else { delete x.openSec; x.dimension = 'both'; }
        }),
      }),
      o.type === 'obstacle' ? this.select('Dimension', { key: 'dimension', get: get('dimension'), options: DIM_OPTIONS, set: this.objSetter(id, (x, v) => { x.dimension = v; }) }) : null,
      this.info('Aktiv', () => { const x = app.doc.get(id); return x ? activeIn(x) : ''; }, { title: 'Aktivierungsstatus: in welcher Dimension das Objekt tödlich ist' }),
    ));
    rows.push(this.group('Position und Größe',
      this.num('X (linke Kante)', { key: 'x', get: get('x'), min: 0, max: WORLD_W - LIMITS.minW, step: 1, unit: 'u', set: this.objSetter(id, (x, v) => { x.x = v; }) }),
      this.num('Y (Mitte)', { key: 'y', get: get('y'), min: 0, max: LIMITS.finish[1], step: 1, unit: 'u', set: this.objSetter(id, (x, v) => { x.y = v; }) }),
      this.num('Breite', { key: 'w', get: get('w'), min: LIMITS.minW, max: WORLD_W, step: 1, unit: 'u', set: this.objSetter(id, (x, v) => { x.w = v; }) }),
      this.num('Höhe', { key: 'h', get: get('h'), min: LIMITS.minH, max: LIMITS.maxH, step: 1, unit: 'u', set: this.objSetter(id, (x, v) => { x.h = v; }) }),
      this.disabled('Rotation', '0° – vom Spiel nicht unterstützt', 'Das Spiel kennt nur achsenparallele Rechtecke; Rotation wäre eine neue Mechanik.'),
      this.info('Lage', () => { const x = app.doc.get(id); return x ? laneInfo(x) : ''; }, { title: 'Spurgenaue Objekte (Standardhöhe, ganzer 0,5-s-Takt) prüft der Spur-Solver exakt' }),
      this.info('Zeitpunkt', () => { const x = app.doc.get(id); return x ? `${secs(x.y)} · Beat ${fmt(Math.round(x.y / unitsPerBeat(app.doc.level.bpm) * 100) / 100)}` : ''; }),
    ));
    if (o.type === 'seal') {
      rows.push(this.group('Rift-Siegel',
        this.num('Öffnungsdauer', {
          key: 'openSec', get: get('openSec'), min: LIMITS.sealOpen[0], max: LIMITS.sealOpen[1], step: 0.05, unit: 's',
          hint: `Standard ${SEAL_OPEN_SEC} s. Unter ${SEAL_OPEN_SEC} s gilt „leuchtet = Tipp reicht“ nicht mehr sicher.`,
          set: this.objSetter(id, (x, v) => { x.openSec = Math.round(v * 100) / 100; }),
        }),
        this.info('Pulse-Radius', () => `${PULSE_RADIUS} u (globale Spielregel, nicht pro Siegel)`),
        this.info('Pulse-Reaktion', () => 'öffnet, sobald eine Welle die sichtbare Fläche berührt'),
        this.info('Kollision', () => 'geschlossen: tödlich in beiden Dimensionen · offen: passierbar'),
        this.select('Vorschau', {
          key: 'preview', get: () => (app.S.sealOpen.has(id) ? 'open' : 'closed'),
          options: [['closed', 'geschlossen'], ['open', 'geöffnet']],
          set: (tx, v) => { if (v === 'open') app.S.sealOpen.add(id); else app.S.sealOpen.delete(id); },
          hint: 'Nur Editor-Ansicht, wird nicht gespeichert',
        }),
        this.check('Pulse-Reichweite anzeigen', { key: 'reach', get: () => app.S.showReach, set: (v) => app.setToggle('showReach', v) }),
      ));
    }
    rows.push(this.buttons(['Duplizieren', () => app.duplicate(), '', 'Strg/Cmd+D'], ['Löschen', () => app.deleteSelection(), 'danger', 'Entf']));
    return rows;
  }

  hintFields(o) {
    const id = o.id;
    const app = this.app;
    return [
      this.group('Hinweistext',
        this.info('ID', () => id),
        this.text('Text', { key: 'text', get: () => app.doc.get(id)?.text ?? '', maxLength: LIMITS.hintLen, validate: (v) => v.trim().length > 0, set: this.objSetter(id, (x, v) => { x.text = v; }) }),
        this.num('Y', { key: 'y', get: () => app.doc.get(id)?.y ?? 0, min: 0, max: LIMITS.finish[1], unit: 'u', set: this.objSetter(id, (x, v) => { x.y = v; }) }),
        this.info('Zeitpunkt', () => secs(app.doc.get(id)?.y ?? 0)),
        this.info('Wirkung', () => 'nur Anzeige, keine Kollision'),
      ),
      this.buttons(['Duplizieren', () => app.duplicate()], ['Löschen', () => app.deleteSelection(), 'danger']),
    ];
  }

  multiFields(objs) {
    const app = this.app;
    const ids = objs.map((o) => o.id);
    const obstacles = objs.filter((o) => o.type === 'obstacle');
    const seals = objs.filter((o) => o.type === 'seal');
    const rows = [this.info('Auswahl', () => `${obstacles.length} Hindernisse · ${seals.length} Siegel · ${objs.length - obstacles.length - seals.length} Hinweise`)];
    if (obstacles.length) {
      rows.push(this.select('Dimension (alle Hindernisse)', {
        key: 'multi-dim',
        get: () => { const d = new Set(obstacles.map((o) => app.doc.get(o.id)?.dimension)); return d.size === 1 ? [...d][0] : 'mixed'; },
        options: [['mixed', '– gemischt –'], ...DIM_OPTIONS],
        set: (tx, v) => { if (v === 'mixed') return; for (const o of obstacles) { const x = tx.touch(o.id); if (x) x.dimension = v; } },
      }));
    }
    if (seals.length) {
      rows.push(this.num('Öffnungsdauer (alle Siegel)', {
        key: 'multi-open', get: () => app.doc.get(seals[0].id)?.openSec ?? SEAL_OPEN_SEC, min: LIMITS.sealOpen[0], max: LIMITS.sealOpen[1], step: 0.05, unit: 's',
        set: (tx, v) => { for (const o of seals) { const x = tx.touch(o.id); if (x) x.openSec = Math.round(v * 100) / 100; } },
      }));
    }
    rows.push(this.info('Bereich', () => {
      const live = ids.map((id) => app.doc.get(id)).filter(Boolean);
      const ys = live.map((o) => o.y);
      return `y ${fmt(Math.min(...ys))} – ${fmt(Math.max(...ys))} u`;
    }));
    return [this.group('Mehrfachauswahl', ...rows), this.buttons(['Duplizieren', () => app.duplicate()], ['Löschen', () => app.deleteSelection(), 'danger'])];
  }

  startFields() {
    const app = this.app;
    const L = () => app.doc.level;
    return [this.group('Start',
      this.select('Startspur', { key: 'start-lane', get: () => String(L().start.lane), options: LANE_OPTIONS, set: (tx, v) => { tx.touchMeta().start.lane = Number(v); } }),
      this.select('Startdimension', { key: 'start-dim', get: () => L().start.dimension, options: START_DIM_OPTIONS, set: (tx, v) => { tx.touchMeta().start.dimension = v; } }),
      this.info('Höhe', () => 'y 0 (Startlinie) – der Spieler steigt mit 260 u/s'),
    )];
  }

  finishFields() {
    const app = this.app;
    const L = () => app.doc.level;
    return [this.group('Ziel',
      this.num('Ziellinie (y)', { key: 'finish', get: () => L().finish.y, min: LIMITS.finish[0], max: LIMITS.finish[1], unit: 'u', set: (tx, v) => { const l = tx.touchMeta(); l.finish.y = v; if (l.height < v) l.height = v; } }),
      this.info('Dauer', () => `${secs(L().finish.y)} · ${fmt(Math.round(L().finish.y / unitsPerBeat(L().bpm) * 10) / 10)} Beats`),
    )];
  }

  testFields() {
    const app = this.app;
    const T = () => app.S.testMarker || { y: 0, lane: 1, dim: 'B' };
    const setT = (k, v) => { app.S.testMarker = { ...T(), [k]: v }; app.markEditorState(); };
    return [this.group('PLAY FROM HERE',
      this.num('Starthöhe (y)', { key: 'test-y', get: () => T().y, min: 0, max: LIMITS.finish[1], unit: 'u', set: (tx, v) => setT('y', v) }),
      this.select('Spur', { key: 'test-lane', get: () => String(T().lane), options: LANE_OPTIONS, set: (tx, v) => setT('lane', Number(v)) }),
      this.select('Dimension', { key: 'test-dim', get: () => T().dim, options: [['B', 'Blau'], ['R', 'Rot']], set: (tx, v) => setT('dim', v) }),
      this.info('Hinweis', () => 'Nur Editor-Hilfe, wird nicht ins Level exportiert'),
    ), this.buttons(['▶ Ab hier testen', () => app.playtest(true), 'primary'], ['Marker entfernen', () => app.removeTestMarker()])];
  }

  levelFields() {
    const app = this.app;
    const L = () => app.doc.level;
    const meta = (fn) => (tx, v) => fn(tx.touchMeta(), v);
    return [
      this.group('Level',
        this.text('Name', { key: 'name', get: () => L().name, maxLength: LIMITS.nameLen, validate: (v) => v.trim().length > 0, set: meta((l, v) => { l.name = v; }) }),
        this.text('ID', { key: 'id', get: () => L().id, maxLength: 40, validate: (v) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(v), hint: 'a–z, 0–9, Bindestrich – Dateiname beim Export', set: meta((l, v) => { l.id = v; }) }),
        this.text('Beschreibung', { key: 'description', get: () => L().description, maxLength: LIMITS.descLen, multiline: true, set: meta((l, v) => { l.description = v; }) }),
      ),
      this.group('Rhythmus und Länge',
        this.num('BPM', { key: 'bpm', get: () => L().bpm, min: LIMITS.bpm[0], max: LIMITS.bpm[1], step: 1, hint: 'Tempo der Musik und der Beat-Marker. Die Steiggeschwindigkeit bleibt 260 u/s.', set: meta((l, v) => { l.bpm = v; }) }),
        this.info('Beat-Abstand', () => `${fmt(Math.round(unitsPerBeat(L().bpm) * 10) / 10)} u = ${(60 / L().bpm).toFixed(3).replace('.', ',')} s`),
        this.num('Ziellinie (y)', { key: 'finish', get: () => L().finish.y, min: LIMITS.finish[0], max: LIMITS.finish[1], unit: 'u', set: meta((l, v) => { l.finish.y = v; if (l.height < v) l.height = v; }) }),
        this.num('Spielbare Höhe', { key: 'height', get: () => L().height, min: LIMITS.finish[0], max: LIMITS.finish[1] + UNITS_PER_BEAT * 8, unit: 'u', hint: 'Obergrenze für Objekte (≥ Ziellinie)', set: meta((l, v) => { l.height = v; }) }),
        this.info('Dauer', () => `${secs(L().finish.y)} bis zum Ziel`),
      ),
      this.group('Start',
        this.select('Startspur', { key: 'start-lane', get: () => String(L().start.lane), options: LANE_OPTIONS, set: meta((l, v) => { l.start.lane = Number(v); }) }),
        this.select('Startdimension', { key: 'start-dim', get: () => L().start.dimension, options: START_DIM_OPTIONS, set: meta((l, v) => { l.start.dimension = v; }) }),
      ),
      this.group('Inhalt',
        this.info('Objekte', () => {
          const o = L().objects;
          const n = (t) => o.filter((x) => x.type === t).length;
          return `${n('obstacle')} Hindernisse · ${n('seal')} Siegel · ${n('hint')} Hinweise`;
        }),
        this.info('Abschnitte', () => (L().sections ? `${L().sections.map((s) => s.id).join(' ')} (aus der Leveldatei)` : 'automatisch (A–D nach Fortschritt, ohne Beschriftung)')),
        this.info('Aufgezeichneter Lauf', () => (L().replay ? `${L().replay.taps.length} Tipps` : 'keiner – im PLAYTEST komplett durchspielen')),
      ),
      L().replay ? this.buttons(['Aufzeichnung entfernen', () => app.clearReplay(), '', 'Entfernt den gespeicherten Nachweis-Lauf']) : null,
    ].filter(Boolean);
  }
}

function fmtNum(v) {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

/** Prüfliste: Fehler (ungültig) und Warnungen (Design), Klick springt zum Objekt. */
export function renderIssues(listEl, summaryEl, issues, play, onPick) {
  listEl.textContent = '';
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warnings = issues.filter((i) => i.severity === 'warning').length;
  const proof = !play ? 'Nachweis: –' : play.ok === true ? `Nachweis ✓ (${play.method === 'solver' ? 'Spur-Solver' : 'Aufzeichnung'})` : play.ok === false ? 'Nachweis ✗' : 'Nachweis offen';
  summaryEl.textContent = `${errors} Fehler · ${warnings} Warnungen · ${proof}`;
  summaryEl.dataset.state = errors ? 'error' : warnings || (play && play.ok !== true) ? 'warn' : 'ok';
  const all = issues.slice();
  if (play) all.push({ severity: play.ok === true ? 'ok' : play.ok === false ? 'warning' : 'info', code: 'play', message: play.message, y: play.replay && play.replay.killer ? play.replay.killer.y : undefined, objectId: play.replay && play.replay.killer ? play.replay.killer.id : undefined });
  if (!all.length) listEl.append(el('li', { class: 'issue ok', text: 'Keine Probleme gefunden.' }));
  for (const i of all) {
    const li = el('li', { class: `issue ${i.severity}`, tabindex: '0', role: 'button' },
      el('span', { class: 'issue-badge', text: i.severity === 'error' ? 'Fehler' : i.severity === 'warning' ? 'Warnung' : i.severity === 'ok' ? 'OK' : 'Info' }),
      el('span', { class: 'issue-msg', text: i.message }));
    if (i.objectId || i.y !== undefined || i.field) {
      li.title = 'Klicken: zum Objekt springen';
      li.addEventListener('click', () => onPick(i));
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter') onPick(i); });
    }
    listEl.append(li);
  }
}
