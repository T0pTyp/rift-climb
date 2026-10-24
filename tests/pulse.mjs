import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BeatTimeline } from '../js/pulse/timeline.js';
import { BeatEffects } from '../js/pulse/effects.js';
import { scoreStep } from '../js/pulse/score.js';
import { AudioEngine, START_LEAD } from '../js/audio.js';
import { validateLevelData, buildLevelRuntime, serializeLevel } from '../js/level-data.js';
import { Game } from '../js/game.js';
const main = validateLevelData(JSON.parse(readFileSync(new URL('../assets/levels/rift-main.json', import.meta.url)))).level;
const rt = buildLevelRuntime(main);
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }
function near(a,b,e=1e-8) { assert.ok(Math.abs(a-b) < e, `${a} != ${b}`); }
const timeline = new BeatTimeline();
test('120 BPM, beat/bar/quarter/eighth position and next beat', () => {
  const p = timeline.at(2.375); assert.equal(p.bar,2); assert.equal(p.beatNumber,5); assert.equal(p.eighth,9); assert.equal(p.quarterBeat,19); near(p.phase,.75); near(p.untilNextBeat,.125); near(p.barProgress,.1875);
});
test('BPM/meter configuration, precise boundaries, no negative phase', () => {
  const t = new BeatTimeline({bpm:150,beatsPerBar:3}); assert.equal(t.at(1.2).bar,2); near(t.at(1.2).phase,0); near(t.at(0).untilNextBeat,.4);
});
for (const fps of [10,30,60,144,'jitter']) test(`All 352 subdivisions exactly once at ${fps} FPS`, () => {
  let time = -1e-7; const events=[];
  const dts = fps === 'jitter' ? [.1,.005,.033,.016,.071] : [1/fps];
  let i=0;
  while(time<44) { const next = Math.min(44,Math.max(0,time)+dts[i++%dts.length]); timeline.between(time,next,e=>events.push(e)); time=next; }
  assert.equal(events.length,352); assert.equal(new Set(events.map(e=>e.step)).size,352); assert.equal(events.filter(e=>e.isBeat).length,88);
});
test('Restart / checkpoint effects do not replay past beat events', () => {
  const e = new BeatEffects(rt); e.seek(20.23); e.update(20.3); assert.equal(e.events,1); e.seek(0); e.update(.01); assert.equal(e.events,1);
});
test('Four score sections, melody, pads, both simultaneous dimension layers and original deterministic arrangement', () => {
  const render=()=>{const out=[]; for(let step=0;step<352;step++) scoreStep(step,timeline,(...n)=>out.push([step,...n])); return out;};
  const a=render(); assert.deepEqual(a,render()); for(const type of ['kick','hat','snare','bass','pad','lead','air','warm']) assert.ok(a.some(n=>n[1]===type));
  assert.ok(a.filter(n=>n[0]>=264).length>a.filter(n=>n[0]<88).length);
  for(const n of a.filter(n=>n[1]==='lead')) {assert.ok(a.some(m=>m[0]===n[0]&&m[5]==='blue')); assert.ok(a.some(m=>m[0]===n[0]&&m[5]==='red'));}
});
test('Old level imports default to 4/4; invalid meter rejected', () => {
  const l=structuredClone(main); delete l.beatsPerBar; assert.equal(validateLevelData(l).level.beatsPerBar,4); l.beatsPerBar=1.5; assert.equal(validateLevelData(l).ok,false);
});
test('BPM and meter survive canonical export/import',()=>{const l={...main,bpm:150,beatsPerBar:3};const roundTrip=validateLevelData(JSON.parse(serializeLevel(l)));assert.equal(roundTrip.level.bpm,150);assert.equal(roundTrip.level.beatsPerBar,3);});
class Param { constructor(){this.value=0;} setValueAtTime(v){this.value=v;} exponentialRampToValueAtTime(v){this.value=v;} setTargetAtTime(v){this.value=v;} cancelScheduledValues(){} }
class Node {
  constructor(ctx){this.ctx=ctx; this.gain=new Param(); this.frequency=new Param(); for(const k of ['threshold','knee','ratio','attack','release']) this[k]=new Param();}
  connect(n){return n;} disconnect(){this.disconnected=true;} start(t){this.startTime=t;this.ctx.sources.push(this);} stop(t){this.stopTime=t;}
}
class Context {
  constructor(){this.currentTime=0;this.state='running';this.sampleRate=8000;this.sources=[];this.destination={};}
  createGain(){return new Node(this);} createDynamicsCompressor(){return new Node(this);} createOscillator(){return new Node(this);} createBufferSource(){return new Node(this);} createBiquadFilter(){return new Node(this);}
  createBuffer(c,n){return {getChannelData:()=>new Float32Array(n)};}
  resume(){this.state='running';return Promise.resolve();}
  advance(dt){this.currentTime+=dt;for(const s of this.sources) if(!s.ended&&s.stopTime<=this.currentTime){s.ended=true;s.onended?.();}}
}
function engine(){const c=new Context();const a=new AudioEngine({context:c,timers:false});a.setLevel(rt);return {c,a};}
test('Fixed audio anchor schedules exact sixteenths despite irregular rendering (10 minute clock test)',()=>{
  const {c,a}=engine();a.timeline.duration=600;a.seek(0);let time=0;const stamps=[];
  a.voice=(type,t)=>{if(type==='kick') stamps.push(t);};a.update(0);
  for(let i=0;time<599;i++){const dt=[1/30,1/144,.05,.007][i%4];time+=dt;c.advance(dt);a.update(Math.floor(time*240+1e-8)/240);}
  assert.equal(a.metrics.resyncs,0);assert.ok(a.metrics.maxDrift<1/240+.00001);
  for(let i=1;i<stamps.length;i++)near(stamps[i]-stamps[i-1],.5);
  near(stamps[0],START_LEAD); console.log(`  max clock error ${(a.metrics.maxDrift*1000).toFixed(3)} ms`);
});
test('Late scheduler skips missed notes instead of emitting a burst',()=>{
  const {c,a}=engine();a.seek(0);a.update(0);const count=a.metrics.scheduled;c.advance(.2);a.schedule();assert.ok(a.metrics.scheduled-count<=2);
});
test('Clock discontinuity rebases audio without changing authoritative songTime',()=>{const {c,a}=engine();a.seek(0);a.update(0);c.advance(.2);a.update(.05);assert.equal(a.metrics.resyncs,1);near(a.songTime,.05);near(a.anchor,c.currentTime+START_LEAD-.05);});
test('Seek/pause cancels all existing and future sources; no timer at rest',()=>{const {c,a}=engine();a.seek(0);a.update(0);assert.ok(a.voices.size>0);a.seek(12.375);c.advance(.02);assert.equal(a.voices.size,0);assert.equal(a.active,false);assert.equal(a.timer,null);a.update(12.375);assert.ok(a.active);near(a.anchor,c.currentTime+START_LEAD-12.375);a.suspend();c.advance(.02);assert.equal(a.voices.size,0);});
test('Dimension crossfade changes bus gains on the same transport',()=>{const {a}=engine();a.seek(0);a.update(0);const anchor=a.anchor;a.setDimension('R');assert.equal(a.red.gain.value,1);assert.equal(a.blue.gain.value,.08);assert.equal(a.anchor,anchor);});
test('Ten distinct SFX and separate mute/volume buses',()=>{const {a,c}=engine();const names=['flight','switch','pulse','seal','seal-close','collision','death','respawn','checkpoint','win'];for(const n of names)a.sfx(n,'B');assert.equal(Object.keys(a.metrics.sfx).length,10);const size=a.voices.size;a.setMuted(true);a.sfx('switch','R');assert.equal(a.voices.size,size);assert.equal(a.master.gain.value,0);a.setVolume('music',0);assert.equal(a.music.gain.value,0);assert.equal(a.effects.gain.value,.7);a.stop();c.advance(.02);assert.equal(a.voices.size,0);});
test('Unexpected context interruption stops transport and requests a pause once',()=>{const {a,c}=engine();let calls=0;a.onInterrupt=()=>calls++;a.seek(0);a.update(0);c.state='interrupted';c.onstatechange();c.onstatechange();assert.equal(calls,1);assert.equal(a.active,false);});
test('100 rapid restarts release every voice',()=>{const {a,c}=engine();for(let i=0;i<100;i++){a.seek(0);a.update(0);c.advance(.016);}a.stop();c.advance(.03);assert.equal(a.voices.size,0);});
const noop=()=>{};
function run(muted,dt){const {a,c}=engine();a.setMuted(muted);const g=new Game({canvas:{getContext:()=>({})},ui:{show:noop,updateHud:noop,toast:noop,showWin:noop},audio:a,input:{guard:noop},storage:{stats:{attempts:0},save:noop},level:main,debug:{autoplay:true,autoplayOffset:.12,sealLead:.25,trace:true}});g.start('normal');while(g.state==='playing'&&g.t<45){c.advance(dt);g.update(dt);}assert.equal(g.state,'won');return g.trace;}
test('100% completion and identical 240-Hz traces with sound on/off at 30/60/144 FPS',()=>{const ref=run(false,1/60);for(const dt of [1/30,1/60,1/144]) for(const muted of [true,false]) assert.deepEqual(run(muted,dt),ref);});
console.log(`${passed} Pulse Engine checks passed`);
