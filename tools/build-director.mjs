// Author the Infinity book from the four Test Infinity blocks. The game only replays these modules.
import {mkdirSync,writeFileSync} from 'node:fs';
import {createEmptyLevel,serializeLevel,validateLevelData} from '../js/level-data.js';
import {runReplay} from '../js/playcheck.js';
import {chunkFingerprint,accepts} from '../js/rift-director.js';
import {hazardRowGap,INFINITY_MAX_HAZARD_GAP} from '../js/endless.js';
import {CLIMB_SPEED} from '../js/config.js';

const CENTER=[45,135,225];
const ENTRY_CLEAR=.2,EXIT_CLEAR=.22;
const TAIL=.22;
const wrap=d=>{const x=((d+180)%360+360)%360-180;return Math.round(x*100)/100;};
const yOf=t=>Math.round(t*CLIMB_SPEED);
const round3=t=>Math.round(t*1000)/1000;
const CYCLE=2.4;
const phaseFor=(t,pos=1.05)=>Math.round((((pos-t)%CYCLE+CYCLE)%CYCLE)/CYCLE*10000)/10000;
const aim=(spin,t,deg)=>wrap(deg-spin*t*180/Math.PI);

function contract(lane,dimension,exit=false){
 const c=CENTER[lane],pad=exit?3:12,vpad=exit?5:40;
 return {x:[+(c-pad).toFixed(2),+(c+pad).toFixed(2)],vx:[-vpad,vpad],target:lane,dimension,lastDirs:[-1,0,1],impulses:['idle'],clearSec:exit?EXIT_CLEAR:ENTRY_CLEAR,traps:exit?'clear':'local-zero'};
}
function fixtures(lane,dimension){
 const c=CENTER[lane],dim=dimension==='blue'?'B':'R';
 return [{id:'center',x:c,vx:0,lastDir:0},{id:'west',x:c-1.2,vx:0,lastDir:-1},{id:'east',x:c+1.2,vx:0,lastDir:1},{id:'drift',x:c,vx:8,lastDir:1}].map(s=>({...s,y:0,lane,dim}));
}
function slit(id,t,lane,gap){
 const y=yOf(t),c=CENTER[lane],half=gap/2,right=c+half;
 return [
  {id:id+'-l',type:'obstacle',x:0,y,w:c-half,h:14,dimension:'both'},
  {id:id+'-r',type:'obstacle',x:right,y,w:270-right,h:14,dimension:'both'},
 ];
}
function bars(id,t,dimension,gap=.32){
 return [0,1].map(i=>({id:id+'-'+i,type:'obstacle',x:0,y:yOf(t+i*gap),w:270,h:14,dimension}));
}
function beam(id,t,dimension,spin,degrees,x=8,length=120){
 return {id,type:'laser',x,y:yOf(t),w:26,h:26,dimension,axis:'none',amplitude:0,period:4,phase:phaseFor(t,.55),startAngle:aim(spin,t,degrees),endAngle:aim(spin,t,degrees),sweepPeriod:3,length,beamWidth:8,warnSec:.5,activeSec:1.5,offSec:.4,disableSec:1,spin};
}
function crossBeam(id,t,dimension,spin,lane){
 const right=lane===2;
 return beam(id,t,dimension,spin,right?180:0,right?214:8,230);
}
function mill(t,spin,length,safeDeg){
 const base=aim(spin,t,safeDeg),y=yOf(t),wings=[[0,'red'],[90,'blue'],[180,'red'],[-90,'blue']];
 return wings.map(([offset,dimension],i)=>{
  const angle=wrap(base+offset);
  return {id:'mill-'+i,type:'laser',x:122,y,w:26,h:26,dimension,axis:'none',amplitude:0,period:4,phase:phaseFor(t),startAngle:angle,endAngle:angle,sweepPeriod:3,length,beamWidth:8,warnSec:.5,activeSec:1.5,offSec:.4,disableSec:1,spin};
 });
}
function finishAfter(last){return yOf(last+TAIL);}

