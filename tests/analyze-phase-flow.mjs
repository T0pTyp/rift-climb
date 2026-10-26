// Internal arena / motion / replay audit. Nothing here is reachable from the game UI.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {Player} from '../js/player.js';
import {runReplay} from '../js/playcheck.js';
import {SIM_DT,STEER_OMEGA,HIT_RADIUS} from '../js/config.js';
import {arenaExperiment,playExperiment} from './lib/flow-lab.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8')),ids=['first-pulse','fractured-rhythm','overload','shattered-gears','voltage-run','singularity-rush'];
const levels=ids.map(id=>read(`assets/levels/${id}.json`)),book=read('assets/endless/chunks.json');
const variants=[];let checks=0;
for(const width of [360,324,306]){
 const scale=width/360,arena={id:'classic',width,lanes:4,step:90*scale,inset:45*scale,startLane:1},measurements=[];
 for(const scenario of ['rest','geometric-center','moving-forward','reversal','wall','two-taps']){
  const p=new Player();p.arena=arena;p.reset(scenario==='wall'?3:1,'B',0);
  if(scenario==='geometric-center')p.body.x=width/2;
  if(scenario==='moving-forward'||scenario==='reversal'){p.impulse(1);p.update(.06,0);}
  const x=p.x,vx=p.vx,dim=p.dim;let firstReverseMs=null,peak=0;
  p.impulse(scenario==='reversal'?-1:1);
  const end=scenario==='two-taps'?.28:.22;
  for(let i=0;i<Math.round(end/SIM_DT);i++){
   if(scenario==='two-taps'&&i===Math.round(.06/SIM_DT))p.impulse(1);
   p.update(SIM_DT,0);peak=Math.max(peak,Math.abs(p.vx));
   if(scenario==='reversal'&&p.vx<=0&&firstReverseMs===null)firstReverseMs=(i+1)*SIM_DT*1000;
   assert.ok(p.x-HIT_RADIUS>=0&&p.x+HIT_RADIUS<=width);checks++;
  }
  const exact=new Player();exact.arena=arena;exact.reset(1,'B',0);exact.impulse(1);exact.update(.22,0);
  measurements.push({scenario,initialX:x,initialVx:vx,initialDim:dim,sampledDurationMs:Math.round(end/SIM_DT)*SIM_DT*1000,displacement:p.x-x,exactRestDisplacementAt220ms:exact.x-arena.inset-arena.step,finalVx:p.vx,finalDim:p.dim,peak,firstReverseMs});
 }
 const results=[];
 for(const l of [...levels,...book.chunks.map(c=>c.level)]){
  const {game,projected,repositioned}=arenaExperiment(l,width),outcome=playExperiment(game,projected.replay.taps);
  if(width===360)assert.ok(outcome.won,l.id);
  assert.ok(projected.objects.filter(o=>o.type!=='hint').every(o=>o.x>=0&&o.x+o.w<=width+1e-8));checks++;
  results.push({id:l.id,...outcome,repositioned,lookaheadSec:game.lookaheadSec,pulseRadius:120});
 }
 variants.push({width,scale,step:arena.step,timeTo95ms:220,wallToWallInputs:3,hitRadius:HIT_RADIUS,visibleBodyWidth:22,wallHitboxMargin:arena.inset-HIT_RADIUS,initialAcceleration:STEER_OMEGA**2*arena.step,measurements,results});
 console.log(`Arena ${width}: campaign ${results.slice(0,6).filter(r=>r.won).length}/6, chunks ${results.slice(6).filter(r=>r.won).length}/20; body/hitbox unchanged`);
}
const reactions=[];
for(const l of levels){
 const rows=[...new Set(l.objects.filter(o=>o.type==='obstacle'||o.type==='seal').map(o=>o.y))].sort((a,b)=>a-b);
 const inputGaps=l.replay.taps.slice(1).map((p,i)=>p.t-l.replay.taps[i].t),failures=[];
 if(process.argv.includes('--timing'))for(let i=0;i<l.replay.taps.length;i++)for(const sign of [-1,1]){
  const taps=l.replay.taps.map((p,j)=>i===j?{...p,t:p.t+sign*.05}:p),result=runReplay(l,taps);
  if(!result.won)failures.push({tap:i,time:l.replay.taps[i].t,offsetMs:sign*50,killer:result.killer});
 }
 reactions.push({id:l.id,durationSec:l.finish.y/260,minimumInputSpacingSec:Math.min(...inputGaps),minimumStaticRowCenterSpacingSec:Math.min(...rows.slice(1).map((y,i)=>(y-rows[i])/260)),isolated50msFailures:process.argv.includes('--timing')?failures:null});
 if(process.argv.includes('--timing'))console.log(l.id+' isolated ±50ms failures: '+JSON.stringify(failures));
}
mkdirSync('test-results/m78',{recursive:true});writeFileSync('test-results/m78/arena-reactions'+(process.argv.includes('--timing')?'-timing':'')+'.json',JSON.stringify({checks,timingAudit:process.argv.includes('--timing'),variants,reactions},null,2));console.log(`${checks} motion/bounds/arena replay assertions passed`);
