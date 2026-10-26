import {mkdirSync,writeFileSync} from 'node:fs';
import {arenaFor,arenaCenter} from '../js/arena.js';
import {createEmptyLevel,validateLevelData,serializeLevel} from '../js/level-data.js';
import {runReplay} from '../js/playcheck.js';
import {TRAP_DEFAULTS} from '../js/traps.js';
// One authored challenge order/time map; geometry is independently laid out in world units.
const phrases=[
 [4,1,'turn'],[6,1,'turn'],[9,-1,'turn'],[12,-1,'turn'],
 [15,-1,'color'],[18,-1,'color'],[21,1,'color'],[24,1,'color'],[27,1,'color'],[30,-1,'color'],[33,-1,'color'],
 [36,1,'seal'],[39,1,'seal'],[42,-1,'saw'],[45,-1,'seal'],[48,1,'seal'],[51,1,'saw'],[54,1,'color'],
 [57,-1,'mine'],[60,-1,'seal'],[63,-1,'laser'],[65,1,'color'],[67,1,'saw'],[69,1,'seal'],[71,-1,'mine'],[73,-1,'laser'],[75,-1,'seal'],[77,1,'color'],
];
mkdirSync('assets/lab',{recursive:true});
const styles=process.argv.slice(2);
for(const style of (styles.length?styles:['classic','compact','narrow'])){
 const title=style==='narrow'?'ZWEI TIPPS':style.toUpperCase();
 const a=arenaFor(style),l=createEmptyLevel({id:'arena-lab-'+style,name:'ARENA LAB · '+title,arenaStyle:style});
 Object.assign(l,{description:style==='narrow'?'Lokaler Breitentest. Drei Spuren, zwei Tipps von Wand zu Wand, 40 Sekunden.':'Lokaler Arena-Vergleich. Gleiche 28 Aufgaben, unveränderte Spieler-Hitbox, 40 Sekunden.',height:10660,finish:{y:10400},music:'first-pulse',theme:'spire',sections:[{id:'A',name:'TURN',y:0,labelY:20},{id:'B',name:'DIMENSIONS',y:2080,labelY:2040},{id:'C',name:'PULSE',y:4680,labelY:4640},{id:'D',name:'PRECISION',y:7280,labelY:7240}]});
 let lane=a.startLane,dim='blue';const objects=[],taps=[];
 for(const [i,[beat,dir,type]] of phrases.entries()){
  const t=(beat-.6)*.5,y=beat*130;lane=Math.max(0,Math.min(a.lanes-1,lane+dir));dim=dim==='blue'?'red':'blue';taps.push({t,dir});
  // Fixed 16-u player diameter plus independently tuned clearance; no sprite/hitbox scaling.
  const center=arenaCenter(lane,a),gap=style==='compact'?(i<4?64:i<18?60:56):(i<4?96:i<18?84:78),left=Math.max(0,Math.min(a.width-gap,center-gap/2)),right=left+gap;
  if(left>=8)objects.push({id:`g${i}-l`,type:'obstacle',x:0,y,w:left,h:14,dimension:'both'});
  if(a.width-right>=8)objects.push({id:`g${i}-r`,type:'obstacle',x:right,y,w:a.width-right,h:14,dimension:'both'});
  if(type==='color')objects.push({id:'color-'+i,type:'obstacle',x:left,y,w:gap,h:14,dimension:dim==='blue'?'red':'blue'});
  if(type==='seal')objects.push({id:'seal-'+i,type:'seal',x:left,y,w:gap,h:14,openSec:.65});
  if(TRAP_DEFAULTS[type]){
   const o={id:type+'-'+i,type,...TRAP_DEFAULTS[type],x:center-16,y,w:32,h:32,dimension:dim};
   if(type==='saw')Object.assign(o,{axis:'none',amplitude:0,spin:4});
   if(type==='mine')Object.assign(o,{activationRadius:140,blastRadius:70,chargeSec:.7});
   if(type==='laser')Object.assign(o,{startAngle:70,endAngle:110,length:140,warnSec:.9});objects.push(o);
  }
 }
 l.objects=objects;l.replay={taps};const v=validateLevelData(l);if(!v.ok)throw Error(JSON.stringify(v.issues));
 const result=runReplay(v.level,taps);if(!result.won)throw Error(style+' '+JSON.stringify(result));
 writeFileSync('assets/lab/'+style+'.json',serializeLevel(v.level));console.log(style,JSON.stringify(result));
}
