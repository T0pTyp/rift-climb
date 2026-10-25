import {writeFileSync,mkdirSync} from 'node:fs';
import {author} from './author-expansion.mjs';
import {runReplay} from '../js/playcheck.js';
// 20 authored phrases: distinct turns, pacing and hazard combinations. No random geometry.
const patterns=[
 ['open-arch',0,[1,1,-1,-1],['color','color','color','color']],
 ['left-echo',0,[-1,1,1,-1],['color','color','ghost-saw','color']],
 ['right-return',0,[1,-1,-1,1],['color','ghost-saw','color','color']],
 ['pendulum-hall',0,[-1,1,-1,1],['ghost-saw','color','ghost-saw','color']],
 ['blue-stair',0,[1,-1,1,-1],['color','color','color','ghost-saw']],
 ['gear-bridge',1,[1,1,-1,-1],['saw','color','seal','saw']],
 ['gold-switch',1,[-1,1,1,-1],['seal','saw','color','seal']],
 ['shaft-cross',1,[1,-1,-1,1],['saw','seal','saw','color']],
 ['double-lock',1,[-1,1,-1,1],['color','seal','color','seal']],
 ['fracture-steps',1,[1,-1,1,-1],['saw','color','saw','seal']],
 ['capacitor-walk',2,[1,1,-1,-1],['mine','laser','seal','mine']],
 ['laser-lattice',2,[-1,1,1,-1],['laser','seal','laser','saw']],
 ['ionic-return',2,[1,-1,-1,1],['mine','seal','saw','laser']],
 ['charged-arches',2,[-1,1,-1,1],['seal','mine','laser','mine']],
 ['reactor-fold',2,[1,-1,1,-1],['saw','laser','mine','seal']],
 ['core-cascade',3,[1,1,-1,-1,-1,1,1,-1],['saw','mine','laser','seal','mine','saw','laser','seal']],
 ['polarity-chain',3,[-1,1,1,-1,1,-1,-1,1],['laser','saw','seal','mine','laser','seal','saw','mine']],
 ['voltage-crown',3,[1,-1,-1,1,1,1,-1,-1],['mine','laser','saw','seal','laser','mine','seal','saw']],
 ['rift-weave',3,[-1,1,-1,1,1,1,-1,-1],['seal','mine','laser','saw','mine','seal','saw','laser']],
 ['singular-flight',3,[1,-1,1,-1,-1,1,-1,1],['saw','seal','laser','mine','seal','saw','mine','laser']],
];
const chunks=patterns.map(([id,tier,dirs,kinds],index)=>{
 const times=tier===3?[4.5,5.5,6.5,7.5,9,10,11,12]:index%2?[5,7.5,9,11.5]:[5,7,9,11];
 const level=author({id,name:id,bpm:120,beats:16,difficulty:['easy','medium','hard','extreme'][tier],theme:['spire','gears','voltage','singularity'][tier],music:'first-pulse',wide:tier===0,
  sections:[[0,id.toUpperCase()]],gates:dirs.map((dir,i)=>[times[i],dir,kinds[i],['none','x','y'][i%3],.5])});
 const proof=runReplay(level,level.replay.taps);if(!proof.won)throw Error(id+': '+JSON.stringify(proof));
 return {id,tier,length:2080,entry:{lane:1,dimension:'blue',clearSec:2},exit:{lane:1,dimension:'blue',settleSec:2},level};
});
mkdirSync('assets/endless',{recursive:true});writeFileSync('assets/endless/chunks.json',JSON.stringify({schema:'rift-infinity-chunks',version:1,metersPerUnit:.1,chunks},null,2)+'\n');console.log('20 independently simulated Infinity phrases authored');
