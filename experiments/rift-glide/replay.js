import {SIM_DT} from '../../js/config.js';
import {makeTestGame} from './game.js';
import {glideConfig} from './config.js';

export function playTestReplay(model,level,taps,{config,entry,duration=60,fps=60,world}={}){
  if(!Array.isArray(taps)||taps.some((p,i)=>{
    const prev=taps[i-1],gap=model==='auto'&&Number.isFinite(p.inputMs)&&Number.isFinite(prev?.inputMs)?(p.inputMs-prev.inputMs)/1000:prev?p.t-prev.t:Infinity;
    return ![1,-1].includes(p.dir)||!Number.isFinite(p.t)||p.t<0||(i&&(p.t<prev.t||gap<(model==='auto'?.045:glideConfig(config).flapCooldownMs/1000)-1e-7));
  }))throw Error('Ungültiger Replay');
  const g=makeTestGame(model,level,config);g.start('normal');
  if(entry){g.player.body.x=entry.x;g.player.body.v=entry.vx;if(model==='glide'){g.player.target=entry.target;g.flight.y=entry.y;g.flight.maxY=Math.max(0,entry.y);g.flight.vy=entry.vy;}g.player.dim=entry.dimension;}
  if(world){g.world=world;world.apply(g);g.level.finishY=Infinity;}
  let i=0,acc=0;const n=Math.round(duration/SIM_DT);
  // Frame accumulator partitions time; all input and physical work still use Game.step at 240Hz.
  while(g.stats.steps<n&&g.state==='playing'){
    acc+=1/fps;
    while(acc>=SIM_DT-1e-12&&g.stats.steps<n&&g.state==='playing'){
      while(i<taps.length&&taps[i].t<=g.t+SIM_DT/2){g.press(taps[i].dir);i++;}
      g.step(SIM_DT);acc-=SIM_DT;
    }
  }
  return g;
}
export function poseOf(g){return {x:g.player.x,y:g.y,vx:g.player.vx,vy:g.flight?.vy??260,target:g.player.target??g.player.lane,dimension:g.player.dim,t:g.t};}
