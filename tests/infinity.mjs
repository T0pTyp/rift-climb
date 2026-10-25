import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../js/game.js';
import {Progression,ASCENSION_KEY,BACKUP_KEY} from '../js/progression.js';
import {EndlessWorld,validateChunkBook,entryTaps,infinityTier,worldMeters} from '../js/endless.js';
import {runReplay} from '../js/playcheck.js';
const book=validateChunkBook(JSON.parse(readFileSync('assets/endless/chunks.json','utf8'))),noop=()=>{};
const memory=()=>{const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
function game(seed,order=null) {const p=new Progression({storage:memory()}),g=new Game({canvas:{getContext:()=>null},ui:{show:noop,showDeath:noop,showWin:noop,updateHud:noop,updateMenu:noop,toast:noop},audio:{seek:noop,sfx:noop,update:noop,stop:noop,suspend:noop},input:{guard:noop},storage:p.infinityStorage(seed),debug:{autoplay:true},level:book.chunks[0].level});g.startEndless(book,seed,p.infinityStorage(seed),order);return {g,p};}
let checks=0;const check=(n,fn)=>{fn();checks++;console.log('PASS '+n);};
check('20 different authored modules independently reach 100% in real physics',()=>{assert.equal(book.chunks.length,20);for(const c of book.chunks)assert.ok(runReplay(c.level,c.level.replay.taps).won,c.id);});
check('Same seed regenerates identical sequence; different seeds vary',()=>{const a=new EndlessWorld(book,37),b=new EndlessWorld(book,37),c=new EndlessWorld(book,38);for(let y=0;y<50000;y+=2080){a.ensure(y);b.ensure(y);c.ensure(y);assert.deepEqual(a.chunks.map(c=>c.id),b.chunks.map(c=>c.id));}assert.notDeepEqual(a.chunks.map(c=>c.id),c.chunks.map(c=>c.id));a.reset();b.reset();assert.deepEqual(a.chunks.map(c=>c.id),b.chunks.map(c=>c.id));});
let pairs=0;
check('All 400 ordered module seams complete with regular inputs and active collisions',()=>{
 for(let a=0;a<20;a++)for(let b=0;b<20;b++){
  const {g}=game(1,[a,b]);while(g.state==='playing'&&g.t<16.01)g.update(.2);assert.equal(g.state,'playing',book.chunks[a].id+' -> '+book.chunks[b].id+' '+JSON.stringify(g.killer?.reason));
  assert.ok(Math.abs(g.player.x-135)<.01);assert.ok(Math.abs(g.player.vx)<.1);assert.equal(g.player.dim,'B');pairs++;
 }
});
check('All 8 lane/dimension entries have legal recovery taps before first hazard',()=>{
 for(const dim of ['B','R'])for(let lane=0;lane<4;lane++){
  const {g}=game(2,[19]);g.player.reset(lane,dim,0);g.autoplayQueue=[...entryTaps(lane,dim),...g.autoplayQueue].sort((a,b)=>a.t-b.t);
  while(g.state==='playing'&&g.t<8.01)g.update(1/30);assert.equal(g.state,'playing',lane+dim);assert.ok(Math.abs(g.player.x-135)<.01);assert.equal(g.player.dim,'B');
 }
});
const long=[];
for(const seed of [1,37,2026,0xffffffff])check('Seed '+seed+' long run: 256 transitions, bounded objects, no normal rewards',()=>{
 const {g,p}=game(seed);while(g.state==='playing'&&g.t<256*8+.01)g.update(.2);assert.equal(g.state,'playing',JSON.stringify(g.killer?.reason));assert.ok(g.endless.chunks.length<=5);assert.ok(g.endless.maxObjects<=140);assert.equal(g.recording,null);assert.equal(g.trace.length,0);assert.equal(p.summary().totalNormalAttempts,0);assert.equal(p.summary().goldMedals,0);assert.equal(p.summary().achievements,0);assert.equal(p.data.endless.attempts,1);assert.equal(p.data.endless.bestHeight,worldMeters(g.y));long.push({seed,seconds:g.t,meters:worldMeters(g.y),transitions:256,maxObjects:g.endless.maxObjects,chunks:g.endless.chunks.length});
});
check('5/30/60/144 FPS reproduce the same long-world state',()=>{let reference;for(const dt of [.2,1/30,1/60,1/144]){const {g}=game(73);while(g.state==='playing'&&g.t<96-1/480)g.update(Math.min(dt,96-g.t-g.acc+1e-10));assert.equal(g.state,'playing');const result=[g.t.toFixed(3),g.player.x.toFixed(5),g.player.dim,g.endless.chunks.map(c=>c.id).join(',')];if(reference)assert.deepEqual(result,reference);else reference=result;}});
check('Pause freezes exact trap states, restart repeats seed and restores world',()=>{const {g,p}=game(11);while(g.t<60)g.update(.2);g.pause();const states=g.traps.snapshot(),t=g.t;g.update(3);assert.equal(g.t,t);assert.deepEqual(g.traps.snapshot(),states);const best=p.data.endless.bestHeight;g.restart();assert.equal(g.t,0);assert.equal(g.player.dim,'B');assert.equal(g.player.lane,1);assert.equal(p.data.endless.attempts,2);assert.equal(p.data.endless.bestHeight,best);assert.ok(g.traps.traps.every(o=>o.state==='idle'));});
check('Difficulty is capped and meter thresholds use world coordinates',()=>{assert.deepEqual([0,2500,7500,15000,1e9].map(infinityTier),[0,1,2,3,3]);});
check('M8 v2 migration adds only optional Infinity data and preserves existing records',()=>{
 const storage=memory(),old={schemaVersion:2,profile:{activePlaytimeMs:1234},levels:{'first-pulse':{best:75,attempts:7,clears:0,deaths:3}},achievements:{},cosmetics:{selectedSkinId:'original',unlockedSkinIds:['original']}};
 storage.setItem(ASCENSION_KEY,JSON.stringify(old));const p=new Progression({storage});assert.equal(p.level('first-pulse').best,75);assert.equal(p.level('first-pulse').attempts,7);assert.equal(p.level('first-pulse').deaths,3);assert.equal(p.data.profile.activePlaytimeMs,1234);assert.equal(p.data.endless.bestHeight,0);
});
check('Infinity saves exact world meters, one attempt and monotonic record across retry/reload',()=>{
 const storage=memory(),p=new Progression({storage}),s=p.infinityStorage(37),r=s.beginRun();s.report(r,20,0,true);assert.equal(p.data.endless.bestHeight,520);assert.ok(p.data.endless.recordAt);s.finish(r,20,0,'death');s.finish(r,20,0,'death');assert.equal(p.data.endless.attempts,1);const next=s.beginRun();s.finish(next,2,0,'death');const reload=new Progression({storage});assert.equal(reload.data.endless.bestHeight,520);assert.equal(reload.data.endless.lastHeight,52);assert.equal(reload.data.endless.attempts,2);assert.equal(reload.data.endless.lastSeed,37);assert.equal(reload.summary().totalNormalAttempts,0);assert.equal(reload.summary().activePlaytimeMs,0);
});
check('Damaged primary Infinity save recovers shared backup without losing campaign evidence',()=>{
 const storage=memory(),p=new Progression({storage}),s=p.infinityStorage(10),r=s.beginRun();s.finish(r,10,0,'death');storage.setItem(BACKUP_KEY,JSON.stringify(p.data));storage.setItem(ASCENSION_KEY,'{bad');const reload=new Progression({storage});assert.equal(reload.data.endless.bestHeight,260);assert.equal(reload.data.endless.attempts,1);assert.ok(reload.warning);
});
check('Blocked storage keeps Infinity playable with explicit warning and no rewards',()=>{
 const p=new Progression({storage:{getItem:()=>null,setItem:()=>{throw Error('quota');}}}),s=p.infinityStorage(2),r=s.beginRun();s.finish(r,10,0,'death');assert.equal(p.data.endless.bestHeight,260);assert.ok(p.warning);assert.equal(p.summary().achievements,0);
});
check('Isolated Forge cannot earn an Infinity record even through the shared adapter',()=>{
 const p=new Progression({isolated:true}),s=p.infinityStorage(2),r=s.beginRun();s.finish(r,100,0,'death');assert.equal(p.data.endless.bestHeight,0);assert.equal(p.data.endless.attempts,0);
});
mkdirSync('test-results/expansion',{recursive:true});writeFileSync('test-results/expansion/infinity.json',JSON.stringify({checks,orderedPairs:pairs,seedTransitions:1024,long},null,2));console.log(`${checks} Infinity checks; ${pairs+1024} transitions simulated successfully`);
