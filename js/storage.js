// Legacy read/migration helpers. M8 progression.js owns all new progress writes.
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
      if(value && typeof value==='object' && ('gfx' in value || 'gfxManual' in value)) {
        delete value.gfx;delete value.gfxManual;localStorage.setItem(key,JSON.stringify(value));
      }
    }
  } catch { /* Optional browser storage. */ }
}
