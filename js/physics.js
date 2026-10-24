export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function circleRectOverlap(cx, cy, r, x0, y0, x1, y1) {
  const nx = clamp(cx, x0, x1);
  const ny = clamp(cy, y0, y1);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
