import {
  BEAT_SEC, CLIMB_SPEED, UNITS_PER_BEAT, WORLD_W, LANES, LANE_W, LEVEL_LENGTH,
  START_LANE, START_DIM, CHECKPOINT_EVERY_BEATS, BAR_THICKNESS,
  buildObstacles, getRows, validateLevel,
} from './level.js';
import { Player, HIT_RADIUS } from './player.js';
import { COLORS, isDeadly } from './dimensions.js';
import { circleRectOverlap, clamp } from './physics.js';

const SUBSTEP = 1 / 240;
const HIT_HALF_H = 5;
const HIT_INSET_X = 3;

export class Game {
  constructor({ canvas, ui, audio, input, storage, debug }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ui = ui;
    this.audio = audio;
    this.input = input;
    this.storage = storage;
    this.debug = debug;
    this.rows = getRows();
    this.obstacles = buildObstacles(this.rows);
    this.validation = validateLevel(this.rows);
    if (!this.validation.ok) console.error('Level nicht lösbar:', this.validation.errors);
    this.player = new Player();
    this.particles = [];
    this.state = 'menu';
    this.mode = 'normal';
    this.t = 0;
    this.sessionAttempts = 0;
    this.flash = 0;
    this.shake = 0;
    this.dimBlend = 0;
    this.respawnTimer = 0;
    this.deathTimer = 0;
    this.checkpoint = null;
    this.lastRowPassed = -1;
    this.view = { cssW: 1, cssH: 1, dpr: 1, scale: 1, offsetX: 0, viewH: 600 };
    this.menuT = 0;
    this.autoplayQueue = [];
  }

  get y() {
    return this.t * CLIMB_SPEED;
  }

  get progress() {
    return Math.floor(clamp(this.y / LEVEL_LENGTH, 0, 1) * 100);
  }

  get attemptsDisplay() {
    return this.mode === 'normal' ? this.storage.stats.attempts : this.sessionAttempts;
  }

  resize(cssW, cssH, dpr) {
    const scale = Math.min(cssW / WORLD_W, cssH / 600);
    this.view = {
      cssW, cssH, dpr, scale,
      offsetX: (cssW - WORLD_W * scale) / 2,
      viewH: cssH / scale,
    };
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
  }

  start(mode) {
    this.mode = mode;
    this.sessionAttempts = 0;
    this.restart();
  }

  restart() {
    if (this.mode === 'normal') {
      this.storage.stats.attempts++;
      this.storage.save();
    } else {
      this.sessionAttempts++;
    }
    this.t = 0;
    this.player.reset(START_LANE, START_DIM);
    this.dimBlend = START_DIM === 'R' ? 1 : 0;
    this.particles.length = 0;
    this.lastRowPassed = -1;
    this.checkpoint = { t: 0, lane: START_LANE, dim: START_DIM, beat: 0, row: -1 };
    this.state = 'playing';
    this.audio.seek(0);
    this.ui.show(null);
    this.input.enable();
    this.setupAutoplay();
  }

