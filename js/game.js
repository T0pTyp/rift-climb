import {
  BEAT_SEC, CLIMB_SPEED, UNITS_PER_BEAT, WORLD_W, LANES, LANE_W, LEVEL_LENGTH, FINISH_BEAT,
  START_LANE, START_DIM, CHECKPOINT_EVERY_BEATS, BAR_THICKNESS, HINTS, SECTIONS,
  buildObstacles, getRows, validateLevel, sectionAt,
} from './level.js';
import {
  SIM_DT, BAR_INSET_X, HIT_HALF_H, HIT_RADIUS, DEATH_FREEZE_SEC, RESTART_GUARD_SEC, RESPAWN_SEC,
  CAMERA_PLAYER_Y, CAMERA_MIN_BOTTOM, SWITCH_SHAKE, DEATH_SHAKE, SHAKE_PX,
} from './config.js';
import { Player } from './player.js';
import { ParticlePool } from './particles.js';
import { COLORS, isDeadly } from './dimensions.js';
import { circleRectOverlap, clamp } from './physics.js';

const DASH = [6, 5];
const NO_DASH = [];
const COLLIDE_RANGE = HIT_HALF_H + HIT_RADIUS + 2;

export class Game {
  constructor({ canvas, ui, audio, input, storage, debug }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
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
    this.particles = new ParticlePool();
    this.state = 'menu';
    this.mode = 'normal';
    this.t = 0;
    this.acc = 0;
    this.sessionAttempts = 0;
    this.flash = 0;
    this.shake = 0;
    this.switchPulse = 0;
    this.ring = { age: 1, x: 0, y: 0, color: '#fff' };
    this.dimBlend = 0;
    this.respawnTimer = 0;
    this.deathTimer = 0;
    this.deathAge = 0;
    this.killer = null;
    this.checkpoint = null;
    this.lastRowPassed = -1;
    this.obsLo = 0;
    this.emitDist = 0;
    this.view = { cssW: 1, cssH: 1, dpr: 1, scale: 1, offsetX: 0, viewH: 600, playerSY: 468 };
    this.menuT = 0;
    this.autoplayQueue = [];
    this.trace = [];
    this.stats = { fps: 60, steps: 0, frameSteps: 0, impulses: 0 };
  }

  get y() {
    return this.t * CLIMB_SPEED;
  }

  get beat() {
    return this.t / BEAT_SEC;
  }

  get progress() {
    return Math.floor(clamp(this.y / LEVEL_LENGTH, 0, 1) * 100);
  }

  get attemptsDisplay() {
    return this.mode === 'normal' ? this.storage.stats.attempts : this.sessionAttempts;
  }

  /** Vorschau nach oben in Sekunden (Kamera-Lesbarkeit). */
  get lookaheadSec() {
    return this.view.playerSY / CLIMB_SPEED;
  }

  resize(cssW, cssH, dpr) {
    const scale = Math.min(cssW / WORLD_W, cssH / 600);
    const viewH = cssH / scale;
    this.view = {
      cssW, cssH, dpr, scale,
      offsetX: (cssW - WORLD_W * scale) / 2,
      viewH,
      playerSY: Math.min(viewH * CAMERA_PLAYER_Y, viewH - CAMERA_MIN_BOTTOM),
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
    this.acc = 0;
    this.player.reset(START_LANE, START_DIM, 0);
    this.dimBlend = START_DIM === 'R' ? 1 : 0;
    this.particles.clear();
    this.flash = 0;
    this.shake = 0;
    this.switchPulse = 0;
    this.ring.age = 1;
    this.killer = null;
    this.lastRowPassed = -1;
    this.rowSolvable = true;
    this.obsLo = 0;
    this.trace.length = 0;
    this.checkpoint = { t: 0, lane: START_LANE, dim: START_DIM, beat: 0, row: -1 };
    this.state = 'playing';
    this.audio.seek(0);
    this.ui.show(null);
    this.input.guard();
    this.setupAutoplay();
  }

  setupAutoplay() {
    this.autoplayQueue = [];
    if (!this.debug.autoplay || !this.validation.solution) return;
    const startIdx = this.lastRowPassed + 1;
    const offset = this.debug.autoplayOffset;
    this.validation.solution.forEach((taps, k) => {
      if (k < startIdx) return;
      const prevT = k === 0 ? 0.5 : this.rows[k - 1][0] * BEAT_SEC + offset;
      taps.forEach((tap, i) => {
        this.autoplayQueue.push({ t: Math.max(prevT, this.t + 0.05) + i * BEAT_SEC, dir: tap === 'R' ? 1 : -1 });
      });
    });
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'respawn') return;
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.audio.suspend();
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom || 'playing';
    this.audio.resume();
    this.audio.seek(this.t);
    this.ui.show(null);
    this.input.guard();
  }

