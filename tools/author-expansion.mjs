// Explicit hand-authored phrases, converted OFFLINE to editable shared JSON.
import {writeFileSync,readFileSync} from 'node:fs';
import {validateLevelData,serializeLevel} from '../js/level-data.js';
import {TRAP_DEFAULTS} from '../js/traps.js';
import {runReplay} from '../js/playcheck.js';
const round=v=>Math.round(v*1e6)/1e6;
export function author({id,name,bpm,beats,difficulty,theme,sections,gates,hints=[],music=id,wide=false}) {
 const at=b=>b*60/bpm,objects=[],taps=[];let lane=1,dim='blue';
 for(const [index,[beat,dir,kind='color',axis='none',lead=.6]] of gates.entries()) {
  if(dir){taps.push({t:round(at(beat-lead)),dir});lane=Math.max(0,Math.min(3,lane+dir));dim=dim==='blue'?'red':'blue';}
  const y=round(at(beat)*260),gap=wide?140:difficulty==='extreme'?76:86,left=Math.max(0,lane*90+45-gap/2),right=Math.min(360,lane*90+45+gap/2);
  if(left>=8)objects.push({id:`wall-${index}-l`,type:'obstacle',x:0,y,w:left,h:14,dimension:'both'});
  if(360-right>=8)objects.push({id:`wall-${index}-r`,type:'obstacle',x:right,y,w:360-right,h:14,dimension:'both'});
  const ghost=kind.startsWith('ghost-'),type=ghost?kind.slice(6):kind;
  const membrane=Math.min(84,gap),mx=lane*90+45-membrane/2;
  if(type==='color')objects.push({id:`color-${index}`,type:'obstacle',x:mx,y,w:membrane,h:14,dimension:dim==='blue'?'red':'blue'});
  else if(type==='seal')objects.push({id:`seal-${index}`,type:'seal',x:mx,y,w:membrane,h:14,openSec:.65});
  else if(TRAP_DEFAULTS[type]) {
   const d=TRAP_DEFAULTS[type],o={id:`${type}-${index}`,type,...d,x:lane*90+45-d.w/2,y,dimension:ghost?(dim==='blue'?'red':'blue'):dim};
   if(type==='saw'){o.axis=axis;o.amplitude=axis==='none'?0:20;o.period=3+(index%3)*.5;o.spin=3.5+index%3;o.phase=(index%4)/4;}
   if(type==='laser'){o.startAngle=75;o.endAngle=105;o.length=180;o.sweepPeriod=3;o.phase=((o.warnSec+.2-at(beat))%(o.warnSec+o.activeSec+o.offSec)+(o.warnSec+o.activeSec+o.offSec))%(o.warnSec+o.activeSec+o.offSec)/(o.warnSec+o.activeSec+o.offSec);}
   objects.push(o);
  }
 }
 for(const [i,[b,text]] of hints.entries())objects.push({id:`hint-${i}`,type:'hint',y:round(at(b)*260),text});
 const raw={schema:'rift-climb-level',version:1,id,name,description:`RIFT EXPANSION · ${name}. Handgefertigte Phrasen und regulärer Replay-Nachweis.`,bpm,beatsPerBar:4,height:round(at(beats)*260)+260,start:{lane:1,dimension:'blue'},finish:{y:round(at(beats)*260)},theme,music,difficulty,
  sections:sections.map(([b,name],i)=>({id:'ABCDE'[i],name,y:round(at(b)*260),labelY:round(at(b)*260)-35})),objects,replay:{taps}};
 const v=validateLevelData(raw);if(!v.ok)throw Error(JSON.stringify(v.issues));return v.level;
}
const gears=()=>author({id:'shattered-gears',name:'Shattered Gears',bpm:120,beats:100,difficulty:'expert',theme:'gears',sections:[[0,'MACHINE WAKE'],[20,'CROSS SHAFTS'],[45,'SHATTER'],[75,'GEARHEART']],hints:[[1,'SÄGEN: FARBE BEACHTEN'],[46,'PASSENDER PULSE ZERSTÖRT SÄGEN']],gates:[
 [4,1,'ghost-saw','x'],[8,-1,'color'],[12,-1,'ghost-saw','y'],[16,1,'color'],
 [22,1,'ghost-saw','none'],[26,1,'ghost-saw','y'],[30,-1,'color'],[34,-1,'ghost-saw','x'],[38,-1,'color'],[42,1,'ghost-saw','y'],
 [47,1,'saw','x'],[50,1,'saw','y'],[53,-1,'seal'],[56,-1,'saw','none'],[59,-1,'saw','x'],[62,1,'seal'],[65,1,'saw','y'],[68,-1,'saw','x'],[71,1,'seal'],[74,1,'saw','none'],
 [77,-1,'saw','x'],[79,-1,'seal'],[81,-1,'saw','y'],[83,1,'color'],[85,1,'saw','none'],[87,1,'seal'],[89,-1,'saw','y'],[91,-1,'seal'],[93,-1,'saw','x'],[95,1,'color'],[97,1,'saw','none']
]});
const voltage=()=>author({id:'voltage-run',name:'Voltage Run',bpm:132,beats:132,difficulty:'hard',theme:'voltage',sections:[[0,'CAPACITOR'],[26.4,'SWEEP ARRAY'],[59.4,'CROSS CIRCUIT'],[99,'HIGH VOLTAGE']],hints:[[1,'MINEN WARNEN VOR DER EXPLOSION'],[28,'LASER: WARNLINIE → STRAHL']],gates:[
 [6,-1,'ghost-mine'],[10,1,'mine'],[14,1,'color'],[18,1,'ghost-mine'],[22,-1,'mine'],[26,-1,'color'],
 [30,1,'ghost-laser'],[34,1,'laser'],[38,-1,'color'],[42,-1,'ghost-laser'],[46,-1,'laser'],[50,1,'color'],[54,1,'laser'],[58,-1,'seal'],
 [62,-1,'mine'],[65,1,'laser'],[68,1,'seal'],[71,1,'mine'],[74,-1,'laser'],[77,-1,'mine'],[80,-1,'seal'],[83,1,'laser'],[86,1,'mine'],[89,-1,'laser'],[92,1,'seal'],[95,1,'mine'],[98,-1,'laser'],
 [101,-1,'mine'],[103,-1,'seal'],[105,1,'laser'],[107,1,'mine'],[109,1,'laser'],[111,-1,'seal'],[113,-1,'mine'],[115,-1,'laser'],[117,1,'mine'],[119,1,'seal'],[121,1,'laser'],[123,-1,'mine'],[125,-1,'laser'],[128,-1,'seal']
]});
const singularity=()=>author({id:'singularity-rush',name:'Singularity Rush',bpm:144,beats:180,difficulty:'extreme',theme:'singularity',sections:[[0,'EVENT HORIZON'],[36,'SHEAR FIELD'],[72,'ION STORM'],[108,'SINGULARITY'],[153,'ESCAPE VELOCITY']],gates:[
 [5,1,'color'],[7,1,'seal'],[9,-1,'color'],[11,-1,'color'],[13,-1,'seal'],[15,1,'color'],[17,1,'seal'],[19,1,'color'],[21,-1,'color'],[23,-1,'seal'],[25,-1,'color'],[27,1,'color'],[29,1,'seal'],[31,-1,'color'],[34,1,'seal'],
 [38,1,'saw','x'],[40,-1,'seal'],[42,-1,'saw','y'],[44,-1,'seal'],[46,1,'saw','none'],[48,1,'seal'],[50,1,'saw','y'],[52,-1,'seal'],[54,-1,'saw','x'],[56,-1,'seal'],[58,1,'saw','y'],[60,1,'seal'],[62,1,'saw','x'],[64,-1,'seal'],[66,-1,'saw','none'],[69,1,'seal'],
 [74,-1,'mine'],[76,1,'laser'],[78,1,'seal'],[80,1,'mine'],[82,-1,'laser'],[84,-1,'mine'],[86,-1,'laser'],[88,1,'seal'],[90,1,'laser'],[92,1,'mine'],[94,-1,'laser'],[96,-1,'mine'],[98,-1,'seal'],[100,1,'laser'],[102,1,'mine'],[105,-1,'laser'],
 [110,-1,'saw','x'],[111.5,1,'mine'],[113,1,'laser'],[114.5,1,'seal'],[116,-1,'saw','y'],[117.5,-1,'mine'],[120,-1,'laser'],[121.5,1,'seal'],[123,1,'saw','x'],[124.5,1,'laser'],[126,-1,'mine'],[127.5,-1,'seal'],
 [130,-1,'saw','y'],[130.75,1,'mine'],[131.5,1,'laser'],[132.25,1,'seal'],[133,-1,'saw','none'],[133.75,-1,'mine'],[136,-1,'laser'],[136.75,1,'seal'],[137.5,1,'saw','x'],[138.25,1,'mine'],[139,-1,'laser'],[139.75,-1,'seal'],
 [142,-1,'saw','y'],[142.75,1,'laser'],[143.5,1,'mine'],[144.25,1,'seal'],[145,-1,'saw','none'],[145.75,-1,'mine'],[148,-1,'laser'],[149,1,'seal'],[150,1,'saw','x'],
 [155,1,'mine'],[156,-1,'laser'],[157,-1,'saw','y'],[158,-1,'seal'],[159,1,'mine'],[160,1,'laser'],[162,1,'saw','none'],[163,-1,'seal'],[164,-1,'mine'],[165,-1,'laser'],[166,1,'saw','x'],[167,1,'seal'],[169,1,'mine'],[170,-1,'laser'],[171,-1,'saw','y'],[172,-1,'seal'],[173,1,'mine'],[174,1,'laser'],[176,1,'seal']
]});
if(process.argv[1]?.endsWith('author-expansion.mjs')) {
 const which=process.argv[2],factory={gears,voltage,singularity}[which];if(!factory)throw Error('Choose gears, voltage or singularity, in that order.');
 const level=factory(),proof=runReplay(level,level.replay.taps);console.log(level.id,JSON.stringify(proof));if(!proof.won)throw Error('Replay failed');
 writeFileSync(`assets/levels/${level.id}.json`,serializeLevel(level));
 const index=JSON.parse(readFileSync('assets/levels/index.json','utf8'));if(!index.levels.some(l=>l.id===level.id))index.levels.splice(index.levels.findIndex(l=>!l.campaign),0,{id:level.id,name:level.name,file:level.id+'.json',campaign:true});writeFileSync('assets/levels/index.json',JSON.stringify(index,null,2)+'\n');
}
