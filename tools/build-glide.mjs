import {writeFileSync,mkdirSync} from 'node:fs';
import {createEmptyLevel,validateLevelData} from '../js/level-data.js';
import {TRAP_DEFAULTS} from '../js/traps.js';
import {makeTestGame} from '../experiments/rift-glide/game.js';
import {playTestReplay,poseOf} from '../experiments/rift-glide/replay.js';
import {glideConfig} from '../experiments/rift-glide/config.js';
import {SIM_DT} from '../js/config.js';
import {chunkFingerprint} from '../js/rift-director.js';

const out='experiments/rift-glide/data';mkdirSync(out,{recursive:true});
const taps=Array.from({length:8},(_,i)=>({t:.25+i*.5,dir:i%2?-1:1}));
const mirrored=new Set(['ledge','saw','laser']);
function taskTaps(task){
  const result=taps.map((p,i)=>({...p,dir:mirrored.has(task)&&i<4?-p.dir:p.dir}));
  if(task==='red-window')result[1].t=.65;
  if(task==='blue-window')result[1].t=.85;
  if(task==='seal')result[2].t=1.15;
  if(task==='mine')result[3].t=1.85;
  if(task==='relay')result[5].t=2.65;
  return result;
}
function level(id,finish=100000){const l=createEmptyLevel({id,name:id,arenaStyle:'narrow'});l.finish.y=finish;l.height=finish+520;l.theme='core';l.music='first-pulse';return l;}
function sample(model,time,inputs=taps){const g=makeTestGame(model,level('sample'));g.start('normal');if(model==='glide')g.flight.vy=130;let i=0;while(g.t<time-SIM_DT/2){while(i<inputs.length&&inputs[i].t<=g.t+SIM_DT/2)g.press(inputs[i++].dir);g.step(SIM_DT);}return {x:g.player.x,y:g.y,dimension:g.player.dim};}
const tasks=[['free','FLOW',0],['wide-turn','FLOW',0],['ledge','PRECISION',1],['red-window','PHASE',1],['blue-window','PHASE',1],['seal','PULSE',1],['saw','SAW',2],['mine','VOLTAGE',2],['laser','VOLTAGE',2],['relay','COMBO',3]];
function objects(model,task){
  const at=t=>sample(model,t,taskTaps(task)),bar=(id,x,w,t,dimension='both')=>({id,type:'obstacle',x,w,h:14,y:at(t).y,dimension}),trap=(type,x,t,extra={})=>({id:type,type,x,y:at(t).y,...TRAP_DEFAULTS[type],...extra});
  switch(task){
    case 'free':return [];
    case 'wide-turn':return [bar('left-fin',0,75,1.1),bar('right-fin',245,25,2.6)];
    case 'ledge':return [bar('rise-ledge',0,165,1.5),bar('return-ledge',180,90,2.0)];
    case 'red-window':return [bar('red-gate',0,270,.85,'red'),bar('left-spur',0,60,2.1)];
    case 'blue-window':return [bar('blue-gate',0,270,1.45,'blue'),bar('right-spur',245,25,2.6)];
    case 'seal':return [{id:'seal',type:'seal',x:0,w:270,h:14,y:at(1.5).y,openSec:.8}];
    case 'saw':return [trap('saw',170,1.5,{w:32,h:32,amplitude:12,period:4,dimension:'red',pulseBreakable:true})];
    case 'mine':return [trap('mine',190,1.6,{activationRadius:110,blastRadius:65,chargeSec:1.2,dimension:'red'})];
    case 'laser':return [trap('laser',85,2.1,{startAngle:0,endAngle:15,length:160,warnSec:1.2,activeSec:.3,offSec:2,dimension:'blue'})];
    case 'relay':return [{id:'seal',type:'seal',x:0,w:270,h:14,y:at(1.5).y,openSec:.8},trap('saw',190,2.6,{w:28,h:28,axis:'none',amplitude:0,dimension:'red',pulseBreakable:true}),bar('exit-fin',0,75,3.1)];
  }
}
const library=[];
for(const model of ['auto','glide']){
  const course=level('flap-'+model,model==='auto'?10400:5167.5);course.name=model==='auto'?'AUTO-CLIMB · VERGLEICH':'RIFT GLIDE · VERGLEICH';
  course.objects=[];const replay=[];let origin=0;
  for(let i=0;i<tasks.length;i++){
    const [task,category,tier]=tasks[i],opening=i===0,inputs=taskTaps(task),span=model==='auto'?1040:opening?487.5:Math.round(sample('glide',4,inputs).y*100)/100;
    const l=level('glide-'+task,span);l.objects=objects(model,task);
    if(mirrored.has(task))l.objects=l.objects.map(o=>({...o,x:270-o.x-o.w,...(o.type==='saw'&&o.axis==='x'?{phase:((o.phase||0)+.5)%1}:{}),...(o.type==='laser'?{startAngle:180-o.startAngle,endAngle:180-o.endAngle}:{})}));
    l.replay={taps:inputs};
    const validation=validateLevelData(l);if(!validation.ok)throw Error(task+': '+JSON.stringify(validation.issues));
    l.objects.forEach(o=>course.objects.push({...o,id:'part'+i+'-'+o.id,y:o.y+origin}));replay.push(...inputs.map(p=>({...p,t:p.t+i*4})));
    if(model==='glide'){
      // These are declared entry fixtures, never mid-run teleportation.
      const fixtures=opening?[{x:135,y:0,vx:0,vy:0,target:135,dimension:'B'}]:[
        {x:137.18,y:0,vx:-39.5,vy:130,target:135,dimension:'B'},
        ...[130,140].flatMap(x=>[-5,5].flatMap(y=>[120,140].map(vy=>({x,y,vx:x===130?40:-40,vy,target:135,dimension:'B'}))))
      ];
      const results=[];
      for(const entry of fixtures){const g=playTestReplay('glide',{...l,finish:{y:100000}},inputs,{entry,duration:4});if(g.state!=='playing')throw Error(task+' entry '+JSON.stringify(entry)+' died: '+g.killer?.o.id+' t='+g.t+' y='+g.y);results.push(poseOf(g));}
      library.push({id:l.id,category,tier,opening,length:span,duration:4,level:l,taps:inputs,fixtures,entry:{x:[125,145],vx:[-50,50],y:[-60,60],vy:[90,170],target:135,dimension:'B'},exit:{x:[130,145],vx:[-50,0],y:[span-60,span+60],vy:[129,131],target:135,dimension:'B'},validation:{status:'verified',physics:glideConfig(),hash:chunkFingerprint(l),fixtures:fixtures.length,results}});
    }
    origin+=span;
  }
  course.finish.y=origin;course.height=origin+520;course.replay={taps:replay};
  const v=validateLevelData(course);if(!v.ok)throw Error(JSON.stringify(v.issues));
  const g=playTestReplay(model,course,replay,{duration:45});if(g.state!=='won')throw Error(model+' course died '+g.killer?.o.id+' '+g.t+' '+g.y);
  writeFileSync(out+'/'+model+'-course.json',JSON.stringify(course,null,2)+'\n');console.log(model+' course won '+g.t.toFixed(4)+'s pulses '+g.rift.emitted);
}
writeFileSync(out+'/chunks.json',JSON.stringify({schema:'rift-glide-chunks',version:1,config:glideConfig(),chunks:library},null,2)+'\n');
console.log('Validated '+library.length+' Glide variants, '+library.reduce((n,c)=>n+c.fixtures.length,0)+' declared entries.');
