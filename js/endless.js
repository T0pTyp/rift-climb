import {buildLevelRuntime,validateLevelData} from './level-data.js';
import {makeTrap} from './traps.js';
import {CLIMB_SPEED,MIN_PRESS_INTERVAL_MS,START_GRACE_MS,SIM_DT,STEER_OMEGA,HIT_RADIUS,PULSE_RADIUS,PULSE_GROW_SEC} from './config.js';
import {RiftDirector,CATEGORIES,validContract,compatible,chunkFingerprint,directorTier} from './rift-director.js';
import {infinityClimbTime,infinitySpaceScale} from './world-units.js';
import {INFINITY_BALANCE} from './infinity-balance.js';
export {METERS_PER_UNIT,worldMeters,infinityClimbY,infinityClimbSpeed,infinityClimbTime,infinitySpaceScale,INFINITY_SPEED_MARK_M,INFINITY_SPEED_RAMP_M} from './world-units.js';
export const INFINITY_TIERS=['EINFACH','MITTEL','SCHWER','SEHR SCHWER'];
export const INFINITY_MIN_SEAM_SEC=2;
// Bound empty space inside a phrase; release pacing lives in infinity-balance.js.
// Entry and exit clearances remain part of the certified seam.
export const INFINITY_MAX_HAZARD_GAP_SEC=INFINITY_BALANCE.maxHazardGapSec;
export const INFINITY_MAX_HAZARD_GAP=CLIMB_SPEED*INFINITY_MAX_HAZARD_GAP_SEC;
export const infinityTier=y=>y*.1<250?0:y*.1<750?1:y*.1<1500?2:3;
/** Prepared rapid actions are distinct from time to read the next challenge. */
/** Largest climb between hazard rows inside the module, excluding the seam clearances. */
export function hazardRowGap(level) {
 const rows=[];
 for(const o of level.objects||[]){
  if(o.type==='hint')continue;
  const row=rows.find(r=>Math.abs(r-o.y)<12);
  if(row===undefined)rows.push(o.y);
 }
 rows.sort((a,b)=>a-b);
 const start=level.chunk.entry.clearSec*CLIMB_SPEED,end=level.finish.y-level.chunk.exit.clearSec*CLIMB_SPEED;
 const marks=[start,...rows.filter(y=>y>=start-1&&y<=end+1),end];
 let max=0;
 for(let i=1;i<marks.length;i++)max=Math.max(max,marks[i]-marks[i-1]);
 return {max,rows:rows.length,start,end};
}
export function chunkFlow(chunk) {
 const taps=chunk.level.replay.taps;let minGap=Infinity,burst=1,maxBurst=1;
 for(let i=1;i<taps.length;i++){
  const gap=taps[i].t-taps[i-1].t;minGap=Math.min(minGap,gap);
  burst=gap<.3?burst+1:1;maxBurst=Math.max(maxBurst,burst);
 }
 return {firstTap:taps[0].t,lastTap:taps.at(-1).t,minGap,maxBurst,tailRest:chunk.length/CLIMB_SPEED-taps.at(-1).t};
}
export function validateChunkBook(raw) {
 if(raw?.version===2)return validateDirectorBook(raw);
 if(raw?.schema!=='rift-infinity-chunks'||raw.version!==1||!Array.isArray(raw.chunks)||raw.chunks.length<20)throw Error('Infinity-Modulbuch ungültig');
 const ids=new Set();
 if(raw.metersPerUnit!==.1)throw Error('Infinity: ungültiger Höhenmaßstab');
 for(const c of raw.chunks){const v=validateLevelData(c.level),taps=c.level?.replay?.taps,duration=c.length/CLIMB_SPEED;
  if(!v.ok||typeof c.id!=='string'||!c.id||c.level.id!==c.id||ids.has(c.id)||!Number.isInteger(c.tier)||c.tier<0||c.tier>3||c.length!==2080||c.level.finish.y!==c.length||c.entry?.lane!==1||c.exit?.lane!==1||c.entry?.dimension!=='blue'||c.exit?.dimension!=='blue'||c.level.start?.lane!==1||c.level.start?.dimension!=='blue'||c.entry.clearSec<2||c.exit.settleSec<1||!Number.isFinite(c.entry.clearSec)||!Number.isFinite(c.exit.settleSec)||!Array.isArray(taps)||!taps.length||taps.some((p,i)=>!Number.isFinite(p.t)||![1,-1].includes(p.dir)||p.t<START_GRACE_MS/1000||p.t>duration-c.exit.settleSec+1e-8||(i&&p.t-taps[i-1].t<MIN_PRESS_INTERVAL_MS/1000-1e-8)))throw Error('Ungültiger Chunk / Übergangsvertrag: '+c.id);
  if(c.level.objects.some(o=>o.type!=='hint'&&o.y-(o.h||0)/2<c.entry.clearSec*CLIMB_SPEED))throw Error('Infinity: Eintrittsruhe fehlt: '+c.id);
  let lane=1,blue=true;for(const p of taps){lane=Math.max(0,Math.min(3,lane+p.dir));blue=!blue;}
  if(lane!==c.exit.lane||!blue)throw Error('Infinity: Replay verletzt Ausgangszustand: '+c.id);
  ids.add(c.id);
 }
 // Excluding two recent IDs must always leave at least one eligible candidate.
 if([0,1,2,3].some(tier=>raw.chunks.filter(c=>c.tier===tier).length<3))throw Error('Infinity braucht mindestens drei Module pro Schwierigkeitsbereich');
 const flows=raw.chunks.map(chunkFlow);
 for(let a=0;a<raw.chunks.length;a++)for(let b=0;b<raw.chunks.length;b++){
  if(raw.chunks[a].exit.lane!==raw.chunks[b].entry.lane||raw.chunks[a].exit.dimension!==raw.chunks[b].entry.dimension||flows[a].tailRest+flows[b].firstTap<INFINITY_MIN_SEAM_SEC-1e-8)throw Error('Infinity: zu wenig kontrollierbare Ruhe am Übergang '+raw.chunks[a].id+' → '+raw.chunks[b].id);
 }
 return raw;
}
function validateDirectorBook(raw) {
 if(raw.schema!=='rift-infinity-chunks'||raw.arenaStyle!=='narrow'||raw.metersPerUnit!==.1||!Array.isArray(raw.chunks)||raw.chunks.length<15)throw Error('RIFT DIRECTOR: ungültiges Modulbuch');
 if(raw.balance==='infinity-first'&&raw.chunks.filter(c=>c.level?.chunk?.opening).length!==1)throw Error('RIFT DIRECTOR: genau eine Eröffnung erforderlich');
 const ids=new Set();
 for(const c of raw.chunks){const l=c.level,m=l?.chunk,v=validateLevelData(l);
  if(!v.ok||!m||c.id!==l.id||ids.has(c.id)||l.arenaStyle!=='narrow'||c.length!==l.finish.y||c.length<180||c.length>2080||!CATEGORIES.includes(m.category)||!Number.isInteger(m.tier)||m.tier<0||m.tier>6||!validContract(m.entry)||!validContract(m.exit,true)||!Array.isArray(l.replay?.taps)||m.actions!==l.replay.taps.length||m.validation?.status!=='verified'||m.validation.hash!==chunkFingerprint(l)||m.validation.physics!=='spring-240-v1')throw Error('RIFT DIRECTOR: ungültiges / veraltetes Zertifikat '+c.id);
  const taps=l.replay.taps;if(taps.some((p,i)=>![1,-1].includes(p.dir)||!Number.isFinite(p.t)||p.t<.2||p.t>c.length/CLIMB_SPEED-m.exit.clearSec+1e-8||(i&&p.t-taps[i-1].t<.045-1e-8)))throw Error('RIFT DIRECTOR: Eingaben '+c.id);
  const config=m.validation.proof?.config,expected={simDt:SIM_DT,climbSpeed:CLIMB_SPEED,steerOmega:STEER_OMEGA,hitRadius:HIT_RADIUS,pulseRadius:PULSE_RADIUS,pulseGrowSec:PULSE_GROW_SEC,arenaWidth:270,arenaStep:90};
  if(!config||Object.keys(expected).some(k=>config[k]!==expected[k]))throw Error('RIFT DIRECTOR: Physik-Zertifikat veraltet '+c.id);
  const gap=hazardRowGap(l);
  if(gap.max>INFINITY_MAX_HAZARD_GAP+1e-6)throw Error('RIFT DIRECTOR: Lücke '+gap.max.toFixed(1)+' u übersteigt '+INFINITY_MAX_HAZARD_GAP+' u in '+c.id);
  ids.add(c.id);
 }
 const categories=raw.balance==='infinity-first'?CATEGORIES.slice(0,7):CATEGORIES.slice(7);
 if(categories.some(k=>raw.chunks.filter(c=>c.level.chunk.category===k).length<4))throw Error('RIFT DIRECTOR: Kategorien unvollständig');
 for(const a of raw.chunks)if(!raw.chunks.some(b=>b.id!==a.id&&!b.level.chunk.opening&&compatible(a.level.chunk.exit,b.level.chunk.entry)))throw Error('RIFT DIRECTOR: kein farbiger Anschluss für '+a.id);
 return raw;
}
/** Seeded selection of proven modules. No geometry depends on rendering/audio. */
export class EndlessWorld {
 constructor(book,seed,order=null){
  this.book=validateChunkBook(book);this.order=order;this.seed=seed>>>0;
  this.director=book.version===2?new RiftDirector(book,()=>this.random()):null;
  if(order&&(!order.length||order.some(i=>!Number.isInteger(i)||!book.chunks[i])))throw Error('Infinity: ungültige Testreihenfolge');
  this.pools=[0,1,2,3].map(tier=>book.chunks.filter(c=>c.tier===tier).map(source=>{
   const types=new Set(source.level.objects.map(o=>o.type)),family=types.has('mine')&&types.has('saw')?'mixed':types.has('laser')?'laser':types.has('seal')?'pulse':types.has('saw')?'saw':'precision';
   return {source,family,actions:source.level.replay.taps.length,burst:chunkFlow(source).maxBurst};
  }));this.reset();
 }
 reset(){this.rng=this.seed||0x6d2b79f5;this.director?.reset();this.chunks=[];this.history=[];this.nextIndex=0;this.nextY=0;this.generated=0;this.maxObjects=0;this.ensure(0);}
 random(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x>>>0;return this.rng/4294967296;}
 select(tier) {
  const pool=this.pools[tier],last=this.history.at(-1),recent=this.history.slice(-2);
  let total=0;const weights=pool.map(c=>{
   if(recent.some(h=>h.id===c.source.id))return 0;
   const frequency=this.history.filter(h=>h.id===c.source.id).length;
   const family = last?.family === c.family ? .65 : 1;
   const recovery=last&&last.actions>c.actions?1.35:1;
   const phaseRecovery=last?.burst>=5?(c.burst<last.burst?1.4:.7):1;
   const weight=family*recovery*phaseRecovery/(1+frequency*2);total+=weight;return weight;
  });
  let roll=this.random()*total,chosen=pool[pool.length-1];
  for(let i=0;i<pool.length;i++){roll-=weights[i];if(roll<0){chosen=pool[i];break;}}
  this.history.push({id:chosen.source.id,family:chosen.family,actions:chosen.actions,burst:chosen.burst});if(this.history.length>8)this.history.shift();
  return chosen.source;
 }
 ensure(y) {
  let changed=false;
  while(this.nextY<y+4680) {
   const tier=this.director?directorTier(this.nextY):infinityTier(this.nextY);
   const source=this.order?this.book.chunks[this.order[this.nextIndex%this.order.length]]:this.director?this.director.select(this.nextY):this.select(tier);
   const index=this.nextIndex++,origin=this.nextY,scale=this.director?infinitySpaceScale(origin):1,span=source.length*scale,t0=this.director?infinityClimbTime(origin):origin/260,prefix=`c${index}-`;
   const level={...source.level,objects:source.level.objects.map(o=>({...o,id:prefix+o.id,y:o.y*scale+origin})),finish:{y:origin+span},height:origin+span+260};
   const rt=buildLevelRuntime(level);rt.traps=rt.traps.map(o=>makeTrap(o,t0));
   this.chunks.push({index,id:source.id,tier:source.level.chunk?.tier??tier,category:source.level.chunk?.category,stage:source.level.chunk?.stage,opening:source.level.chunk?.opening,challenge:source.level.chunk?.challenge,validation:source.level.chunk?.validation,origin,end:origin+span,t0,rt,taps:source.level.replay.taps.map(t=>({t:t.t+t0,dir:t.dir}))});
   this.nextY+=span;this.generated++;changed=true;
  }
  while(this.chunks.length&&this.chunks[0].end<y-520){this.chunks.shift();changed=true;}
  return changed;
 }
 apply(game) {
  const chunks=this.chunks,rt=game.level;
  const names={SLIT:'SCHLITZ',PAIR:'FARBPAAR',LASER:'DREHLASER',MILL:'WINDMÜHLE',COMBO:'KOMBI'};
  rt.obstacles=chunks.flatMap(c=>c.rt.obstacles);rt.seals=chunks.flatMap(c=>c.rt.seals);rt.hints=this.book.balance==='infinity-first'?[]:chunks.map(c=>[c.origin+40,this.director?(c.opening?'ANFANG':names[c.category]||c.category):'RUHEZONE · SPUR 2 / BLAU']);rt.traps=chunks.flatMap(c=>c.rt.traps);
  game.obstacles=rt.obstacles;game.seals=rt.seals;game.traps.traps=rt.traps;game.rift.seals=rt.seals;game.rift.maxHh=20;game.obsLo=0;
  rt.maxChh=6;rt.maxHh=8;game.collideRange=16;
  this.maxObjects=Math.max(this.maxObjects,rt.obstacles.length+rt.traps.length);
  if(game.audio.timeline)game.audio.timeline.accents=new Set(rt.seals.map(s=>Math.round(s.y/260/game.audio.timeline.stepSec)));
  if(game.audio.timeline&&this.director)game.audio.timeline.director=chunks.map(c=>({start:c.t0,end:infinityClimbTime(c.end),tier:c.tier,category:c.category,challenge:c.challenge}));
 }
 tapsAfter(t,last=-Infinity){return this.chunks.flatMap(c=>c.taps).filter(p=>p.t>=t-1/480&&p.t>last+1e-8);}
 tierAt(y){return this.director?directorTier(y):infinityTier(y);}
}
/** Optional entry recovery uses ordinary wall taps, never hidden input correction. */
export function entryTaps(lane,dim) {
 const taps=[];let time=.25;
 for(let i=0;i<lane;i++){taps.push({t:time,dir:-1});time+=.18;dim=dim==='B'?'R':'B';}
 if(dim==='B'){taps.push({t:time,dir:-1});time+=.18;}
 taps.push({t:time,dir:1});return taps;
}
