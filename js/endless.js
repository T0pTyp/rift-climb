import {buildLevelRuntime,validateLevelData} from './level-data.js';
import {makeTrap} from './traps.js';
export {METERS_PER_UNIT,worldMeters} from './world-units.js';
export const INFINITY_TIERS=['EINFACH','MITTEL','SCHWER','SEHR SCHWER'];
export const infinityTier=y=>y*.1<250?0:y*.1<750?1:y*.1<1500?2:3;
export function validateChunkBook(raw) {
 if(raw?.schema!=='rift-infinity-chunks'||raw.version!==1||!Array.isArray(raw.chunks)||raw.chunks.length<20)throw Error('Infinity-Modulbuch ungültig');
 const ids=new Set();
 for(const c of raw.chunks){const v=validateLevelData(c.level);if(!v.ok||!c.level.replay||ids.has(c.id)||!Number.isInteger(c.tier)||c.tier<0||c.tier>3||c.length!==2080||c.level.finish.y!==c.length||c.entry?.lane!==1||c.exit?.lane!==1||c.entry?.dimension!=='blue'||c.exit?.dimension!=='blue')throw Error('Ungültiger Chunk: '+c.id);ids.add(c.id);}
 if([0,1,2,3].some(tier=>!raw.chunks.some(c=>c.tier===tier)))throw Error('Infinity braucht alle vier Schwierigkeitsbereiche');
 return raw;
}
/** Seeded selection of proven modules. No geometry depends on rendering/audio. */
export class EndlessWorld {
 constructor(book,seed,order=null){this.book=book;this.order=order;this.seed=seed>>>0;this.reset();}
 reset(){this.rng=this.seed||0x6d2b79f5;this.chunks=[];this.nextIndex=0;this.nextY=0;this.generated=0;this.maxObjects=0;this.ensure(0);}
 random(){let x=this.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.rng=x>>>0;return this.rng/4294967296;}
 ensure(y) {
  let changed=false;
  while(this.nextY<y+4680) {
   const tier=infinityTier(this.nextY),pool=this.book.chunks.filter(c=>c.tier===tier);
   const source=this.order?this.book.chunks[this.order[this.nextIndex%this.order.length]]:pool[Math.floor(this.random()*pool.length)];
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
