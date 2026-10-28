import {Game} from '../../js/game.js';
import {GlideFlight,GlidePlayer} from './flight.js';
import {testMusicSections} from './config.js';

/** Shares Game's input actions, collisions, traps, pulse, audio, renderer and restart. */
export class GlideGame extends Game {
  constructor(options,config){
    super(options);this.flight=new GlideFlight(config);this.player=new GlidePlayer(this.flight.config);
    // Spatial finish / 260 is not a valid song duration for active vertical flight.
    this.beatEffects.timeline.duration=Infinity;this.beatEffects.timeline.sections=testMusicSections();
  }
  get y(){return this.flight?.y||0;}
  get cameraY(){return this.flight?.camera||0;}
  resize(w,h,dpr){super.resize(w,h,dpr);this.view.playerSY=Math.min(this.view.viewH*.62,this.view.viewH-225);}
  get progress(){return this.world?0:Math.min(100,Math.floor((this.flight?.maxY||0)/this.level.finishY*100));}
  restart(){
    // Finish the old run before clearing maximum height and time.
    if(this.flight)this.saveProgress(true);
    this.flight?.reset();this.world?.reset();
    super.restart();this.lastAcceptedFlap=-Infinity;
    if(this.world)this.world.apply(this);
  }
  impulse(dir){
    if(this.state!=='playing'||![1,-1].includes(dir)||!this.flight.flap(this.t))return false;
    super.impulse(dir);this.lastAcceptedFlap=this.t;return true;
  }
  advanceWorld(h){this.flight.step(h);this.t+=h;}
  setupAutoplay(){if(this.world){this.autoplayQueue=this.debug.autoplay?this.world.tapsAfter(this.t,this.lastAutoT):[];}else super.setupAutoplay();}
  step(h){
    if(this.world&&this.world.ensure(this.flight.maxY,this.t)){this.world.apply(this);this.setupAutoplay();}
    // A downward pass must revisit obstacles already below the previous upward scan.
    this.obsLo=0;super.step(h);
    if(this.state==='playing'&&!this.world&&this.flight.maxY>=this.level.finishY)this.win();
    if(this.state==='playing'&&this.y-this.player.hitRadius<=this.flight.floor)this.die({id:'rift-floor',type:'rift-floor',color:'W',y:this.flight.floor});
  }
  win(){if(!this.world)super.win();}
  deathReason(o,dim){return o.type==='rift-floor'?'RIFT-GRENZE · Auftrieb verloren':super.deathReason(o,dim);}
  renderPlayer(ctx,sy){
    const p=this.anim.pose,old={sx:p.sx,sy:p.sy,tilt:p.tilt};
    if(!['dead','dying'].includes(this.state)){
      const v=this.flight.vy/this.flight.config.flapVelocity;
      p.sx*=1-.035*Math.max(0,v);p.sy*=1+.07*Math.max(0,v);
      p.tilt+=Math.max(-.08,Math.min(.08,-v*.06));
    }
    super.renderPlayer(ctx,sy);Object.assign(p,old);
  }
  render(){
    super.render();if(this.state==='menu')return;
    const {ctx,view:v}=this,k=v.dpr*v.scale,sy=v.playerSY-(this.flight.floor-this.cameraY);
    ctx.save();ctx.setTransform(k,0,0,k,v.offsetX*v.dpr,0);
    const g=ctx.createLinearGradient(0,sy-20,0,sy+20);g.addColorStop(0,'rgba(255,45,138,0)');g.addColorStop(1,'rgba(255,45,138,.35)');ctx.fillStyle=g;ctx.fillRect(0,sy-20,270,40);
    ctx.strokeStyle='#ff77bb';ctx.lineWidth=2;ctx.beginPath();
    for(let x=0;x<=270;x+=6){const y=sy+Math.sin(x*.09+this.realT*3)*3;x?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
    ctx.font='700 9px system-ui';ctx.fillStyle='#ffadd6';ctx.textAlign='center';ctx.fillText('RIFT-GRENZE',135,sy-8);ctx.restore();
  }
}

export function gameOptions(level,overrides={}){
  const noop=()=>{};
  return {canvas:{getContext:()=>null,width:0,height:0},ui:{show:noop,updateHud:noop,updateMenu:noop,toast:noop,showDeath:noop,showWin:noop},audio:{seek:noop,sfx:noop,update:noop,suspend:noop,resume:noop,stop:noop},input:{guard:noop,ignored:0},storage:{stats:{best:0,attempts:0,clears:0},save:noop},debug:{},level,...overrides};
}
export const makeTestGame=(model,level,config,overrides)=>model==='auto'?new Game(gameOptions(level,overrides)):new GlideGame(gameOptions(level,overrides),config);
