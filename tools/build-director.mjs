// Offline authoring/certification only. The game never searches or builds geometry.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createEmptyLevel,validateLevelData,serializeLevel} from '../js/level-data.js';
import {Player} from '../js/player.js';
import {SIM_DT,CLIMB_SPEED} from '../js/config.js';
import {runReplay} from '../js/playcheck.js';
import {CATEGORIES,chunkFingerprint,accepts} from '../js/rift-director.js';
const patterns=[
 [[2,1],[3.25,-1]],
 [[2,-1],[2.75,1],[3.5,1],[4.25,-1]],
 [[2,1],[2.5,-1],[3,-1],[3.5,1]],
 [[2,-1],[2.25,-1],[2.5,1],[3,1],[3.5,1],[4,-1]],
 [[2,1],[2.25,1],[2.5,-1],[3,-1],[3.5,-1],[4,1]],
];
const titles={FLOW:['Arc','Crosswind','Switchback','Left Current','Right Current'],PHASE:['Veil','Red Echo','Blue Echo','Double Shift','Phase Cascade'],SAW:['Rotor','Pendulum','Shear','Gear Weave','Saw Circuit'],VOLTAGE:['Capacitor','Discharge','Relay','Voltage Split','Overcurrent'],PRECISION:['Needle','Stagger','Chicane','Aperture','Thread'],COMBO:['Confluence','Pulse Relay','Circuit Break','Rift Storm','Infinity Knot']};
const entry={x:[123,147],vx:[-240,240],target:1,dimension:'blue',lastDirs:[-1,0,1],impulses:['idle','active'],clearSec:1.8,traps:'local-zero'};
const exit={x:[134.99,135.01],vx:[-.1,.1],target:1,dimension:'blue',lastDirs:[-1,1],impulses:['idle'],clearSec:1.5,traps:'clear'};
const fixtures=[{id:'center',x:135,vx:0,lastDir:0},...[-12,12].flatMap(dx=>[-240,0,240].map(vx=>({id:`x${dx}-v${vx}`,x:135+dx,vx,lastDir:vx<0?-1:1})))].map(s=>({...s,y:0,lane:1,dim:'B'}));
const book={schema:'rift-infinity-chunks',version:2,arenaStyle:'narrow',metersPerUnit:.1,revision:'director-1',chunks:[]};
for(const category of CATEGORIES)for(let variant=0;variant<5;variant++){
 const id=`infinity-${category.toLowerCase()}-${variant+1}`,l=createEmptyLevel({id,name:titles[category][variant],arenaStyle:'narrow'});
 const taps=patterns[variant].map(([t,dir])=>({t,dir})),duration=variant===0?6:variant===1?8:6;
 l.finish.y=duration*260;l.height=l.finish.y+260;l.theme=({FLOW:'spire',PHASE:'fracture',SAW:'gears',VOLTAGE:'voltage',PRECISION:'core',COMBO:'singularity'})[category];l.music='neon-ascent';l.bpm=120;l.description=`RIFT DIRECTOR · ${category} · ${titles[category][variant]}`;l.objects=[];l.replay={taps};
 let n=0;const add=(o)=>l.objects.push({id:`o${n++}`,...o});
 // Sample the actual spring trajectory at authored moments, not a lane approximation.
 const poses=[],p=new Player('narrow');let ti=0;
 for(let step=0;step<=duration/SIM_DT;step++){
  const t=step*SIM_DT;while(ti<taps.length&&taps[ti].t<=t+SIM_DT/2)p.impulse(taps[ti++].dir);
  poses.push({x:p.x,dim:p.dim,vx:p.vx});p.update(SIM_DT,t*260);
 }
 const at=t=>poses[Math.round(t/SIM_DT)],dim=d=>d==='B'?'blue':'red';
 function gate(t,gap=92){const x=at(t).x,y=t*260,a=Math.max(0,x-gap/2),b=Math.min(270,x+gap/2);if(a>=8)add({type:'obstacle',x:0,y,w:a,h:14,dimension:'both'});if(270-b>=8)add({type:'obstacle',x:b,y,w:270-b,h:14,dimension:'both'});}
 for(let i=0;i<taps.length;i++){
  const tap=taps[i],t=tap.t+Math.min(.3,((taps[i+1]?.t??tap.t+.6)-tap.t)/2),pose=at(t);
  if(category==='FLOW')gate(tap.t+.3,variant?104:124);
  if(category==='PRECISION')gate(tap.t+.3,variant>=3?100:82);
  if(category==='PHASE'||category==='COMBO')add({type:'obstacle',x:0,y:t*260,w:270,h:14,dimension:pose.dim==='B'?'red':'blue'});
  // Every pulse target is within the real expanding circle emitted BEFORE movement.
  if((category==='SAW'||category==='COMBO')&&i%2===0){const x=at(tap.t).x;add({type:'saw',x:Math.max(28,Math.min(202,x-20)),y:(tap.t+.24)*260,w:40,h:40,dimension:dim(pose.dim),axis:'x',amplitude:10+variant*2,period:2.5+variant*.25,phase:variant*.1,spin:4});}
  if((category==='VOLTAGE'||category==='COMBO')&&i%2===0){const type=(i/2+variant)%2===0?'mine':'laser',x=at(tap.t).x;add(type==='mine'?{type,x:Math.max(0,Math.min(242,x-14)),y:(tap.t+.25)*260,w:28,h:28,dimension:dim(pose.dim),activationRadius:160,chargeSec:.85,blastRadius:95,blastSec:.22}:{type,x:Math.max(0,Math.min(244,x-13)),y:(tap.t+.25)*260,w:26,h:26,dimension:dim(pose.dim),axis:'none',amplitude:0,period:4,phase:0,startAngle:75,endAngle:105,sweepPeriod:3,length:100,beamWidth:8,warnSec:1,activeSec:.4,offSec:1,disableSec:1.2});}
  if((category==='PHASE'||category==='COMBO'||category==='SAW')&&i===taps.length-1)add({type:'seal',x:0,y:(tap.t+.27)*260,w:270,h:14,openSec:.75});
 }
 l.chunk={category,tier:({FLOW:0,PHASE:variant<2?0:1,PRECISION:1,SAW:2,VOLTAGE:3,COMBO:variant>=3?5:4})[category],hazardFamily:category==='COMBO'?'mixed':category.toLowerCase(),actions:taps.length,requiredSwitches:taps.length,rhythm:{bpm:120,subdivision:variant>=3?'eighth':'quarter'},challenge:variant===4&&['SAW','VOLTAGE','COMBO'].includes(category),entry:structuredClone(entry),exit:structuredClone(exit),fixtures:structuredClone(fixtures)};
 // Bounded local timing search repairs the authoring candidate using the real Game.
 let solved=runReplay(l,taps,{proof:true});let searched=1;
 if(!solved.won){for(const delta of [-.05,.05,-.1,.1]){const candidate=taps.map(t=>({...t,t:t.t+delta}));searched++;const r=runReplay(l,candidate,{proof:true});if(r.won){l.replay.taps=candidate;solved=r;break;}}}
 if(!solved.won)throw Error(id+' fails '+JSON.stringify(solved));
 const f=solved.proof.finish;if(!accepts(exit,{x:f.x,vx:f.vx,target:1,dimension:f.dimension==='B'?'blue':'red',lastDir:l.replay.taps.at(-1).dir,impulse:'idle'}))throw Error(id+' exit '+JSON.stringify(f));
 for(const entryState of fixtures){const r=runReplay(l,l.replay.taps,{entry:entryState,proof:true});if(!r.won)throw Error(id+' fixture '+entryState.id+' '+JSON.stringify(r));}
 // Normalization is the exact editor/game roundtrip before signing the certificate.
 const normalized=validateLevelData(l);if(!normalized.ok)throw Error(id+' schema '+JSON.stringify(normalized.issues));
 const level=JSON.parse(serializeLevel(normalized.level));
 level.chunk.validation={status:'verified',physics:'spring-240-v1',hash:chunkFingerprint(level),fixtures:fixtures.length,searched,proof:solved.proof};
 book.chunks.push({id,length:l.finish.y,level});console.log('VERIFIED',id,l.replay.taps.length,fixtures.length);
}
mkdirSync('assets/endless',{recursive:true});writeFileSync('assets/endless/director.json',JSON.stringify(book,null,2)+'\n');
