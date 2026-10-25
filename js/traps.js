// Shared, deterministic dynamic hazards. All clocks are simulation seconds.
import { HIT_RADIUS, PULSE_GROW_SEC, SIM_DT, WORLD_W } from './config.js';
import { pulseRadius } from './rift.js';
export const TRAP_TYPES = ['saw','mine','laser'];
export const TRAP_NAMES={saw:'Phase Saw',mine:'Pulse Mine',laser:'Sweep Laser'};
export const isTrap = o => TRAP_TYPES.includes(o.type);
export const TRAP_DEFAULTS = {
 saw:{w:48,h:48,dimension:'blue',axis:'x',amplitude:25,period:3,phase:0,spin:4},
 mine:{w:28,h:28,dimension:'red',activationRadius:190,chargeSec:.7,blastRadius:130,blastSec:.22},
 laser:{w:26,h:26,dimension:'blue',axis:'none',amplitude:0,period:4,phase:0,startAngle:65,endAngle:115,sweepPeriod:3,length:200,beamWidth:10,warnSec:.7,activeSec:.6,offSec:1,disableSec:1},
};
export const TRAP_FIELDS = {
 saw:{amplitude:[0,100],period:[1,12],phase:[0,1],spin:[-12,12]},
 mine:{activationRadius:[80,220],chargeSec:[.5,1.5],blastRadius:[30,160],blastSec:[.12,.4]},
 laser:{amplitude:[0,80],period:[1,12],phase:[0,1],startAngle:[-180,180],endAngle:[-180,180],sweepPeriod:[1,12],length:[40,320],beamWidth:[4,18],warnSec:[.5,2],activeSec:[.2,1.5],offSec:[.4,3],disableSec:[.7,2]},
};
export function trapReach(o) {return o.type==='laser'?o.length+o.amplitude+o.w:o.type==='mine'?o.activationRadius:o.w/2+o.amplitude;}
export function normalizeTrap(o,width=WORLD_W) {
 const d=TRAP_DEFAULTS[o.type],clean={id:o.id,type:o.type,x:o.x,y:o.y,w:o.w??d.w,h:o.h??o.w??d.h,dimension:o.dimension??d.dimension},errors=[];
 for(const [key,[min,max]] of Object.entries(TRAP_FIELDS[o.type])) {
  const v=o[key]??d[key];if(!Number.isFinite(v)||v<min||v>max)errors.push(`${key}: ${min}–${max}`);clean[key]=v;
 }
 if(o.type!=='mine'){clean.axis=o.axis??d.axis;if(!['none','x','y'].includes(clean.axis))errors.push('Achse: none/x/y');}
 if(!['blue','red'].includes(clean.dimension))errors.push('Dimension: blue/red');
 if(![clean.x,clean.y,clean.w,clean.h].every(Number.isFinite)||clean.w<16||clean.w>80||clean.h!==clean.w)errors.push('Körper: 16–80 u, gleiche Breite/Höhe');
 const a=clean.axis==='x'?clean.amplitude:0;
 if(clean.x-a<0||clean.x+clean.w+a>width)errors.push('Bewegung ragt seitlich aus der Arena');
 if(clean.type==='mine'&&clean.blastRadius>clean.activationRadius)errors.push('Explosion größer als Aktivierungszone');
 return {clean,errors};
}
export function makeTrap(data,timeOrigin=0) {
 const o={...data,color:data.dimension==='red'?'R':'B',timeOrigin,pose:{},previous:{},renderPose:{}};resetTrap(o);return o;
}
export function resetTrap(o) {
 o.state='idle';o.chargeAt=-Infinity;o.burstAt=-Infinity;o.disabledUntil=-Infinity;o.epoch=o.timeOrigin;o.deadAt=-Infinity;o.pulseId=0;
}
const mod=(v,n)=>(v%n+n)%n;
function angleAt(o,t){return (o.startAngle+(o.endAngle-o.startAngle)*(.5+.5*Math.sin((t-o.timeOrigin)*Math.PI*2/o.sweepPeriod)))*Math.PI/180;}
export function trapPose(o,t,out={}) {
 const v=(t-o.timeOrigin)/(o.period||1)*Math.PI*2+(o.phase||0)*Math.PI*2;
 out.x=o.x+o.w/2+(o.axis==='x'?Math.sin(v)*o.amplitude:0);
 out.y=o.y+(o.axis==='y'?Math.sin(v)*o.amplitude:0);out.angle=o.type==='saw'?(t-o.timeOrigin)*o.spin:0;
 out.phase='idle';
 if(o.type==='laser') {
  const cycle=o.warnSec+o.activeSec+o.offSec,pos=mod(t-o.epoch+o.phase*cycle,cycle);
  out.phase=t<o.disabledUntil?'disabled':pos<o.warnSec?'warning':pos<o.warnSec+o.activeSec?'active':'off';
  out.angle=angleAt(o,out.phase==='warning'?t-pos+o.warnSec:t);
  // Preview the complete activation ray, including a moving projector's future origin.
  const warnV=(t-pos+o.warnSec-o.timeOrigin)/o.period*Math.PI*2+o.phase*Math.PI*2;
  out.warnX=o.x+o.w/2+(o.axis==='x'?Math.sin(warnV)*o.amplitude:0);
  out.warnY=o.y+(o.axis==='y'?Math.sin(warnV)*o.amplitude:0);
  out.endX=out.x+Math.cos(out.angle)*o.length;out.endY=out.y+Math.sin(out.angle)*o.length;
 }
 return out;
}
export function pointSegmentDistance(px,py,ax,ay,bx,by) {
 const dx=bx-ax,dy=by-ay,k=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(px-ax-k*dx,py-ay-k*dy);
}
export class TrapField {
 constructor(traps=[]){this.traps=traps;this.events=0;}
 reset(){for(const o of this.traps)resetTrap(o);this.events=0;}
 snapshot(){return this.traps.map(o=>({id:o.id,state:o.state,chargeAt:o.chargeAt,burstAt:o.burstAt,disabledUntil:o.disabledUntil,epoch:o.epoch,deadAt:o.deadAt,pulseId:o.pulseId}));}
 restore(snapshot){this.reset();const byId=new Map((snapshot||[]).map(s=>[s.id,s]));for(const o of this.traps)if(byId.has(o.id))Object.assign(o,byId.get(o.id));}
 step(t,h,player,previousX,previousY,pulses,onEvent) {
  for(const o of this.traps) {
   const reach=trapReach(o);
   if(Math.abs(o.y-player.y)>reach+240)continue;
   const q=trapPose(o,t,o.pose),old=trapPose(o,t-h,o.previous);
   // Sweep Laser stays armed. A matching pulse still destroys saws and disarms mines.
   if(o.type!=='laser'&&o.state!=='destroyed'&&o.state!=='disarmed')for(const p of pulses) {
    if(!p.live||t-p.t0>PULSE_GROW_SEC+SIM_DT||p.dim!==o.color||o.pulseId===p.id)continue;
    if(Math.hypot(p.x-q.x,p.y-q.y)-o.w/2>pulseRadius(t-p.t0))continue;
    o.pulseId=p.id;
    if(o.type==='saw'){o.state='destroyed';o.deadAt=t;}
    else if(o.type==='mine'){o.state='disarmed';o.deadAt=t;}
    else continue;
    this.events++;onEvent?.(o,o.type==='saw'?'saw-break':'mine-disarm');
   }
   if(o.state==='destroyed'||o.state==='disarmed')continue;
   if(o.type==='mine') {
    if(o.state==='idle'&&o.color===player.dim&&Math.hypot(player.x-q.x,player.y-q.y)<=o.activationRadius){o.state='charging';o.chargeAt=t;onEvent?.(o,'mine-warn');}
    if(o.state==='charging'&&t-o.chargeAt>=o.chargeSec){o.state='exploding';o.burstAt=t;onEvent?.(o,'mine-blast');}
    if(o.state==='exploding'&&t-o.burstAt>=o.blastSec)o.state='spent';
   }
   if(o.color!==player.dim)continue;
   if(o.type==='saw'&&pointSegmentDistance(0,0,previousX-old.x,previousY-old.y,player.x-q.x,player.y-q.y)<=HIT_RADIUS+o.w/2-1)return o;
   if(o.type==='mine'&&o.state==='exploding'&&pointSegmentDistance(q.x,q.y,previousX,previousY,player.x,player.y)<=o.blastRadius+HIT_RADIUS)return o;
   if(o.type==='laser'&&(q.phase==='active'||old.phase==='active')) {
    // Adaptive subdivision bounds moving capsule endpoints to < 4 u per sample.
    const n=Math.max(1,Math.ceil((o.length*Math.abs(q.angle-old.angle)+Math.hypot(q.x-old.x,q.y-old.y)+Math.hypot(player.x-previousX,player.y-previousY))/4));
    for(let i=0;i<=n;i++) {
     const a=i/n,at=t-h+h*a,r=trapPose(o,at,o.renderPose);if(r.phase!=='active')continue;
     if(pointSegmentDistance(previousX+(player.x-previousX)*a,previousY+(player.y-previousY)*a,r.x,r.y,r.endX,r.endY)<=HIT_RADIUS+o.beamWidth/2)return o;
    }
   }
  }
  return null;
 }
}
