// Prozedurale Musik + Effekte über WebAudio (keine Samples, keine geschützte Musik).
// Tempo (BPM) und Intensitätsstufen kommen aus dem geladenen Level (setLevel).
import { BEAT_SEC } from './config.js';

const LOOKAHEAD = 0.12;
const ROOTS = [110, 87.31, 130.81, 98]; // Am, F, C, G (pro Takt)
const CHORDS = [
  [220, 261.63, 329.63, 440],
  [174.61, 220, 261.63, 349.23],
  [261.63, 329.63, 392, 523.25],
  [196, 246.94, 293.66, 392],
];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.nextStep = 0;
    this.noise = null;
    this.setLevel(null);
  }

  /** Tempo und Intensitätsstufen (Abschnitte B/C) aus den Laufzeitdaten eines Levels; null = 120 BPM, 88 Beats. */
  setLevel(rt) {
    this.beatSec = rt ? rt.beatSec : BEAT_SEC;
    this.step = this.beatSec / 4; // 16tel
    const upb = rt ? rt.unitsPerBeat : 130;
    const secs = rt ? rt.sections : null;
    this.finishBeat = rt ? Math.ceil(rt.finishBeat - 1e-6) : 88;
    this.bFrom = secs && secs[1] ? Math.round(secs[1].y / upb) : 22;
    this.cFrom = secs && secs[2] ? Math.round(secs[2].y / upb) : 53;
    this.bMid = Math.round((this.bFrom + this.cFrom) / 2 / 4) * 4;
  }

  /** Muss synchron in einem Nutzer-Gesten-Handler aufgerufen werden (iOS Safari). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.55;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state !== 'running') this.ctx.resume();
      const src = this.ctx.createBufferSource();
      src.buffer = this.ctx.createBuffer(1, 1, 22050);
      src.connect(this.ctx.destination);
      src.start(0);
    } catch (err) {
      console.warn('Audio nicht verfügbar:', err);
      this.ctx = null;
    }
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state !== 'running') this.ctx.resume();
  }

  seek(gameTime) {
    this.nextStep = Math.max(0, Math.ceil(gameTime / this.step - 1e-6));
  }

  /** Plant alle 16tel, die im Lookahead-Fenster liegen, relativ zur Spielzeit. */
  update(gameTime) {
    if (!this.ready || this.muted) {
      this.seek(gameTime);
      return;
    }
    const now = this.ctx.currentTime;
    while (this.nextStep * this.step < gameTime + LOOKAHEAD) {
      const stepTime = this.nextStep * this.step;
      const when = now + Math.max(0, stepTime - gameTime);
      this.playStep(this.nextStep, when);
      this.nextStep++;
    }
  }

  playStep(step, t) {
    const beat = Math.floor(step / 4);
    const sub = step % 4;
    const bar = Math.floor(beat / 4);
    const chord = bar % 4;
    const intensity = beat < this.bFrom ? 0 : beat < this.bMid ? 1 : beat < this.cFrom ? 2 : 3;
    if (beat >= this.finishBeat) {
      if (sub === 0 && beat < this.finishBeat + 4) this.kick(t);
      return;
    }

    if (sub === 0) this.kick(t);
    if (sub === 2) this.hat(t, 0.05);
    if (intensity >= 2 && (sub === 1 || sub === 3)) this.hat(t, 0.025);
    if (intensity >= 1 && sub === 0 && beat % 2 === 1) this.snare(t);
    if (sub === 0 || sub === 2 || (intensity >= 2 && sub === 3)) {
      this.bass(t, ROOTS[chord] * (sub === 2 && intensity >= 1 ? 2 : 1));
    }
    if (intensity >= 2) {
      const notes = CHORDS[chord];
      const idx = (step * (intensity >= 3 ? 3 : 1)) % notes.length;
      if (intensity >= 3 || sub % 2 === 0) this.lead(t, notes[idx] * 2, 0.045);
    } else if (sub === 0 && beat % 4 === 0) {
      this.pad(t, CHORDS[chord]);
    }
  }

  env(gainNode, t, peak, decay) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  }

  kick(t) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    this.env(g, t, 0.9, 0.22);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  noiseHit(t, gain, decay, type, freq) {
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = c.createGain();
    this.env(g, t, gain, decay);
    s.connect(f).connect(g).connect(this.master);
    s.start(t);
    s.stop(t + decay + 0.02);
  }

  hat(t, gain) {
    this.noiseHit(t, gain, 0.04, 'highpass', 7000);
  }

  snare(t) {
    this.noiseHit(t, 0.18, 0.14, 'bandpass', 1800);
  }

  bass(t, freq) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.2);
    const g = c.createGain();
    this.env(g, t, 0.22, 0.22);
    o.connect(f).connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.25);
  }

  lead(t, freq, gain) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = c.createGain();
    this.env(g, t, gain, 0.11);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.13);
  }

  pad(t, notes) {
    const c = this.ctx;
    for (const n of notes.slice(0, 3)) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = n;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + this.beatSec * 4);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + this.beatSec * 4 + 0.05);
    }
  }

  sfx(name, dim, atWall) {
    if (!this.ready || this.muted) return;
    const t = this.ctx.currentTime;
    if (name === 'switch') {
      const c = this.ctx;
      const o = c.createOscillator();
      o.type = 'triangle';
      // Blau höher, Rot tiefer: die aktive Dimension ist auch hörbar
      const base = dim === 'B' ? 740 : 494;
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.06);
      const g = c.createGain();
      this.env(g, t, 0.15, 0.09);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.11);
      this.noiseHit(t, 0.06, 0.05, 'highpass', 3500);
      if (atWall) this.noiseHit(t, 0.12, 0.06, 'bandpass', 600);
    } else if (name === 'death') {
      this.noiseHit(t, 0.45, 0.25, 'lowpass', 1400);
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(220, t);
      o.frequency.exponentialRampToValueAtTime(55, t + 0.22);
      const g = this.ctx.createGain();
      this.env(g, t, 0.18, 0.24);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.26);
    } else if (name === 'seal') {
      // Siegel öffnet: heller, metallischer Doppelton
      const c = this.ctx;
      [1567.98, 2349.32].forEach((f, i) => {
        const o = c.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t + i * 0.035);
        const g = c.createGain();
        this.env(g, t + i * 0.035, 0.11, 0.16);
        o.connect(g).connect(this.master);
        o.start(t + i * 0.035);
        o.stop(t + i * 0.035 + 0.18);
      });
      this.noiseHit(t, 0.07, 0.12, 'highpass', 6000);
    } else if (name === 'checkpoint') {
      [880, 1318.5].forEach((f, i) => this.lead(t + i * 0.07, f, 0.06));
    } else if (name === 'win') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.lead(t + i * 0.1, f, 0.08));
    }
  }
}
