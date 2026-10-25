import assert from 'node:assert/strict';
import { Progression, ASCENSION_KEY, BACKUP_KEY } from '../js/progression.js';
import { ACHIEVEMENTS, SKINS } from '../js/rewards.js';
import { Game } from '../js/game.js';
import { loadLevel } from './lib/levels.mjs';
const memory=()=>{const m=new Map();return {get length(){return m.size;},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)};};
let checks=0;const check=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
const s=memory(),now=()=> '2026-10-25T12:00:00.000Z',p=new Progression({storage:s,now});
check('Original available, locked skin cannot equip',()=>{assert.deepEqual(p.data.cosmetics.unlockedSkinIds,['original']);assert.equal(p.equip('void'),false);});
const r=p.begin('first-pulse',true);
check('Actual normal start counted once and First Flight awarded',()=>{assert.equal(p.summary().totalNormalAttempts,1);assert.ok(p.data.achievements['first-flight']);});
check('Bronze at exactly 50%, no early medal',()=>{p.report(r,10,49);assert.equal(p.level(r.id).medal,'none');p.report(r,20,50);assert.equal(p.level(r.id).medal,'bronze');});
check('Silver at 75%; record and medal never decrease',()=>{p.report(r,30,75);p.report(r,31,20);assert.equal(p.level(r.id).medal,'silver');assert.equal(p.level(r.id).best,75);});
check('A report of 100 is not a completion; actual win awards Gold',()=>{p.report(r,39.9,100);assert.equal(p.level(r.id).medal,'silver');p.finish(r,40,100,'win');assert.equal(p.level(r.id).medal,'gold');assert.equal(p.level(r.id).best,100);});
check('Repeated completion/death/report cannot duplicate counters or rewards',()=>{const n=p.queue.length;p.finish(r,40,100,'win');p.finish(r,40,100,'death');p.report(r,80,100);assert.equal(p.level(r.id).clears,1);assert.equal(p.level(r.id).deaths,0);assert.equal(p.queue.length,n);assert.equal(p.summary().activePlaytimeMs,40000);});
check('Victory grants First Victory/Pulse Master/Azure; timestamp captured',()=>{for(const id of ['first-victory','pulse-master'])assert.ok(p.data.achievements[id]);assert.ok(p.data.cosmetics.unlockedSkinIds.includes('azure'));assert.equal(p.level(r.id).firstCompletedAt,now());});
check('Selected skin survives reload',()=>{assert.ok(p.equip('azure'));const q=new Progression({storage:s,now});assert.equal(q.data.cosmetics.selectedSkinId,'azure');assert.equal(q.queue.length,0);});
check('Practice is isolated from all normal statistics/rewards',()=>{p.level('overload');const before=JSON.stringify(p.data),q=p.begin('overload',false);p.report(q,60,99);p.finish(q,70,100,'win');assert.equal(JSON.stringify(p.data),before);});
check('Death exactly once; retry is another attempt',()=>{const q=p.begin('first-pulse',true);p.finish(q,2,5,'death');p.finish(q,2,5,'death');assert.equal(p.level(q.id).deaths,1);p.begin('first-pulse',true);assert.equal(p.level(q.id).attempts,3);});
for(const id of ['fractured-rhythm','overload']){const q=p.begin(id,true);p.finish(q,id==='overload'?66.6667:56.25,100,'win');}
check('All level achievements and all five skins earned exactly once',()=>{assert.equal(p.summary().goldMedals,3);assert.ok(p.data.achievements['golden-ascent']);assert.equal(p.summary().skins,5);});
while(p.summary().totalNormalAttempts<25)p.begin('first-pulse',true);
check('Persistent Climber at 25 normal attempts',()=>{assert.ok(p.data.achievements['persistent-climber']);assert.equal(p.summary().achievements,8);});
check('Migration preserves M7 progress, reconciles rewards without invented dates/deaths/time',()=>{const m=memory();m.setItem('riftclimb.pulse.v1.first-pulse',JSON.stringify({stats:{best:100,attempts:17,clears:2},gfx:'low'}));const q=new Progression({storage:m,now});assert.equal(q.level('first-pulse').attempts,17);assert.equal(q.level('first-pulse').deaths,0);assert.equal(q.summary().activePlaytimeMs,0);assert.equal(q.level('first-pulse').firstCompletedAt,null);assert.equal(q.data.achievements['pulse-master'].unlockedAt,null);assert.equal(q.summary().historyIncomplete,true);assert.equal(q.queue.length,0);assert.ok(q.data.cosmetics.unlockedSkinIds.includes('azure'));assert.equal(new Progression({storage:m}).summary().totalNormalAttempts,17);});
check('Corrupt primary restores backup; corrupt fields preserve valid backup progress',()=>{s.setItem(ASCENSION_KEY,'{broken');let q=new Progression({storage:s});assert.equal(q.summary().goldMedals,3);assert.ok(q.warning);const raw=JSON.parse(s.getItem(ASCENSION_KEY));raw.levels['first-pulse'].best='broken';raw.levels['first-pulse'].clears=-3;raw.levels['first-pulse'].completed=false;s.setItem(ASCENSION_KEY,JSON.stringify(raw));q=new Progression({storage:s});assert.equal(q.level('first-pulse').best,100);assert.equal(q.level('first-pulse').clears,1);});
check('Missing storage and thrown writes keep a usable session with a warning',()=>{const q=new Progression({storage:{getItem(){throw Error();},setItem(){throw Error();}}});const a=q.begin('first-pulse',true);q.finish(a,40,100,'win');assert.equal(q.level(a.id).best,100);assert.equal(q.durable,false);assert.ok(q.warning);});
check('Forge isolation does not read/migrate/write normal saves',()=>{const before=s.getItem(ASCENSION_KEY),q=new Progression({storage:s,isolated:true}),a=q.begin('overload',true);q.finish(a,67,100,'win');q.equip('original');assert.equal(s.getItem(ASCENSION_KEY),before);assert.equal(q.summary().totalNormalAttempts,0);assert.equal(q.summary().achievements,0);});
check('Future schema stays untouched',()=>{const m=memory();m.setItem(ASCENSION_KEY,'{"schemaVersion":9,"future":true}');const q=new Progression({storage:m});q.begin('first-pulse',true);assert.equal(m.getItem(ASCENSION_KEY),'{"schemaVersion":9,"future":true}');assert.ok(q.readOnly);});
check('Catalog contains only eight achievements and five skins',()=>{assert.equal(ACHIEVEMENTS.length,8);assert.equal(SKINS.length,5);});
const noop=()=>{};
const makeGame=(id,progression,skin='original')=>{
 const g=new Game({canvas:{getContext:()=>null},ui:{show:noop,showDeath:noop,showWin:noop,toast:noop,updateMenu:noop,updateHud:noop},audio:{setLevel:noop,seek:noop,update:noop,sfx:noop,stop:noop,suspend:noop},input:{guard:noop},storage:progression.storageFor(id),debug:{autoplay:true,trace:true},level:loadLevel(id)});g.skinId=skin;return g;
};
for(const id of ['first-pulse','fractured-rhythm','overload']) {
 check(id+' five skins produce identical complete gameplay traces and normal stats',()=>{
  let trace;
  for(const skin of SKINS){const q=new Progression({storage:memory()}),g=makeGame(id,q,skin.id);g.start('normal');while(g.state==='playing')g.update(1/60);
   assert.equal(g.state,'won');assert.equal(q.level(id).best,100);assert.equal(q.level(id).attempts,1);assert.equal(q.level(id).clears,1);assert.equal(q.level(id).deaths,0);
   assert.ok(Math.abs(q.summary().activePlaytimeMs-g.t*1000)<1.01);if(trace)assert.deepEqual(g.trace,trace);else trace=g.trace;
  }
 });
}
check('Actual Game: Practice, pause, immediate Retry and duplicate death are isolated/idempotent',()=>{
 const q=new Progression({storage:memory()}),g=makeGame('first-pulse',q);g.start('normal');g.update(.1);g.pause();const time=q.summary().activePlaytimeMs;g.update(20);assert.equal(q.summary().activePlaytimeMs,time);
 g.start('practice');const saved=JSON.stringify(q.data);while(g.state==='playing')g.update(1/60);assert.equal(g.state,'won');assert.equal(JSON.stringify(q.data),saved);
 g.debug.autoplay=false;g.start('normal');while(g.state==='playing')g.update(1/60);const killer=g.killer.o;g.die(killer);assert.equal(q.level('first-pulse').deaths,1);g.restart();assert.equal(q.level('first-pulse').attempts,3);
});
check('Actual Forge Game win never changes its saved normal profile',()=>{
 const storage=memory(),q=new Progression({storage,isolated:true}),g=makeGame('first-pulse',q);g.start('normal');while(g.state==='playing')g.update(1/60);assert.equal(g.state,'won');assert.equal(q.summary().totalNormalAttempts,0);assert.equal(q.summary().totalCompletions,0);assert.equal(storage.length,0);
});
check('Legacy replay adapter cannot carry Practice progress into a new Normal run',()=>{
 const g=makeGame('first-pulse',new Progression({storage:memory()}));g.storage={stats:{best:0,attempts:0,clears:0},save:noop};g.start('practice');for(let i=0;i<300;i++)g.update(1/60);g.start('normal');assert.equal(g.storage.stats.best,0);assert.equal(g.storage.stats.attempts,1);
});
console.log(`${checks} progression checks passed`);
