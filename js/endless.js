import {buildLevelRuntime,validateLevelData} from './level-data.js';
import {makeTrap} from './traps.js';
import {CLIMB_SPEED,MIN_PRESS_INTERVAL_MS,START_GRACE_MS} from './config.js';
export {METERS_PER_UNIT,worldMeters} from './world-units.js';
export const INFINITY_TIERS=['EINFACH','MITTEL','SCHWER','SEHR SCHWER'];
export const INFINITY_MIN_SEAM_SEC=2;
export const infinityTier=y=>y*.1<250?0:y*.1<750?1:y*.1<1500?2:3;
/** Prepared rapid actions are distinct from time to read the next challenge. */
export function chunkFlow(chunk) {
 const taps=chunk.level.replay.taps;let minGap=Infinity,burst=1,maxBurst=1;
 for(let i=1;i<taps.length;i++){
  const gap=taps[i].t-taps[i-1].t;minGap=Math.min(minGap,gap);
  burst=gap<.3?burst+1:1;maxBurst=Math.max(maxBurst,burst);
 }
 return {firstTap:taps[0].t,lastTap:taps.at(-1).t,minGap,maxBurst,tailRest:chunk.length/CLIMB_SPEED-taps.at(-1).t};
}
export function validateChunkBook(raw) {
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
/** Seeded selection of proven modules. No geometry depends on rendering/audio. */
export class EndlessWorld {
 constructor(book,seed,order=null){
  this.book=validateChunkBook(book);this.order=order;this.seed=seed>>>0;
  if(order&&(!order.length||order.some(i=>!Number.isInteger(i)||!book.chunks[i])))throw Error('Infinity: ungültige Testreihenfolge');
  this.pools=[0,1,2,3].map(tier=>book.chunks.filter(c=>c.tier===tier).map(source=>{
   const types=new Set(source.level.objects.map(o=>o.type)),family=types.has('mine')&&types.has('saw')?'mixed':types.has('laser')?'laser':types.has('seal')?'pulse':types.has('saw')?'saw':'precision';
   return {source,family,actions:source.level.replay.taps.length,burst:chunkFlow(source).maxBurst};
  }));this.reset();
 }
 reset(){this.rng=this.seed||0x6d2b79f5;this.chunks=[];this.history=[];this.nextIndex=0;this.nextY=0;this.generated=0;this.maxObjects=0;this.ensure(0);}
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
   const tier=infinityTier(this.nextY);
   const source=this.order?this.book.chunks[this.order[this.nextIndex%this.order.length]]:this.select(tier);
   const index=this.nextIndex++,origin=this.nextY,t0=origin/260,prefix=`c${index}-`;
   const level={...source.level,objects:source.level.objects.map(o=>({...o,id:prefix+o.id,y:o.y+origin})),finish:{y:source.length+origin},height:source.length+origin+260};
   const rt=buildLevelRuntime(level);rt.traps=rt.traps.map(o=>makeTrap(o,t0));
   this.chunks.push({index,id:source.id,tier,origin,end:origin+source.length,t0,rt,taps:source.level.replay.taps.map(t=>({t:t.t+t0,dir:t.dir}))});
   this.nextY+=source.length;this.generated++;changed=true;
  }
  while(this.chunks.length&&this.chunks[0].end<y-520){this.chunks.shift();changed=true;}
  return changed;
 }
 apply(game) {
  const chunks=this.chunks,rt=game.level;
  rt.obstacles=chunks.flatMap(c=>c.rt.obstacles);rt.seals=chunks.flatMap(c=>c.rt.seals);rt.hints=chunks.map(c=>[c.origin+260,'RUHEZONE · SPUR 2 / BLAU']);rt.traps=chunks.flatMap(c=>c.rt.traps);
  game.obstacles=rt.obstacles;game.seals=rt.seals;game.traps.traps=rt.traps;game.rift.seals=rt.seals;game.rift.maxHh=20;game.obsLo=0;
  rt.maxChh=6;rt.maxHh=8;game.collideRange=16;
  this.maxObjects=Math.max(this.maxObjects,rt.obstacles.length+rt.traps.length);
  if(game.audio.timeline)game.audio.timeline.accents=new Set(rt.seals.map(s=>Math.round(s.y/260/game.audio.timeline.stepSec)));
 }
 tapsAfter(t,last=-Infinity){return this.chunks.flatMap(c=>c.taps).filter(p=>p.t>=t-1/480&&p.t>last+1e-8);}
 tierAt(y){return this.chunks.find(c=>y>=c.origin&&y<c.end)?.tier??infinityTier(y);}
}
/** Optional entry recovery uses ordinary wall taps, never hidden input correction. */
export function entryTaps(lane,dim) {
 const taps=[];let time=.25;
 for(let i=0;i<lane;i++){taps.push({t:time,dir:-1});time+=.18;dim=dim==='B'?'R':'B';}
 if(dim==='B'){taps.push({t:time,dir:-1});time+=.18;}
 taps.push({t:time,dir:1});return taps;
}
