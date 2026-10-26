// Development-only experiments. Every motion/collision comes from the real Game.
// No URL, menu, storage setting or production arena can select these variants.
import {headlessGame} from '../../js/playcheck.js';
import {SIM_DT,HIT_RADIUS} from '../../js/config.js';
import {isTrap,normalizeTrap} from '../../js/traps.js';
export function arenaExperiment(level,width=360) {
 const scale=width/360,projected=structuredClone(level);let repositioned=0;
 for(const o of projected.objects){
  if(o.type==='hint')continue;
  if(isTrap(o)){
   const center=(o.x+o.w/2)*scale,a=o.axis==='x'?(o.amplitude||0)*scale:0;
   o.x=Math.max(a,Math.min(width-o.w-a,center-o.w/2));
   if(Math.abs(o.x-(center-o.w/2))>1e-8)repositioned++;
   if(o.axis==='x')o.amplitude=a;
   if(normalizeTrap(o,width).errors.length)throw Error('Invalid projected trap '+o.id);
  } else {o.x*=scale;o.w*=scale;}
  if(o.x<0||o.x+o.w>width+1e-8)throw Error('Projected obstacle outside arena '+o.id);
 }
 const game=headlessGame(projected),arena={...game.arena,width,step:90*scale,inset:45*scale};
 game.arena=game.player.arena=game.level.arena=arena;
 game.resize(390,664,1);game.start('normal');
 return {game,projected,arena,repositioned};
}
export function playExperiment(game,taps,limit=game.level.finishY/260+1) {
 let used=0;
 while(game.state==='playing'&&game.t<limit){while(used<taps.length&&taps[used].t<=game.t+SIM_DT/2)game.press(taps[used++].dir);game.step(SIM_DT);}
 return {won:game.state==='won',progress:game.progress,t:game.t,tapsUsed:used,killer:game.killer?.o.id||null,trapInteractions:game.traps.events,sealsOpened:game.seals.reduce((n,s)=>n+s.timesOpened,0)};
}
/** A bounded, nonstacking contact-only grace prototype; never imported by game.
 * Re-entering the same contact cannot rearm it until the caller reports separation.
 */
export class PhasePrototype {
 constructor(ms){this.duration=ms/1000;this.reset();}
 reset(){this.until=-Infinity;this.contact=null;this.used=new Set();}
 switch(t,contact){if(!this.duration||!contact||this.used.has(contact)||t<this.until)return;this.contact=contact;this.used.add(contact);this.until=t+this.duration;}
 leave(contact){this.used.delete(contact);if(this.contact===contact)this.contact=null;}
 protects(t,id,color){return (color==='B'||color==='R')&&this.contact===id&&t<this.until;}
}
/** Counterfactual single-slot input buffer. The real spring never needs this queue. */
export class InputBufferPrototype {
 constructor(ms){this.duration=ms/1000;this.reset();}
 reset(){this.pending=null;}
 request(t,dir,apply,active=true){
  if(!active){this.reset();return false;}
  if(apply(dir)){this.reset();return true;}
  if(this.duration)this.pending={dir,until:t+this.duration};return false;
 }
 flush(t,apply,active=true){
  if(!active||!this.pending||t>=this.pending.until){this.reset();return false;}
  if(apply(this.pending.dir)){this.reset();return true;}return false;
 }
}
export const clearRadius=HIT_RADIUS;