  setupAutoplay() {
    this.autoplayQueue = [];
    if (!this.debug.autoplay || !this.validation.solution) return;
    const startIdx = this.lastRowPassed + 1;
    this.validation.solution.forEach((taps, k) => {
      if (k < startIdx) return;
      const prevT = k === 0 ? 0.5 : this.rows[k - 1][0] * BEAT_SEC + 0.12;
      taps.forEach((tap, i) => {
        this.autoplayQueue.push({ t: Math.max(prevT, this.t + 0.05) + i * BEAT_SEC, dir: tap === 'R' ? 1 : -1 });
      });
    });
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'respawn') return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.input.disable();
    this.audio.suspend();
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom || 'playing';
    this.audio.resume();
    this.audio.seek(this.t);
    this.ui.show(null);
    this.input.enable();
  }

  toMenu() {
    this.state = 'menu';
    this.input.disable();
    this.audio.resume();
    this.ui.updateMenu(this.storage.stats, this.storage.muted);
    this.ui.show('menu');
  }

  impulse(dir) {
    if (this.state !== 'playing') return;
    const p = this.player;
    p.impulse(dir);
    this.flash = 1;
    this.audio.sfx('switch', p.dim);
    const c = COLORS[p.dim].main;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 160;
      this.particles.push({ x: p.x, y: this.y, vx: Math.cos(a) * s - dir * 60, vy: Math.sin(a) * s - 80, life: 0.45, max: 0.45, color: c, size: 2 + Math.random() * 2 });
    }
  }

  update(dt) {
    this.menuT += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    this.shake = Math.max(0, this.shake - dt * 3);
    const targetBlend = this.player.dim === 'R' ? 1 : 0;
    this.dimBlend += (targetBlend - this.dimBlend) * Math.min(1, dt * 14);
    this.updateParticles(dt);

    if (this.state === 'playing') {
      let remaining = dt;
      while (remaining > 1e-9 && this.state === 'playing') {
        const h = Math.min(SUBSTEP, remaining);
        remaining -= h;
        this.step(h);
      }
    } else if (this.state === 'respawn') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.state = 'playing';
        this.audio.seek(this.t);
        this.input.enable(0);
        this.setupAutoplay();
      }
    } else if (this.state === 'dying') {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.finishDeath();
    }

    if (this.state === 'playing' || this.state === 'respawn') {
      this.audio.update(this.t);
    }
    if (this.state !== 'menu') {
      this.ui.updateHud(this.progress, this.player.dim, this.attemptsDisplay, this.mode);
    }
  }

  step(h) {
    this.t += h;
    while (this.autoplayQueue.length && this.autoplayQueue[0].t <= this.t) {
      this.impulse(this.autoplayQueue.shift().dir);
    }
    const p = this.player;
    p.update(h);
    const y = this.y;

    for (const o of this.obstacles) {
      if (o.y < y - 40) continue;
      if (o.y > y + 40) break;
      if (!isDeadly(o.color, p.dim)) continue;
      if (circleRectOverlap(p.x, y, HIT_RADIUS, o.x0 + HIT_INSET_X, o.y - HIT_HALF_H, o.x1 - HIT_INSET_X, o.y + HIT_HALF_H)) {
        this.die();
        return;
      }
    }

    while (this.lastRowPassed + 1 < this.rows.length &&
      this.rows[this.lastRowPassed + 1][0] * UNITS_PER_BEAT + HIT_HALF_H + HIT_RADIUS < y) {
      this.lastRowPassed++;
      this.onRowPassed(this.lastRowPassed);
    }

    if (y >= LEVEL_LENGTH) this.win();
  }

  onRowPassed(k) {
    if (this.mode !== 'practice') return;
    const beat = this.rows[k][0];
    const p = this.player;
    const alive = this.validation.alive[k];
    if (beat - this.checkpoint.beat < CHECKPOINT_EVERY_BEATS) return;
    if (p.dashing || !alive || !alive.has(p.lane + p.dim)) return;
    this.checkpoint = { t: this.t, lane: p.lane, dim: p.dim, beat, row: k };
    this.audio.sfx('checkpoint');
    this.ui.toast('CHECKPOINT');
  }

  explode() {
    const p = this.player;
    const colors = [COLORS[p.dim].main, '#ffffff'];
    for (let i = 0; i < 36; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 80 + Math.random() * 280;
      this.particles.push({ x: p.x, y: this.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.8, max: 0.8, color: colors[i % 2], size: 2 + Math.random() * 3 });
    }
    this.shake = 1;
    this.audio.sfx('death');
  }

  die() {
    this.explode();
    this.input.disable();
    this.autoplayQueue = [];
    if (this.mode === 'practice') {
      this.sessionAttempts++;
      this.state = 'respawn';
      this.respawnTimer = 0.9;
      const cp = this.checkpoint;
      const dy = cp.t * CLIMB_SPEED - this.y;
      for (const q of this.particles) q.y += dy;
      this.t = cp.t;
      this.lastRowPassed = cp.row;
      this.player.reset(cp.lane, cp.dim);
      this.audio.seek(this.t);
      return;
    }
    this.state = 'dying';
    this.deathTimer = 0.35;
  }

  finishDeath() {
    const pct = this.progress;
    const stats = this.storage.stats;
    const isNewBest = pct > stats.best;
    if (isNewBest) {
      stats.best = pct;
      this.storage.save();
    }
    this.state = 'dead';
    this.ui.showDeath({ pct, best: stats.best, isNewBest });
  }

  win() {
    this.state = 'won';
    this.input.disable();
    this.autoplayQueue = [];
    if (this.mode === 'normal') {
      this.storage.stats.best = 100;
      this.storage.stats.clears = (this.storage.stats.clears || 0) + 1;
      this.storage.save();
    }
    this.audio.sfx('win');
    this.ui.showWin({ mode: this.mode, attempts: this.attemptsDisplay });
  }

  /** Tastatur-Bestätigung (Enter/Leertaste/R) auf Overlays. */
  confirm() {
    if (this.state === 'dead' || this.state === 'won') { this.restart(); return true; }
    if (this.state === 'paused') { this.resume(); return true; }
    return false;
  }

  updateParticles(dt) {
    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.life -= dt;
      if (q.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
      q.x += q.vx * dt;
      q.y -= q.vy * dt;
      q.vx *= 0.96;
      q.vy *= 0.96;
    }
  }

  // ---------------------------------------------------------------- Rendering

  render() {
    const { ctx } = this;
    const v = this.view;
    const camY = this.state === 'menu' ? this.menuT * CLIMB_SPEED * 0.35 : this.y;
    const blend = this.dimBlend;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#020208';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const sx = (Math.random() - 0.5) * this.shake * 10;
    const sy = (Math.random() - 0.5) * this.shake * 10;
    const k = v.dpr * v.scale;
    ctx.setTransform(k, 0, 0, k, v.dpr * v.offsetX + sx * k, sy * k);

    const H = v.viewH;
    const playerSY = H * 0.78;
    const toScreen = (wy) => playerSY - (wy - camY);

    // Hintergrund (Blend zwischen blauer und roter Dimension)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, mix('#04102a', '#2a0420', blend));
    bg.addColorStop(1, mix('#02040c', '#0c0208', blend));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORLD_W, H);

    const accent = blend < 0.5 ? COLORS.B : COLORS.R;
    const beatF = camY / UNITS_PER_BEAT;
    const pulse = this.state === 'menu' ? 0.3 : 1 - (beatF - Math.floor(beatF));

    // Spurlinien
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    for (let i = 1; i < LANES; i++) {
      ctx.moveTo(i * LANE_W, 0);
      ctx.lineTo(i * LANE_W, H);
    }
    ctx.stroke();

    // Beat-Linien (pulsieren im Takt)
    const firstBeat = Math.floor((camY - playerSY) / UNITS_PER_BEAT) - 1;
    const lastBeat = Math.ceil((camY + H) / UNITS_PER_BEAT) + 1;
    for (let b = firstBeat; b <= lastBeat; b++) {
      const sy2 = toScreen(b * UNITS_PER_BEAT);
      const strong = b % 4 === 0;
      ctx.strokeStyle = strong ? accent.glow : 'rgba(255,255,255,0.04)';
      ctx.globalAlpha = strong ? 0.3 + 0.5 * pulse : 1;
      ctx.beginPath();
      ctx.moveTo(0, sy2);
      ctx.lineTo(WORLD_W, sy2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Seitenwände
    ctx.fillStyle = accent.main;
    ctx.globalAlpha = 0.25 + 0.35 * pulse;
    ctx.fillRect(0, 0, 2, H);
    ctx.fillRect(WORLD_W - 2, 0, 2, H);
    ctx.globalAlpha = 1;

    if (this.state === 'menu') return;

    // Ziellinie
    const fy = toScreen(LEVEL_LENGTH);
    if (fy > -40 && fy < H + 40) {
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = i % 2 ? '#ffffff' : '#1affb2';
        ctx.fillRect(i * 20, fy - 6, 20, 6);
      }
      ctx.fillStyle = '#1affb2';
      ctx.font = '700 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('RIFT CLEARED', WORLD_W / 2, fy - 16);
    }

    // Checkpoint-Marker (Practice)
    if (this.mode === 'practice' && this.checkpoint && this.checkpoint.beat > 0) {
      const cy = toScreen(this.checkpoint.t * CLIMB_SPEED);
      if (cy > -10 && cy < H + 10) {
        ctx.strokeStyle = 'rgba(26,255,178,0.6)';
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(WORLD_W, cy);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Hindernisse
    const dim = this.player.dim;
    const top = camY + playerSY + 40;
    const bottom = camY - (H - playerSY) - 40;
    for (const o of this.obstacles) {
      if (o.y < bottom) continue;
      if (o.y > top) break;
      const oy = toScreen(o.y);
      const x0 = o.x0 + 3;
      const w = o.x1 - o.x0 - 6;
      const hh = BAR_THICKNESS / 2;
      const col = COLORS[o.color];
      if (isDeadly(o.color, dim)) {
        ctx.fillStyle = col.glow;
        ctx.fillRect(x0 - 4, oy - hh - 4, w + 8, BAR_THICKNESS + 8);
        ctx.fillStyle = col.main;
        ctx.fillRect(x0, oy - hh, w, BAR_THICKNESS);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x0 + 2, oy - 1.5, w - 4, 3);
      } else {
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = col.main;
        ctx.fillRect(x0, oy - hh, w, BAR_THICKNESS);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col.ghost;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.strokeRect(x0 + 1, oy - hh + 1, w - 2, BAR_THICKNESS - 2);
        ctx.setLineDash([]);
        ctx.lineWidth = 1;
      }
    }

    // Partikel
    for (const q of this.particles) {
      ctx.globalAlpha = q.life / q.max;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, toScreen(q.y) - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    this.renderPlayer(ctx, playerSY);

    // Dimensionswechsel: dezenter Farb-Flash + Rand-Vignette
    if (this.flash > 0) {
      ctx.fillStyle = COLORS[dim].main;
      ctx.globalAlpha = this.flash * 0.12;
      ctx.fillRect(0, 0, WORLD_W, H);
      ctx.globalAlpha = 1;
    }
    const vg = ctx.createRadialGradient(WORLD_W / 2, H / 2, H * 0.3, WORLD_W / 2, H / 2, H * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, COLORS[dim].glow);
    ctx.fillStyle = vg;
    ctx.globalAlpha = 0.35 + this.flash * 0.4;
    ctx.fillRect(0, 0, WORLD_W, H);
    ctx.globalAlpha = 1;
  }

  renderPlayer(ctx, sy) {
    const p = this.player;
    if (this.state === 'dying' || this.state === 'dead') return;
    if (this.state === 'respawn' && Math.floor(this.respawnTimer * 10) % 2 === 0) return;
    const col = COLORS[p.dim];
    const tilt = p.dashing ? p.dashDir * 0.45 * (1 - p.dashT) : 0;

    // Spur (Trail)
    p.trail.push({ x: p.x, y: this.y });
    if (p.trail.length > 10) p.trail.shift();
    for (let i = 0; i < p.trail.length - 1; i++) {
      const tr = p.trail[i];
      ctx.globalAlpha = (i / p.trail.length) * 0.35;
      ctx.fillStyle = col.main;
      const s = 3 + i * 0.6;
      ctx.fillRect(tr.x - s / 2, sy - (tr.y - this.y) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(p.x, sy);
    ctx.rotate(tilt);
    ctx.fillStyle = col.glow;
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col.main;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(11, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function hex(c) {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
}

function mix(a, b, t) {
  const A = hex(a);
  const B = hex(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
}
