// Prepared contracts, not a runtime pathfinder. Coordinates/velocities stay continuous.
import {INFINITY_BALANCE,difficultyAt,difficultyWeight} from './infinity-balance.js';
import {MOMENTUM_CONFIG,momentumSnapshot,effectiveDifficultyHeight} from './momentum.js';
export const GENERATOR_VERSION='rift-pattern-forge-1';
export const CATEGORIES=['FLOW','PHASE','PULSE','SAW','VOLTAGE','PRECISION','COMBO','SLIT','PAIR','LASER','MILL'];
export const DIRECTOR_TIERS=INFINITY_BALANCE.labels;
export const ZONES=['CYAN RIFT TOWER','FRACTURED DIMENSION','MECHANICAL CORE','VOLTAGE FACILITY','RIFT STORM','INFINITY CORE'];
// Retained legacy export for external tools. Active heights live in infinity-balance.js.
export const DIRECTOR_BAND_M=1500;
export const directorTier=y=>Math.min(6,Math.floor(difficultyAt(Math.max(0,y*.1))));
export const zoneAt=t=>ZONES[Math.floor(t/32)%ZONES.length];
export const stateOf=g=>({x:g.player.x,vx:g.player.vx,target:g.player.lane,dimension:g.player.dim==='B'?'blue':'red',lastDir:g.player.lastDir,impulse:g.player.dashing?'active':'idle'});
export function accepts(contract,state) {
 return !!contract&&!!state&&state.x>=contract.x[0]-1e-8&&state.x<=contract.x[1]+1e-8&&state.vx>=contract.vx[0]-1e-8&&state.vx<=contract.vx[1]+1e-8&&contract.target===state.target&&contract.dimension===state.dimension&&contract.lastDirs.includes(state.lastDir)&&contract.impulses.includes(state.impulse);
}
export function compatible(a,b) {
 // Color and lane decide the join. The combined clearance stays under a second: the next trap is the seam.
 const seam=a&&b?a.clearSec+b.clearSec:0;
 return !!a&&!!b&&a.x[0]>=b.x[0]-1e-8&&a.x[1]<=b.x[1]+1e-8&&a.vx[0]>=b.vx[0]-1e-8&&a.vx[1]<=b.vx[1]+1e-8&&a.target===b.target&&a.dimension===b.dimension&&a.lastDirs.every(v=>b.lastDirs.includes(v))&&a.impulses.every(v=>b.impulses.includes(v))&&seam>=.3&&seam<1&&a.traps==='clear'&&b.traps==='local-zero';
}
export function validContract(c,exit=false) {
 return !!c&&['x','vx'].every(k=>Array.isArray(c[k])&&c[k].length===2&&c[k].every(Number.isFinite)&&c[k][0]<=c[k][1])&&c.x[0]>=8&&c.x[1]<=262&&Number.isInteger(c.target)&&c.target>=0&&c.target<=2&&['blue','red'].includes(c.dimension)&&Array.isArray(c.lastDirs)&&c.lastDirs.length>0&&c.lastDirs.every(v=>[-1,0,1].includes(v))&&Array.isArray(c.impulses)&&c.impulses.length>0&&c.impulses.every(v=>['idle','active'].includes(v))&&Number.isFinite(c.clearSec)&&c.clearSec>=.15&&c.clearSec<1&&c.traps===(exit?'clear':'local-zero');
}
// FNV audit fingerprint: detects stale offline certificates, not an anti-cheat signature.
export function chunkFingerprint(level) {
 const {validation,enabled,weight,...meta}=level.chunk||{};
 // Editor normalization and JSON export may reorder keys. Sign semantic data.
 const text=JSON.stringify({...level,chunk:meta},(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0)):v);let h=2166136261;
 for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);return(h>>>0).toString(16).padStart(8,'0');
}
export const legacyDirectorSignature=book=>chunkFingerprint({revision:book.revision,chunks:book.chunks.map(c=>({id:c.id,hash:chunkFingerprint(c.level)}))});
export const directorSignature=book=>chunkFingerprint({generator:GENERATOR_VERSION,book:legacyDirectorSignature(book),controls:book.chunks.map(c=>({id:c.id,enabled:c.level.chunk.enabled!==false,weight:c.level.chunk.weight??1})),balance:INFINITY_BALANCE,momentum:MOMENTUM_CONFIG});
export class RiftDirector {
 constructor(book,random,momentum){this.book=book;this.random=random;this.reset(momentum);}
 reset(momentum=this.momentum){this.momentum=momentumSnapshot(momentum);this.history=[];this.rejected=0;this.fallbacks=0;this.nextChallenge=600;this.previous=null;this.sinceRecovery=0;}
 difficultyHeight(meters){return effectiveDifficultyHeight(meters,this.momentum);}
 select(y) {
  if(this.book.balance==='infinity-first')return this.selectInfinity(y);
  const tier=directorTier(y),last=this.history.at(-1),recent=this.history.slice(-3),challenge=y*.1>=this.nextChallenge;
  if(!this.history.length){
   const opening=this.book.chunks.find(c=>c.level.chunk.opening);
   if(opening){const m=opening.level.chunk;this.previous=m.exit;this.history.push({id:opening.id,category:m.category,actions:m.actions,family:m.hazardFamily});return opening;}
  }
  const eligible=this.book.chunks.filter(c=>{const m=c.level.chunk;if(m.opening)return false;const ok=m.tier<=tier&&m.validation.status==='verified'&&compatible(this.previous,m.entry);if(!ok)this.rejected++;return ok;});
  let pool=eligible.filter(c=>!recent.some(h=>h.id===c.id)&&(!c.level.chunk.challenge||challenge));
  if(this.history.length>=2&&this.history.at(-2).category===last?.category){const varied=pool.filter(c=>c.level.chunk.category!==last.category);if(varied.length)pool=varied;}
  if(challenge){const special=pool.filter(c=>c.level.chunk.challenge);if(special.length)pool=special;}
  if(!pool.length){this.fallbacks++;pool=eligible;}
  if(!pool.length)throw Error('RIFT DIRECTOR: kein zertifizierter Übergang');
  const weights=pool.map(c=>{const m=c.level.chunk,freq=this.history.filter(h=>h.id===c.id).length;
   const difficulty=m.tier===tier?2:Math.pow(.55,tier-m.tier),recovery=last?.actions>=6&&m.actions<=4?2:1;
   return difficulty/(1+freq*3)*(last?.category===m.category ? .35 : 1)*recovery*(last?.family===m.hazardFamily ? .6 : 1);
  });
  let roll=this.random()*weights.reduce((a,b)=>a+b,0),chosen=pool.at(-1);
  for(let i=0;i<pool.length;i++){roll-=weights[i];if(roll<0){chosen=pool[i];break;}}
  const m=chosen.level.chunk;this.previous=m.exit;this.history.push({id:chosen.id,category:m.category,actions:m.actions,family:m.hazardFamily});if(this.history.length>12)this.history.shift();
  if(m.challenge)this.nextChallenge=y*.1+450+this.random()*400;
  return chosen;
 }
 selectInfinity(y){
  const meters=this.difficultyHeight(y*.1),last=this.history.at(-1),recent=this.history.slice(-INFINITY_BALANCE.recentPatterns);
  if(!this.history.length){const c=this.book.chunks.find(c=>c.level.chunk.opening);this.remember(c);return c;}
  const eligible=this.book.chunks.filter(c=>{const m=c.level.chunk,ok=!m.opening&&m.enabled!==false&&(m.weight??1)>0&&m.validation.status==='verified'&&compatible(this.previous,m.entry)&&difficultyWeight(m.tier,meters)>0;if(!ok)this.rejected++;return ok;});
  const recovery=this.sinceRecovery>=INFINITY_BALANCE.recoveryEvery;
  let pool=eligible.filter(c=>!recent.some(h=>h.pattern===c.level.chunk.pattern)&&(!recovery||c.level.chunk.category==='FLOW'));
  if(!pool.length){this.fallbacks++;pool=eligible.filter(c=>c.level.chunk.category==='FLOW');const alternatives=pool.filter(c=>c.level.chunk.pattern!==last?.pattern);if(alternatives.length)pool=alternatives;}
  if(!pool.length)throw Error('RIFT DIRECTOR: kein zertifizierter FLOW-Anschluss');
  const weights=pool.map(c=>{
   const m=c.level.chunk,freq=this.history.filter(h=>h.pattern===m.pattern).length;
   const repeat=last?.family===m.hazardFamily?(this.history.at(-2)?.family===m.hazardFamily ? .35 : .65):1;
   return (m.weight??1)*difficultyWeight(m.tier,meters)/(1+freq*2)*(last?.category===m.category ? .55 : 1)*repeat;
  });
  let roll=this.random()*weights.reduce((a,b)=>a+b,0),chosen=pool.at(-1);
  for(let i=0;i<pool.length;i++){roll-=weights[i];if(roll<0){chosen=pool[i];break;}}
  this.remember(chosen);return chosen;
 }
 remember(c){const m=c.level.chunk;this.previous=m.exit;this.history.push({id:c.id,pattern:m.pattern,category:m.category,actions:m.actions,family:m.hazardFamily});if(this.history.length>12)this.history.shift();this.sinceRecovery=m.category==='FLOW'?0:this.sinceRecovery+1;}
}
