// LEVEL FORGE: lokale Speicherung im Browser (IndexedDB). Nichts verlässt den Rechner –
// veröffentlicht wird ausschließlich über JSON-Export und einen Commit ins Repo (assets/levels/).
const DB_NAME = 'rift-forge';
const DB_VERSION = 1;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export class ForgeStore {
  constructor() {
    this.db = null;
    this.available = false;
  }

  async open() {
    try {
      if (!('indexedDB' in window)) return false;
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains('drafts')) db.createObjectStore('drafts');
        if (!db.objectStoreNames.contains('levels')) db.createObjectStore('levels', { keyPath: 'id' });
      };
      this.db = await req(r);
      this.available = true;
    } catch (err) {
      console.warn('IndexedDB nicht verfügbar:', err);
      this.available = false;
    }
    return this.available;
  }

  async tx(store, mode, fn) {
    if (!this.db) throw new Error('Lokaler Speicher nicht verfügbar');
    const t = this.db.transaction(store, mode);
    const done = new Promise((resolve, reject) => {
      t.oncomplete = resolve;
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
    const result = await req(fn(t.objectStore(store)));
    await done;
    return result;
  }

  /** Autospeicherung: genau ein Entwurf (aktueller Editorzustand) zur Wiederherstellung. */
  saveDraft(draft) {
    return this.tx('drafts', 'readwrite', (s) => s.put(draft, 'current'));
  }

  loadDraft() {
    return this.tx('drafts', 'readonly', (s) => s.get('current'));
  }

  /** Lokale Levelbibliothek („Speichern“). */
  saveLevel(level) {
    return this.tx('levels', 'readwrite', (s) => s.put({ id: level.id, name: level.name, savedAt: new Date().toISOString(), level }));
  }

  listLevels() {
    return this.tx('levels', 'readonly', (s) => s.getAll());
  }

  deleteLevel(id) {
    return this.tx('levels', 'readwrite', (s) => s.delete(id));
  }
}