  toMenu() {
    this.state = 'menu';
    this.audio.resume();
    this.ui.updateMenu(this.storage.stats, this.storage.muted);
    this.ui.show('menu');
  }

  /** Spielfeld-Eingabe (Tipp oder Taste). Bedeutung hängt vom Zustand ab. */
  press(dir) {
    if (this.state === 'playing') {
      this.impulse(dir);
      return true;
    }
    if ((this.state === 'dying' || this.state === 'dead') && this.deathAge >= RESTART_GUARD_SEC) {
      this.quickRestart();
      return true;
    }
    return false;
  }

  quickRestart() {
    if (this.state !== 'dying' && this.state !== 'dead') return;
    if (this.mode === 'practice') this.respawn();
    else this.restart();
  }

  impulse(dir) {
    if (this.state !== 'playing') return;
    const p = this.player;
    const atWall = p.impulse(dir);
    this.stats.impulses++;
    this.flash = 1;
    this.switchPulse = 1;
    this.shake = Math.max(this.shake, SWITCH_SHAKE);
    const col = COLORS[p.dim].main;
    this.ring.age = 0;
    this.ring.x = p.x;
    this.ring.y = this.y;
    this.ring.color = col;
    this.audio.sfx('switch', p.dim, atWall);
    const y = this.y;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * (1.15 + Math.random() * 0.7);
      const s = 70 + Math.random() * 130;
      this.particles.spawn(p.x, y - 6, Math.cos(a) * s - dir * 70, Math.sin(a) * s, 0.32 + Math.random() * 0.12, 2 + Math.random() * 1.5, col, 0.9);
    }
    if (atWall) {
      const wx = dir > 0 ? WORLD_W - 2 : 2;
      for (let i = 0; i < 8; i++) {
        this.particles.spawn(wx, y + (Math.random() - 0.5) * 24, -dir * (60 + Math.random() * 120), (Math.random() - 0.5) * 120, 0.28, 2, '#ffffff', 0.88);
      }
    }
  }

  update(dt) {
    this.menuT += dt;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.shake = Math.max(0, this.shake - dt * 5);
    this.switchPulse = Math.max(0, this.switchPulse - dt * 4);
    this.ring.age = Math.min(1, this.ring.age + dt / 0.38);
    const targetBlend = this.player.dim === 'R' ? 1 : 0;
    this.dimBlend += (targetBlend - this.dimBlend) * Math.min(1, dt * 16);
    this.particles.update(dt);

    let frameSteps = 0;
    if (this.state === 'playing') {
      this.acc += dt;
      while (this.acc >= SIM_DT && this.state === 'playing') {
        this.acc -= SIM_DT;
        this.step(SIM_DT);
        frameSteps++;
      }
    } else if (this.state === 'respawn') {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.state = 'playing';
        this.acc = 0;
        this.audio.seek(this.t);
        this.setupAutoplay();
      }
    } else if (this.state === 'dying' || this.state === 'dead') {
      this.deathAge += dt;
      if (this.state === 'dying') {
        this.deathTimer -= dt;
        if (this.deathTimer <= 0) this.finishDeath();
      }
    }
    this.stats.frameSteps = frameSteps;
    if (dt > 0) this.stats.fps += (1 / Math.max(dt / (this.debug.speed || 1), 1e-3) - this.stats.fps) * 0.05;

    if (this.state === 'playing' || this.state === 'respawn') {
      this.audio.update(this.t);
    }
    if (this.state !== 'menu') {
      this.ui.updateHud(this.progress, this.player.dim, this.attemptsDisplay, this.mode);
    }
  }

  step(h) {
    this.t += h;
    this.stats.steps++;
    while (this.autoplayQueue.length && this.autoplayQueue[0].t <= this.t) {
      this.impulse(this.autoplayQueue.shift().dir);
    }
    const p = this.player;
    const y = this.y;
    p.update(h, y);

    // Schweif-Partikel proportional zur zurückgelegten Seitenstrecke (bildratenunabhängig)
    this.emitDist += Math.abs(p.vx) * h;
    if (this.emitDist > 9) {
      this.emitDist = 0;
      this.particles.spawn(p.x, y - 8, -p.vx * 0.15, -60, 0.26, 2.5, COLORS[p.dim].main, 0.9);
    }

    const obs = this.obstacles;
    while (this.obsLo < obs.length && obs[this.obsLo].y < y - COLLIDE_RANGE) this.obsLo++;
    for (let i = this.obsLo; i < obs.length; i++) {
      const o = obs[i];
      if (o.y > y + COLLIDE_RANGE) break;
      if (!isDeadly(o.color, p.dim)) continue;
      if (circleRectOverlap(p.x, y, HIT_RADIUS, o.x0 + BAR_INSET_X, o.y - HIT_HALF_H, o.x1 - BAR_INSET_X, o.y + HIT_HALF_H)) {
        this.die(o);
        return;
      }
    }

    while (this.lastRowPassed + 1 < this.rows.length &&
      this.rows[this.lastRowPassed + 1][0] * UNITS_PER_BEAT + HIT_HALF_H + HIT_RADIUS < y) {
      this.lastRowPassed++;
      this.onRowPassed(this.lastRowPassed);
    }

    if (this.debug.trace && this.stats.steps % 60 === 0) {
      this.trace.push(`${this.t.toFixed(4)}:${p.x.toFixed(6)}:${p.lane}${p.dim}`);
    }

    if (y >= LEVEL_LENGTH) this.win();
  }

  onRowPassed(k) {
    const p = this.player;
    const alive = this.validation.alive[k];
    this.rowSolvable = !!alive && alive.has(p.lane + p.dim) && !p.dashing;
    if (this.mode !== 'practice') return;
    const beat = this.rows[k][0];
    if (beat - this.checkpoint.beat < CHECKPOINT_EVERY_BEATS) return;
    if (p.dashing || !alive || !alive.has(p.lane + p.dim)) return;
    this.checkpoint = { t: this.t, lane: p.lane, dim: p.dim, beat, row: k };
    this.audio.sfx('checkpoint');
    this.ui.toast('CHECKPOINT');
  }

  deathReason(o, dim) {
    if (o.color === 'W') return 'WEISS tötet immer';
    const name = COLORS[o.color].name;
    return `${name} ist in der ${dim === 'B' ? 'blauen' : 'roten'} Dimension aktiv`;
  }

  die(o) {
    const p = this.player;
    const y = this.y;
    this.killer = { o, x: p.x, y, dim: p.dim, reason: this.deathReason(o, p.dim) };
    const colors = [COLORS[o.color].main, '#ffffff', COLORS[p.dim].main];
    for (let i = 0; i < 34; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 90 + Math.random() * 260;
      this.particles.spawn(p.x, y, Math.cos(a) * s, Math.sin(a) * s, 0.45 + Math.random() * 0.25, 2 + Math.random() * 2.5, colors[i % 3], 0.9);
    }
    this.shake = DEATH_SHAKE;
    this.flash = 0;
    this.audio.sfx('death');
    this.autoplayQueue = [];
    if (this.mode === 'practice') this.sessionAttempts++;
    this.state = 'dying';
    this.deathAge = 0;
    this.deathTimer = this.mode === 'practice' ? DEATH_FREEZE_SEC * 0.8 : DEATH_FREEZE_SEC;
  }

  finishDeath() {
    if (this.mode === 'practice') {
      this.respawn();
      return;
    }
    const pct = this.progress;
    const stats = this.storage.stats;
    const isNewBest = pct > stats.best;
    if (isNewBest) {
      stats.best = pct;
      this.storage.save();
    }
    this.state = 'dead';
    this.ui.showDeath({ pct, best: stats.best, isNewBest, reason: this.killer ? this.killer.reason : '' });
  }

  respawn() {
    const cp = this.checkpoint;
    const dy = cp.t * CLIMB_SPEED - this.y;
    this.particles.offset(dy);
    this.t = cp.t;
    this.acc = 0;
    this.lastRowPassed = cp.row;
    this.obsLo = 0;
    this.killer = null;
    this.player.reset(cp.lane, cp.dim, this.y);
    this.state = 'respawn';
    this.respawnTimer = RESPAWN_SEC;
    this.audio.seek(this.t);
    this.input.guard(0);
  }

  win() {
    this.state = 'won';
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
    if (this.state === 'dying' || this.state === 'dead') {
      if (this.deathAge < RESTART_GUARD_SEC) return true;
      this.quickRestart();
      return true;
    }
    if (this.state === 'won') { this.restart(); return true; }
    if (this.state === 'paused') { this.resume(); return true; }
    return false;
  }

  // ---------------------------------------------------------------- Rendering

  render() {
    const { ctx } = this;
    const v = this.view;
    const camY = this.state === 'menu' ? this.menuT * CLIMB_SPEED * 0.35 : this.y;
    const blend = this.dimBlend;
    const H = v.viewH;
    const psy = v.playerSY;
    const dim = this.player.dim;
    const inGame = this.state !== 'menu';

    // Hintergrund und Vignette liegen als CSS-Ebenen unter dem (transparenten) Canvas.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const amp = this.shake * this.shake * SHAKE_PX;
    const sx = amp ? (Math.random() - 0.5) * amp : 0;
    const sy = amp ? (Math.random() - 0.5) * amp : 0;
    const k = v.dpr * v.scale;
    ctx.setTransform(k, 0, 0, k, v.dpr * v.offsetX + sx * k, sy * k);

    // --- Effekt-Ebene (liegt UNTER den Hindernissen)
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.08;
      ctx.fillStyle = COLORS[dim].main;
      ctx.fillRect(0, 0, WORLD_W, H);
      ctx.globalAlpha = 1;
    }

    const accent = blend < 0.5 ? COLORS.B : COLORS.R;
    const beatF = camY / UNITS_PER_BEAT;
    const pulse = this.state === 'menu' ? 0.3 : 1 - (beatF - Math.floor(beatF));

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    for (let i = 1; i < LANES; i++) {
      ctx.moveTo(i * LANE_W, 0);
      ctx.lineTo(i * LANE_W, H);
    }
    ctx.stroke();

    const firstBeat = Math.floor((camY - (H - psy)) / UNITS_PER_BEAT) - 1;
    const lastBeat = Math.ceil((camY + psy) / UNITS_PER_BEAT) + 1;
    for (let b = firstBeat; b <= lastBeat; b++) {
      const by = psy - (b * UNITS_PER_BEAT - camY);
      const strong = b % 4 === 0;
      ctx.strokeStyle = strong ? accent.glow : 'rgba(255,255,255,0.04)';
      ctx.globalAlpha = strong ? 0.3 + 0.5 * pulse : 1;
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.lineTo(WORLD_W, by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = accent.main;
    ctx.globalAlpha = 0.25 + 0.35 * pulse;
    ctx.fillRect(0, 0, 2, H);
    ctx.fillRect(WORLD_W - 2, 0, 2, H);
    const bump = this.player.wallBump;
    if (inGame && bump) {
      ctx.globalAlpha = Math.abs(bump) * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bump > 0 ? WORLD_W - 4 : 0, psy - 40, 4, 80);
    }
    ctx.globalAlpha = 1;

    if (!inGame) return;

    // Wechsel-Ring (Energieimpuls) – unter den Hindernissen
    if (this.ring.age < 1) {
      const a = this.ring.age;
      const ry = psy - (this.ring.y - camY);
      ctx.globalAlpha = (1 - a) * 0.7;
      ctx.strokeStyle = this.ring.color;
      ctx.lineWidth = 3 * (1 - a) + 1;
      ctx.beginPath();
      ctx.arc(this.ring.x, ry, 14 + a * 120, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
    }

    this.renderMarkers(ctx, camY, psy, H);

    // Partikel (unter den Hindernissen, damit Effekte nie verdecken)
    const ps = this.particles.items;
    for (let i = 0; i < this.particles.count; i++) {
      const q = ps[i];
      const qy = psy - (q.y - camY);
      if (qy < -10 || qy > H + 10) continue;
      ctx.globalAlpha = q.life / q.max;
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, qy - q.size / 2, q.size, q.size);
    }
    ctx.globalAlpha = 1;

    this.renderObstacles(ctx, camY, psy, H, dim);
    this.renderPlayer(ctx, psy);
    this.renderDeath(ctx, camY, psy);
    if (this.debug.hitboxes) this.renderDebug(ctx, camY, psy, H);
  }

  renderMarkers(ctx, camY, psy, H) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Abschnitts-Marken und Hinweise im Abschnitt A
    ctx.font = '800 11px system-ui, sans-serif';
    for (const sec of SECTIONS) {
      if (sec.from === 0) continue;
      const by = psy - (sec.labelBeat * UNITS_PER_BEAT - camY);
      if (by < -20 || by > H + 20) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(`${sec.id} · ${sec.name.toUpperCase()}`, WORLD_W / 2, by);
    }
    ctx.font = '800 14px system-ui, sans-serif';
    for (const [beat, text] of HINTS) {
      const by = psy - (beat * UNITS_PER_BEAT - camY);
      if (by < -20 || by > H + 20) continue;
      ctx.globalAlpha = clamp((H - by) / 120, 0, 1) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, WORLD_W / 2, by);
    }
    ctx.globalAlpha = 1;

    const fy = psy - (LEVEL_LENGTH - camY);
    if (fy > -40 && fy < H + 40) {
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = i % 2 ? '#ffffff' : '#1affb2';
        ctx.fillRect(i * 20, fy - 6, 20, 6);
      }
      ctx.fillStyle = '#1affb2';
      ctx.font = '800 16px system-ui, sans-serif';
      ctx.fillText('RIFT CLEARED · 100 %', WORLD_W / 2, fy - 20);
    }

    if (this.mode === 'practice' && this.checkpoint && this.checkpoint.beat > 0) {
      const cy = psy - (this.checkpoint.t * CLIMB_SPEED - camY);
      if (cy > -10 && cy < H + 10) {
        ctx.strokeStyle = 'rgba(26,255,178,0.6)';
        ctx.setLineDash(DASH);
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(WORLD_W, cy);
        ctx.stroke();
        ctx.setLineDash(NO_DASH);
      }
    }
  }

  renderObstacles(ctx, camY, psy, H, dim) {
    const top = camY + psy + 40;
    const bottom = camY - (H - psy) - 40;
    const hh = BAR_THICKNESS / 2;
    const pop = this.switchPulse;
    const killerO = this.killer && (this.state === 'dying' || this.state === 'dead') ? this.killer.o : null;
    for (const o of this.obstacles) {
      if (o.y < bottom) continue;
      if (o.y > top) break;
      const oy = psy - (o.y - camY);
      const x0 = o.x0 + BAR_INSET_X;
      const w = o.x1 - o.x0 - BAR_INSET_X * 2;
      const col = COLORS[o.color];
      if (isDeadly(o.color, dim)) {
        const g = 4 + (o.color === 'W' ? 0 : pop * 5);
        ctx.fillStyle = col.glow;
        ctx.fillRect(x0 - g, oy - hh - g, w + g * 2, BAR_THICKNESS + g * 2);
        ctx.fillStyle = col.main;
        ctx.fillRect(x0, oy - hh, w, BAR_THICKNESS);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillRect(x0 + 2, oy - 1.5, w - 4, 3);
      } else {
        ctx.globalAlpha = 0.14;
        ctx.fillStyle = col.main;
        ctx.fillRect(x0, oy - hh, w, BAR_THICKNESS);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = col.ghost;
        ctx.lineWidth = 2;
        ctx.setLineDash(DASH);
        ctx.strokeRect(x0 + 1, oy - hh + 1, w - 2, BAR_THICKNESS - 2);
        ctx.setLineDash(NO_DASH);
        ctx.lineWidth = 1;
      }
      if (o === killerO && Math.floor(this.deathAge * 12) % 2 === 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(x0 - 3, oy - hh - 3, w + 6, BAR_THICKNESS + 6);
        ctx.lineWidth = 1;
      }
    }
  }

  renderPlayer(ctx, sy) {
    const p = this.player;
    if (this.state === 'dying' || this.state === 'dead') return;
    if (this.state === 'respawn' && Math.floor(this.respawnTimer * 10) % 2 === 0) return;
    const col = COLORS[p.dim];
    const y = this.y;

    // Schweif aus dem Ringpuffer (älteste zuerst)
    const n = p.trailCount;
    for (let i = n - 1; i >= 1; i--) {
      const idx = (p.trailHead - i + p.trailX.length) % p.trailX.length;
      const f = 1 - i / n;
      ctx.globalAlpha = f * 0.4;
      ctx.fillStyle = col.main;
      const s = 2 + f * 6;
      ctx.fillRect(p.trailX[idx] - s / 2, sy - (p.trailY[idx] - y) - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    const scale = 1 + p.pop * 0.28;
    ctx.save();
    ctx.translate(p.x, sy);
    ctx.rotate(p.tilt);
    ctx.scale(scale * (1 - p.pop * 0.12), scale);
    ctx.globalAlpha = 0.8 + p.pop * 0.2;
    ctx.fillStyle = col.glow;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + p.pop * 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.pop > 0.6 ? '#ffffff' : col.main;
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

  renderDeath(ctx, camY, psy) {
    const kl = this.killer;
    if (!kl || (this.state !== 'dying' && this.state !== 'dead')) return;
    const ky = psy - (kl.y - camY);
    const a = Math.min(1, this.deathAge / 0.12);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.moveTo(kl.x - 9, ky - 9); ctx.lineTo(kl.x + 9, ky + 9);
    ctx.moveTo(kl.x + 9, ky - 9); ctx.lineTo(kl.x - 9, ky + 9);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(kl.x, ky, 16 + this.deathAge * 40, 0, Math.PI * 2);
    ctx.globalAlpha = Math.max(0, 1 - this.deathAge * 2.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1;
    if (this.mode === 'practice') {
      ctx.font = '800 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(kl.reason.toUpperCase(), WORLD_W / 2, ky + 36);
    }
  }

  renderDebug(ctx, camY, psy, H) {
    const p = this.player;
    const dim = p.dim;
    const top = camY + psy + 20;
    const bottom = camY - (H - psy) - 20;
    ctx.lineWidth = 1;
    for (const o of this.obstacles) {
      if (o.y < bottom) continue;
      if (o.y > top) break;
      const oy = psy - (o.y - camY);
      ctx.strokeStyle = isDeadly(o.color, dim) ? '#ffea00' : 'rgba(160,160,160,0.6)';
      ctx.strokeRect(o.x0 + BAR_INSET_X, oy - HIT_HALF_H, o.x1 - o.x0 - BAR_INSET_X * 2, HIT_HALF_H * 2);
    }
    ctx.strokeStyle = '#00ff66';
    ctx.beginPath();
    ctx.arc(p.x, psy, HIT_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, psy);
    ctx.lineTo(p.x + p.vx * 0.1, psy - CLIMB_SPEED * 0.1);
    ctx.stroke();

    const solver = this.lastRowPassed < 0 ? 'Start' : this.rowSolvable ? 'lösbar' : 'Sackgasse';
    const lines = [
      `FPS ${this.stats.fps.toFixed(0)}  Sim ${Math.round(1 / SIM_DT)} Hz  Schritte/Frame ${this.stats.frameSteps}`,
      `t ${this.t.toFixed(3)} s  Beat ${this.beat.toFixed(2)}/${FINISH_BEAT}  Abschnitt ${sectionAt(this.beat).id}`,
      `x ${p.x.toFixed(1)}  vx ${p.vx.toFixed(0)} u/s  Spur ${p.lane}  Dim ${dim}`,
      `y ${this.y.toFixed(0)}  vy ${CLIMB_SPEED} u/s  Vorschau ${this.lookaheadSec.toFixed(2)} s`,
      `Impulse ${this.stats.impulses}  ignoriert ${this.input.ignored}  Solver: ${solver}`,
    ];
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(4, H - 14 * lines.length - 10, WORLD_W - 8, 14 * lines.length + 6);
    ctx.fillStyle = '#00ff66';
    lines.forEach((l, i) => ctx.fillText(l, 8, H - 14 * lines.length - 6 + i * 14));
    ctx.textBaseline = 'alphabetic';
  }
}
