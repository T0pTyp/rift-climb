// Grafikstufen: beeinflussen ausschließlich die Darstellung (Partikel, Glow, Hintergrund, Auflösung).
// Simulation, Timing und Kollision lesen diese Werte nie.

export const QUALITY = Object.freeze({
  high: Object.freeze({ id: 'high', label: 'HOCH', particles: 1, cap: 320, glow: 2, backdrop: 2, shards: 26, ribbonCore: true, dprCap: 2.5 }),
  medium: Object.freeze({ id: 'medium', label: 'MITTEL', particles: 0.6, cap: 200, glow: 1, backdrop: 1, shards: 12, ribbonCore: true, dprCap: 2 }),
  low: Object.freeze({ id: 'low', label: 'NIEDRIG', particles: 0.3, cap: 96, glow: 0, backdrop: 0, shards: 0, ribbonCore: false, dprCap: 1.5 }),
});

export const QUALITY_ORDER = ['high', 'medium', 'low'];

export function nextQuality(id) {
  return QUALITY_ORDER[(QUALITY_ORDER.indexOf(id) + 1) % QUALITY_ORDER.length];
}

/** Startwert ohne gespeicherte Wahl: schwächere Geräte (≤ 4 Kerne oder ≤ 2 GB) beginnen mit MITTEL. */
export function defaultQuality() {
  if (typeof navigator === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;
  return cores <= 4 || mem <= 2 ? 'medium' : 'high';
}

export function qualityOf(id) {
  return QUALITY[id] || QUALITY.high;
}
