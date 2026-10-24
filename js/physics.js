export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function circleRectOverlap(cx, cy, r, x0, y0, x1, y1) {
  const nx = clamp(cx, x0, x1);
  const ny = clamp(cy, y0, y1);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

/**
 * Exakte Lösung einer kritisch gedämpften Feder für einen Zeitschritt.
 * Ergebnis ist unabhängig von der Schrittweite (keine Integrationsfehler),
 * Geschwindigkeit bleibt bei Zielwechseln stetig und es gibt kein Überschwingen.
 */
export function springStep(s, target, omega, dt) {
  const e = s.x - target;
  const c = s.v + omega * e;
  const k = Math.exp(-omega * dt);
  s.x = target + (e + c * dt) * k;
  s.v = (s.v - omega * c * dt) * k;
}
