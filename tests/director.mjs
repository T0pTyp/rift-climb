import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {Progression} from '../js/progression.js';
import {Player} from '../js/player.js';
import {withInputEvent} from '../js/input-time.js';
import {EndlessWorld,validateChunkBook,hazardRowGap,INFINITY_MAX_HAZARD_GAP,INFINITY_MAX_HAZARD_GAP_SEC} from '../js/endless.js';
import {headlessGame,runReplay,checkChunkPlayability,runEndlessReplay} from '../js/playcheck.js';
import {validateLevelData,serializeLevel} from '../js/level-data.js';
import {CATEGORIES,compatible,RiftDirector,directorTier,accepts,stateOf,chunkFingerprint} from '../js/rift-director.js';
import {CLIMB_SPEED,SIM_DT} from '../js/config.js';
import {makeTrap,trapPose} from '../js/traps.js';
const book=validateChunkBook(JSON.parse(readFileSync('assets/endless/director.json')));
let checks=0,pairs=0,entries=0,timing=0;const test=(s,f)=>{f();checks++;console.log('PASS '+s);};
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),key:i=>[...m.keys()][i],get length(){return m.size;}};};
function game(seed=37,order=null){const g=headlessGame(book.chunks[0].level);g.debug.autoplay=true;g.startEndless(book,seed,g.storage,order);return g;}
function play(g,seconds,dt=.2){const end=Math.round(seconds*240);let guard=0;while(g.state==='playing'&&g.stats.steps<end&&guard++<end+1)g.update(Math.min(dt,(end-g.stats.steps)/240));return g;}
const stageCount=stage=>book.chunks.filter(c=>c.level.chunk.stage===stage).length;
function threatEnd(level){let t=0;for(const o of level.objects){const y=o.y/CLIMB_SPEED;t=Math.max(t,y+(String(o.id).includes('mill')?o.length/CLIMB_SPEED:0));}return t;}
function firstHazard(level){return Math.min(...level.objects.map(o=>o.y))/CLIMB_SPEED;}
test('270/90 actual spring: symmetric movement, immediate retarget, stable walls',()=>{for(const dir of [-1,1]){const p=new Player('narrow');p.impulse(dir);assert.equal(p.x,135);assert.equal(p.dim,'R');p.update(.22,0);assert.ok(Math.abs(p.x-135-dir*85.498)<.02);const x=p.x;p.impulse(-dir);assert.equal(p.x,x);assert.equal(p.dim,'B');for(let i=0;i<240;i++)p.update(1/240,i/240*260);assert.ok(Math.abs(p.x-135)<.001);for(let i=0;i<100;i++){p.impulse(dir);p.update(.05,i*13);assert.ok(p.x>=8&&p.x<=262);}assert.ok(Math.abs(p.x-(dir>0?225:45))<.001);}});
test('Four blocks, three stages, only lasers and blockades',()=>{
 assert.deepEqual(CATEGORIES,['SLIT','PAIR','LASER','MILL','COMBO']);
 assert.equal(stageCount(0),1);assert.equal(stageCount(1),20);assert.equal(stageCount(2),20);assert.equal(stageCount(3),8);
 assert.equal(book.chunks.filter(c=>c.level.chunk.opening).length,1);
 for(const c of book.chunks){
  assert.ok(c.level.objects.every(o=>o.type==='obstacle'||o.type==='laser'),c.id);
  assert.equal(hazardRowGap(c.level).max<=INFINITY_MAX_HAZARD_GAP+1e-6,true,c.id);
  const times=c.level.objects.map(o=>o.y/CLIMB_SPEED).sort((a,b)=>a-b);
  for(let i=1;i<times.length;i++)assert.ok(times[i]-times[i-1]<1,c.id);
 }
 assert.equal(INFINITY_MAX_HAZARD_GAP,CLIMB_SPEED*INFINITY_MAX_HAZARD_GAP_SEC);
 const lasers=book.chunks.filter(c=>c.level.chunk.block==='laser'||c.level.chunk.block==='pair-laser');
 for(const c of lasers){const ls=c.level.objects.filter(o=>o.type==='laser');assert.equal(ls.filter(o=>o.dimension==='red').length,2,c.id);assert.equal(ls.filter(o=>o.dimension==='blue').length,2,c.id);assert.ok(ls.every(o=>o.spin),c.id);}
 for(const c of book.chunks.filter(x=>x.level.chunk.block==='mill'||x.level.chunk.block==='slit-mill')){
  const wings=c.level.objects.filter(o=>String(o.id).includes('mill'));
  assert.equal(wings.length,4,c.id);assert.equal(new Set(wings.map(o=>o.spin)).size,1);assert.equal(new Set(wings.map(o=>o.y)).size,1);assert.equal(new Set(wings.map(o=>o.x)).size,1);
  const poses=wings.map(o=>trapPose(makeTrap(o),wings[0].y/CLIMB_SPEED));
  for(let i=0;i<4;i++){const gap=Math.atan2(Math.sin(poses[(i+1)%4].angle-poses[i].angle),Math.cos(poses[(i+1)%4].angle-poses[i].angle));assert.ok(Math.abs(Math.abs(gap)-Math.PI/2)<1e-6,c.id);}
 }
});
test('Every module is certified and every tap keeps a 20 ms corridor',()=>{
 for(const c of book.chunks){const l=c.level,v=validateLevelData(l);assert.ok(v.ok,c.id);assert.deepEqual(JSON.parse(serializeLevel(v.level)),l);const proof=checkChunkPlayability(l);assert.ok(proof.ok,c.id+' '+proof.message);entries+=l.chunk.fixtures.length;assert.equal(proof.certificate.hash,l.chunk.validation.hash);assert.ok(runReplay(l,l.replay.taps).won,c.id);
  for(let i=0;i<l.replay.taps.length;i++)for(const sign of [-1,1]){const taps=l.replay.taps.map((t,j)=>({...t,t:t.t+(i===j?sign*.02:0)}));if(taps.some((tap,k)=>tap.t<.2||(k&&tap.t-taps[k-1].t<.045)))continue;timing++;assert.ok(runReplay(l,taps).won,c.id+' tap '+i+' '+sign);}}
});
test('Joins follow color and the gap after the opening stays under a second',()=>{
 const opening=book.chunks.find(c=>c.level.chunk.opening);
 assert.equal(game().endless.chunks[0].id,opening.id);
 let worst=0;
 for(const a of book.chunks)for(const b of book.chunks){
  if(a.id===b.id||b.level.chunk.opening)continue;
  const matches=compatible(a.level.chunk.exit,b.level.chunk.entry);
  if(!matches){assert.ok(a.level.chunk.exit.dimension!==b.level.chunk.entry.dimension||a.level.chunk.exit.target!==b.level.chunk.entry.target);continue;}
  assert.equal(a.level.chunk.exit.dimension,b.level.chunk.entry.dimension);
  const gap=(a.length/CLIMB_SPEED-threatEnd(a.level))+firstHazard(b.level);
  worst=Math.max(worst,gap);assert.ok(gap<1,`${a.id} → ${b.id} ${gap.toFixed(3)}s`);
  const g=game(1,[book.chunks.indexOf(a),book.chunks.indexOf(b)]);
  const entry=a.level.chunk.entry;g.player.reset(entry.target,entry.dimension==='blue'?'B':'R',0);g.player.body.x=(entry.x[0]+entry.x[1])/2;g.player.body.v=0;
  play(g,(a.length+b.length)/CLIMB_SPEED+.25);assert.equal(g.state,'playing',`${a.id} → ${b.id} ${g.killer?.o?.id||''}`);pairs++;
 }
 assert.ok(worst<.99);
});
test('Contracts reject a different color, lane or clearance and still accept a real join',()=>{
 const pair=book.chunks.find(c=>c.level.chunk.block==='pair'),next=book.chunks.find(c=>c.id!==pair.id&&compatible(pair.level.chunk.exit,c.level.chunk.entry));
 assert.ok(compatible(pair.level.chunk.exit,next.level.chunk.entry));
 assert.equal(compatible(pair.level.chunk.exit,{...next.level.chunk.entry,dimension:pair.level.chunk.exit.dimension==='blue'?'red':'blue'}),false);
 assert.equal(compatible(pair.level.chunk.exit,{...next.level.chunk.entry,target:pair.level.chunk.exit.target===0?2:0}),false);
 assert.equal(compatible({...pair.level.chunk.exit,clearSec:.9},next.level.chunk.entry),false);
});
test('Certificates survive normalized JSON roundtrips; stale definitions fail',()=>{for(const c of book.chunks)assert.equal(chunkFingerprint(JSON.parse(serializeLevel(validateLevelData(c.level).level))),c.level.chunk.validation.hash);const b=structuredClone(book);b.chunks[0].level.objects[0].x++;assert.throws(()=>validateChunkBook(b));});
test('A repeated recent module falls back to another module of the same color',()=>{const entrants=book.chunks.filter(c=>!c.level.chunk.opening&&c.level.chunk.entry.dimension==='red'&&c.level.chunk.entry.target===0);const source=book.chunks.find(c=>c.level.chunk.exit.dimension==='red'&&c.level.chunk.exit.target===0);const pool=entrants.slice(0,3);const d=new RiftDirector({chunks:pool},()=>.2);d.history=pool.map(c=>({id:c.id,category:c.level.chunk.category}));d.previous=source.level.chunk.exit;const chosen=d.select(0);assert.equal(chosen.level.chunk.entry.dimension,'red');assert.equal(d.fallbacks,1);});
test('Six capped difficulty bands keep speed fixed',()=>{assert.deepEqual([0,249,250,500,750,1250,2000,1e9].map(m=>directorTier(m*10)),[0,0,1,2,3,4,5,5]);});
test('Opt-in complete seed/input replay reproduces real continuous state; bad records fail',()=>{const g=game();g.debug.trace=true;assert.equal(g.recordEndlessInputs(),true);play(g,24);const record=g.exportEndlessReplay(),r=runEndlessReplay(book,record);assert.ok(r.ok);assert.equal(r.state,'playing');assert.equal(r.t,g.t);assert.equal(r.x,g.player.x);assert.equal(r.dimension,g.player.dim);assert.equal(g.recordEndlessInputs(),false);assert.equal(runEndlessReplay(book,{...record,truncated:true}).ok,false);g.restart();assert.equal(g.exportEndlessReplay(),null);});
test('Accepted event times preserve queued contacts in one simulation tick',()=>{const g=game();g.debug.trace=true;g.recordEndlessInputs();const now=performance.now();withInputEvent(now-80,()=>g.press(1));withInputEvent(now-20,()=>g.press(-1));play(g,.3);const record=g.exportEndlessReplay(),r=runEndlessReplay(book,record);assert.equal(record.taps[0].t,record.taps[1].t);assert.ok(r.ok);assert.equal(r.pulses,2);});
for(const seed of [1,37])test('Regular-input climb stays alive for seed '+seed,()=>{const g=game(seed);play(g,80);assert.equal(g.state,'playing',JSON.stringify({seed,t:g.t,killer:g.killer?.o?.id}));assert.ok(g.y*.1>1800);});
test('5/30/60/144 FPS have identical simulated states and ordered generation',()=>{let ref;for(const fps of [5,30,60,144]){const g=game(37);play(g,36,1/fps);assert.equal(g.state,'playing');const state={x:g.player.x,vx:g.player.vx,dim:g.player.dim,t:g.t,impulses:g.stats.impulses,ids:g.endless.director.history.map(c=>c.id)};if(ref)assert.deepEqual(state,ref);else ref=state;}});
test('Generation stays seeded and does not repeat a module three times',()=>{
 const a=new EndlessWorld(book,37),b=new EndlessWorld(book,37);const seen=new Set();let repeat=0,last=null,maxChunks=0;
 for(let i=0;i<4000;i++){a.ensure(i*700);b.ensure(i*700);assert.deepEqual(a.chunks.map(c=>c.id),b.chunks.map(c=>c.id));maxChunks=Math.max(maxChunks,a.chunks.length);for(const c of a.chunks)if(!seen.has(c.index)){seen.add(c.index);repeat=c.id===last?repeat+1:1;assert.ok(repeat<3,c.id);last=c.id;}}
 assert.ok(maxChunks<=30);
});
test('Pause/retry clears inputs, traps, waves, time; same seed restarts exactly',()=>{const g=game();play(g,12);const old=g.t;g.pause();g.update(.2);assert.equal(g.t,old);g.resume();g.restart();assert.equal(g.t,0);assert.equal(g.player.dim,'B');assert.equal(g.rift.emitted,0);assert.deepEqual(g.endless.chunks.map(c=>c.id),game().endless.chunks.map(c=>c.id));});
test('Central storage persists heights / isolates normal and editor statistics',()=>{const store=memory(),p=new Progression({storage:store}),g=game();g.storage=p.infinityStorage(37);g.restart();play(g,20);g.saveProgress(true);const height=p.data.endless.bestHeight;assert.ok(height>=500);assert.equal(p.data.endless.attempts,1);assert.equal(p.summary().totalNormalAttempts,0);assert.equal(p.summary().goldMedals,0);assert.equal(new Progression({storage:store}).data.endless.bestHeight,height);const before=JSON.stringify(p.data),isolated=new Progression({storage:store,isolated:true}),i=game();i.storage=isolated.infinityStorage(37);i.restart();play(i,20);i.saveProgress(true);assert.equal(JSON.stringify(new Progression({storage:store}).data),before);});
mkdirSync('test-results/m79',{recursive:true});writeFileSync('test-results/m79/director.json',JSON.stringify({checks,pairs,entries,timing,stages:{opening:stageCount(0),easy:stageCount(1),tight:stageCount(2),combo:stageCount(3)}},null,2));
console.log(JSON.stringify({checks,pairs,entries,timing,stages:{opening:stageCount(0),easy:stageCount(1),tight:stageCount(2),combo:stageCount(3)}}));
