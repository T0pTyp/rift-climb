// Pure musical coordinates. Simulation time is authoritative; audio never advances physics.
export const SECTION_NAMES = ['INTRO', 'BUILD', 'DROP', 'FINALE'];
export class BeatTimeline {
  constructor({ bpm = 120, beatsPerBar = 4, duration = 44, sections = null } = {}) {
    this.bpm = bpm;
    this.beatsPerBar = beatsPerBar;
    this.duration = duration;
    this.beatSec = 60 / bpm;
    this.stepSec = this.beatSec / 4;
    this.sections = sections?.length ? sections : SECTION_NAMES.map((name, i) => ({ time: duration * i / 4, name }));
  }
  at(seconds) {
    const time = Math.max(0, seconds);
    const beat = time / this.beatSec;
    const index = Math.floor(beat + 1e-8);
    const phase = Math.max(0, beat - index);
    let section = 0;
    for (let i = 1; i < this.sections.length; i++) if (time + 1e-8 >= this.sections[i].time) section = i;
    return { time, beat, index, beatNumber: index + 1,
      bar: Math.floor(index / this.beatsPerBar) + 1,
      beatInBar: index % this.beatsPerBar + 1,
      phase, eighth: Math.floor(beat * 2 + 1e-8), quarterBeat: Math.floor(beat * 4 + 1e-8),
      untilNextBeat: (1 - phase) * this.beatSec,
      barProgress: (index % this.beatsPerBar + phase) / this.beatsPerBar,
      section, sectionName: this.sections[section].name };
  }
  // Every crossed subdivision exactly once, including slow frames. seek() is handled by caller.
  between(from, to, emit) {
    if (to < from) return;
    const first = Math.max(0, Math.floor(from / this.stepSec + 1e-8) + 1);
    const last = Math.min(Math.floor(this.duration / this.stepSec - 1e-8), Math.floor(to / this.stepSec + 1e-8));
    for (let step = first; step <= last; step++) {
      const time = step * this.stepSec;
      emit({ step, time, beat: step / 4, isBeat: step % 4 === 0,
        isBar: step % (4 * this.beatsPerBar) === 0,
        accent: step % (4 * this.beatsPerBar) === 0 || this.sections.some(s => Math.abs(time - s.time) < this.stepSec / 2) });
    }
  }
}
