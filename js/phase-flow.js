import {CLIMB_SPEED,HIT_RADIUS,MIN_PRESS_INTERVAL_MS,STEER_OMEGA,IMPULSE_MS} from './config.js';
import {springStep,clamp} from './physics.js';
import {arenaCenter} from './arena.js';

/** Debug only. No buffer, immunity, alternate arena or collision override exists here. */
export function phaseFlowState(game,now=performance.now()) {
 const p=game.player;let next=null;
 const forecast=dir=>{const body={x:p.x,v:p.vx};springStep(body,arenaCenter(clamp(p.lane+dir,0,game.arena.lanes-1),game.arena),STEER_OMEGA,IMPULSE_MS/1000);return body.x-p.x;};
 for(let i=game.obsLo;i<game.obstacles.length;i++){
  const o=game.obstacles[i];
  if(o.y+o.chh+HIT_RADIUS<game.y||!game.deadlyNow(o,p.dim))continue;
  next={id:o.id,dimension:o.color,seconds:Math.max(0,(o.y-o.chh-HIT_RADIUS-game.y)/CLIMB_SPEED),
    horizontalClearance:Math.max(o.x0-p.x,p.x-o.x1,0)-HIT_RADIUS,method:'vertical-band-only',collisionPrediction:false};break;
 }
 return {
  arenaWidth:game.arena.width,impulseTargetDistance:game.arena.step,steerOmega:STEER_OMEGA,
  motionForecast:{atMs:IMPULSE_MS,left:forecast(-1),right:forecast(1),assumption:'no further input; motion only, not a safe-route prediction'},
  x:p.x,vx:p.vx,dimension:p.dim,simTime:game.t,impulseActive:p.dashing,interruptible:true,movementCooldownMs:0,
  debounceRemainingMs:Math.max(0,MIN_PRESS_INTERVAL_MS-(now-(game.input.lastPress??-Infinity))),
  inputBuffer:{durationMs:0,pending:false,reason:'spring-is-interruptible'},
  phaseBuffer:{durationMs:0,active:false,remainingMs:0,reason:'geometry-and-event-time; no collision immunity'},
  input:game.input.lastDecision||null,lastSwitch:game.lastSwitch,
  nextBand:next,collision:game.killer?{decision:'hit',id:game.killer.o.id,dimension:game.killer.dim,phaseProtection:false}:{decision:'current-dimension-and-real-geometry',phaseProtection:false},
  chunk:game.endless?.chunks.find(c=>game.y>=c.origin&&game.y<c.end)?.id||null,
 };
}
