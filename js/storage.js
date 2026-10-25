// Per-level local results; no accounts or unlocks. Legacy M1–M6 keys remain readable.
export const STORAGE_KEY = 'riftclimb.pulse.v1';
export function readJson(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
export function migrateVisualPreferences() {
  try {
    for (let i=0;i<localStorage.length;i++) {
      const key=localStorage.key(i);
      if (!key?.startsWith(STORAGE_KEY)) continue;
      const value=readJson(key);
      if(value && ('gfx' in value || 'gfxManual' in value)) {
        delete value.gfx;delete value.gfxManual;localStorage.setItem(key,JSON.stringify(value));
      }
    }
  } catch { /* Optional browser storage. */ }
}
export function createStorage(levelId, memoryOnly = false) {
  const key=levelId==='rift-main'?STORAGE_KEY:`${STORAGE_KEY}.${levelId}`;
  const own=memoryOnly?null:readJson(key), saved=own?.stats || {};
  const integer=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isFinite(n)?Math.min(max,Math.max(0,Math.floor(n))):0;
  return {
    stats:{best:integer(saved.best,100),attempts:integer(saved.attempts),clears:integer(saved.clears)},
    muted:!!readJson(STORAGE_KEY)?.muted,
    save() {
      if(memoryOnly)return;
      try {
        localStorage.setItem(key,JSON.stringify({stats:this.stats,muted:this.muted}));
        if(key!==STORAGE_KEY) {
          const global=readJson(STORAGE_KEY)||{};global.muted=this.muted;
          delete global.gfx;delete global.gfxManual;localStorage.setItem(STORAGE_KEY,JSON.stringify(global));
        }
      } catch { /* Keep session values if storage is unavailable. */ }
    },
  };
}
