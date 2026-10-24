// Lädt Level-Dateien aus assets/levels/ (Node, ohne Browser) – dieselben Dateien, die das Spiel per fetch lädt.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateLevelData, validateIndex } from '../../js/level-data.js';

export const LEVEL_DIR = fileURLToPath(new URL('../../assets/levels/', import.meta.url));

export function readJson(file) {
  return JSON.parse(readFileSync(LEVEL_DIR + file, 'utf8'));
}

export function loadIndex() {
  return validateIndex(readJson('index.json'));
}

/** Geprüftes Level (wirft, wenn die Datei Fehler enthält). */
export function loadLevel(id) {
  const { index } = loadIndex();
  const entry = index.levels.find((l) => l.id === id);
  if (!entry) throw new Error(`Level ${id} nicht im Index`);
  const res = validateLevelData(readJson(entry.file));
  if (!res.ok) throw new Error(`Level ${id} ungültig: ${res.issues.filter((i) => i.severity === 'error').map((i) => i.message).join('; ')}`);
  return res.level;
}
