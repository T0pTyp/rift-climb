import { CLIMB_SPEED } from '../config.js';
import { BeatTimeline } from './timeline.js';
// Visual response observes simulation time, even with audio disabled.
export class BeatEffects {
  constructor(rt) {
    this.timeline = new BeatTimeline({ bpm: rt.bpm, beatsPerBar: rt.beatsPerBar, duration: rt.finishY / CLIMB_SPEED,
      sections: rt.endless?[{time:0,name:'RIFT INFINITY'}]:rt.sections?.filter(s => !s.auto).map(s => ({ time: s.y / CLIMB_SPEED, name: s.name })) });
    this.seek(0);
  }
  seek(t) { this.time = t - 1e-7; this.lastBeat = -Infinity; this.lastAccent = -Infinity; this.events = 0; }
  update(t, accent) {
    this.timeline.between(this.time, t, e => {
      this.events++;
      if (e.isBeat) this.lastBeat = e.time;
      if (e.accent) { this.lastAccent = e.time; accent?.(); }
    });
    this.time = t;
  }
  pulse(t) { return Math.exp(-Math.max(0, t - this.lastBeat) * 9); }
  accent(t) { return Math.exp(-Math.max(0, t - this.lastAccent) * 12); }
}
