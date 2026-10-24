import {
  BEAT_SEC, CLIMB_SPEED, UNITS_PER_BEAT, WORLD_W, LANES, LANE_W, CHECKPOINT_EVERY_BEATS,
  SIM_DT, HIT_RADIUS, DEATH_FREEZE_SEC, RESTART_GUARD_SEC, RESPAWN_SEC,
  CAMERA_PLAYER_Y, CAMERA_MIN_BOTTOM, SWITCH_SHAKE, DEATH_SHAKE, SHAKE_PX,
  PULSE_RADIUS, PULSE_GROW_SEC, PULSE_FADE_SEC, SEAL_WARN_SEC, SEAL_STREAK_SHAKE,
} from './config.js';
import { validateLevel } from './level.js';
import { buildLevelRuntime, levelFromRows } from './level-data.js';
import { RiftField, pulseRadius, distToSeal } from './rift.js';
import { Player } from './player.js';
import { ParticlePool } from './particles.js';
import { COLORS, isDeadly } from './dimensions.js';
import { circleRectOverlap, clamp } from './physics.js';
import { DASH, NO_DASH, drawBar, drawSealClosed, drawSealOpen, drawShip, drawFinish } from './shapes.js';

const REACH_DASH = [4, 7];
const CHECKPOINT_SPACING = CHECKPOINT_EVERY_BEATS * UNITS_PER_BEAT;

