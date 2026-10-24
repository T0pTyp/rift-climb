// NEON ASCENT — original score, A minor / F / C / G. No samples, no randomness.
// Both dimension arrangements are emitted from the SAME step/harmony.
export const SCORE_TITLE = 'NEON ASCENT';
const ROOTS = [45, 41, 48, 43];
const CHORDS = [[57,60,64], [53,57,60], [60,64,67], [55,59,62]];
const MOTIF = [0,2,1,2,0,1,2,1, 2,1,0,1,2,0,1,2];
export const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
export function scoreStep(step, timeline, emit) {
  const t = step * timeline.stepSec;
  if (t >= timeline.duration - 1e-8) return;
  const beat = Math.floor(step / 4), sub = step % 4;
  const bar = Math.floor(beat / timeline.beatsPerBar);
  const chord = bar % 4, stage = timeline.at(t).section;
  const root = ROOTS[chord], notes = CHORDS[chord];
  // Gate arrival: metallic chord accent; preceding sixteenth: a small drum pickup.
  if (timeline.accents?.has(step)) {
    emit('air', frequency(notes[2] + 12), .055, timeline.beatSec * .55, 'base');
    emit('warm', frequency(root), .065, timeline.beatSec * .4, 'red');
  }
  if (timeline.accents?.has(step + 1)) emit('snare', 0, .045, .07, 'base');
  const ending = t >= timeline.duration - timeline.beatSec;
  if (ending) {
    if (sub === 0) {
      emit('kick', 0, .16, .3, 'base');
      for (const n of [57,60,64,69]) emit('pad', frequency(n), .035, timeline.beatSec * .9, 'base');
    }
    return;
  }
  if (sub === 0) emit('kick', 0, .55, .23, 'base');
  if (sub === 2 || (stage >= 2 && sub % 2)) emit('hat', 0, sub === 2 ? .055 : .025, .045, 'base');
  if (stage >= 1 && sub === 0 && beat % 2) emit('snare', 0, .14, .15, 'base');
  if (stage >= 3 && beat % timeline.beatsPerBar === timeline.beatsPerBar - 1 && sub === 3) emit('snare', 0, .06, .09, 'base');
  if (sub === 0 || (stage >= 1 && sub === 2) || (stage >= 2 && sub === 3)) {
    const f = frequency(root + (sub === 2 ? 12 : 0));
    emit('bass', f, .11, timeline.stepSec * (stage ? 1.7 : 3), 'base');
    emit('warm', f / 2, .10, timeline.stepSec * 1.8, 'red');
  }
  // Pad enters at every bar; stateless so checkpoint reconstruction uses the same harmony.
  if (step % (timeline.beatsPerBar * 4) === 0) {
    for (const n of notes) {
      emit('pad', frequency(n), .026, timeline.beatSec * timeline.beatsPerBar * .92, 'base');
      emit('pad', frequency(n + 12), .022, timeline.beatSec * 2, 'blue');
    }
  }
  if (stage >= 1 && (sub === 0 || (stage >= 2 && sub === 2))) {
    const n = notes[MOTIF[Math.floor(step / 2) % MOTIF.length]];
    const length = timeline.stepSec * 1.7;
    emit('lead', frequency(n + 12), stage === 1 ? .035 : .055, length, 'base');
    emit('air', frequency(n + 24), .035, length, 'blue');
    emit('warm', frequency(n), .055, length, 'red');
  }
  if (stage >= 3 && sub % 2 === 1) emit('air', frequency(notes[(beat + sub) % 3] + 24), .022, timeline.stepSec * .7, 'blue');
}
