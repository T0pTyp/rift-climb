export const DIM = Object.freeze({ BLUE: 'B', RED: 'R' });

export const COLORS = Object.freeze({
  B: { main: '#2fd6ff', glow: 'rgba(47,214,255,0.35)', ghost: 'rgba(47,214,255,0.42)', bg: '#03121f', name: 'BLAU' },
  R: { main: '#ff2d8a', glow: 'rgba(255,45,138,0.35)', ghost: 'rgba(255,45,138,0.42)', bg: '#1a0414', name: 'ROT' },
  W: { main: '#f4f6ff', glow: 'rgba(244,246,255,0.4)', ghost: 'rgba(244,246,255,0.4)', bg: '#000', name: 'WEISS' },
  S: { main: '#ffc23d', glow: 'rgba(255,194,61,0.42)', ghost: 'rgba(255,194,61,0.5)', bg: '#000', name: 'GOLD-SIEGEL' },
});

export function otherDim(dim) {
  return dim === DIM.BLUE ? DIM.RED : DIM.BLUE;
}

/**
 * Weiß ist immer tödlich; Blau/Rot nur, wenn die gleiche Dimension aktiv ist.
 * Rift-Siegel (S) sind in beiden Dimensionen tödlich, solange sie geschlossen sind (Zustand: rift.js).
 */
export function isDeadly(color, activeDim) {
  return color === 'W' || color === 'S' || color === activeDim;
}