const modules=[];
function add(spec){modules.push(spec);}

// One short relaxed opening. The run starts lane 1 blue and leaves on the left wall, red.
add({
 id:'infinity-opening',name:'Anfang',category:'SLIT',tier:0,stage:0,opening:true,block:'opening',
 entryLane:1,entryDim:'blue',exitLane:0,exitDim:'red',
 taps:[{t:.42,dir:-1}],
 objects:[...slit('open-0',.9,0,64),...slit('open-1',1.45,0,64)],
 finishY:finishAfter(1.45),
 description:'Kurzer lockerer Anfang. Danach folgt direkt die nächste Falle.',
});

const states=[[0,'blue',1],[0,'red',1],[1,'blue',2],[1,'red',2],[2,'blue',1],[2,'red',1]];
for(const stage of [1,2]){
 const tier=stage-1,hole=stage===1?56:40,lead=stage===1?.4:.28,spin=stage===1?1.2:2.5,millSpin=stage===1?1.05:1.6,millLen=stage===1?100:112;
 for(const [lane,dim,dest] of states){
  const dir=dest>lane?1:-1,wall=lane===0?-1:1,flip=dim==='blue'?'red':'blue',tag=`s${stage}-l${lane}${dim[0]}`;
  const slitT=stage===1?.7:.56,pairT=stage===1?.72:.55,pairGap=stage===1?.34:.26;
  if(lane!==1)add({
   id:`infinity-${tag}-pair`,name:`Farbpaar ${stage}`,category:'PAIR',tier,stage,block:'pair',
   entryLane:lane,entryDim:dim,exitLane:lane,exitDim:flip,
   taps:[{t:round3(pairT-lead),dir:wall}],
   objects:bars('pair',pairT,dim,pairGap),finishY:0,
   description:`Stufe ${stage}: ${dim}-${dim}. Der erste Tipp entscheidet den zweiten Balken.`,
  });
  else add({
   id:`infinity-${tag}-pair`,name:`Farbpaar ${stage}`,category:'PAIR',tier,stage,block:'pair',
   entryLane:1,entryDim:dim,exitLane:0,exitDim:flip,
   taps:[{t:round3(pairT-lead),dir:-1}],
   objects:bars('pair',pairT,dim,pairGap),finishY:0,
   description:`Stufe ${stage}: ${dim}-${dim}. Der erste Tipp entscheidet den zweiten Balken.`,
  });
  add({
   id:`infinity-${tag}-slit`,name:`Schlitz ${stage}`,category:'SLIT',tier,stage,block:'slit',
   entryLane:lane,entryDim:dim,exitLane:dest,exitDim:flip,
   taps:[{t:round3(slitT-lead),dir}],
   objects:slit('slit',slitT,dest,hole),finishY:0,
   description:`Stufe ${stage}: ein Schlitz auf Spur ${dest}.`,
  });
  const pass=stage===1?.72:.58,safe=dim==='red'?90:0,far=lane===0?214:8;
  if(lane!==1)add({
   id:`infinity-${tag}-laser`,name:`Drehlaser ${stage}`,category:'LASER',tier,stage,block:'laser',
   entryLane:lane,entryDim:dim,exitLane:lane,exitDim:flip,
   taps:[{t:round3(pass-lead),dir:wall}],
   objects:[crossBeam('spin-a0',pass,dim,spin,lane),crossBeam('spin-a1',pass+.3,dim,-spin,lane),beam('spin-b0',pass+.58,flip,spin*.6,90,far,64),beam('spin-b1',pass+.88,flip,-spin*.6,90,far,64)],
   finishY:0,description:`Stufe ${stage}: zwei rote und zwei blaue Drehlaser.`,
  });
  if(lane!==1)add({
   id:`infinity-${tag}-mill`,name:`Windmühle ${stage}`,category:'MILL',tier,stage,block:'mill',
   entryLane:lane,entryDim:dim,exitLane:lane,exitDim:dim,taps:[],
   objects:mill(.62,millSpin,millLen,safe),finishY:0,
   description:`Stufe ${stage}: vier Flügel um die Mitte, ${dim==='blue'?'blau':'rot'}.`,
  });
 }
}

