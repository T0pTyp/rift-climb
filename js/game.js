import {
  BEAT_SEC, CLIMB_SPEED, UNITS_PER_BEAT, WORLD_W, CHECKPOINT_EVERY_BEATS,
  SIM_DT, HIT_RADIUS, DEATH_FREEZE_SEC, RESPAWN_SEC,
  CAMERA_PLAYER_Y, CAMERA_MIN_BOTTOM, SWITCH_SHAKE, DEATH_SHAKE, SHAKE_PX,
  PULSE_RADIUS, PULSE_GROW_SEC, PULSE_FADE_SEC, SEAL_WARN_SEC, SEAL_STREAK_SHAKE, PARTICLE_CAP,
} from './config.js';
import { validateLevel } from './level.js';
import { buildLevelRuntime, levelFromRows, createEmptyLevel } from './level-data.js';
import { RiftField, pulseRadius, distToSeal } from './rift.js';
import { Player } from './player.js';
import { ParticlePool, PARTICLE_KIND } from './particles.js';
import { COLORS, isDeadly } from './dimensions.js';
import { sweptCircleRect, clamp } from './physics.js';
import { DASH, NO_DASH, drawBar, drawSealClosed, drawSealOpen, drawFinish } from './shapes.js';
import { RiftlingAnimator } from './art/riftling-anim.js';
import { drawRiftling, riftlingArt } from './art/riftling.js';
import { drawTrail, drawParticles } from './art/effects.js';
import { Backdrop } from './art/backdrop.js';

import { BeatEffects } from './pulse/effects.js';
import { TrapField,makeTrap,trapReach } from './traps.js';
import { drawTrap } from './art/traps.js';
import {EndlessWorld,worldMeters,INFINITY_TIERS,infinityClimbY,infinityClimbSpeed} from './endless.js';
import {DIRECTOR_TIERS,zoneAt,directorSignature,GENERATOR_VERSION} from './rift-director.js';
import {phaseFlowState} from './phase-flow.js';
import {qualifyingRuns} from './momentum.js';
import {currentInputEventTime} from './input-time.js';

