// Bewegungsspur und Partikel-Darstellung (Spiel). Keine Allokationen pro Frame: feste Puffer, Pool-Partikel.
import { PARTICLE_KIND } from '../particles.js';

const MAX_PTS = 64;
const lx = new Float32Array(MAX_PTS);
const ly = new Float32Array(MAX_PTS);
const nx = new Float32Array(MAX_PTS);
const ny = new Float32Array(MAX_PTS);

/**
 * Dynamischer Energie-Schweif aus dem Ringpuffer des Spielers (älteste Punkte zuerst).
 * sy/y: Bildschirm- und Welthöhe des Spielers. width: Breite am Kopf (u), wächst mit der Geschwindigkeit.
 */
export function drawTrail(ctx, player, px, sy, y, color, width) {
  const n = Math.min(player.trailCount, MAX_PTS - 1);
  if (n < 2) return;
  const len = player.trailX.length;
  let m = 0;
  for (let i = n - 1; i >= 1; i--) {
    const idx = (player.trailHead - i + len) % len;
    lx[m] = player.trailX[idx];
    ly[m] = sy - (player.trailY[idx] - y) + 6;
    m++;
  }
  lx[m] = px;
  ly[m] = sy + 6;
  m++;
  for (let i = 0; i < m; i++) {
    const a = i > 0 ? i - 1 : i;
    const b = i < m - 1 ? i + 1 : i;
    let dx = lx[b] - lx[a];
    let dy = ly[b] - ly[a];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d;
    dy /= d;
    nx[i] = -dy;
    ny[i] = dx;
  }
  const ribbon = (w, alpha, fill) => {
    ctx.beginPath();
    for (let i = 0; i < m; i++) {
      const f = (i + 1) / m;
      const hw = w * f * f;
      if (i === 0) ctx.moveTo(lx[i] + nx[i] * hw, ly[i] + ny[i] * hw);
      else ctx.lineTo(lx[i] + nx[i] * hw, ly[i] + ny[i] * hw);
    }
    for (let i = m - 1; i >= 0; i--) {
      const f = (i + 1) / m;
      const hw = w * f * f;
      ctx.lineTo(lx[i] - nx[i] * hw, ly[i] - ny[i] * hw);
    }
    ctx.closePath();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.fill();
  };
  ribbon(width, 0.38, color);
  ribbon(width * 0.42, 0.55, '#ffffff');
  ctx.globalAlpha = 1;
}

/** Partikel des Pools; Arten: Quadrat, Funke (entlang der Bewegung), Splitter (rotierendes Dreieck), Lichtpunkt. */
export function drawParticles(ctx, pool, camY, psy, H) {
  const ps = pool.items;
  for (let i = 0; i < pool.count; i++) {
    const q = ps[i];
    const qy = psy - (q.y - camY);
    if (qy < -16 || qy > H + 16) continue;
    const f = q.life / q.max;
    ctx.globalAlpha = f;
    ctx.fillStyle = q.color;
    const s = q.size;
    if (q.kind === PARTICLE_KIND.SPARK) {
      const v = Math.hypot(q.vx, q.vy) || 1;
      const l = Math.min(14, 2 + v * 0.03) * (0.5 + 0.5 * f);
      ctx.strokeStyle = q.color;
      ctx.lineWidth = s * 0.7;
      ctx.beginPath();
      ctx.moveTo(q.x, qy);
      ctx.lineTo(q.x - (q.vx / v) * l, qy + (q.vy / v) * l);
      ctx.stroke();
    } else if (q.kind === PARTICLE_KIND.SHARD) {
      const r = q.rot;
      const c = Math.cos(r) * s;
      const sn = Math.sin(r) * s;
      ctx.beginPath();
      ctx.moveTo(q.x + c * 1.4, qy + sn * 1.4);
      ctx.lineTo(q.x - c * 0.7 - sn * 0.8, qy - sn * 0.7 + c * 0.8);
      ctx.lineTo(q.x - c * 0.7 + sn * 0.8, qy - sn * 0.7 - c * 0.8);
      ctx.closePath();
      ctx.fill();
    } else if (q.kind === PARTICLE_KIND.GLOW) {
      ctx.globalAlpha = f * 0.35;
      ctx.fillRect(q.x - s, qy - s, s * 2, s * 2);
      ctx.globalAlpha = f;
      ctx.fillRect(q.x - s / 3, qy - s / 3, (s * 2) / 3, (s * 2) / 3);
    } else {
      ctx.fillRect(q.x - s / 2, qy - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}
