// Offline authoring/certification only. The game never searches or builds geometry.
import {writeFileSync,mkdirSync} from 'node:fs';
import {createEmptyLevel,validateLevelData,serializeLevel} from '../js/level-data.js';
import {Player} from '../js/player.js';
import {SIM_DT,CLIMB_SPEED,HIT_RADIUS} from '../js/config.js';
import {runReplay} from '../js/playcheck.js';
import {CATEGORIES,chunkFingerprint,accepts} from '../js/rift-director.js';
import {INFINITY_MAX_HAZARD_GAP,hazardRowGap} from '../js/endless.js';
const DURATION=8,ENTRY_CLEAR=1,EXIT_CLEAR=1;
const patterns=[
 [[1,-1,-1,1,1,-1,-1,1],.72],
 [[-1,1,1,-1,-1,1,1,-1],.68],
 [[1,1,-1,-1,-1,1,1,-1],.7],
 [[1,-1,-1,1,1,-1,-1,1],.58],
 [[-1,1,1,-1,-1,1,1,-1],.64],
].map(([dirs,step])=>{
 const taps=[];let t=1.15;
 for(const dir of dirs){taps.push({t:+t.toFixed(3),dir});t+=step;}
 let lane=1,blue=true;
 for(const tap of taps){lane=Math.max(0,Math.min(2,lane+tap.dir));blue=!blue;}
 if(lane!==1||!blue||taps.at(-1).t>DURATION-EXIT_CLEAR)throw Error('pattern leaves home '+JSON.stringify(taps));
 return taps;
});
const titles={FLOW:['Arc','Crosswind','Switchback','Left Current','Right Current'],PHASE:['Veil','Red Echo','Blue Echo','Double Shift','Phase Cascade'],SAW:['Rotor','Pendulum','Shear','Gear Weave','Saw Circuit'],VOLTAGE:['Capacitor','Discharge','Relay','Voltage Split','Overcurrent'],PRECISION:['Needle','Stagger','Chicane','Aperture','Thread'],COMBO:['Confluence','Pulse Relay','Circuit Break','Rift Storm','Infinity Knot']};
const entry={x:[123,147],vx:[-240,240],target:1,dimension:'blue',lastDirs:[-1,0,1],impulses:['idle','active'],clearSec:ENTRY_CLEAR,traps:'local-zero'};
const exit={x:[134.99,135.01],vx:[-.1,.1],target:1,dimension:'blue',lastDirs:[-1,1],impulses:['idle'],clearSec:EXIT_CLEAR,traps:'clear'};
const fixtures=[{id:'center',x:135,vx:0,lastDir:0},...[-12,12].flatMap(dx=>[-240,0,240].map(vx=>({id:`x${dx}-v${vx}`,x:135+dx,vx,lastDir:vx<0?-1:1})))].map(s=>({...s,y:0,lane:1,dim:'B'}));
const book={schema:'rift-infinity-chunks',version:2,arenaStyle:'narrow',metersPerUnit:.1,revision:'director-2',chunks:[]};
let laserSerial=0;
for(const category of CATEGORIES)for(let variant=0;variant<5;variant++){
 const id=`infinity-${category.toLowerCase()}-${variant+1}`,l=createEmptyLevel({id,name:titles[category][variant],arenaStyle:'narrow'});
 const taps=patterns[variant].map(tap=>({...tap})),duration=DURATION;
 l.finish.y=duration*CLIMB_SPEED;l.height=l.finish.y+260;l.theme=({FLOW:'spire',PHASE:'fracture',SAW:'gears',VOLTAGE:'voltage',PRECISION:'core',COMBO:'singularity'})[category];l.music='neon-ascent';l.bpm=120;l.description=`RIFT DIRECTOR · ${category} · ${titles[category][variant]}`;l.objects=[];l.replay={taps};
 let n=0;const add=(o)=>l.objects.push({id:`o${n++}`,...o});
 const tracks=fixtures.map(start=>{
  const p=new Player('narrow');p.reset(1,'B',0);p.body.x=start.x;p.body.v=start.vx;p.lastDir=start.lastDir;
  const poses=[];let ti=0;
  for(let step=0;step<=duration/SIM_DT;step++){
   const t=step*SIM_DT;while(ti<taps.length&&taps[ti].t<=t+SIM_DT/2)p.impulse(taps[ti++].dir);
   poses.push({x:p.x,dim:p.dim,lane:p.lane,vx:p.vx});p.update(SIM_DT,t*CLIMB_SPEED);
  }
  return poses;
 });
 const at=(track,t)=>track[Math.min(track.length-1,Math.round(t/SIM_DT))];
 const span=t=>{const xs=[];for(const track of tracks)for(let u=t-.12;u<=t+.02;u+=.02)xs.push(at(track,Math.max(0,u)).x);return {lo:Math.min(...xs),hi:Math.max(...xs)};};
 const threatBefore=t=>{
  const prev=taps.filter(tap=>tap.t<=t-.06).at(-1);
  if(!prev)return null;
  return at(tracks[0],prev.t-SIM_DT).dim==='B'?'blue':'red';
 };
 function blockade(t){
  const {lo,hi}=span(t),pad=HIT_RADIUS+24,a=lo-pad,b=hi+pad;
  if(b-a>190||a<16||b>254)return;
  const y=t*CLIMB_SPEED;
  if(a>=8)add({type:'obstacle',x:0,y,w:a,h:14,dimension:'both'});
  if(270-b>=8)add({type:'obstacle',x:b,y,w:270-b,h:14,dimension:'both'});
 }
 function colorGate(t,dimension){
  if(!dimension)return;
  add({type:'obstacle',x:0,y:t*CLIMB_SPEED,w:270,h:14,dimension});
 }
 const activeStart=ENTRY_CLEAR+.08,activeEnd=duration-EXIT_CLEAR-.08;
 for(let i=0;i<taps.length;i++){
  const tap=taps[i],threat=threatBefore(tap.t+.2),yTap=tap.t;
  if(category==='PHASE'||category==='COMBO'||category==='FLOW')colorGate(yTap+.16,threat);
  if(category==='PRECISION')blockade(yTap+.2);
  if((category==='SAW'||category==='COMBO')&&i%2===0){
   const x=Math.max(8,Math.min(222,at(tracks[0],yTap).x-20));
   add({type:'saw',x,y:(yTap+.4)*CLIMB_SPEED,w:40,h:40,dimension:threat,axis:'none',amplitude:0,period:4,phase:0,spin:4,durable:true});
  }
  if((category==='VOLTAGE'||category==='COMBO')&&i%2===0){
   const down=laserSerial++%2===1;
   const type=(i/2+variant)%2===0?'mine':'laser';
   const x=Math.max(0,Math.min(242,at(tracks[0],yTap+.3).x-14));
   const pass=(yTap+.48);
   if(type==='mine')add({type,x,y:pass*CLIMB_SPEED,w:28,h:28,dimension:threat,activationRadius:150,chargeSec:.9,blastRadius:80,blastSec:.2});
   else {
    const warn=.5,active=1.1,off=.5,cycle=warn+active+off,target=warn+active/2;
    let phase=((target-pass)/cycle)%1;if(phase<0)phase+=1;
    const angles=down?[-110,-70]:[70,110];
    add({type,x:Math.max(0,Math.min(244,x)),y:(yTap+.42)*CLIMB_SPEED,w:26,h:26,dimension:threat,axis:'none',amplitude:0,period:4,phase:+phase.toFixed(4),startAngle:angles[0],endAngle:angles[1],sweepPeriod:2.4,length:78,beamWidth:8,warnSec:warn,activeSec:active,offSec:off,disableSec:1});
   }
  }
  if((category==='PHASE'||category==='COMBO')&&i===taps.length-1)add({type:'seal',x:97,y:(yTap+.22)*CLIMB_SPEED,w:76,h:14,openSec:.7});
 }
 const mids=[];
 for(let i=0;i<taps.length-1;i++)mids.push((taps[i].t+taps[i+1].t)/2);
 mids.push(Math.min(activeEnd-.04,taps.at(-1).t+.5));
 const wallCount=category==='PRECISION'?0:category==='COMBO'?3:4;
 for(let k=0;k<wallCount;k++)blockade(mids[Math.round(k*(mids.length-1)/Math.max(1,wallCount-1))]);
 // One row at least every 0.8 s. Prefer a solid gap; a full-width color bar still blocks the idle.
 for(let pass=0;pass<12;pass++){
  const rows=l.objects.map(o=>o.y).filter((y,i,a)=>a.findIndex(v=>Math.abs(v-y)<12)===i).sort((a,b)=>a-b);
  const start=ENTRY_CLEAR*CLIMB_SPEED,end=(duration-EXIT_CLEAR)*CLIMB_SPEED;
  const marks=[start,...rows.filter(y=>y>=start-1&&y<=end+1),end];
  let hole=null;
  for(let i=1;i<marks.length;i++)if(marks[i]-marks[i-1]>INFINITY_MAX_HAZARD_GAP){hole=(marks[i-1]+marks[i])/2;break;}
  if(hole===null)break;
  const t=hole/CLIMB_SPEED,before=l.objects.length;
  if(l.objects.length<22)blockade(t);
  if(l.objects.length===before)colorGate(t,threatBefore(t)||'red');
  if(l.objects.length===before)throw Error(id+' unfilled gap at '+t.toFixed(2));
 }
 l.chunk={category,tier:({FLOW:0,PHASE:variant<2?0:1,PRECISION:1,SAW:2,VOLTAGE:3,COMBO:variant>=3?5:4})[category],hazardFamily:category==='COMBO'?'mixed':category.toLowerCase(),actions:taps.length,requiredSwitches:taps.length,rhythm:{bpm:120,subdivision:variant>=3?'eighth':'quarter'},challenge:variant===4&&['SAW','VOLTAGE','COMBO'].includes(category),entry:structuredClone(entry),exit:structuredClone(exit),fixtures:structuredClone(fixtures)};
 const gap=hazardRowGap(l);
 if(gap.max>INFINITY_MAX_HAZARD_GAP)throw Error(id+' gap '+gap.max.toFixed(1));
 let solved=runReplay(l,taps,{proof:true});let searched=1;
 if(!solved.won){for(const delta of [-.04,.04,-.08,.08]){const candidate=taps.map(tap=>({...tap,t:+(tap.t+delta).toFixed(3)}));if(candidate.some((tap,i)=>tap.t<.2||tap.t>duration-EXIT_CLEAR||(i&&tap.t-candidate[i-1].t<.045)))continue;searched++;const r=runReplay(l,candidate,{proof:true});if(r.won){l.replay.taps=candidate;solved=r;break;}}}
 if(!solved.won)throw Error(id+' fails '+JSON.stringify(solved));
 const f=solved.proof.finish;if(!accepts(exit,{x:f.x,vx:f.vx,target:1,dimension:f.dimension==='B'?'blue':'red',lastDir:l.replay.taps.at(-1).dir,impulse:'idle'}))throw Error(id+' exit '+JSON.stringify(f));
 for(const entryState of fixtures){const r=runReplay(l,l.replay.taps,{entry:entryState,proof:true});if(!r.won)throw Error(id+' fixture '+entryState.id+' '+JSON.stringify(r.killer||r));}
 const normalized=validateLevelData(l);if(!normalized.ok)throw Error(id+' schema '+JSON.stringify(normalized.issues));
 const level=JSON.parse(serializeLevel(normalized.level));
 level.chunk.validation={status:'verified',physics:'spring-240-v1',hash:chunkFingerprint(level),fixtures:fixtures.length,searched,proof:solved.proof};
 book.chunks.push({id,length:l.finish.y,level});console.log('VERIFIED',id,'gap',hazardRowGap(level).max.toFixed(0),'objs',level.objects.length);
}
mkdirSync('assets/endless',{recursive:true});writeFileSync('assets/endless/director.json',JSON.stringify(book,null,2)+'\n');
console.log('WROTE',book.chunks.length);