// Stage 3: slit straight into the windmill, and a color pair straight into the lasers.
for(const [lane,dim] of [[0,'blue'],[0,'red'],[2,'blue'],[2,'red']]){
 const other=lane===0?2:0,dir=lane===0?1:-1,wall=lane===0?-1:1,flip=dim==='blue'?'red':'blue';
 const tag=`s3-${lane}${dim[0]}`;
 const slitT=.76,millT=1.08,safe=dim==='red'?90:0;
 add({
  id:`infinity-${tag}-slit-mill`,name:'Schlitz und Mühle',category:'COMBO',tier:2,stage:3,block:'slit-mill',
  entryLane:lane,entryDim:dim,exitLane:other,exitDim:dim,
  taps:[{t:.22,dir},{t:.46,dir}],
  objects:[...slit('slit',slitT,other,44),...mill(millT,1.35,100,safe)],
  finishY:0,description:'Stufe 3: Schlitz und direkt danach die Windmühle in der erzwungenen Farbe.',
 });
 const pairT=.58,laserT=1.2;
 add({
  id:`infinity-${tag}-pair-laser`,name:'Paar und Laser',category:'COMBO',tier:2,stage:3,block:'pair-laser',
  entryLane:lane,entryDim:dim,exitLane:lane,exitDim:flip,
  taps:[{t:.38,dir:wall}],
  objects:[...bars('pair',pairT,dim),crossBeam('spin-a0',laserT,dim,2.1,lane),crossBeam('spin-a1',laserT+.28,dim,-2.1,lane),beam('spin-b0',laserT+.62,flip,1.4,90,lane===0?214:8,70),beam('spin-b1',laserT+.9,flip,-1.4,90,lane===0?214:8,70)],
  finishY:0,description:'Stufe 3: Farbpaar und direkt danach zwei rote und zwei blaue Drehlaser.',
 });
}

