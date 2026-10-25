// NEON ASCENT — original score, A minor / F / C / G. No samples, no randomness.
// Both dimension arrangements are emitted from the SAME step/harmony.
export const SCORE_TITLE = 'NEON ASCENT';
const ROOTS = [45, 41, 48, 43];
const CHORDS = [[57,60,64], [53,57,60], [60,64,67], [55,59,62]];
const MOTIF = [0,2,1,2,0,1,2,1, 2,1,0,1,2,0,1,2];
export const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
export function scoreStep(step, timeline, emit) {
  if (ARRANGEMENTS[timeline.music]) return campaignStep(step, timeline, emit);
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

// Original M7 compositions: independent motifs/harmonies, same synthesis and clock.
export const ARRANGEMENTS = Object.freeze({
  'shattered-gears':{roots:[40,36,43,38],chords:[[64,67,71],[60,64,67],[67,71,74],[62,66,69]],motif:[0,2,1,0,2,3,1,2,0,1,3,2,1,2,0,1],drive:1},
  'voltage-run':{roots:[37,33,40,35],chords:[[61,64,68],[57,61,64],[64,68,71],[59,63,66]],motif:[0,1,3,2,0,2,1,3,2,1,0,2,3,1,2,0],drive:2},
  'singularity-rush':{roots:[43,39,46,41],chords:[[67,70,74],[63,67,70],[70,74,77],[65,69,72]],motif:[0,3,2,0,1,2,3,1,2,0,3,2,1,0,2,1],drive:2},
  'rift-infinity':{roots:[45,41,48,43],chords:[[57,60,64],[53,57,60],[60,64,67],[55,59,62]],motif:[0,2,1,3,1,0,2,1,3,2,0,1,2,3,1,0],drive:1},
  'first-pulse': { title: 'First Pulse', roots: [50,47,43,45], chords: [[62,66,69],[59,62,66],[55,59,62],[57,61,64]],
    motif: [0,1,2,1,0,2,1,0, 1,2,3,2,1,0,2,1], drive: 0 },
  'fractured-rhythm': { title: 'Fractured Rhythm', roots: [38,34,41,36], chords: [[62,65,69],[58,62,65],[65,69,72],[60,64,67]],
    motif: [0,2,1,3,2,1,0,2, 1,0,2,3,2,0,1,2], drive: 1 },
  overload: { title: 'Overload', roots: [42,38,45,40], chords: [[66,69,73],[62,66,69],[69,73,76],[64,68,71]],
    motif: [0,0,2,1,3,2,1,0, 2,3,2,1,0,1,2,3], drive: 2 },
});
function campaignStep(step, tl, emit) {
  const t = step * tl.stepSec;
  if (t >= tl.duration - 1e-8) return;
  const a = ARRANGEMENTS[tl.music], beat = Math.floor(step / 4), sub = step % 4;
  const bar = Math.floor(beat / tl.beatsPerBar), inBar = beat % tl.beatsPerBar;
  const stage = tl.endless?Math.min(3,Math.floor(t/24)):Math.min(3, tl.at(t).section), chord = Math.floor(bar / 2) % 4;
  const root = a.roots[chord], notes = a.chords[chord];
  // Last bar resolves to the tonic; no endless loop after the finish.
  if (t >= tl.duration - tl.beatSec * 2) {
    if (sub === 0) {
      emit('kick',0,.32,.2,'base');
      for (const n of a.chords[0]) emit('pad',frequency(n),.032,tl.beatSec*1.8,'base');
      emit('air',frequency(a.chords[0][2]+12),.035,tl.beatSec*.8,'blue');
      emit('warm',frequency(a.roots[0]),.08,tl.beatSec*.8,'red');
    }
    return;
  }
  // An audible two-beat intake before the hard level's Overload Sequence.
  const intake = a.drive === 2 && t >= tl.duration*.7-tl.beatSec*2 && t < tl.duration*.7;
  const full = stage >= 2 || a.drive === 2;
  if (sub === 0 && !intake) emit('kick',0,full ? .50 : .43,.22,'base');
  if (sub === 0 && inBar % 2 === 1 && !intake) emit('snare',0,.13+(a.drive*.012),.13,'base');
  if (sub === 2 || (full && sub%2===1)) emit('hat',0,sub===2?.05:.024,.04,'base');
  if (stage >= 3 && inBar === tl.beatsPerBar-1 && sub === 3) emit('snare',0,.055,.075,'base');
  const bassStep = sub===0 || (stage>=1 && sub===2) || (a.drive>0 && sub===3 && beat%2===0);
  if (bassStep && !intake) {
    const n = root + (sub===2 ? 12 : a.drive===2 && sub===3 ? 7 : 0);
    emit('bass',frequency(n),.105,tl.stepSec*1.65,'base');
    emit('warm',frequency(n-12),.085,tl.stepSec*1.7,'red');
  }
  if (step % (tl.beatsPerBar*4)===0) for (const n of notes) {
    emit('pad',frequency(n-12),.024,tl.beatSec*tl.beatsPerBar*.92,'base');
    emit('pad',frequency(n+12),.019,tl.beatSec*2,'blue');
  }
  if (tl.accents?.has(step)) {
    emit('air',frequency(notes[2]+12),.052,tl.beatSec*.55,'base');
    emit('warm',frequency(root),.05,tl.beatSec*.4,'red');
  }
  if (tl.accents?.has(step+1)) emit('snare',0,.045,.065,'base');
  if (intake) { if(sub===0) emit('air',frequency(notes[inBar%3]+12),.045,tl.beatSec*.6,'blue'); return; }
  const melodic = stage>=1 || (a.drive>0) || (sub===0 && inBar===3);
  if (melodic && (sub===0 || ((full || a.drive===1) && sub===2))) {
    const idx = a.motif[Math.floor(step/2)%a.motif.length];
    // Follow each chord's own major/minor third; the fourth motif degree is its octave.
    const n = idx === 3 ? notes[0] + 12 : notes[idx];
    emit('lead',frequency(n),stage===0?.027:.045,tl.stepSec*1.65,'base');
    emit('air',frequency(n+12),.029,tl.stepSec*1.5,'blue');
    emit('warm',frequency(n-12),.042,tl.stepSec*1.65,'red');
  }
  if (stage>=3 && sub%2===1) emit('air',frequency(notes[(beat+sub)%3]+12),.018,tl.stepSec*.7,'blue');
}
