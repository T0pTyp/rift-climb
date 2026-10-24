import { PARTICLE_CAP } from './config.js';

export const PARTICLE_KIND = Object.freeze({ SQUARE: 0, SPARK: 1, SHARD: 2, GLOW: 3 });

/** Fester Partikel-Pool: keine Allokationen im Game Loop, älteste Partikel werden bei Überlauf ersetzt. */
export class ParticlePool {
  constructor(cap = PARTICLE_CAP) {
    this.cap = cap;
    this.items = Array.from({ length: cap }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', drag: 0.96, kind: 0, rot: 0, spin: 0, grav: 0 }));
    this.count = 0;
    this.cursor = 0;
  }

  spawn(x, y, vx, vy, life, size, color, drag = 0.96, kind = PARTICLE_KIND.SQUARE, grav = 0) {
    let p;
    if (this.count < this.cap) {
      p = this.items[this.count++];
    } else {
      p = this.items[this.cursor];
      this.cursor = (this.cursor + 1) % this.cap;
    }
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.max = life; p.size = size; p.color = color; p.drag = drag;
    p.kind = kind; p.grav = grav;
    p.rot = Math.random() * Math.PI * 2;
    p.spin = (Math.random() - 0.5) * 18;
    return p;
  }

  /** Verschiebt alle Partikel (z. B. beim Practice-Respawn). */
  offset(dy) {
    for (let i = 0; i < this.count; i++) this.items[i].y += dy;
  }

  clear() {
    this.count = 0;
    this.cursor = 0;
  }

  update(dt) {
    const it = this.items;
    for (let i = this.count - 1; i >= 0; i--) {
      const q = it[i];
      q.life -= dt;
      if (q.life <= 0) {
        this.count--;
        it[i] = it[this.count];
        it[this.count] = q;
        continue;
      }
      const d = Math.pow(q.drag, dt * 60);
      q.vx *= d;
      q.vy = q.vy * d - q.grav * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += q.spin * dt;
    }
  }
}
