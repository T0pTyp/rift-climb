import {Player} from '../../js/player.js';
import {clamp} from '../../js/physics.js';
import {glideConfig} from './config.js';

export class GlideFlight {
  constructor(config){this.config=glideConfig(config);this.reset();}
  reset(){this.y=0;this.vy=0;this.maxY=0;this.camera=0;this.lastFlap=-Infinity;}
  flap(t){if(t-this.lastFlap<this.config.flapCooldownMs/1000-1e-9)return false;this.lastFlap=t;this.vy=this.config.flapVelocity;return true;}
  step(h){
    const c=this.config,v=this.vy,startY=this.y,untilCap=(v+c.maxFallVelocity)/c.gravity;
    const d=Math.min(h,Math.max(0,untilCap));
    this.y+=v*d-.5*c.gravity*d*d-c.maxFallVelocity*(h-d);
    this.vy=Math.max(-c.maxFallVelocity,v-c.gravity*h);
    // Track an apex even if it falls inside this simulation step.
    const apex=v>0?Math.min(d,v/c.gravity):0;
    this.maxY=Math.max(this.maxY,this.y,startY+v*apex-.5*c.gravity*apex*apex);
    const target=Math.max(0,this.y-c.cameraDeadZone);
    this.camera+=Math.max(0,target-this.camera)*(1-Math.exp(-c.cameraResponse*h));
  }
  get floor(){return this.camera-this.config.fallDistance;}
}

export class GlidePlayer extends Player {
  constructor(config){super('narrow');this.config=glideConfig(config);this.target=this.x;}
  reset(lane,dim,y){super.reset(lane,dim,y);this.target=this.x;}
  impulse(dir){
    const previous=this.target;
    this.target=clamp(previous+dir*this.config.horizontalTravelPerTap,18,252);
    // Reuse the original switch/pop/animation contract without quantizing the target.
    const wall=this.target===previous;
    this.lastDir=dir;this.dim=this.dim==='B'?'R':'B';this.pop=1;
    if(wall)this.wallBump=dir;
    return wall;
  }
  get dashing(){return Math.abs(this.x-this.target)>2||Math.abs(this.vx)>30;}
  update(h,y){
    // Original Player handles trail/pop decay; replace only the horizontal spring destination.
    const lane=this.lane;this.lane=(this.target-this.arena.inset)/this.arena.step;
    super.update(h,y);this.lane=lane;
    this.body.x=clamp(this.body.x,18,252);
    if(this.body.x===18)this.body.v=Math.max(0,this.body.v);
    if(this.body.x===252)this.body.v=Math.min(0,this.body.v);
  }
}