const K = PARTICLE_KIND;

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
    this.arena=this.level.arena;
    this.rows = this.level.rows;
    this.lines = this.level.lines;
    this.obstacles = this.level.obstacles;
    this.seals = this.level.seals;
    this.collideRange = this.level.maxChh + HIT_RADIUS + 2;
    this.rift = new RiftField(this.seals);
    this.traps = new TrapField(this.level.traps.map(o=>makeTrap(o)));
    this.trapActor={x:0,y:0,dim:'B'};
    this.beatEffects = new BeatEffects(this.level);
    this.onSealOpen = this.onSealOpen.bind(this);
    this.onTrapEvent = this.onTrapEvent.bind(this);
    // Spur-Solver nur für Level im Spurmodell; freie Level werden über einen aufgezeichneten Lauf nachgewiesen.
    this.validation = this.rows
      ? validateLevel(this.rows, this.level.start)
      : { ok: null, errors: [], alive: null, solution: null, reachable: [] };
    if (this.audio.setLevel) this.audio.setLevel(this.level);
    this.startFrom = null;
    this.recording = null;
    this.player = new Player(this.arena.id);
    this.particles = new ParticlePool(PARTICLE_CAP);
    this.anim = new RiftlingAnimator();
    this.backdrop = new Backdrop();
    this.art = riftlingArt;
    riftlingArt.load();
    this.realT = 0;
    this.state = 'menu';
    this.mode = 'normal';
    this.t = 0;
    this.timelineRevision = 0;
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
    this.deathShown = false;
    this.checkpoint = null;
    this.lastRowPassed = -1; // Index in this.lines (= Reihe im Spurmodell)
    this.obsLo = 0;
    this.emitDist = 0;
    this.view = { cssW: 1, cssH: 1, dpr: 1, scale: 1, offsetX: 0, viewH: 600, playerSY: 468 };
    this.menuT = 0;
    this.clearAge = 0;
    this.autoplayQueue = [];
    this.trace = [];
    this.deathLog = []; // Explicit debug mode only; bounded, local, never persisted/uploaded.
    this.stats = { fps: 60, steps: 0, frameSteps: 0, impulses: 0 };
    this.lastSwitch = null;
    this.recentInputs=[];
    this.infinityRecordAnnounced=false;
  }

  get y() {
    return this.endless?.director ? infinityClimbY(this.t) : this.t * CLIMB_SPEED;
  }

  // Extension points for isolated developer simulations; defaults preserve Auto-Climb.
  advanceWorld(h) { this.t += h; }
  get cameraY() { return this.y; }

  /** Reuse the running app, input handlers and AudioContext for a menu selection. */
  setLevelData(data, storage) {
    this.endless=null;
    this.audio.stop?.();
    this.levelData=data;this.level=buildLevelRuntime(data);this.storage=storage;
    this.arena=this.level.arena;this.player.arena=this.arena;
    this.rows=this.level.rows;this.lines=this.level.lines;
    this.obstacles=this.level.obstacles;this.seals=this.level.seals;
    this.collideRange=this.level.maxChh+HIT_RADIUS+2;
    this.rift=new RiftField(this.seals);this.beatEffects=new BeatEffects(this.level);
    this.traps=new TrapField(this.level.traps.map(o=>makeTrap(o)));
    this.validation=this.rows?validateLevel(this.rows,this.level.start):{ok:null,errors:[],alive:null,solution:null,reachable:[]};
    this.audio.setLevel?.(this.level);
    this.t=0;this.acc=0;this.sessionAttempts=0;this.obsLo=0;this.lastRowPassed=-1;
    this.startFrom=null;this.killer=null;this.checkpoint=null;this.autoplayQueue=[];this.recording=null;
    this.particles.clear();this.player.reset(this.level.start.lane,this.level.start.dim,0);
    this.dimBlend=this.level.start.dim==='R'?1:0;this.anim.reset(this.dimBlend);
    this.flash=this.shake=this.switchPulse=this.clearAge=0;
    this.timelineRevision++;
    const v=this.view;this.resize(v.cssW,v.cssH,v.dpr);
    this.toMenu();
  }

  /** Musikalischer Beat (Level-BPM). */
  get beat() {
    return this.t / this.level.beatSec;
  }

  get progress() {
    if(this.endless)return 0;
    return Math.floor(clamp(this.y / this.level.finishY, 0, 1) * 100);
  }

  get attemptsDisplay() {
    if(this.mode==='endless'||this.mode==='lab')return this.storage.stats.attempts;
    if(this.storage.progression?.isolated)return this.sessionAttempts;
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
      offsetX: (cssW - this.arena.width * scale) / 2,
      viewH,
      playerSY: Math.min(viewH * CAMERA_PLAYER_Y, viewH - CAMERA_MIN_BOTTOM),
    };
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.backdrop.configure(cssW, cssH, dpr, this.level.theme);
  }

  /** Energie sammelt sich zur Figur (Respawn/Neustart): Partikel fliegen von einem Ring zur Mitte. */
  converge(n, radius, life, climbing) {
    const p = this.player;
    const col = COLORS[p.dim].main;
    const vy0 = climbing ? CLIMB_SPEED : 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const r = radius * (0.8 + Math.random() * 0.4);
      const l = life * (0.75 + Math.random() * 0.25);
      this.particles.spawn(p.x + Math.cos(a) * r, this.y + Math.sin(a) * r, -Math.cos(a) * r / l, -Math.sin(a) * r / l + vy0, l, 2 + Math.random() * 1.5, i % 3 ? col : '#ffffff', 1, climbing ? K.GLOW : K.SPARK);
    }
  }

  /** from: { y, lane, dim } = ab dieser Höhe starten (PLAY FROM HERE im Editor), sonst Levelstart. */
  start(mode, from = null) {
    this.saveProgress(true);
    this.storage.finish?.(this.run,this.t,this.progress,'quit');
    // Flush the old mode before restart can observe the new one (also for replay adapters).
    this.state='menu';
    this.mode = mode;
    this.startFrom = from;
    this.sessionAttempts = 0;
    this.restart();
  }

  startEndless(book,seed,storage,order=null,momentum) {
    const data=createEmptyLevel({id:'rift-infinity',name:'RIFT INFINITY',arenaStyle:book.arenaStyle});
    this.setLevelData(data,storage);this.endless=new EndlessWorld(book,seed,order,momentum);
    this.level.endless=true;this.level.finishY=Infinity;this.level.music='rift-infinity';this.level.theme='infinity';
    this.audio.setLevel?.(this.level);this.beatEffects=new BeatEffects(this.level);
    const v=this.view;this.backdrop.configure(v.cssW,v.cssH,v.dpr,'infinity');
    this.start('endless');
  }

  restart() {
    if (['playing','paused','dying','dead'].includes(this.state)) this.saveProgress();
    this.storage.finish?.(this.run,this.t,this.progress,'retry');
    this.timelineRevision++;
    this.runStartBest=this.storage.stats.best;
    if (this.storage.beginRun) {
      this.run=this.storage.beginRun((this.mode==='normal'||this.mode==='endless'||this.mode==='lab')&&!this.startFrom,this.mode);
      if(this.run&&this.endless?.director)this.run.ramp=true;
      if(this.mode==='practice'||this.storage.progression.isolated)this.sessionAttempts++;
    } else if (this.mode === 'normal') {
      this.storage.stats.attempts++;
      this.storage.save();
    } else {
      this.sessionAttempts++;
    }
    const from = this.startFrom;
    const st = from || this.level.start;
    this.t = from ? from.y / CLIMB_SPEED : 0;
    this.lastAutoT=-Infinity;
    if(this.endless){this.endless.reset(this.run?.momentum||this.endless.initialMomentum);this.endless.apply(this);}
    this.acc = 0;
    this.player.reset(st.lane, st.dim, this.y);
    // Declared chunk entry fixtures use the same continuous body, only at run start.
    if(from&&Number.isFinite(from.x)&&Number.isFinite(from.vx)){this.player.body.x=from.x;this.player.body.v=from.vx;this.player.lastDir=from.lastDir||0;}
    this.dimBlend = st.dim === 'R' ? 1 : 0;
    this.particles.clear();
    this.anim.reset(this.dimBlend, { rebuild: true, duration: 0.28 });
    this.converge(12, 30, 0.26, true);
    this.flash = 0;
    this.shake = 0;
    this.switchPulse = 0;
    this.rift.reset();
    this.traps.reset();
    this.clearAge = 0;
    this.sealStreak = 0;
    this.killer = null;
    this.lastRowPassed = this.linesBelow(this.y);
    this.rowSolvable = true;
    this.obsLo = 0;
    this.trace.length = 0;
    this.lastSwitch = null;
    this.recentInputs.length=0;
    this.endlessRecording=null;
    this.infinityRecordAnnounced=false;
    this.stats.steps = this.stats.frameSteps = this.stats.impulses = 0;
    this.checkpoint = this.captureCheckpoint(this.y / UNITS_PER_BEAT, this.lastRowPassed);
    // Aufzeichnung (Nachweis der Durchspielbarkeit) nur für vollständige Läufe im Normalmodus
    this.recording = this.mode === 'normal' && !from ? [] : null;
    this.state = 'playing';
    this.audio.seek(this.t);
    this.audio.setDimension?.(this.player.dim, true);
    this.beatEffects.seek(this.t);
    this.ui.setArena?.(this.arena.id,this.mode);
    this.ui.show(null);
    this.input.guard();
    this.setupAutoplay();
    this.audio.update(this.t);
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
    if(this.endless){this.autoplayQueue=this.endless.tapsAfter(this.t,this.lastAutoT);return;}
    if (this.level.replay && !this.startFrom) {
      this.autoplayQueue = this.level.replay.taps.filter(tap => tap.t >= this.t - SIM_DT / 2).map(tap => ({ ...tap }));
      return;
    }
    if (!this.validation.solution) return;
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

  pause(interrupted=false) {
    if (this.state !== 'playing' && this.state !== 'respawn') return;
    this.saveProgress(true);
    this.pausedFrom = this.state;
    this.state = 'paused';
    this.input.guard(0,!interrupted); // Physical gesture epoch, or actual interruption time.
    this.audio.suspend();
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = this.pausedFrom || 'playing';
    this.timelineRevision++;
    this.audio.resume();
    this.audio.seek(this.t);
    this.ui.show(null);
    this.input.guard();
    if (this.state === 'playing') this.audio.update(this.t);
  }

  toMenu() {
    this.saveProgress();
    this.storage.finish?.(this.run,this.t,this.progress,'quit');
    this.state = 'menu';
    this.input.guard(0);
    this.audio.stop?.();
    this.ui.updateMenu(this.storage.stats, this.storage.muted);
    this.ui.show('menu');
  }

  /** Spielfeld-Eingabe (Tipp oder Taste). Bedeutung hängt vom Zustand ab. */
  recordEndlessInputs() {
    if(!this.endless?.director||this.t!==0||this.state!=='playing'||!(this.debug.hitboxes||this.debug.trace))return false;
    if(this.player.x!==135||this.player.vx!==0||this.player.lane!==1||this.player.dim!=='B'||this.stats.impulses!==0)return false;
    this.endlessRecording={schema:'rift-infinity-replay',version:2,generator:GENERATOR_VERSION,momentum:this.endless.momentum,start:{x:this.player.x,y:this.y,vx:this.player.vx,target:this.player.lane,dimension:this.player.dim,lastDir:this.player.lastDir},seed:this.endless.seed,revision:this.endless.book.revision,signature:directorSignature(this.endless.book),simulation:'spring-240-v1',arenaWidth:270,arenaStep:90,taps:[],truncated:false};return true;
  }
  exportEndlessReplay(){return this.endlessRecording?structuredClone({...this.endlessRecording,duration:this.t,outcome:this.state}):null;}

  press(dir) {
    if (this.state === 'playing') {
      if(this.endlessRecording){if(this.endlessRecording.taps.length<16000)this.endlessRecording.taps.push({t:this.t,dir,inputMs:currentInputEventTime()});else this.endlessRecording.truncated=true;}
      if(this.debug.hitboxes||this.debug.trace){this.recentInputs.push({t:this.t,dir});if(this.recentInputs.length>64)this.recentInputs.shift();}
      if (this.recording) this.recording.push({ t: Math.round(this.t * 1e4) / 1e4, dir });
      this.impulse(dir);
      return true;
    }
    if (this.state === 'dying' || this.state === 'dead') {
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
    const from = p.dim;
    const atWall = p.impulse(dir);
    this.stats.impulses++;
    this.flash = 1;
    this.switchPulse = 1;
    this.shake = Math.max(this.shake, SWITCH_SHAKE);
    const col = COLORS[p.dim].main;
    this.rift.emit(p.x, this.y, this.t, col,p.dim);
    this.lastSwitch={t:this.t,from,to:p.dim,pulseId:this.rift.nextId-1};
    this.audio.setDimension?.(p.dim);
    this.audio.sfx('flight', p.dim, atWall);
    this.audio.sfx('switch', p.dim, atWall);
    this.audio.sfx('pulse', p.dim);
    this.anim.onSwitch(dir);
    this.anim.onPulse();
    const y = this.y;
    // Rückstoß nach unten-hinten (Funken) und Energie-Impuls als kleiner Ring in der neuen Dimensionsfarbe
    for (let i = 0, n = 10; i < n; i++) {
      const a = Math.PI * (1.15 + Math.random() * 0.7);
      const s = 70 + Math.random() * 130;
      this.particles.spawn(p.x, y - 6, Math.cos(a) * s - dir * 70, Math.sin(a) * s, 0.32 + Math.random() * 0.12, 2 + Math.random() * 1.5, col, 0.9, i % 2 ? K.SPARK : K.SQUARE);
    }
    for (let i = 0, n = 10; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.particles.spawn(p.x + Math.cos(a) * 10, y + Math.sin(a) * 10, Math.cos(a) * 150, Math.sin(a) * 150 + CLIMB_SPEED, 0.2, 1.8, i % 2 ? col : '#ffffff', 0.86, K.GLOW);
    }
    if (atWall) {
      const wx = dir > 0 ? this.arena.width - 2 : 2;
      for (let i = 0, n = 8; i < n; i++) {
        this.particles.spawn(wx, y + (Math.random() - 0.5) * 24, -dir * (60 + Math.random() * 120), (Math.random() - 0.5) * 120, 0.28, 2, '#ffffff', 0.88, K.SPARK);
      }
    }
  }

  update(dt) {
    if(this.endless&&this.state==='playing'&&this.endless.ensure(this.y)){this.endless.apply(this);this.setupAutoplay();}
    this.menuT += dt;
    this.realT += dt;
    const p = this.player;
    this.anim.update(dt, {
      vx: p.vx, tilt: p.tilt, targetBlend: p.dim === 'R' ? 1 : 0,
      alive: this.state !== 'dying' && this.state !== 'dead',
    });
    this.flash = Math.max(0, this.flash - dt * 6);
    this.shake = Math.max(0, this.shake - dt * 5);
    this.switchPulse = Math.max(0, this.switchPulse - dt * 4);
    const targetBlend = this.player.dim === 'R' ? 1 : 0;
    this.dimBlend += (targetBlend - this.dimBlend) * Math.min(1, dt * 16);
    this.particles.update(dt);
    if (this.state === 'won') this.clearAge += dt;

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

    if (this.state === 'playing') {
      this.beatEffects.update(this.t, () => {
        const col = COLORS[this.player.dim].main;
        for (const x of [5, this.arena.width - 5]) this.particles.spawn(x, this.y + 100, 0, 20, .18, 1.6, col, .3, K.SPARK);
      });
      this.audio.update(this.t);
      this.saveProgress();
    }
    if (this.state !== 'menu') {
      if(this.endless){
        const tier=this.endless.tierAt(this.y),director=this.endless.director;
        this.ui.updateEndlessHud?.(worldMeters(this.y),this.storage.stats.best,(director?DIRECTOR_TIERS:INFINITY_TIERS)[tier],this.player.dim,this.attemptsDisplay,director?zoneAt(this.t):'');
        if(this.state==='playing'&&!this.infinityRecordAnnounced&&worldMeters(this.y)>this.runStartBest){this.infinityRecordAnnounced=true;this.ui.toast('NEUER HÖHENREKORD');this.audio.sfx('checkpoint',this.player.dim);}
      }
      else this.ui.updateHud(this.progress, this.player.dim, this.attemptsDisplay, this.mode);
    }
  }

  step(h) {
    // Same before-step convention as runReplay and ordinary input -> simulation.
    while (this.autoplayQueue.length && this.autoplayQueue[0].t <= this.t + h / 2) {
      const tap=this.autoplayQueue.shift();this.lastAutoT=tap.t;this.press(tap.dir);
    }
    const previousX=this.player.x,previousY=this.y;
    this.advanceWorld(h);
    this.stats.steps++;
    const p = this.player;
    const y = this.y;
    p.update(h, y);

    // Schweif-Partikel proportional zur zurückgelegten Seitenstrecke (bildratenunabhängig)
    this.emitDist += Math.abs(p.vx) * h;
    if (this.emitDist > 9) {
      this.emitDist = 0;
      this.particles.spawn(p.x + (Math.random() - 0.5) * 6, y - 10, -p.vx * 0.15, -60, 0.3, 2.6, COLORS[p.dim].main, 0.9, K.GLOW);
    }

    this.rift.step(this.t, this.onSealOpen, (seal) => {
      if (Math.abs(seal.y - this.y) < 400) this.audio.sfx('seal-close');
    });
    const actor=this.trapActor;actor.x=p.x;actor.y=y;actor.dim=p.dim;
    const hit=this.traps.step(this.t,h,actor,previousX,previousY,this.rift.pulses,this.onTrapEvent);
    if(hit){this.die(hit);return;}

    const obs = this.obstacles;
    const range = this.collideRange;
    while (this.obsLo < obs.length && obs[this.obsLo].y < y - range) this.obsLo++;
    for (let i = this.obsLo; i < obs.length; i++) {
      const o = obs[i];
      if (o.y > y + range) break;
      if (!this.deadlyNow(o, p.dim)) continue;
      if (sweptCircleRect(previousX, previousY, p.x, y, HIT_RADIUS, o.x0, o.y - o.chh, o.x1, o.y + o.chh)) {
        this.die(o);
        return;
      }
    }

    const lines = this.lines;
    while (!this.endless&&this.lastRowPassed + 1 < lines.length && lines[this.lastRowPassed + 1].y + lines[this.lastRowPassed + 1].chh + HIT_RADIUS < y) {
      this.lastRowPassed++;
      this.onRowPassed(this.lastRowPassed);
    }

    if (this.debug.trace && this.stats.steps % 60 === 0) {
      this.trace.push(`${this.t.toFixed(4)}:${p.x.toFixed(6)}:${p.lane}${p.dim}`);
      if(this.endless&&this.trace.length>1024)this.trace.shift();
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
      // Präzise Aktion: durch ein geöffnetes Siegel – kurzer goldener Lichtimpuls an der Figur
      this.anim.onPrecise();
      for (let i = 0, n = 10; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = 60 + Math.random() * 90;
        this.particles.spawn(p.x, this.y, Math.cos(a) * s, Math.sin(a) * s + CLIMB_SPEED * 0.8, 0.3, 1.8, i % 2 ? COLORS.S.main : '#ffffff', 0.9, K.GLOW);
      }
    }
    // Legacy solver requires a settled lane. Free-form replays preserve x/v exactly,
    // so a checkpoint during a finishing turn is safe and doesn't erase momentum.
    const alive = this.validation.alive ? this.validation.alive[k] : null;
    const safe = !this.validation.alive || (!p.dashing && !!alive && alive.has(p.lane + p.dim));
    this.rowSolvable = safe;
    if (this.mode !== 'practice') return;
    const beat = line.y / UNITS_PER_BEAT;
    if (line.y - this.checkpoint.beat * UNITS_PER_BEAT < CHECKPOINT_SPACING) return;
    if (!safe) return;
    this.checkpoint = this.captureCheckpoint(beat, k);
    this.audio.sfx('checkpoint');
    this.ui.toast('CHECKPOINT');
  }

  captureCheckpoint(beat, row) {
    const p = this.player;
    return { t:this.t, lane:p.lane, dim:p.dim, beat, row,
      x:p.x, vx:p.vx, lastDir:p.lastDir, rift:this.rift.snapshot(),traps:this.traps.snapshot() };
  }

  sectionAt(y) {
    let s = this.level.sections[0];
    for (const sec of this.level.sections) if (y >= sec.y) s = sec;
    return s;
  }

  onTrapEvent(o,event) {
    this.audio.sfx(event,o.color);
    if(event==='mine-warn')return;
    const q=o.pose,col=COLORS[o.color].main;
    for(let i=0;i<18;i++){
      const a=i/18*Math.PI*2,implode=event==='mine-disarm',radius=implode?o.w:0,speed=implode?-75:event==='laser-disable'?90:140;
      this.particles.spawn(q.x+Math.cos(a)*radius,q.y+Math.sin(a)*radius,Math.cos(a)*speed,Math.sin(a)*speed,.32,2.5,event==='saw-break'&&i%3===0?'#c7d9eb':i%3?col:'#fff',.9,i%2?K.SPARK:K.SHARD);
    }
  }

  deathReason(o, dim) {
    if(o.type)return {saw:'PHASE SAW war aktiv – gleiche Farbe',mine:'PULSE MINE: Explosionszone war aktiv',laser:'SWEEP LASER war aktiv – Warnlinie beachten'}[o.type]||'Rift verloren';
    if (o.color === 'W') return 'WEISS tötet immer';
    if (o.color === 'S') {
      return o.timesOpened > 0 ? 'GOLD-SIEGEL hat sich wieder geschlossen' : 'GOLD-SIEGEL war zu – tippe, wenn es aufleuchtet';
    }
    const name = COLORS[o.color].name;
    return `${name} ist in der ${dim === 'B' ? 'blauen' : 'roten'} Dimension aktiv`;
  }

  die(o) {
    if(this.state!=='playing')return;
    this.input.guard(0,false);
    this.saveProgress();
    this.deathNewBest=(this.endless?worldMeters(this.y):this.progress)>this.runStartBest;
    this.storage.finish?.(this.run,this.t,this.progress,'death');
    const p = this.player;
    const y = this.y;
    this.killer = { o, x: p.x, y, dim: p.dim, reason: this.deathReason(o, p.dim) };
    if (this.debug.hitboxes || this.debug.trace) {
      const chunk=this.endless?.chunks.find(c=>y>=c.origin&&y<c.end);
      this.deathLog.push({type:o.type|| (o.color==='S'?'seal':'obstacle'),id:o.id,x:p.x,y,vx:p.vx,dimension:p.dim,t:this.t,level:this.level.id,chunk:chunk?.id,chunkIndex:chunk?.index,seed:this.endless?.seed,reason:this.killer.reason,inputs:(this.recentInputs||[]).filter(i=>this.t-i.t<=6)});
      if(this.deathLog.length>32)this.deathLog.shift();
    }
    this.sealStreak = 0;
    const colors = [COLORS[o.color].main, '#ffffff', COLORS[p.dim].main];
    // Trefferimpuls (Funken) und Energiefragmente des Körpers (Splitter in der Dimensionsfarbe)
    for (let i = 0, n = 18; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 120 + Math.random() * 280;
      this.particles.spawn(p.x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.2, 2 + Math.random() * 1.5, colors[i % 3], 0.88, K.SPARK);
    }
    for (let i = 0, n = 16; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 50 + Math.random() * 150;
      this.particles.spawn(p.x + Math.cos(a) * 6, y + Math.sin(a) * 8, Math.cos(a) * s, Math.sin(a) * s + 40, 0.55 + Math.random() * 0.3, 2.8 + Math.random() * 2.6, i % 4 ? COLORS[p.dim].main : COLORS[p.dim].light, 0.93, K.SHARD, 260);
    }
    this.anim.onDeath();
    this.shake = DEATH_SHAKE;
    this.flash = 0;
    this.audio.stop?.();
    this.audio.sfx('collision');
    this.audio.sfx('death');
    this.autoplayQueue = [];
    if (this.mode === 'practice') this.sessionAttempts++;
    this.state = 'dying';
    this.deathAge = 0;
    this.deathTimer = this.mode === 'practice' ? DEATH_FREEZE_SEC * 0.8 : DEATH_FREEZE_SEC;
    // Retry is available at once; the existing impact animation continues behind it.
    if(this.mode==='normal'||this.mode==='endless'||this.mode==='lab'){this.deathShown=true;this.showDeathResult();}
  }

  finishDeath() {
    if (this.mode === 'practice') {
      this.respawn();
      return;
    }
    this.state = 'dead';
    if(!this.deathShown)this.showDeathResult();
  }

  showDeathResult() {
    const pct=this.endless?worldMeters(this.y):this.progress,stats=this.storage.stats,isNewBest=this.deathNewBest;
    this.ui.showDeath({ pct, best: stats.best, isNewBest, reason: this.killer ? this.killer.reason : '', attempts:this.attemptsDisplay, medal:stats.medal, rewards:this.run?.rewards || [],mode:this.mode,endless:!!this.endless });
  }

  saveProgress(force=false) {
    if(this.storage.report)return this.mode==='normal'||this.mode==='endless'||this.mode==='lab'?this.storage.report(this.run,this.t,this.progress,force):false;
    if (this.mode !== 'normal' || this.progress <= (this.storage.stats.best || 0)) return false;
    this.storage.stats.best = this.progress;
    this.storage.save();
    return true;
  }

  respawn() {
    this.lastSwitch=null;
    const cp = this.checkpoint;
    const dy = (this.endless?.director ? infinityClimbY(cp.t) : cp.t * CLIMB_SPEED) - this.y;
    this.particles.offset(dy);
    this.t = cp.t;
    this.acc = 0;
    this.lastRowPassed = cp.row;
    this.obsLo = 0;
    this.killer = null;
    this.rift.restore(cp.rift);
    this.traps.restore(cp.traps);
    this.sealStreak = 0;
    this.player.reset(cp.lane, cp.dim, this.y);
    this.player.body.x = cp.x ?? this.player.x;
    this.player.body.v = cp.vx || 0;
    this.player.lastDir = cp.lastDir || 0;
    this.dimBlend = cp.dim === 'R' ? 1 : 0;
    this.anim.reset(cp.dim === 'R' ? 1 : 0, { rebuild: true, duration: RESPAWN_SEC * 0.6 });
    this.converge(16, 40, RESPAWN_SEC * 0.5, false);
    this.state = 'respawn';
    this.respawnTimer = RESPAWN_SEC;
    this.audio.seek(this.t);
    this.audio.setDimension?.(cp.dim, true);
    this.beatEffects.seek(this.t);
    this.audio.sfx('respawn');
    this.input.guard(0);
  }

  win() {
    if(this.endless||this.state!=='playing')return;
    this.state = 'won';
    this.input.guard(0,false);
    this.clearAge = 0;
    this.anim.onPrecise();
    for (let i=0;i<72;i++) {
      const a=i/72*Math.PI*2, speed=70+(i%4)*40;
      this.particles.spawn(this.player.x,this.y,Math.cos(a)*speed,Math.sin(a)*speed,1.1+(i%3)*.15,2+(i%3),i%3===0?'#ffc23d':i%2?'#2fd6ff':'#ff2d8a',1,K.SPARK);
    }
    this.autoplayQueue = [];
    if (this.storage.finish) {
      this.storage.finish(this.run,this.t,100,'win');
    } else if (this.mode === 'normal') {
      this.storage.stats.best = 100;
      this.storage.stats.clears = (this.storage.stats.clears || 0) + 1;
      this.storage.save();
    }
    this.audio.stop?.();
    this.audio.sfx('win');
    this.ui.showWin({ mode: this.mode, attempts: this.attemptsDisplay, isNewBest:this.runStartBest<100, medal:this.storage.stats.medal, rewards:this.run?.rewards || [],levelName:this.level.name });
    if (this.events.onWin) {
      const replay = this.recording ? { taps: this.recording.slice() } : null;
      this.events.onWin({ mode: this.mode, attempts: this.attemptsDisplay, replay, from: this.startFrom });
    }
  }

  /** Tastatur-Bestätigung (Enter/Leertaste/R) auf Overlays. */
  confirm() {
    if (this.state === 'dying' || this.state === 'dead') {
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
    const camY = this.state === 'menu' ? this.menuT * CLIMB_SPEED * 0.35 : this.cameraY;
    const blend = this.dimBlend;
    const H = v.viewH;
    const psy = v.playerSY;
    const dim = this.player.dim;
    const inGame = this.state !== 'menu';

    // Opaque, cached background gradients and architecture; no full-screen gradients per frame.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    {
      ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
      this.backdrop.render(ctx, camY * v.scale, blend, this.endless?this.t:inGame ? clamp(this.y / this.level.finishY, 0, 1) : 0, this.realT);
      if(this.arena.width<WORLD_W){
        // Retain Classic pixel scale/lookahead; dark outer architecture is not playable.
        const edge=v.offsetX,right=edge+this.arena.width*v.scale;
        ctx.fillStyle='rgba(2,5,14,.57)';ctx.fillRect(0,0,edge,v.cssH);ctx.fillRect(right,0,v.cssW-right,v.cssH);
        ctx.strokeStyle='rgba(111,132,187,.19)';ctx.lineWidth=1;
        for(const x of [edge-14,right+14]){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,v.cssH);ctx.stroke();}
      }
    }

    const amp = this.shake * this.shake * SHAKE_PX;
    const sx = amp ? (Math.random() - 0.5) * amp : 0;
    const sy = amp ? (Math.random() - 0.5) * amp : 0;
    const k = v.dpr * v.scale;
    ctx.setTransform(k, 0, 0, k, v.dpr * v.offsetX + sx * k, sy * k);
    if(this.arena.width<WORLD_W){ctx.save();ctx.beginPath();ctx.rect(0,0,this.arena.width,H);ctx.clip();}

    // --- Effekt-Ebene (liegt UNTER den Hindernissen)
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * 0.08;
      ctx.fillStyle = COLORS[dim].main;
      ctx.fillRect(0, 0, this.arena.width, H);
      ctx.globalAlpha = 1;
    }

    const accent = blend < 0.5 ? COLORS.B : COLORS.R;
    const upb = this.level.unitsPerBeat;
    const pulse = this.state === 'menu' ? .3 : this.beatEffects.pulse(this.t);
    const strongPulse = this.beatEffects.accent(this.t);
    if (inGame && strongPulse > .01) {
      ctx.globalAlpha = strongPulse * .025;
      ctx.fillStyle = accent.main;
      ctx.fillRect(0, 0, this.arena.width, H);
      ctx.globalAlpha = 1;
    }

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath();
    for (let i = 1; i < this.arena.lanes; i++) {
      ctx.moveTo(this.arena.inset+(i-.5)*this.arena.step, 0);
      ctx.lineTo(this.arena.inset+(i-.5)*this.arena.step, H);
    }
    ctx.stroke();

    const firstBeat = Math.floor((camY - (H - psy)) / upb) - 1;
    const lastBeat = Math.ceil((camY + psy) / upb) + 1;
    for (let b = firstBeat; b <= lastBeat; b++) {
      const by = psy - (b * upb - camY);
      const strong = b % this.level.beatsPerBar === 0;
      ctx.strokeStyle = strong ? accent.glow : 'rgba(255,255,255,0.04)';
      ctx.globalAlpha = strong ? 0.3 + 0.5 * pulse : 1;
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.lineTo(this.arena.width, by);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = accent.main;
    ctx.globalAlpha = 0.25 + 0.35 * pulse;
    ctx.fillRect(0, 0, 2, H);
    ctx.fillRect(this.arena.width - 2, 0, 2, H);
    const bump = this.player.wallBump;
    if (inGame && bump) {
      ctx.globalAlpha = Math.abs(bump) * 0.9;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bump > 0 ? this.arena.width - 4 : 0, psy - 40, 4, 80);
    }
    ctx.globalAlpha = 1;

    if (!inGame) {if(this.arena.width<WORLD_W)ctx.restore();return;}

    // Rift Pulse (Energiewelle) und Reichweiten-Hinweis – unter den Hindernissen
    this.renderPulses(ctx, camY, psy);

    this.renderMarkers(ctx, camY, psy, H);

    // Partikel (unter den Hindernissen, damit Effekte nie verdecken)
    drawParticles(ctx, this.particles, camY, psy, H);

    this.renderObstacles(ctx, camY, psy, H, dim);
    for(const o of this.traps.traps)if(Math.abs(o.y-camY)<H+trapReach(o))drawTrap(ctx,o,this.t,psy-(o.y-camY),dim);
    this.renderPlayer(ctx, psy - (this.y - camY));
    if (this.state === 'won') this.renderClear(ctx, psy - (this.y - camY));
    this.renderDeath(ctx, camY, psy);
    if (this.debug.hitboxes) this.renderDebug(ctx, camY, psy, H);
    if(this.arena.width<WORLD_W)ctx.restore();
  }

  renderClear(ctx, sy) {
    const age=this.clearAge;
    ctx.save();ctx.translate(this.player.x,sy);
    for(let ring=0;ring<3;ring++) {
      const t=age-ring*.16;if(t<0)continue;
      const r=22+Math.min(t,1.5)*110;
      ctx.globalAlpha=Math.max(0,1-t/1.7)*.65;
      ctx.strokeStyle=ring===1?'#ffc23d':ring===0?'#2fd6ff':'#ff2d8a';ctx.lineWidth=2;
      ctx.beginPath();for(let j=0;j<=8;j++){const a=j*Math.PI/4+age*.3;j?ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r):ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.stroke();
    }
    ctx.restore();
  }

  renderMarkers(ctx, camY, psy, H) {
    if(this.endless){ctx.font='700 11px system-ui';ctx.textAlign='center';ctx.fillStyle='#b6d4e1';for(const [y,text]of this.level.hints){const sy=psy-(y-camY);if(sy>-20&&sy<H)ctx.fillText(text,this.arena.width/2,sy);}return;}
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Abschnitts-Marken und Hinweise im Abschnitt A
    ctx.font = '800 11px system-ui, sans-serif';
    for (const sec of this.level.sections) {
      if (sec.auto || sec.y === 0) continue;
      const by = psy - (sec.labelY - camY);
      if (by < -20 || by > H + 20) continue;
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillText(`${sec.id} · ${sec.name.toUpperCase()}`, this.arena.width / 2, by);
    }
    ctx.font = '800 14px system-ui, sans-serif';
    for (const [hy, text] of this.level.hints) {
      const by = psy - (hy - camY);
      if (by < -20 || by > H + 20) continue;
      ctx.globalAlpha = clamp((H - by) / 120, 0, 1) * 0.85;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, this.arena.width / 2, by);
    }
    ctx.globalAlpha = 1;

    const fy = psy - (this.level.finishY - camY);
    if (fy > -40 && fy < H + 40) drawFinish(ctx, this.arena.width, fy);

    if (this.mode === 'practice' && this.checkpoint && this.checkpoint.t > 0) {
      const cy = psy - (this.checkpoint.t * CLIMB_SPEED - camY);
      if (cy > -10 && cy < H + 10) {
        ctx.strokeStyle = 'rgba(26,255,178,0.6)';
        ctx.setLineDash(DASH);
        ctx.beginPath();
        ctx.moveTo(0, cy);
        ctx.lineTo(this.arena.width, cy);
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
    // Binary-search the first possibly visible row, including tall obstacles.
    let lo=0, hi=this.obstacles.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(this.obstacles[mid].y<bottom-this.level.maxHh)lo=mid+1;else hi=mid;}
    for (let i=lo;i<this.obstacles.length;i++) {
      const o=this.obstacles[i];
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
      drawSealClosed(ctx, x0, oy, w, hh, reach, reach ? 0.5 + 0.5 * Math.sin(t * 28) : 0, t);
      return;
    }
    const rem = rift.remaining(o, t);
    const warn = rem < SEAL_WARN_SEC && Math.floor(rem * 40) % 2 === 0;
    drawSealOpen(ctx, x0, oy, w, hh, rem / o.openSec, warn, t - o.openedAt);
  }

  /** Riftling: Energie-Schweif (Breite nach Geschwindigkeit) und Figur in der aktuellen Animationspose. */
  renderPlayer(ctx, sy) {
    const p = this.player;
    const pose = this.anim.pose;
    const v = this.view;
    const dead = this.state === 'dying' || this.state === 'dead';
    if (!dead) {
      const col = COLORS[p.dim];
      drawTrail(ctx, p, p.x, sy, this.y, col.main, 4.5 + this.anim.speed * 4);
    }
    if (dead && this.state === 'dead' && pose.alpha <= 0.01) return;
    drawRiftling(ctx, dead && this.killer ? this.killer.x : p.x, sy, pose, v.dpr * v.scale, this.skinId || 'original');
    if(!dead&&this.state!=='menu'){
      // A crisp state marker follows the actual dimension even while skin art blends.
      ctx.save();ctx.strokeStyle=COLORS[p.dim].main;ctx.lineWidth=1.4;
      ctx.globalAlpha=.45+.4*this.switchPulse;
      for(let i=0;i<2;i++){const angle=.15+i*Math.PI;ctx.beginPath();ctx.arc(p.x,sy,17,angle,angle+1.15);ctx.stroke();}
      ctx.restore();
    }
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
      ctx.fillText(kl.reason.toUpperCase(), this.arena.width / 2, ky + 36);
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
    const flow=phaseFlowState(this),band=flow.nextBand;
    const lines = [
      `Arena ${this.arena.width} u · Ziel ${this.arena.step} u · Impuls unterbrechbar · Sperre 0 ms`,
      `Δx220 ms L ${flow.motionForecast.left.toFixed(1)} / R ${flow.motionForecast.right.toFixed(1)} u (ohne weitere Eingabe)`,
      `Input 0 ms / Phase 0 ms · kein Kollisionsschutz · Entprellung ${flow.debounceRemainingMs.toFixed(0)} ms`,
      band?`Aktives Höhenband in ${band.seconds.toFixed(2)} s · nur y, keine Kollisionsvorhersage`:'Kein aktives statisches Höhenband voraus',
      `Pulse R ${PULSE_RADIUS} u  Öffnung ${next ? next.openSec : '–'} s  Wellen ${this.rift.activePulses}  gesendet ${this.rift.emitted}`,
      sealLine,
      `FPS ${this.stats.fps.toFixed(0)}  Sim ${Math.round(1 / SIM_DT)} Hz  Schritte/Frame ${this.stats.frameSteps}`,
      `t ${this.t.toFixed(3)} s  Beat ${this.beat.toFixed(2)}/${this.level.finishBeat.toFixed(0)}  Abschnitt ${this.sectionAt(this.y).id}  ${this.level.bpm} BPM`,
      `x ${p.x.toFixed(1)}  y ${this.y.toFixed(0)}  vx ${p.vx.toFixed(0)} u/s  Spur ${p.lane}  Dim ${dim}`,
      `vy ${(this.endless?.director?infinityClimbSpeed(this.y):CLIMB_SPEED)} u/s  Vorschau ${this.lookaheadSec.toFixed(2)} s  Siegel-Serie ${this.sealStreak}`,
      `Impulse ${this.stats.impulses}  ignoriert ${this.input.ignored}  Solver: ${solver}`,
      `Partikel ${this.particles.count}/${this.particles.cap}  Riftling ${this.anim.state}`,
    ];
    if(this.endless?.director){const e=this.endless,c=e.chunks.find(c=>this.y>=c.origin&&this.y<c.end);lines.push(`Seed ${e.seed} · ${c?.id} · ${c?.category}`,`Director ${DIRECTOR_TIERS[e.tierAt(this.y)]} · geprüft ${c?.validation?.status}`,`Chunks ${e.chunks.length} / erzeugt ${e.generated} · verworfen ${e.director.rejected} · Fallback ${e.director.fallbacks}`,`Objekte ${this.obstacles.length+this.traps.traps.length} · Fallen ${this.traps.traps.length}`);}
    if(this.endless?.director){const e=this.endless,s=this.storage.progression?.data.endless.momentum,q=s?qualifyingRuns(s.recentRuns,this.storage.stats.best):[];lines.push(`Momentum ${e.momentum.tier} · bewiesen ${e.momentum.provenHeight} m · Best ${this.storage.stats.best} m`,`Höhe ${(this.y*.1).toFixed(1)} m · effektiv ${e.director.difficultyHeight(this.y*.1).toFixed(1)} m`,`Frühe Tode ${s?.consecutiveEarlyDeaths||0} · nächster Run M${s?.tier||0}`,`Letzte qualifizierte Höhen ${q.map(r=>r.height).join('/')||'–'}`);}
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(4, H - 14 * lines.length - 10, this.arena.width - 8, 14 * lines.length + 6);
    ctx.fillStyle = '#00ff66';
    lines.forEach((l, i) => ctx.fillText(l, 8, H - 14 * lines.length - 6 + i * 14));
    ctx.textBaseline = 'alphabetic';
  }
}