export class Game {
  /**
   * level: geprüftes JSON-Level (validateLevelData(...).level). rows: Reihenliste (nur für Tests, wird migriert).
   * events: { onWin({ mode, attempts, replay, from }) } – z. B. für den Playtest aus LEVEL FORGE.
   */
  constructor({ canvas, ui, audio, input, storage, debug, level, rows, events }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ui = ui;
    this.audio = audio;
    this.input = input;
    this.storage = storage;
    this.debug = debug;
    this.events = events || {};
    this.levelData = level || levelFromRows(rows || [], { id: 'test', name: 'Test' });
    this.level = buildLevelRuntime(this.levelData);
    this.rows = this.level.rows;
    this.lines = this.level.lines;
    this.obstacles = this.level.obstacles;
    this.seals = this.level.seals;
    this.collideRange = this.level.maxChh + HIT_RADIUS + 2;
    this.rift = new RiftField(this.seals);
    this.onSealOpen = this.onSealOpen.bind(this);
    // Spur-Solver nur für Level im Spurmodell; freie Level werden über einen aufgezeichneten Lauf nachgewiesen.
    this.validation = this.rows
      ? validateLevel(this.rows, this.level.start)
      : { ok: null, errors: [], alive: null, solution: null, reachable: [] };
    if (this.audio.setLevel) this.audio.setLevel(this.level);
    this.startFrom = null;
    this.recording = null;
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
    this.sealStreak = 0;
    this.dimBlend = 0;
    this.respawnTimer = 0;
    this.deathTimer = 0;
    this.deathAge = 0;
    this.killer = null;
    this.checkpoint = null;
    this.lastRowPassed = -1; // Index in this.lines (= Reihe im Spurmodell)
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

  /** Musikalischer Beat (Level-BPM). */
  get beat() {
    return this.t / this.level.beatSec;
  }

  get progress() {
    return Math.floor(clamp(this.y / this.level.finishY, 0, 1) * 100);
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

  /** from: { y, lane, dim } = ab dieser Höhe starten (PLAY FROM HERE im Editor), sonst Levelstart. */
  start(mode, from = null) {
    this.mode = mode;
    this.startFrom = from;
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
    const from = this.startFrom;
    const st = from || this.level.start;
    this.t = from ? from.y / CLIMB_SPEED : 0;
    this.acc = 0;
    this.player.reset(st.lane, st.dim, this.y);
    this.dimBlend = st.dim === 'R' ? 1 : 0;
    this.particles.clear();
    this.flash = 0;
    this.shake = 0;
    this.switchPulse = 0;
    this.rift.reset();
    this.sealStreak = 0;
    this.killer = null;
    this.lastRowPassed = this.linesBelow(this.y);
    this.rowSolvable = true;
    this.obsLo = 0;
    this.trace.length = 0;
    this.checkpoint = { t: this.t, lane: st.lane, dim: st.dim, beat: this.y / UNITS_PER_BEAT, row: this.lastRowPassed };
    // Aufzeichnung (Nachweis der Durchspielbarkeit) nur für vollständige Läufe im Normalmodus
    this.recording = this.mode === 'normal' && !from ? [] : null;
    this.state = 'playing';
    this.audio.seek(this.t);
    this.ui.show(null);
    this.input.guard();
    this.setupAutoplay();
  }

  /** Index der letzten Linie, die der Spieler bei Höhe y bereits vollständig passiert hat. */
  linesBelow(y) {
    let k = -1;
    while (k + 1 < this.lines.length && this.lines[k + 1].y + this.lines[k + 1].chh + HIT_RADIUS < y) k++;
    return k;
  }

  setupAutoplay() {
    this.autoplayQueue = [];
    if (!this.debug.autoplay) return;
    if (!this.validation.solution) {
      // Ohne Spur-Lösung: aufgezeichneten Lauf abspielen (nur sinnvoll ab Levelstart)
      const rep = this.level.replay;
      if (rep && !this.startFrom) for (const tap of rep.taps) if (tap.t > this.t + 1e-9) this.autoplayQueue.push({ t: tap.t, dir: tap.dir });
      return;
    }
    const startIdx = this.lastRowPassed + 1;
    const offset = this.debug.autoplayOffset;
    const lead = this.debug.sealLead;
    this.validation.solution.forEach((taps, k) => {
      if (k < startIdx) return;
      const prevT = k === 0 ? 0.5 : this.rows[k - 1][0] * BEAT_SEC + offset;
      const hasSeal = this.rows[k][1].includes('S');
      taps.forEach((tap, i) => {
        let t = Math.max(prevT, this.t + 0.05) + i * BEAT_SEC;
        // Öffnungs-Tipp vor einer Siegel-Reihe: `lead` Sekunden vor dem Siegel
        if (hasSeal && i === taps.length - 1) t = Math.max(t, this.rows[k][0] * BEAT_SEC - lead);
        this.autoplayQueue.push({ t, dir: tap === 'R' ? 1 : -1 });
      });
    });
    this.autoplayQueue.sort((a, b) => a.t - b.t);
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
      if (this.recording) this.recording.push({ t: Math.round(this.t * 1e4) / 1e4, dir });
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
    this.rift.emit(p.x, this.y, this.t, col);
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

    this.rift.step(this.t, this.onSealOpen);

    const obs = this.obstacles;
    const range = this.collideRange;
    while (this.obsLo < obs.length && obs[this.obsLo].y < y - range) this.obsLo++;
    for (let i = this.obsLo; i < obs.length; i++) {
      const o = obs[i];
      if (o.y > y + range) break;
      if (!this.deadlyNow(o, p.dim)) continue;
      if (circleRectOverlap(p.x, y, HIT_RADIUS, o.x0, o.y - o.chh, o.x1, o.y + o.chh)) {
        this.die(o);
        return;
      }
    }

    const lines = this.lines;
    while (this.lastRowPassed + 1 < lines.length && lines[this.lastRowPassed + 1].y + lines[this.lastRowPassed + 1].chh + HIT_RADIUS < y) {
      this.lastRowPassed++;
      this.onRowPassed(this.lastRowPassed);
    }

    if (this.debug.trace && this.stats.steps % 60 === 0) {
      this.trace.push(`${this.t.toFixed(4)}:${p.x.toFixed(6)}:${p.lane}${p.dim}`);
    }

    if (y >= this.level.finishY) this.win();
  }

  /** Geschlossene Siegel sind in beiden Dimensionen tödlich, geöffnete gar nicht; sonst Dimensionsregel. */
  deadlyNow(o, dim) {
    if (o.color === 'S') return !this.rift.isOpen(o, this.t);
    return isDeadly(o.color, dim);
  }

  onSealOpen(s, wasOpen) {
    if (wasOpen) return;
    const w = s.x1 - s.x0;
    for (let i = 0; i < 14; i++) {
      const px = s.x0 + Math.random() * w;
      this.particles.spawn(px, s.y + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 90, 40 + Math.random() * 120, 0.3 + Math.random() * 0.15, 2 + Math.random() * 1.5, i % 3 ? COLORS.S.main : '#ffffff', 0.9);
    }
    this.audio.sfx('seal');
  }

  onRowPassed(k) {
    const p = this.player;
    const line = this.lines[k];
    if (line.objs.some((o) => o.color === 'S' && p.x >= o.x0 && p.x <= o.x1)) {
      this.sealStreak++;
      if (this.sealStreak % 3 === 0) this.shake = Math.max(this.shake, SEAL_STREAK_SHAKE);
    }
    // Mit Spur-Solver: nur Zustände, von denen das Ziel erreichbar ist; sonst nur "nicht mitten im Spurwechsel"
    const alive = this.validation.alive ? this.validation.alive[k] : null;
    const safe = !p.dashing && (!this.validation.alive || (!!alive && alive.has(p.lane + p.dim)));
    this.rowSolvable = safe;
    if (this.mode !== 'practice') return;
    const beat = line.y / UNITS_PER_BEAT;
    if (line.y - this.checkpoint.beat * UNITS_PER_BEAT < CHECKPOINT_SPACING) return;
    if (!safe) return;
    this.checkpoint = { t: this.t, lane: p.lane, dim: p.dim, beat, row: k };
    this.audio.sfx('checkpoint');
    this.ui.toast('CHECKPOINT');
  }

  sectionAt(y) {
    let s = this.level.sections[0];
    for (const sec of this.level.sections) if (y >= sec.y) s = sec;
    return s;
  }

  deathReason(o, dim) {
    if (o.color === 'W') return 'WEISS tötet immer';
    if (o.color === 'S') {
      return o.timesOpened > 0 ? 'GOLD-SIEGEL hat sich wieder geschlossen' : 'GOLD-SIEGEL war zu – tippe, wenn es aufleuchtet';
    }
    const name = COLORS[o.color].name;
    return `${name} ist in der ${dim === 'B' ? 'blauen' : 'roten'} Dimension aktiv`;
  }

  die(o) {
    const p = this.player;
    const y = this.y;
    this.killer = { o, x: p.x, y, dim: p.dim, reason: this.deathReason(o, p.dim) };
    this.sealStreak = 0;
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
    this.rift.reset();
    this.sealStreak = 0;
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
    if (this.events.onWin) {
      const replay = this.recording ? { taps: this.recording.slice() } : null;
      this.events.onWin({ mode: this.mode, attempts: this.attemptsDisplay, replay, from: this.startFrom });
    }
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
    const upb = this.level.unitsPerBeat;
    const beatF = camY / upb;
    const pulse = this.state === 'menu' ? 0.3 : 1 - (beatF - Math.floor(beatF));

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    for (let i = 1; i < LANES; i++) {
      ctx.moveTo(i * LANE_W, 0);
      ctx.lineTo(i * LANE_W, H);
    }
    ctx.stroke();

    const firstBeat = Math.floor((camY - (H - psy)) / upb) - 1;
    const lastBeat = Math.ceil((camY + psy) / upb) + 1;
    for (let b = firstBeat; b <= lastBeat; b++) {
      const by = psy - (b * upb - camY);
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

    // Rift Pulse (Energiewelle) und Reichweiten-Hinweis – unter den Hindernissen
    this.renderPulses(ctx, camY, psy);

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
    for (const sec of this.level.sections) {
      if (sec.auto || sec.y === 0) continue;
      const by = psy - (sec.labelY - camY);
      if (by < -20 || by > H + 20) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(`${sec.id} · ${sec.name.toUpperCase()}`, WORLD_W / 2, by);
    }
    ctx.font = '800 14px system-ui, sans-serif';
    for (const [hy, text] of this.level.hints) {
      const by = psy - (hy - camY);
      if (by < -20 || by > H + 20) continue;
      ctx.globalAlpha = clamp((H - by) / 120, 0, 1) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, WORLD_W / 2, by);
    }
    ctx.globalAlpha = 1;

    const fy = psy - (this.level.finishY - camY);
    if (fy > -40 && fy < H + 40) drawFinish(ctx, WORLD_W, fy);

    if (this.mode === 'practice' && this.checkpoint && this.checkpoint.t > 0) {
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

  /** Zeichnet nur Objekte im sichtbaren Ausschnitt (Hindernisse sind nach y sortiert). */
  renderObstacles(ctx, camY, psy, H, dim) {
    const top = camY + psy + 40 + this.level.maxHh;
    const bottom = camY - (H - psy) - 40;
    const pop = this.switchPulse;
    const killerO = this.killer && (this.state === 'dying' || this.state === 'dead') ? this.killer.o : null;
    for (const o of this.obstacles) {
      if (o.y + o.hh < bottom) continue;
      if (o.y > top) break;
      const oy = psy - (o.y - camY);
      const x0 = o.x0;
      const w = o.x1 - o.x0;
      const hh = o.hh;
      if (o.color === 'S') this.renderSeal(ctx, o, oy, x0, w, hh);
      else drawBar(ctx, o.color, x0, oy, w, hh, isDeadly(o.color, dim), pop);
      if (o === killerO && Math.floor(this.deathAge * 12) % 2 === 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.strokeRect(x0 - 3, oy - hh - 3, w + 6, hh * 2 + 6);
        ctx.lineWidth = 1;
      }
    }
  }

  renderPulses(ctx, camY, psy) {
    const live = this.state === 'playing' || this.state === 'paused' || this.state === 'respawn';
    if (!live) return;
    const p = this.player;
    const y = this.y;

    // Reichweiten-Hinweis: dezenter Kreis, sobald ein geschlossenes Siegel naht; deutlicher, wenn ein Tipp es jetzt öffnet
    let near = 0;
    let reach = false;
    for (const s of this.seals) {
      if (s.y + s.chh + HIT_RADIUS < y) continue;
      if (s.y - this.level.maxHh > y + PULSE_RADIUS + UNITS_PER_BEAT) break;
      if (this.rift.isOpen(s, this.t)) continue;
      near = Math.max(near, clamp(1 - (s.y - s.hh + 7 - y - PULSE_RADIUS) / UNITS_PER_BEAT, 0, 1));
      if (this.rift.inReach(s, p.x, y)) reach = true;
    }
    if (near > 0) {
      ctx.strokeStyle = COLORS.S.main;
      ctx.globalAlpha = reach ? 0.45 : 0.18 * near;
      ctx.lineWidth = reach ? 2 : 1.5;
      ctx.setLineDash(REACH_DASH);
      ctx.beginPath();
      ctx.arc(p.x, psy, PULSE_RADIUS, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash(NO_DASH);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
    }

    for (const q of this.rift.pulses) {
      if (!q.live) continue;
      const age = this.t - q.t0;
      const r = pulseRadius(age);
      const fade = age <= PULSE_GROW_SEC ? 1 : 1 - (age - PULSE_GROW_SEC) / PULSE_FADE_SEC;
      if (fade <= 0 || r <= 0) continue;
      const qy = psy - (q.y - camY);
      ctx.globalAlpha = 0.07 * fade;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, qy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.85 * fade;
      ctx.strokeStyle = q.color;
      ctx.lineWidth = 1 + 3 * fade;
      ctx.stroke();
      ctx.globalAlpha = 0.6 * fade;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(q.x, qy, Math.max(0, r - 4), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Geschlossen: massives Gold mit Rautenmuster und heller Kontur. Offen: gestrichelter Rahmen + Countdown-Balken. */
  renderSeal(ctx, o, oy, x0, w, hh) {
    const t = this.t;
    const rift = this.rift;
    if (!rift.isOpen(o, t)) {
      const reach = this.state === 'playing' && rift.inReach(o, this.player.x, this.y);
      drawSealClosed(ctx, x0, oy, w, hh, reach, reach ? 0.5 + 0.5 * Math.sin(t * 28) : 0);
      return;
    }
    const rem = rift.remaining(o, t);
    const warn = rem < SEAL_WARN_SEC && Math.floor(rem * 40) % 2 === 0;
    drawSealOpen(ctx, x0, oy, w, hh, rem / o.openSec, warn, t - o.openedAt);
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
    drawShip(ctx, p.x, sy, p.dim, p.tilt, p.pop);
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
      if (o.y + o.hh < bottom) continue;
      if (o.y - this.level.maxHh > top) break;
      const oy = psy - (o.y - camY);
      const deadly = this.deadlyNow(o, dim);
      if (o.color === 'S') {
        ctx.strokeStyle = deadly ? '#ff8800' : 'rgba(160,160,160,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(o.x0, oy - o.chh, o.x1 - o.x0, o.chh * 2);
        ctx.lineWidth = 1;
        const rem = this.rift.remaining(o, this.t);
        ctx.font = '700 10px ui-monospace, monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = deadly ? '#ff8800' : '#cccccc';
        ctx.fillText(`${deadly ? 'ZU' : 'OFFEN ' + rem.toFixed(2) + ' s'}  d ${distToSeal(p.x, this.y, o).toFixed(0)}`, o.x0 + 2, oy - o.chh - 3);
        ctx.textBaseline = 'alphabetic';
      } else {
        ctx.strokeStyle = deadly ? '#ffea00' : 'rgba(160,160,160,0.6)';
        ctx.strokeRect(o.x0, oy - o.chh, o.x1 - o.x0, o.chh * 2);
      }
    }
    // Pulse-Reichweite (Referenz) und aktuelle Wellenradien
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.setLineDash(REACH_DASH);
    ctx.beginPath();
    ctx.arc(p.x, psy, PULSE_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash(NO_DASH);
    for (const q of this.rift.pulses) {
      if (!q.growing) continue;
      ctx.strokeStyle = '#ff00ff';
      ctx.beginPath();
      ctx.arc(q.x, psy - (q.y - camY), pulseRadius(this.t - q.t0), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#00ff66';
    ctx.beginPath();
    ctx.arc(p.x, psy, HIT_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p.x, psy);
    ctx.lineTo(p.x + p.vx * 0.1, psy - CLIMB_SPEED * 0.1);
    ctx.stroke();

    const solver = !this.validation.alive ? 'Lauf-Nachweis' : this.lastRowPassed < 0 ? 'Start' : this.rowSolvable ? 'lösbar' : 'Sackgasse';
    const next = this.seals.find((s) => s.y + s.chh + HIT_RADIUS >= this.y);
    let sealLine = 'Nächstes Siegel: –';
    if (next) {
      const open = this.rift.isOpen(next, this.t);
      sealLine = `Siegel B${next.beat}: ${open ? 'OFFEN ' + this.rift.remaining(next, this.t).toFixed(2) + ' s' : 'ZU'}  ` +
        `d ${distToSeal(p.x, this.y, next).toFixed(0)} u${!open && this.rift.inReach(next, p.x, this.y) ? '  IN REICHWEITE' : ''}`;
    }
    const lines = [
      `Pulse R ${PULSE_RADIUS} u  Öffnung ${next ? next.openSec : '–'} s  Wellen ${this.rift.activePulses}  gesendet ${this.rift.emitted}`,
      sealLine,
      `FPS ${this.stats.fps.toFixed(0)}  Sim ${Math.round(1 / SIM_DT)} Hz  Schritte/Frame ${this.stats.frameSteps}`,
      `t ${this.t.toFixed(3)} s  Beat ${this.beat.toFixed(2)}/${this.level.finishBeat.toFixed(0)}  Abschnitt ${this.sectionAt(this.y).id}  ${this.level.bpm} BPM`,
      `x ${p.x.toFixed(1)}  y ${this.y.toFixed(0)}  vx ${p.vx.toFixed(0)} u/s  Spur ${p.lane}  Dim ${dim}`,
      `vy ${CLIMB_SPEED} u/s  Vorschau ${this.lookaheadSec.toFixed(2)} s  Siegel-Serie ${this.sealStreak}`,
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
