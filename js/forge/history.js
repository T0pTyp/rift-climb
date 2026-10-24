// LEVEL FORGE: Dokumentmodell mit Transaktionen für Undo/Redo.
// Ein Undo-Schritt speichert nur die geänderten Objekte (vorher/nachher) und bei Bedarf die Level-Metadaten –
// ein Drag über viele Frames ergibt genau einen Schritt (Transaktion von pointerdown bis pointerup).

const HISTORY_LIMIT = 300;
const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function metaOf(level) {
  const m = {};
  for (const k of Object.keys(level)) if (k !== 'objects') m[k] = clone(level[k]);
  return m;
}

export class LevelDoc {
  constructor(level, onChange) {
    this.onChange = onChange || (() => {});
    this.revision = 0;
    this.load(level);
  }

  /** Neues Dokument (leert die History). */
  load(level) {
    this.level = clone(level);
    this.undoStack = [];
    this.redoStack = [];
    this.tx = null;
    this.reindex();
  }

  reindex() {
    this.byId = new Map();
    for (const o of this.level.objects) this.byId.set(o.id, o);
    this.sorted = null;
  }

  get objects() {
    return this.level.objects;
  }

  /** Objekte nach y sortiert (für sichtbaren Ausschnitt und Treffertests), lazy neu aufgebaut. */
  get byY() {
    if (!this.sorted) this.sorted = this.level.objects.slice().sort((a, b) => a.y - b.y);
    return this.sorted;
  }

  get(id) {
    return this.byId.get(id) || null;
  }

  /** Stabile, eindeutige ID (Präfix + laufende Nummer). */
  newId(prefix) {
    let n = this.level.objects.length + 1;
    while (this.byId.has(`${prefix}-${n}`)) n++;
    return `${prefix}-${n}`;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  begin(label) {
    if (this.tx) this.tx.commit();
    this.tx = new Transaction(this, label);
    return this.tx;
  }

  /** Während einer laufenden Transaktion geändert (z. B. Drag-Frame): nur neu zeichnen, kein History-Eintrag. */
  touched() {
    this.sorted = null;
    this.revision++;
    this.onChange({ live: true });
  }

  push(entry) {
    this.undoStack.push(entry);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack.length = 0;
    this.revision++;
    this.onChange({ label: entry.label });
  }

  undo() {
    if (this.tx) this.tx.commit();
    const e = this.undoStack.pop();
    if (!e) return null;
    this.apply(e, 'before');
    this.redoStack.push(e);
    this.revision++;
    this.onChange({ label: e.label, undo: true });
    return e;
  }

  redo() {
    if (this.tx) this.tx.commit();
    const e = this.redoStack.pop();
    if (!e) return null;
    this.apply(e, 'after');
    this.undoStack.push(e);
    this.revision++;
    this.onChange({ label: e.label, redo: true });
    return e;
  }

  apply(entry, side) {
    const list = side === 'before' ? entry.changes.slice().reverse() : entry.changes;
    const objs = this.level.objects;
    for (const c of list) {
      const snap = c[side];
      const i = objs.findIndex((o) => o.id === c.id);
      if (!snap) {
        if (i >= 0) objs.splice(i, 1);
      } else if (i >= 0) {
        objs[i] = clone(snap);
      } else {
        objs.splice(Math.min(c.index, objs.length), 0, clone(snap));
      }
    }
    const meta = side === 'before' ? entry.metaBefore : entry.metaAfter;
    if (meta) {
      for (const k of Object.keys(this.level)) if (k !== 'objects' && !(k in meta)) delete this.level[k];
      Object.assign(this.level, clone(meta));
    }
    this.reindex();
  }
}

class Transaction {
  constructor(doc, label) {
    this.doc = doc;
    this.label = label;
    this.before = new Map();
    this.metaBefore = null;
    this.done = false;
  }

  /** Objekt zur Änderung vormerken (Vorher-Zustand einmalig sichern) und zurückgeben. */
  touch(id) {
    const o = this.doc.get(id);
    if (!o) return null;
    if (!this.before.has(id)) this.before.set(id, { snap: clone(o), index: this.doc.level.objects.indexOf(o) });
    return o;
  }

  touchMeta() {
    if (!this.metaBefore) this.metaBefore = metaOf(this.doc.level);
    return this.doc.level;
  }

  create(obj, index = this.doc.level.objects.length) {
    const objs = this.doc.level.objects;
    objs.splice(Math.min(index, objs.length), 0, obj);
    this.doc.byId.set(obj.id, obj);
    this.doc.sorted = null;
    if (!this.before.has(obj.id)) this.before.set(obj.id, { snap: null, index: objs.indexOf(obj) });
    return obj;
  }

  remove(id) {
    const o = this.touch(id);
    if (!o) return;
    const objs = this.doc.level.objects;
    objs.splice(objs.indexOf(o), 1);
    this.doc.byId.delete(id);
    this.doc.sorted = null;
  }

  /** Schließt die Transaktion ab; ohne echte Änderung entsteht kein Undo-Schritt. */
  commit() {
    if (this.done) return false;
    this.done = true;
    if (this.doc.tx === this) this.doc.tx = null;
    const changes = [];
    for (const [id, { snap, index }] of this.before) {
      const now = this.doc.get(id);
      const after = now ? clone(now) : null;
      if (same(snap, after)) continue;
      changes.push({ id, before: snap, after, index });
    }
    let metaAfter = null;
    if (this.metaBefore) {
      metaAfter = metaOf(this.doc.level);
      if (same(this.metaBefore, metaAfter)) { this.metaBefore = null; metaAfter = null; }
    }
    if (!changes.length && !metaAfter) {
      this.doc.sorted = null;
      return false;
    }
    this.doc.sorted = null;
    this.doc.push({ label: this.label, changes, metaBefore: this.metaBefore, metaAfter });
    return true;
  }

  /** Bricht ab und stellt den Vorher-Zustand wieder her (z. B. Esc während eines Drags). */
  cancel() {
    if (this.done) return;
    this.done = true;
    if (this.doc.tx === this) this.doc.tx = null;
    const changes = [...this.before].map(([id, { snap, index }]) => ({ id, before: snap, after: null, index }));
    this.doc.apply({ changes, metaBefore: this.metaBefore }, 'before');
    this.doc.revision++;
    this.doc.onChange({ live: true });
  }
}