function threatEnd(objects){
 let t=0;
 for(const o of objects){
  const y=o.y/CLIMB_SPEED;
  t=Math.max(t,y+(o.id?.startsWith('mill')?o.length/CLIMB_SPEED:0));
 }
 return t;
}
function materialize(spec){
 const finishY=spec.finishY||finishAfter(threatEnd(spec.objects));
 const l=createEmptyLevel({id:spec.id,name:spec.name,arenaStyle:'narrow'});
 Object.assign(l,{description:spec.description,theme:'spire',music:'neon-ascent',bpm:120,height:finishY+260,finish:{y:finishY},start:{lane:spec.entryLane,dimension:spec.entryDim},objects:spec.objects,replay:{taps:spec.taps}});
 l.chunk={category:spec.category,tier:spec.tier,stage:spec.stage,opening:!!spec.opening,block:spec.block,hazardFamily:spec.block,actions:spec.taps.length,requiredSwitches:spec.taps.length,rhythm:{bpm:120,subdivision:'quarter'},challenge:false,entry:contract(spec.entryLane,spec.entryDim),exit:contract(spec.exitLane,spec.exitDim,true),fixtures:fixtures(spec.entryLane,spec.entryDim)};
 return l;
}
function shifted(taps,i,dt){return taps.map((tap,j)=>j===i?{...tap,t:round3(tap.t+dt)}:tap);}
function prove(spec){
 const level=materialize(spec);
 const gap=hazardRowGap(level);
 if(gap.max>INFINITY_MAX_HAZARD_GAP+1e-6)throw Error(spec.id+' Lücke '+gap.max.toFixed(1));
 let solved=runReplay(level,spec.taps,{proof:true});
 if(!solved.won)throw Error(spec.id+' stirbt an '+(solved.killer?.id||solved.error||solved.progress));
 for(let i=0;i<spec.taps.length;i++)for(const dt of [-.02,.02]){
  const taps=shifted(spec.taps,i,dt);
  if(taps.some((tap,k)=>tap.t<.2||(k&&tap.t-taps[k-1].t<.045)))continue;
  const r=runReplay(level,taps);
  if(!r.won)throw Error(spec.id+' Toleranz Tip '+i+' '+(dt*1000)+' ms an '+(r.killer?.id||r.error));
 }
 const f=solved.proof.finish;
 const exitState={x:f.x,vx:f.vx,target:spec.exitLane,dimension:f.dimension==='B'?'blue':'red',lastDir:spec.taps.at(-1)?.dir||0,impulse:Math.abs(f.x-CENTER[spec.exitLane])>2||Math.abs(f.vx)>30?'active':'idle'};
 if(!accepts(level.chunk.exit,exitState))throw Error(spec.id+' Ausgang '+JSON.stringify(exitState));
 if(exitState.dimension!==spec.exitDim)throw Error(spec.id+' Farbe '+exitState.dimension);
 for(const entry of level.chunk.fixtures){
  const r=runReplay(level,spec.taps,{entry,proof:true});
  if(!r.won)throw Error(spec.id+' Probe '+entry.id+' '+(r.killer?.id||r.error));
 }
 if(spec.block==='pair'||spec.block==='pair-laser'){
  const missed=runReplay(level,spec.taps.slice(1));
  if(missed.won||!String(missed.killer?.id||'').startsWith('pair'))throw Error(spec.id+' ohne ersten Tipp '+JSON.stringify(missed.killer));
  const barsY=spec.objects.filter(o=>o.id.startsWith('pair')).map(o=>o.y).sort((a,b)=>a-b);
  const mid=round3(((barsY[0]+barsY[1])/2)/CLIMB_SPEED);
  const extra=[...spec.taps,{t:mid,dir:spec.entryLane===0?-1:1}].sort((a,b)=>a.t-b.t);
  const between=runReplay(level,extra);
  if(between.won||between.killer?.id!=='pair-1')throw Error(spec.id+' Zwischentipp '+JSON.stringify(between.killer));
 }
 if(spec.block==='laser'){
  const missed=runReplay(level,spec.taps.slice(1));
  if(missed.won||!String(missed.killer?.id||'').startsWith('spin-a'))throw Error(spec.id+' ohne Farbwechsel '+JSON.stringify(missed.killer));
 }
 if(spec.block==='mill'||spec.block==='slit-mill'){
  const turned=structuredClone(level);
  for(const o of turned.objects)if(o.id.startsWith('mill')){o.startAngle=wrap(o.startAngle+90);o.endAngle=o.startAngle;}
  const dead=runReplay(turned,spec.taps);
  if(dead.won||!String(dead.killer?.id||'').startsWith('mill'))throw Error(spec.id+' verdreht überlebt '+JSON.stringify(dead.killer));
 }
 const normalized=validateLevelData(level);
 if(!normalized.ok)throw Error(spec.id+' Schema '+normalized.issues.filter(i=>i.severity==='error').map(i=>i.message).join('; '));
 const stored=JSON.parse(serializeLevel(normalized.level));
 stored.chunk.validation={status:'verified',physics:'spring-240-v1',hash:chunkFingerprint(stored),fixtures:stored.chunk.fixtures.length,proof:solved.proof};
 return {id:spec.id,length:finishYOf(stored),level:stored};
}
function finishYOf(level){return level.finish.y;}

const book={schema:'rift-infinity-chunks',version:2,arenaStyle:'narrow',metersPerUnit:.1,revision:'director-4',chunks:[]};
for(const spec of modules){
 const chunk=prove(spec);
 book.chunks.push(chunk);
 console.log('OK',spec.id,'stage',spec.stage,'taps',spec.taps.length,'y',chunk.length);
}
mkdirSync('assets/endless',{recursive:true});
writeFileSync('assets/endless/director.json',JSON.stringify(book,null,2)+'\n');
const by=new Map();
for(const c of book.chunks){const s=c.level.chunk.stage;by.set(s,(by.get(s)||0)+1);}
console.log('WROTE',book.chunks.length,JSON.stringify([...by.entries()]));
