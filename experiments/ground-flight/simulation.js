import {SIM_DT,HIT_RADIUS} from '../../js/config.js';
import {sweptCircleRect} from '../../js/physics.js';
import {isDeadly,otherDim} from '../../js/dimensions.js';
import {RiftField} from '../../js/rift.js';
import {TrapField,makeTrap,isTrap} from '../../js/traps.js';
import {hybridConfig} from './config.js';

export const HYBRID_SIMULATION_VERSION='hybrid-1';
export const CONTRACTS = Object.freeze({
  ground:{mode:'ground',y:8,vy:0,dim:'B',grounded:true},
  flight:{mode:'flight',y:108,vy:-240,dim:'B',grounded:false},
});
export function exitMatches(p,mode) {
  return p.mode===mode&&p.dim==='B'&&(mode==='ground'?p.grounded&&p.y===8&&p.vy===0:Math.abs(p.y-108)<=4&&Math.abs(p.vy+240)<=.01);
}
// Exact constant-gravity integration, including the terminal-speed crossing.
function fall(p,g,c,h) {
  const cutoff=Math.max(0,(p.vy+c.maxFall)/g),dt=Math.min(h,cutoff);
  p.y+=p.vy*dt-.5*g*dt*dt;p.vy=Math.max(-c.maxFall,p.vy-g*dt);
  if(h>dt)p.y-=c.maxFall*(h-dt);
}
export class HybridSimulation {
  constructor({config=hybridConfig(),pieces=[],entry='ground',endless=false,source='interactive'}={}) {
    this.config=config;this.endless=endless;this.source=source;this.pieces=[];this.objects=[];this.portals=[];
    this.rift=new RiftField([]);this.traps=new TrapField([]);this.listeners=[];
    this.p={x:0,...CONTRACTS[entry],vx:config.speed,hitRadius:HIT_RADIUS};
    this.t=0;this.tick=0;this.accumulator=0;this.state='playing';this.finishX=0;this.queue=[];this.inputs=[];this.events=[];
    this.counts={jumps:0,flaps:0,phases:0,pulses:0,portals:0,landings:0,interactions:0,touches:0};
    this.lastAction={motion:-Infinity,phase:-Infinity};this.death=null;
    for(const p of pieces)this.append(p.chunk,p.offset,p.index??this.pieces.length);
  }
  onEvent(fn){this.listeners.push(fn);}
  event(kind,object=null) {
    const e={kind,t:this.t,x:this.p.x,y:this.p.y,mode:this.p.mode,dim:this.p.dim,id:object?.id??null,chunk:object?.chunk??this.currentPiece()?.id??null};
    this.events.push(e);if(this.events.length>160)this.events.shift();for(const fn of this.listeners)fn(e);
  }
  append(chunk,offset=this.finishX,index=this.pieces.length) {
    const origin=offset/this.config.speed,piece={id:chunk.id,name:chunk.name,category:chunk.category,entry:chunk.entry,exit:chunk.exit,offset,end:offset+chunk.length,index};
    this.pieces.push(piece);this.finishX=Math.max(this.finishX,piece.end);
    for(const raw of chunk.objects) {
      const data={...raw,id:index+':'+raw.id,chunk:chunk.id,x:raw.x+offset};
      if(isTrap(data))this.traps.traps.push(makeTrap(data,origin));
      else if(data.type==='portal')this.portals.push({...data,used:false});
      else {
        const o={...data,x0:data.x,x1:data.x+data.w,hh:data.h/2,y:data.y+data.h/2,color:data.type==='seal'?'S':data.dimension==='neutral'?'W':data.dimension==='blue'?'B':'R'};
        this.objects.push(o);
        if(o.type==='seal'){o.openUntil=-Infinity;o.openedAt=-Infinity;o.pulseId=0;o.timesOpened=0;o.closePending=false;this.rift.seals.push(o);}
      }
    }
    this.rift.seals.sort((a,b)=>a.y-b.y);this.rift.maxHh=Math.max(0,...this.rift.seals.map(s=>s.hh));
  }
  currentPiece(){return this.pieces.find(p=>p.end>this.p.x+1e-7);}
  cull() {
    const behind=this.p.x-650;
    this.pieces=this.pieces.filter(p=>p.end>behind);
    this.objects=this.objects.filter(o=>o.x1>behind);this.portals=this.portals.filter(o=>o.x>behind);
    this.traps.traps=this.traps.traps.filter(o=>o.x+(o.length||o.w)+(o.amplitude||0)>behind);
    this.rift.seals=this.rift.seals.filter(o=>o.x1>behind);
  }
  input(action,at=this.t) {
    if(!['motion','phase'].includes(action)||this.state!=='playing'||!Number.isFinite(at)||at<this.t-1e-7)return false;
    this.queue.push({action,t:at});this.queue.sort((a,b)=>a.t-b.t);return true;
  }
  action(action) {
    const p=this.p,c=this.config,cd=action==='phase'?c.phaseCooldown:c.flapCooldown;
    this.counts.touches++;
    if(this.t-this.lastAction[action]<cd-1e-8)return false;
    if(action==='motion') {
      if(p.mode==='ground'&&!p.grounded)return false;
      this.lastAction.motion=this.t;p.vy=Math.min(c.maxUp,p.mode==='ground'?c.jumpImpulse:c.flapImpulse);p.grounded=false;
      const kind=p.mode==='ground'?'jump':'flap';this.counts[kind==='jump'?'jumps':'flaps']++;this.event(kind);
    } else {
      this.lastAction.phase=this.t;p.dim=otherDim(p.dim);this.counts.phases++;
      this.rift.emit(p.x,p.y,this.t,p.dim==='B'?'#2fd6ff':'#ff2d8a',p.dim);this.counts.pulses++;this.event('phase');
    }
    this.inputs.push({t:this.t,action});if(this.inputs.length>16000){this.inputs.shift();this.inputsDiscarded=true;}return true;
  }
  kill(o,kind=o.type) {
    if(this.state!=='playing')return;
    this.state='dead';this.death={type:kind,id:o.id??kind,chunk:o.chunk??this.currentPiece()?.id,x:this.p.x,y:this.p.y,dim:this.p.dim,mode:this.p.mode,t:this.t,lastInputs:this.inputs.slice(-8)};this.event('death',o);
  }
  step() {
    if(this.state!=='playing')return;
    while(this.queue.length&&this.queue[0].t<=this.t+1e-8)this.action(this.queue.shift().action);
    const p=this.p,c=this.config,px=p.x,py=p.y;p.x+=c.speed*SIM_DT;
    if(!p.grounded||p.mode==='flight')fall(p,p.mode==='ground'?c.gravity:c.flightGravity,c,SIM_DT);
    this.tick++;this.t=this.tick*SIM_DT;
    for(const portal of this.portals)if(!portal.used&&px<portal.x&&p.x>=portal.x) {
      portal.used=true;
      if(p.mode!==portal.target){p.mode=portal.target;this.counts.portals++;if(p.mode==='flight'){p.grounded=false;p.vy=Math.min(c.maxUp,c.portalLift);}this.event('portal',portal);}
    }
    if(p.mode==='ground'&&p.y<=HIT_RADIUS){p.y=HIT_RADIUS;p.vy=0;if(!p.grounded){this.counts.landings++;this.event('land');}p.grounded=true;}
    if(p.mode==='flight'&&(p.y<HIT_RADIUS||p.y>c.ceiling-HIT_RADIUS)){this.kill({id:'rift-boundary',type:'boundary'},p.y<8?'floor':'ceiling');return;}
    this.rift.step(this.t,o=>{this.counts.interactions++;this.event('seal',o);},o=>this.event('seal-close',o));
    const hit=this.traps.step(this.t,SIM_DT,p,px,py,this.rift.pulses,(o,kind)=>{
      if(['saw-break','mine-disarm','laser-disable'].includes(kind))this.counts.interactions++;
      this.event(kind,o);
    });
    if(hit){this.kill(hit);return;}
    for(const o of this.objects) {
      if(o.x1<px-HIT_RADIUS||o.x0>p.x+HIT_RADIUS)continue;
      if(!isDeadly(o.color,p.dim)||o.type==='seal'&&this.rift.isOpen(o,this.t))continue;
      if(sweptCircleRect(px,py,p.x,p.y,HIT_RADIUS,o.x0,o.y-o.hh,o.x1,o.y+o.hh)){this.kill(o);return;}
    }
    for(const piece of this.pieces)if(px<piece.end-1e-7&&p.x>=piece.end-1e-7)this.event('pass',{id:piece.id,chunk:piece.id});
    if(!this.endless&&p.x>=this.finishX-1e-7){this.state='complete';this.event('complete');}
  }
  advance(seconds) {
    if(this.state!=='playing')return;
    this.accumulator+=Math.max(0,seconds);
    while(this.accumulator>=SIM_DT-1e-10&&this.state==='playing'){this.accumulator-=SIM_DT;this.step();}
  }
  pause(){if(this.state==='playing'){this.state='paused';this.queue=[];this.accumulator=0;}}
  resume(){if(this.state==='paused'){this.state='playing';this.queue=[];}}
  summary(){return {duration:this.t,distance:this.p.x*.1,counts:{...this.counts},completed:this.state==='complete',death:this.death,parameters:{...this.config},source:this.source,inputsTruncated:!!this.inputsDiscarded};}
}
