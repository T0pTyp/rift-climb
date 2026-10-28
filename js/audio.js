import { CLIMB_SPEED } from './config.js';
import { BeatTimeline } from './pulse/timeline.js';
import { scoreStep, ARRANGEMENTS, frequency } from './pulse/score.js';

export const AUDIO_PREFS = 'riftclimb.audio.v1';
export const LOOKAHEAD = .12;
export const START_LEAD = .025;
const VOLUME = { music: .65, sfx: .7, muted: false };
const bounded = v => Math.min(1, Math.max(0, Number(v) || 0));

export class AudioEngine {
  constructor({ context = null, timers = true } = {}) {
    this.ctx = null;
    this.timers = timers;
    this.voices = new Set();
    this.timer = null;
    this.active = false;
    this.anchor = null;
    this.songTime = 0;
    this.dimension = 'B';
    this.settings = { ...VOLUME };
    try { const p = JSON.parse(globalThis.localStorage?.getItem(AUDIO_PREFS));
      if (p) this.settings = { music: bounded(p.music ?? VOLUME.music), sfx: bounded(p.sfx ?? VOLUME.sfx), muted: !!p.muted };
    } catch { /* Storage optional. */ }
    this.muted = this.settings.muted;
    this.metrics = { scheduled: 0, resyncs: 0, drift: 0, maxDrift: 0, sfx: {} };
    this.setLevel(null);
    if (context) this.attach(context);
  }
  setLevel(rt) {
    this.stop();
    this.timeline = new BeatTimeline({ bpm: rt?.bpm || 120, beatsPerBar: rt?.beatsPerBar || 4,
      duration: rt ? rt.finishY / CLIMB_SPEED : 44,
      sections: rt?.endless?[{time:0,name:'RIFT INFINITY'}]:rt?.sections?.filter(s => !s.auto).map(s => ({ time: s.y / CLIMB_SPEED, name: s.name })) });
    this.timeline.endless=!!rt?.endless;
    this.timeline.music = rt?.music || 'neon-ascent';
    this.timeline.accents = new Set((rt?.seals || []).map(s => Math.round(s.y / CLIMB_SPEED / this.timeline.stepSec)));
    this.step = this.timeline.stepSec;
  }
  attach(c) {
    this.ctx = c;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : .55;
    this.music = c.createGain(); this.music.gain.value = this.settings.music;
    this.effects = c.createGain(); this.effects.gain.value = this.settings.sfx;
    this.base = c.createGain(); this.base.connect(this.music);
    this.blue = c.createGain(); this.blue.connect(this.music);
    this.red = c.createGain(); this.red.connect(this.music);
    this.music.connect(this.master); this.effects.connect(this.master);
    this.compressor = c.createDynamicsCompressor();
    this.compressor.threshold.value = -16;
    this.compressor.knee.value = 12;
    this.compressor.ratio.value = 8;
    this.compressor.attack.value = .003;
    this.compressor.release.value = .15;
    // Conservative headroom after compression.
    this.output = c.createGain(); this.output.gain.value = .8;
    this.master.connect(this.compressor).connect(this.output).connect(c.destination);
    this.noise = c.createBuffer(1, Math.ceil(c.sampleRate * .5), c.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 0x52494654;
    for (let i = 0; i < data.length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; }
    this.setDimension(this.dimension, true);
    c.onstatechange = () => {
      if (c.state === 'running' && this.wantsPlayback && !this.active) this.update(this.songTime);
      if (c.state !== 'running' && this.active) {
        this.stop();
        this.onInterrupt?.();
      }
    };
  }
  // Call ONLY from a real gesture. resume rejection never affects gameplay.
  unlock() {
    try {
      if (!this.ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        let ctx;
        try { ctx = new AC({ latencyHint: 'interactive' }); }
        catch { ctx = new AC(); }
        this.attach(ctx);
      }
      // iOS stays silent unless a node is started inside the gesture, before resume() resolves.
      this.prime();
      if (this.ctx.state !== 'running') {
        const pending = this.ctx.resume?.();
        pending?.then?.(() => {
          if (this.wantsPlayback && this.ctx?.state === 'running') this.update(this.songTime);
        })?.catch?.(() => {});
      }
    } catch { /* Game remains fully playable without audio. */ }
  }
  prime() {
    if (!this.ctx || this.primed) return;
    try {
      const ctx = this.ctx;
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate || 8000);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.start(0);
      this.primed = true;
    } catch { /* The next gesture can try again. */ }
  }
  get ready() { return this.ctx?.state === 'running'; }
  persist() { try { globalThis.localStorage?.setItem(AUDIO_PREFS, JSON.stringify(this.settings)); } catch { /* optional */ } }
  setMuted(value) {
    this.muted = this.settings.muted = !!value;
    if (this.master) this.master.gain.setTargetAtTime(value ? 0 : .55, this.ctx.currentTime, .015);
    this.persist();
  }
  setVolume(bus, value) {
    if (!['music', 'sfx'].includes(bus)) return;
    this.settings[bus] = bounded(value);
    const node = bus === 'music' ? this.music : this.effects;
    if (node) node.gain.setTargetAtTime(this.settings[bus], this.ctx.currentTime, .02);
    this.persist();
  }
  setDimension(dim, immediate = false) {
    this.dimension = dim;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const [node, value] of [[this.blue, dim === 'B' ? 1 : .08], [this.red, dim === 'R' ? 1 : .08]]) {
      node.gain.cancelScheduledValues(t);
      if (immediate) node.gain.setValueAtTime(value, t);
      else node.gain.setTargetAtTime(value, t, .025);
    }
  }
  cancel(kind) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const voice of this.voices) {
      if (kind && voice.kind !== kind) continue;
      // Cancel future starts too. A short release avoids clicks on active envelopes.
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(.0001, now, .002);
      try { voice.source.stop(now + .012); } catch { /* already ended */ }
    }
  }
  stop() {
    this.wantsPlayback = false;
    this.active = false;
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.anchor = null;
    this.cancel();
  }
  suspend() { this.stop(); } // Context is reused; do not race suspend/resume promises.
  resume() { this.unlock(); }
  seek(time) {
    this.stop();
    this.seekTime = Math.max(0, time);
    this.songTime = this.seekTime;
    this.nextStep = Math.max(0, Math.ceil(this.songTime / this.step - 1e-8));
  }
  update(time) {
    this.songTime = time;
    if (this.simulationOnly) return;
    this.wantsPlayback = true;
    const state = this.ctx?.state;
    // Suspended is startable: source.start() has to happen in the same gesture as the tap.
    if (state !== 'running' && state !== 'suspended') return;
    if (time >= this.timeline.duration) { this.stop(); return; }
    const now = this.ctx.currentTime;
    this.lastSync = now;
    if (!this.active) {
      this.active = true;
      this.anchor = now + START_LEAD - time;
      // A gesture may resume the context one frame after seek; keep the opening note.
      const start = time - this.seekTime < .04 ? this.seekTime : time;
      this.nextStep = Math.max(0, Math.ceil(start / this.step - 1e-8));
      // Resume sustaining harmony at an arbitrary checkpoint (no earlier drums retriggered).
      if (this.nextStep % (4 * this.timeline.beatsPerBar)) {
        const barStep = Math.floor(this.nextStep / (4 * this.timeline.beatsPerBar)) * 4 * this.timeline.beatsPerBar;
        scoreStep(barStep, this.timeline, (type, f, g, dur, layer) => {
          const remaining = dur - (time - barStep * this.step);
          if (type === 'pad' && remaining > .02) this.voice(type, now + START_LEAD, f, g, remaining, layer);
        });
      }
      if (this.timers) this.timer = setInterval(() => this.schedule(), 25);
    }
    if (state !== 'running') { this.schedule(); return; }
    const drift = time - (now - this.anchor + START_LEAD);
    this.metrics.drift = drift;
    this.metrics.maxDrift = Math.max(this.metrics.maxDrift, Math.abs(drift));
    // Only the AUDIO moves when the clocks diverge (stalls, debug speed, clock rate).
    if (Math.abs(drift) > .055) {
      this.cancel('music');
      this.anchor = now + START_LEAD - time;
      this.nextStep = Math.max(0, Math.ceil(time / this.step - 1e-8));
      this.metrics.resyncs++;
    }
    this.schedule();
  }
  schedule() {
    const state = this.ctx?.state;
    if (!this.active || (state !== 'running' && state !== 'suspended')) return;
    const now = this.ctx.currentTime;
    if (state === 'running' && now - this.lastSync > .25) { this.stop(); this.onInterrupt?.(); return; }
    while (this.anchor + this.nextStep * this.step < now + LOOKAHEAD) {
      const step = this.nextStep++;
      const t = this.anchor + step * this.step;
      if (step * this.step >= this.timeline.duration - 1e-8) break;
      if (t < now - .008) continue; // missed notes are skipped, never burst together
      scoreStep(step, this.timeline, (type, f, gain, dur, layer) => this.voice(type, Math.max(now, t), f, gain, dur, layer));
      if (this.metronome && step % 4 === 0) this.voice('air', Math.max(now, t), step % (4 * this.timeline.beatsPerBar) ? 1046 : 1568, .045, .04, 'base');
      this.metrics.scheduled++;
    }
  }
  voice(type, t, frequency, peak, duration, layer = 'sfx') {
    if (!this.ctx) return;
    const c = this.ctx, noise = type === 'hat' || type === 'snare' || type === 'noise';
    const source = noise ? c.createBufferSource() : c.createOscillator();
    const gain = c.createGain();
    const nodes = [source, gain];
    if (noise) source.buffer = this.noise;
    else {
      source.type = type === 'bass' || type === 'warm' ? 'sawtooth' : type === 'lead' ? 'triangle' : 'sine';
      source.frequency.setValueAtTime(type === 'kick' ? 155 : frequency, t);
      if (type === 'kick') source.frequency.exponentialRampToValueAtTime(43, t + .13);
      if (type === 'fall') source.frequency.exponentialRampToValueAtTime(55, t + duration * .9);
    }
    let tail = source;
    if (noise || type === 'bass' || type === 'warm') {
      const filter = c.createBiquadFilter(); nodes.push(filter);
      filter.type = type === 'hat' ? 'highpass' : type === 'snare' ? 'bandpass' : 'lowpass';
      filter.frequency.value = type === 'hat' ? 7000 : type === 'snare' ? 1800 : type === 'warm' ? 650 : 950;
      source.connect(filter); tail = filter;
    }
    const attack = type === 'pad' ? Math.min(.12, duration * .2) : .004;
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, t + Math.max(attack + .01, duration));
    tail.connect(gain).connect(layer === 'sfx' ? this.effects : this[layer]);
    const voice = { source, gain, kind: layer === 'sfx' ? 'sfx' : 'music' };
    this.voices.add(voice);
    source.onended = () => { for (const n of nodes) n.disconnect(); this.voices.delete(voice); };
    source.start(t); source.stop(t + duration + .025);
  }
  sfx(name, dim, atWall) {
    if (!this.ready || this.muted || this.settings.sfx === 0) return;
    this.metrics.sfx[name] = (this.metrics.sfx[name] || 0) + 1;
    // Virtual-time developer replays can advance minutes in one browser task.
    // Count feedback, but do not enqueue minutes of SFX at the real audio clock.
    if(this.simulationOnly)return;
    const t = this.ctx.currentTime;
    const note = (f, gain = .09, length = .1, offset = 0, type = 'air') => this.voice(type, t + offset, f, gain, length);
    if (name === 'flight') note(atWall ? 150 : 240, .045, .065, 0, 'fall');
    if (name === 'switch') note(dim === 'B' ? 988 : 494, .08, .1);
    if (name === 'pulse') { note(110, .12, .16, 0, 'fall'); note(880, .025, .09, .015); }
    if (name === 'seal') { note(1568, .065, .13); note(2349, .04, .12, .035); }
    if (name === 'seal-close') note(196, .035, .08, 0, 'warm');
    if (name === 'collision') this.voice('noise', t, 0, .13, .075);
    if (name === 'death') note(220, .12, .24, .035, 'fall');
    if (name === 'respawn') { note(440, .055, .12); note(880, .05, .16, .07); }
    if (name === 'checkpoint') { note(880, .06, .12); note(1318.5, .05, .15, .07); }
    if (name === 'reward') { note(1046.5,.04,.12);note(1568,.035,.15,.065);note(2093,.025,.18,.12); }
    if (name === 'record') { note(783.99,.035,.10);note(1174.66,.03,.14,.06); }
    if(name==='saw-break'){note(180,.07,.18,0,'fall');note(1200,.035,.1,.025);}
    if(name==='mine-warn'){note(660,.04,.06);note(880,.04,.06,.12);}
    if(name==='mine-blast'){note(90,.08,.2,0,'fall');this.voice('noise',t,0,.055,.12);}
    if(name==='mine-disarm'){note(1174.66,.05,.12);note(1568,.035,.15,.05);}
    if(name==='laser-disable'){note(300,.05,.16,0,'fall');note(1480,.03,.08);}
    if (name === 'win') {
      const chord=ARRANGEMENTS[this.timeline.music]?.chords[0];
      const fanfare=chord?[...chord,chord[0]+12].map(frequency):[523.25,659.25,783.99,1046.5];
      fanfare.forEach((f,i)=>note(f,.07,.28,i*.1));
    }
  }
  status() {
    return { state: this.ctx?.state || 'locked', active: this.active, songTime: this.songTime,
      nextStep: this.nextStep, sources: this.voices.size, dimension: this.dimension,
      settings: { ...this.settings }, ...this.metrics };
  }
}
