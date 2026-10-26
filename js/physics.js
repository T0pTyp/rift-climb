export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function circleRectOverlap(cx, cy, r, x0, y0, x1, y1) {
  const nx = clamp(cx, x0, x1);
  const ny = clamp(cy, y0, y1);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r - 1e-7;
}

/** Exact swept circle against a rectangle's rounded Minkowski boundary.
 * Endpoint-only checks miss corner crossings; an expanded AABB kills too early.
 */
export function sweptCircleRect(ax, ay, bx, by, r, x0, y0, x1, y1) {
  if (circleRectOverlap(ax, ay, r, x0, y0, x1, y1) || circleRectOverlap(bx, by, r, x0, y0, x1, y1)) return true;
  const dx = bx - ax, dy = by - ay;
  let lo = 0, hi = 1;
  for (let axis = 0; axis < 2; axis++) {
    const a = axis ? ay : ax, d = axis ? dy : dx, min = axis ? y0 : x0, max = axis ? y1 : x1;
    if (!d) { if (a < min || a > max) { hi = -1; break; } }
    else { const u = (min - a) / d, v = (max - a) / d; lo = Math.max(lo, Math.min(u, v)); hi = Math.min(hi, Math.max(u, v)); }
  }
  if (lo <= hi) return true;
  const length2 = dx * dx + dy * dy;
  if (!length2) return false;
  for (let corner = 0; corner < 4; corner++) {
    const x = corner & 1 ? x1 : x0, y = corner & 2 ? y1 : y0;
    const k = clamp(((x - ax) * dx + (y - ay) * dy) / length2, 0, 1);
    if ((x - ax - dx * k) ** 2 + (y - ay - dy * k) ** 2 < r * r - 1e-7) return true;
  }
  return false;
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
