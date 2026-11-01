import {normalizeTrap,isTrap} from '../../js/traps.js';
import {HybridSimulation,CONTRACTS,exitMatches,HYBRID_SIMULATION_VERSION} from './simulation.js';
import {HYBRID_DEFAULTS,hybridConfig,defaultPhysics} from './config.js';
import {SIM_DT,HIT_RADIUS,PULSE_RADIUS,PULSE_GROW_SEC} from '../../js/config.js';

export function chunkErrors(c) {
  const e=[];
  if(c?.schema!=='rift-hybrid-chunk'||c.version!==1||typeof c.id!=='string'||!['ground','flight'].includes(c.entry)||!['ground','flight'].includes(c.exit))return ['Chunk-Metadaten ungültig.'];
  if(!Number.isFinite(c.length)||c.length<500||c.length>2500)e.push('Länge: 500–2500 u.');
  if(!Number.isInteger(c.difficulty)||c.difficulty<0||c.difficulty>4)e.push('Schwierigkeit: 0–4.');
  if(!Array.isArray(c.objects)||!Array.isArray(c.replay?.inputs))return [...e,'Objekte/Replay fehlen.'];
  const ids=new Set();
  for(const o of c.objects) {
    if(!o||typeof o.id!=='string'||ids.has(o.id)){e.push('Objekt-ID fehlt/doppelt.');continue;}ids.add(o.id);
    if(!Number.isFinite(o.x)||!Number.isFinite(o.y)||o.x<0||o.x>c.length-70){e.push(o.id+': Position.');continue;}
    if(isTrap(o))e.push(...normalizeTrap(o,c.length+500).errors.map(x=>o.id+': '+x));
    else if(o.type==='portal'){if(!['ground','flight'].includes(o.target))e.push('Portalziel ungültig.');}
    else if(!['rect','seal'].includes(o.type)||!Number.isFinite(o.w)||!Number.isFinite(o.h)||o.w<2||o.h<2||o.y<0||o.y+o.h>300||!['neutral','blue','red'].includes(o.dimension)||o.type==='seal'&&(!Number.isFinite(o.openSec)||o.openSec<.5||o.openSec>2))e.push(o.id+': Geometrie.');
  }
  let time=-1;
  for(const a of c.replay.inputs){if(!['motion','phase'].includes(a.action)||!Number.isFinite(a.t)||a.t<time||a.t<0||a.t>=c.length/HYBRID_DEFAULTS.speed)e.push('Ungültige Replayeingabe.');time=a.t;}
  return e;
}
export function fingerprint(c) {
  const {validation,enabled,...geometry}=c;const s=JSON.stringify({geometry,physics:HYBRID_DEFAULTS,shared:{SIM_DT,HIT_RADIUS,PULSE_RADIUS,PULSE_GROW_SEC},engine:HYBRID_SIMULATION_VERSION});
  let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);
}
export function runChunk(c,{entry={},inputs=c.replay.inputs,config=hybridConfig()}={}) {
  const sim=new HybridSimulation({config,entry:c.entry,pieces:[{chunk:c,offset:0}],source:'automated'});
  Object.assign(sim.p,entry);for(const a of inputs)sim.input(a.action,a.t);
  sim.advance(c.length/config.speed+1);return sim;
}
export function certifyChunk(c) {
  const errors=chunkErrors(c);if(errors.length)return {status:'INVALID',errors};
  const fixtures=[],exitStates=[];
  for(const dy of (c.entry==='flight'?[-1,0,1]:[0]))for(const dv of (c.entry==='flight'?[-12,0,12]:[0])) {
    const entry={...CONTRACTS[c.entry],y:CONTRACTS[c.entry].y+dy,vy:CONTRACTS[c.entry].vy+dv},sim=runChunk(c,{entry});
    if(sim.state!=='complete'||!exitMatches(sim.p,c.exit))return {status:'UNVERIFIED',reason:sim.death??sim.p,entry};
    fixtures.push(entry);exitStates.push({...sim.p});
  }
  return {status:'VERIFIED',fingerprint:fingerprint(c),physics:{...HYBRID_DEFAULTS},fixtures,exitStates,clock:'chunk-local zero',replay:c.replay,scope:'Only listed entry states and recorded inputs; not all human trajectories.'};
}
export const certified = c => c.enabled!==false&&c.validation?.status==='VERIFIED'&&c.validation.fingerprint===fingerprint(c)&&!chunkErrors(c).length;
export function compatibleChunks(previous,next) {
  if(!certified(next))return false;
  if(!previous)return next.entry==='ground';
  if(!certified(previous)||previous.exit!==next.entry)return false;
  // Compare actual certified endpoint poses to explicitly simulated start poses.
  // World x is rebased at the seam; gravity, speed, radius and clocks are signed.
  return previous.validation.exitStates.every(s=>next.validation.fixtures.some(e=>
    e.mode===s.mode&&e.dim===s.dim&&e.grounded===s.grounded&&Math.abs(e.y-s.y)<1e-6&&Math.abs(e.vy-s.vy)<1e-6));
}
export function composeCourse(book,course) {
  const pieces=[],inputs=[];let offset=0,mode='ground';
  for(const id of course.route) {
    const c=book.find(c=>c.id===id);if(!c||c.entry!==mode)throw Error('Inkompatibler Kurs: '+id);
    pieces.push({chunk:c,offset,index:pieces.length});inputs.push(...c.replay.inputs.map(a=>({...a,t:a.t+offset/HYBRID_DEFAULTS.speed})));
    offset+=c.length;mode=c.exit;
  }
  return {pieces,inputs,length:offset};
}
export class HybridDirector {
  constructor(book,{seed=37,config=hybridConfig()}={}) {
    if(!defaultPhysics(config))throw Error('Endless benötigt die geprüften Standardparameter.');
    this.book=book.filter(certified);this.seed=seed>>>0;this.randomState=this.seed;this.config=config;this.sequence=[];this.offset=0;this.mode='ground';this.rejected=0;this.generated=0;this.previous=null;
    for(const mode of ['ground','flight'])if(!this.book.some(c=>c.entry===mode&&c.difficulty<=1))throw Error('Sicherer geprüfter Anschluss fehlt: '+mode);
    for(const c of this.book)if(!this.book.some(n=>n.difficulty<=1&&compatibleChunks(c,n)))throw Error('Kein geprüfter Erholungsanschluss: '+c.id);
  }
  random(){this.randomState=(Math.imul(this.randomState,1664525)+1013904223)>>>0;return this.randomState/4294967296;}
  next() {
    const meters=this.offset*.1,cap=Math.min(4,meters/180),last=this.sequence.at(-1),recent=this.sequence.slice(-3);
    // Recovery after three demanding pieces, never speed up the simulation.
    const recovery=this.generated%4===3;
    const introduction=c=>c.difficulty===0?1:Math.min(1,Math.max(0,cap-c.difficulty+1));
    let pool=this.book.filter(c=>c.entry===this.mode&&compatibleChunks(this.previous,c)&&c.difficulty<=(recovery?1:Math.max(1,Math.ceil(cap)))&&introduction(c)>0);
    if(this.generated===0&&pool.some(c=>c.id==='G01'))pool=pool.filter(c=>c.id==='G01');
    this.rejected+=this.book.length-pool.length;
    if(pool.length>1)pool=pool.filter(c=>c.id!==last?.id);
    let total=0;const weights=pool.map(c=>{const w=introduction(c)*(recent.some(p=>p.id===c.id)?.2:1)/(1+Math.abs(c.difficulty-cap));total+=w;return w;});
    let r=this.random()*total,chosen=pool.at(-1);for(let i=0;i<pool.length;i++){r-=weights[i];if(r<=0){chosen=pool[i];break;}}
    if(!chosen)throw Error('Kein zertifizierter Anschluss.');
    const p={chunk:chosen,offset:this.offset,index:this.generated++};
    this.sequence.push({id:chosen.id,entry:chosen.entry,exit:chosen.exit,offset:this.offset});
    // Bounded recent history; absolute chunk IDs remain monotonic separately.
    this.offset+=chosen.length;this.mode=chosen.exit;this.previous=chosen;return p;
  }
  ensure(sim) {
    while(this.offset<sim.p.x+2300){const p=this.next();sim.append(p.chunk,p.offset,p.index);}
    sim.cull();if(this.sequence.length>16)this.sequence.splice(0,this.sequence.length-16);
  }
}
