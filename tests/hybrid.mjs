import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {HybridSimulation,CONTRACTS,exitMatches} from '../experiments/ground-flight/simulation.js';
import {HybridDirector,certifyChunk,certified,composeCourse,runChunk,chunkErrors,compatibleChunks} from '../experiments/ground-flight/director.js';
import {HYBRID_DEFAULTS,hybridConfig,jumpMetrics} from '../experiments/ground-flight/config.js';
import {HybridStats,STATS_KEY} from '../experiments/ground-flight/statistics.js';
import {headlessGame} from '../js/playcheck.js';
import {Player} from '../js/player.js';
import {validateChunkBook} from '../js/endless.js';
import {makeTrap,TRAP_DEFAULTS} from '../js/traps.js';
const root='experiments/ground-flight/data',book=JSON.parse(readFileSync(root+'/book.json')).chunks,course=JSON.parse(readFileSync(root+'/first-run.json')),track=composeCourse(book,course);
const report={groups:0,entries:0,pairs:0,timing:0,runs:[],fps:[]},test=(name,fn)=>{fn();report.groups++;console.log('PASS '+name);};
const blank=(mode='ground',objects=[])=>({id:'fixture',entry:mode,exit:mode,length:2000,objects});
const sim=(mode='ground',objects=[])=>new HybridSimulation({entry:mode,pieces:[{chunk:blank(mode,objects),offset:0}]});
const realCourse=fps=>{const s=new HybridSimulation({pieces:track.pieces,source:'automated'});for(const a of track.inputs)s.input(a.action,a.t);for(let i=0;i<fps*80&&s.state==='playing';i++)s.advance(1/fps);return s;};
test('Independent frozen config; exact public arena270 / target90 / hit radius8',()=>{
 const p=new Player('narrow');assert.equal(p.arena.width,270);p.impulse(1);p.update(2,0);assert.ok(Math.abs(p.x-225)<1e-8);assert.equal(p.hitRadius,8);
 const a=hybridConfig({speed:200});assert.equal(a.speed,200);assert.equal(hybridConfig().speed,180);assert.ok(Object.isFrozen(a));assert.throws(()=>hybridConfig({gravity:NaN}));assert.throws(()=>hybridConfig({jumpImpulse:480,maxUp:400}));
 const j=jumpMetrics(HYBRID_DEFAULTS);assert.ok(Math.abs(j.height-90)<1e-8);assert.ok(Math.abs(j.airtime-.8622448979591837)<1e-8);assert.ok(Math.abs(j.range-155.20408163265)<1e-5);
 const measured=sim();measured.input('motion');while(!measured.counts.landings)measured.advance(1/240);assert.ok(Math.abs(measured.t-j.airtime)<=1/240);assert.ok(Math.abs(measured.p.x-j.range)<=180/240);
});
test('Ground auto-run, jump, gravity, no air jump, landing and second jump',()=>{
 const s=sim();s.input('motion');s.advance(.2);assert.equal(s.counts.jumps,1);assert.ok(s.p.y>65);const vy=s.p.vy;s.input('motion');s.advance(.1);assert.equal(s.counts.jumps,1);assert.ok(s.p.vy<vy);assert.equal(s.counts.phases,0);assert.equal(s.rift.emitted,0);
 s.advance(.6);assert.equal(s.p.grounded,true);assert.equal(s.p.vy,0);assert.equal(s.p.y,8);s.input('motion');s.advance(.1);assert.equal(s.counts.jumps,2);assert.equal(s.counts.landings,1);assert.ok(Math.abs(s.p.x-180)<1e-8);
});
test('Flight resets upward speed, gravity, cooldown and bounded velocities',()=>{
 const s=sim('flight');s.input('motion');s.advance(.1);assert.equal(s.counts.flaps,1);assert.ok(s.p.vy>0);s.input('motion');s.advance(.0042);assert.ok(s.p.vy<=240);assert.equal(s.counts.flaps,2);assert.equal(s.counts.phases,0);s.advance(.55);assert.ok(s.p.vy<0);
 const fast=sim('flight');fast.p.y=280;fast.p.vy=-800;fast.advance(.05);assert.equal(fast.p.vy,-360);
 const rapid=sim('flight');for(const t of [0,.01,.02,.08])rapid.input('motion',t);rapid.advance(.1);assert.equal(rapid.counts.flaps,2);assert.ok(rapid.p.vy<=HYBRID_DEFAULTS.maxUp);
});
test('Motion and phase at same tick are independent, one switch and Pulse',()=>{
 const s=sim();s.input('motion');s.input('phase');s.input('phase');s.advance(.01);assert.equal(s.counts.jumps,1);assert.equal(s.counts.phases,1);assert.equal(s.counts.pulses,1);assert.equal(s.rift.emitted,1);assert.equal(s.p.dim,'R');s.advance(.2);assert.equal(s.counts.jumps,1);
});
test('Exact rectangle sweep, neutral/active deadly and inactive visible data',()=>{
 const o={id:'wall',type:'rect',x:100,y:0,w:20,h:120,dimension:'neutral'};
 for(const dimension of ['neutral','blue','red']){const s=sim('ground',[{...o,dimension}]);s.advance(1);assert.equal(s.state,dimension==='red'?'playing':'dead');if(dimension!=='red')assert.equal(s.death.id,'0:wall');}
 const s=sim('ground',[{...o,dimension:'red'}]);s.input('phase',.4);s.advance(1);assert.equal(s.state,'dead');
});
test('Phase works while airborne; seal opening and saw destruction use shared Rift/TrapField',()=>{
 const s=runChunk(book.find(c=>c.id==='G05'));assert.equal(s.state,'complete');assert.equal(s.rift.seals[0].color,'S');assert.ok(s.events.some(e=>e.kind==='seal'));assert.ok(s.events.some(e=>e.kind==='saw-break'));assert.equal(s.traps.traps[0].state,'destroyed');
 const a=runChunk(book.find(c=>c.id==='G06'));assert.ok(a.events.some(e=>e.kind==='phase'&&e.y>8));assert.ok(a.events.some(e=>e.kind==='laser-disable'));
});
test('Pulse affects only matching trap dimension; mine and laser deactivate once',()=>{
 for(const type of ['saw','mine','laser'])for(const dimension of ['blue','red']){
 const o={...TRAP_DEFAULTS[type],id:type,type,x:45,y:20,dimension,axis:'none',amplitude:0,pulseBreakable:true};const s=sim('ground');s.traps.traps=[makeTrap(o)];s.input('phase');s.advance(.15);
 assert.equal(s.counts.interactions,dimension==='red'?1:0);assert.equal(s.rift.emitted,1);
 }
});
test('Mine warning/burst and laser capsule collision end a genuine run',()=>{
 const mine={...TRAP_DEFAULTS.mine,id:'mine',type:'mine',x:110,y:8,dimension:'blue',activationRadius:190,blastRadius:130,chargeSec:.5};
 const s=sim('ground',[mine]);s.advance(2);assert.equal(s.state,'dead');assert.equal(s.death.type,'mine');assert.ok(s.events.some(e=>e.kind==='mine-warn'));assert.ok(s.events.some(e=>e.kind==='mine-blast'));
 const laser=runChunk(book.find(c=>c.id==='G03'),{inputs:[]});assert.equal(laser.state,'dead');assert.equal(laser.death.type,'laser');
});
test('Portals only transform, keep dimension and pulse count; return has safe landing',()=>{
 const s=sim('ground',[{id:'up',type:'portal',x:180,y:0,target:'flight'},{id:'down',type:'portal',x:360,y:0,target:'ground'}]);s.input('phase',.2);s.advance(2.6);assert.equal(s.state,'playing');assert.equal(s.p.mode,'ground');assert.ok(s.p.grounded);assert.equal(s.counts.portals,2);assert.equal(s.counts.phases,1);assert.equal(s.rift.emitted,1);
 s.advance(.2);assert.equal(s.counts.portals,2);
});
test('Flight floor / ceiling have explicit death causes and stable radius',()=>{
 const floor=sim('flight');floor.advance(1);assert.equal(floor.death.type,'floor');assert.equal(floor.p.hitRadius,8);
 const ceiling=sim('flight');ceiling.p.y=291;ceiling.p.vy=400;ceiling.advance(.02);assert.equal(ceiling.death.type,'ceiling');
});
test('Double Laser Hop: two regular jumps, landing in between; omitting either is fatal',()=>{
 const c=book.find(c=>c.id==='G03'),s=runChunk(c);assert.equal(s.state,'complete');assert.equal(c.objects.filter(o=>o.type==='rect').length,0);assert.equal(s.counts.jumps,2);
 const j=s.events.filter(e=>e.kind==='jump'),land=s.events.find(e=>e.kind==='land');assert.ok(j[0].t<land.t&&land.t<j[1].t);assert.ok(j[1].t-land.t>.5);
 for(let i=0;i<2;i++){const a=runChunk(c,{inputs:c.replay.inputs.filter((_,k)=>i!==k)});assert.equal(a.state,'dead');assert.equal(a.death.type,'laser');}
});
test('All 14 data chunks have real entry/exit certificates; invalid/stale chunks excluded',()=>{
 assert.equal(book.length,14);for(const c of book){assert.deepEqual(chunkErrors(c),[]);assert.ok(certified(c),c.id);const proof=certifyChunk(c);assert.equal(proof.status,'VERIFIED',c.id);report.entries+=proof.fixtures.length;}
 const bad=structuredClone(book[0]);bad.objects[0].x++;assert.equal(certified(bad),false);bad.objects[0].w=-4;assert.ok(chunkErrors(bad).length);assert.equal(certifyChunk(bad).status,'INVALID');
 const wrongEntry=structuredClone(book.find(c=>c.id==='F01'));wrongEntry.validation.fixtures=wrongEntry.validation.fixtures.map(e=>({...e,y:e.y+25}));assert.equal(compatibleChunks(book.find(c=>c.id==='M01'),wrongEntry),false);
 assert.throws(()=>new HybridDirector(book.map(c=>({...c,validation:{status:'UNVERIFIED'}}))));assert.throws(()=>new HybridDirector(book,{config:hybridConfig({speed:190})}));
});
test('Individual input timing ±20ms still survives, not a claim of arbitrary trajectories',()=>{
 for(const c of book)for(let i=0;i<c.replay.inputs.length;i++)for(const delta of [-.02,.02]){
 const inputs=c.replay.inputs.map((a,k)=>({...a,t:Math.max(0,a.t+(i===k?delta:0))})).sort((a,b)=>a.t-b.t),s=runChunk(c,{inputs});assert.equal(s.state,'complete',c.id+' input'+i+' '+delta+' '+JSON.stringify(s.death));report.timing++;
 }
});
test('Every compatible ordered chunk pair survives with no reset or teleport at seam',()=>{
 for(const a of book)for(const b of book)if(a.exit===b.entry){
 assert.ok(compatibleChunks(a,b),a.id+'→'+b.id);
 const s=new HybridSimulation({entry:a.entry,pieces:[{chunk:a,offset:0,index:0},{chunk:b,offset:a.length,index:1}],source:'automated'});
 for(const e of a.replay.inputs)s.input(e.action,e.t);for(const e of b.replay.inputs)s.input(e.action,e.t+a.length/180);s.advance((a.length+b.length)/180+1);assert.equal(s.state,'complete',a.id+'→'+b.id+' '+JSON.stringify(s.death));assert.ok(exitMatches(s.p,b.exit));report.pairs++;
 }
});
test('Full First Run completes in80s; all nine gameplay objectives and four portals',()=>{
 const s=realCourse(60);assert.equal(s.state,'complete',JSON.stringify(s.death));assert.equal(s.t,80);assert.equal(s.p.x,14400);assert.equal(s.counts.portals,4);assert.equal(s.counts.phases,10);assert.equal(s.counts.pulses,10);assert.equal(s.counts.jumps,11);assert.equal(s.counts.flaps,32);assert.equal(s.counts.interactions,6);report.firstRun=s.summary();
 const no=new HybridSimulation({pieces:track.pieces});no.advance(80);assert.equal(no.state,'dead');
});
test('30 /60 /120 rendering FPS give identical actual simulation',()=>{
 let expected;for(const fps of [30,60,120]){const s=realCourse(fps),state={p:s.p,t:s.t,counts:s.counts,state:s.state};assert.equal(s.state,'complete');if(expected)assert.deepEqual(state,expected);else expected=state;report.fps.push({fps,state:s.state,duration:s.t,distance:s.p.x});}
});
test('Pause freezes timers, discards pending input; restart is a clean new run',()=>{
 const s=sim();s.input('motion',.1);s.pause();s.advance(3);assert.equal(s.t,0);s.resume();s.advance(.2);assert.equal(s.counts.jumps,0);s.input('phase');s.advance(.1);assert.equal(s.rift.emitted,1);const fresh=sim();assert.equal(fresh.rift.emitted,0);assert.equal(fresh.p.dim,'B');assert.equal(fresh.t,0);
});
function endless(seed,seconds){
 const s=new HybridSimulation({endless:true,source:'automated'}),d=new HybridDirector(book,{seed}),milestones=[];let queued=-1,maxChunks=0,maxObjects=0;
 while(s.t<seconds-1e-8&&s.state==='playing'){
 d.ensure(s);for(const p of s.pieces)if(p.index>queued){const c=book.find(c=>c.id===p.id);for(const e of c.replay.inputs)s.input(e.action,e.t+p.offset/180);queued=p.index;}
 maxChunks=Math.max(maxChunks,s.pieces.length);maxObjects=Math.max(maxObjects,s.objects.length+s.traps.traps.length+s.portals.length);s.advance(Math.min(.1,seconds-s.t));
 const target=[500,1000,2500,5000][milestones.length];if(s.p.x*.1>=target)milestones.push({target,t:s.t,distance:s.p.x*.1,state:s.state});
 }return {s,d,maxChunks,maxObjects,milestones};
}
test('Seeded generator deterministic, compatible modes, recovery and bounded history',()=>{
 for(const seed of [0,1,37,991,0xffffffff]){const a=new HybridDirector(book,{seed}),b=new HybridDirector(book,{seed});let previous='ground';for(let i=0;i<1000;i++){const x=a.next(),y=b.next();assert.equal(x.chunk.id,y.chunk.id);assert.equal(x.chunk.entry,previous);assert.ok(certified(x.chunk));if(i%4===3)assert.ok(x.chunk.difficulty<=1);previous=x.chunk.exit;if(a.sequence.length>16)a.sequence.splice(0,a.sequence.length-16);if(b.sequence.length>16)b.sequence.splice(0,b.sequence.length-16);}}
});
test('Actual Hybrid Endless input replays500/1000/2500/5000m, three seeds; culling bounded',()=>{
 for(const seed of [1,37,991]){const r=endless(seed,5000/18+1);assert.equal(r.s.state,'playing',JSON.stringify(r.s.death));assert.ok(r.s.p.x*.1>=5000);assert.ok(r.maxChunks<=6,r.maxChunks);assert.ok(r.maxObjects<35,r.maxObjects);assert.ok(r.d.sequence.length<=16);assert.equal(r.milestones.length,4);report.runs.push({seed,...r.s.summary(),maxChunks:r.maxChunks,maxObjects:r.maxObjects,generated:r.d.generated,milestones:r.milestones});}
});
test('Local stats idempotent, isolated namespace, durable reload, ratings and corrupt/blocked storage',()=>{
 const m=new Map([['public-save','unchanged']]),store={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v)},s=new HybridStats(store),r={id:'test',kind:'course',duration:10,distance:180,parameters:{speed:180},source:'interactive',outcome:'death',death:{type:'rect'},completed:false};
 assert.equal(s.add(r),true);assert.equal(s.add(r),false);assert.ok(s.rate('test',{control:4,fun:4,fairness:3,retry:5}));const loaded=new HybridStats(store);assert.equal(loaded.summary('course').runs,1);assert.equal(loaded.summary('course').ratings.control,4);assert.equal(m.get('public-save'),'unchanged');assert.equal(m.size,2);assert.ok(m.has(STATS_KEY));
 s.add({...r,id:'automated',source:'automated'});assert.equal(s.summary('course').runs,1);assert.equal(s.rate('automated',{control:5,fun:5,fairness:5,retry:5}),false);
 const broken=new HybridStats({getItem(){return '{';},setItem(){throw Error();}});assert.ok(broken.warning);broken.add(r);assert.equal(broken.data.runs.length,1);assert.ok(broken.warning);
});
test('Original public Infinity Game still has270/90 and unchanged real input/pulse rules',()=>{
 const b=validateChunkBook(JSON.parse(readFileSync('assets/endless/director.json'))),g=headlessGame(b.chunks[0].level);g.startEndless(b,37,g.storage);assert.equal(g.arena.width,270);for(let i=0;i<60;i++)g.update(1/60);const before=g.rift.emitted;g.press(1);assert.equal(g.player.dim,'R');assert.equal(g.rift.emitted,before+1);assert.equal(g.arena.step,90);
});
mkdirSync('test-results/m84',{recursive:true});writeFileSync('test-results/m84/simulation.json',JSON.stringify(report,null,2));console.log(report.groups+' Hybrid groups passed',JSON.stringify({entries:report.entries,pairs:report.pairs,timing:report.timing}));
