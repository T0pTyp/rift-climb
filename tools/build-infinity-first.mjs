// 20 authored tasks, including the opening. Mirroring is certified independently.
import {writeFileSync} from 'node:fs';
import {createEmptyLevel,validateLevelData,serializeLevel} from '../js/level-data.js';
import {runReplay,checkChunkPlayability} from '../js/playcheck.js';
import {chunkFingerprint} from '../js/rift-director.js';
const patterns=[
 ['wide-arc','FLOW',0,[1,-1],['flow','flow'],1.1],
 ['double-arc','FLOW',0,[1,-1,-1,1],['flow','flow','flow','flow'],1],
 ['echo','FLOW',0,[-1,1,-1,1],['flow','flow','flow','flow'],1.15],
 ['breathing-room','FLOW',0,[1,-1],['flow','flow'],1.35],
 ['polarity','PHASE',1,[1,-1],['phase','phase'],1.1],
 ['phase-weave','PHASE',1,[1,-1,-1,1],['phase','flow','phase','flow'],.9],
 ['color-echo','PHASE',1,[-1,1,-1,1],['flow','phase','flow','phase'],1],
 ['gold-door','PULSE',2,[1,-1],['seal','phase'],1.05],
 ['twin-seals','PULSE',2,[1,-1,-1,1],['seal','flow','seal','phase'],.95],
 ['gear-drift','SAW',2,[1,-1],['avoid-saw','phase'],1.05],
 ['gear-release','SAW',3,[1,-1,-1,1],['saw','phase','avoid-saw','flow'],.85],
 ['capacitor','VOLTAGE',3,[1,-1],['mine','phase'],1.05],
 ['warning-ray','VOLTAGE',3,[1,-1,-1,1],['laser','flow','laser','phase'],.9],
 ['discharge','VOLTAGE',4,[1,-1,-1,1],['mine','laser','phase','seal'],.8],
 ['needle-turn','PRECISION',4,[1,-1,-1,1],['precision','phase','precision','seal'],.72],
 ['cross-current','PRECISION',5,[1,-1,-1,1,1,-1],['precision','saw','phase','precision','seal','phase'],.68],
 ['reactor','COMBO',5,[1,-1,-1,1],['saw','mine','laser','seal'],.75],
 ['storm-weave','COMBO',6,[1,-1,-1,1,1,-1],['seal','saw','phase','mine','precision','laser'],.68],
 ['core-cascade','COMBO',6,[-1,1,1,-1,-1,1,1,-1],['saw','seal','mine','precision','laser','phase','seal','precision'],.7],
];
const center=lane=>45+90*lane;
const contract=exit=>({x:[135-(exit ? .15 : 1.5),135+(exit ? .15 : 1.5)],vx:[exit?-1:-12,exit?1:12],target:1,dimension:'blue',lastDirs:[-1,0,1],impulses:['idle'],clearSec:exit ? .45 : .5,traps:exit?'clear':'local-zero'});
const fixtures=()=>[-1.5,0,1.5].flatMap(dx=>[-12,0,12].map(vx=>({id:`x${dx}v${vx}`,x:135+dx,vx,y:0,lane:1,dim:'B',lastDir:Math.sign(vx)})));
function gate(objects,id,t,lane,gap){const c=center(lane);objects.push(...[{id:id+'-l',type:'obstacle',x:0,y:t*260,w:c-gap/2,h:12,dimension:'both'},{id:id+'-r',type:'obstacle',x:c+gap/2,y:t*260,w:270-c-gap/2,h:12,dimension:'both'}].filter(o=>o.w>=8));}
function build([pattern,category,tier,dirs,kinds,interval],mirror){
 const id='infinity-'+pattern+(mirror?'-mirror':''),l=createEmptyLevel({id,name:pattern,arenaStyle:'narrow'});
 let lane=1,dim='blue';const taps=[],objects=[],interactions=[];
 dirs.forEach((direction,i)=>{
  const dir=direction*(mirror?-1:1),t=+(i*interval+.55).toFixed(3),old=dim;lane=Math.max(0,Math.min(2,lane+dir));dim=dim==='blue'?'red':'blue';taps.push({t,dir});
  const kind=kinds[i],pass=+(t+(kind==='avoid-saw' ? .5 : kind==='seal'||['saw','mine','laser'].includes(kind) ? .24 : .42)).toFixed(3),c=center(lane),row='r'+i;
  const gap=kind==='flow'?112:kind==='precision'?42:tier<3?80:62;
  if(kind==='seal')objects.push({id:row+'-seal',type:'seal',x:0,y:pass*260,w:270,h:16,openSec:.85});
  else gate(objects,row,pass,lane,gap);
  if(kind==='phase')objects.push({id:row+'-phase',type:'obstacle',x:0,y:pass*260+24,w:270,h:12,dimension:old});
  if(kind==='saw'||kind==='avoid-saw'){
   const x=kind==='saw'?c:lane===2?45:225;objects.push({id:row+'-saw',type:'saw',x:x-18,y:pass*260,w:36,h:36,dimension:dim,axis:'x',amplitude:kind==='saw'?10:22,period:3.2,phase:.1,spin:3.2,pulseBreakable:true});
  }
  if(kind==='mine')objects.push({id:row+'-mine',type:'mine',x:c-14,y:pass*260,w:28,h:28,dimension:dim,activationRadius:115,chargeSec:.85,blastRadius:78,blastSec:.2});
  if(kind==='laser')objects.push({id:row+'-laser',type:'laser',x:c-13,y:pass*260,w:26,h:26,dimension:dim,axis:'none',amplitude:0,period:4,phase:0,startAngle:-25,endAngle:25,sweepPeriod:3.2,length:100,beamWidth:7,warnSec:.85,activeSec:.45,offSec:.9,disableSec:1.2});
  if(['seal','saw','mine','laser'].includes(kind))interactions.push({input:i,target:row+'-'+kind,kind});
 });
 if(lane!==1||dim!=='blue')throw Error(pattern+' must return to its declared exit');
 const duration=+(taps.at(-1).t+1.15).toFixed(3);
 Object.assign(l,{description:`${category}: ${kinds.join(' / ')}. Gespiegelte Geometrie separat geprüft.`,theme:'spire',music:'neon-ascent',bpm:120,height:duration*260+260,finish:{y:duration*260},start:{lane:1,dimension:'blue'},objects,replay:{taps}});
 l.chunk={pattern,mirrored:mirror,category,tier,stage:tier,opening:false,hazardFamily:category,actions:taps.length,requiredSwitches:taps.length,interactions,rhythm:{bpm:120,subdivision:'quarter'},challenge:tier>=5,entry:contract(false),exit:contract(true),fixtures:fixtures()};
 return l;
}
function opening(){const l=build(patterns[0],false);l.id='infinity-opening';l.name='First breath';l.objects=[];for(const [i,t] of [.9,1.9].entries())for(const x of [0,250])l.objects.push({id:`welcome-${i}-${x}`,type:'obstacle',x,y:t*260,w:20,h:12,dimension:'both'});l.replay={taps:[]};l.finish.y=2.55*260;l.height=l.finish.y+260;l.chunk={...l.chunk,pattern:'opening',opening:true,actions:0,requiredSwitches:0,interactions:[]};return l;}
const levels=[opening(),...patterns.flatMap(p=>[build(p,false),build(p,true)])];
const book={schema:'rift-infinity-chunks',version:2,arenaStyle:'narrow',metersPerUnit:.1,revision:'infinity-first-1',balance:'infinity-first',chunks:[]};
for(const level of levels){
 const v=validateLevelData(level);if(!v.ok)throw Error(level.id+JSON.stringify(v.issues));
 const l=JSON.parse(serializeLevel(v.level)),proof=checkChunkPlayability(l);
 if(!proof.ok)throw Error(l.id+': '+proof.message+' '+JSON.stringify(proof.replay));
 for(let i=0;i<l.replay.taps.length;i++)for(const dt of [-.04,.04]){const taps=l.replay.taps.map((t,j)=>({...t,t:t.t+(j===i?dt:0)}));const r=runReplay(l,taps);if(!r.won)throw Error(l.id+' timing '+i+'/'+dt+': '+JSON.stringify(r));}
 l.chunk.validation=proof.certificate;l.chunk.validation.hash=chunkFingerprint(l);
 book.chunks.push({id:l.id,length:l.finish.y,level:l});console.log('VERIFIED',l.id);
}
writeFileSync('assets/endless/director.json',JSON.stringify(book,null,2)+'\n');
console.log(`${book.chunks.length} variants / ${new Set(levels.map(l=>l.chunk.pattern)).size} authored tasks written`);


