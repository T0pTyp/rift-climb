import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {headlessGame,runReplay} from '../js/playcheck.js';
import {chunkFlow,validateChunkBook,entryTaps,INFINITY_MIN_SEAM_SEC} from '../js/endless.js';
import {playExperiment} from './lib/flow-lab.mjs';
const book=validateChunkBook(JSON.parse(readFileSync('assets/endless/chunks.json'))),flows=book.chunks.map(c=>({id:c.id,tier:c.tier,...chunkFlow(c)}));
let checks=0,entries=0,timing=0,minWall=Infinity;const failures=[];
for(const c of book.chunks){
 for(let i=0;i<c.level.replay.taps.length;i++)for(const offsetMs of [-50,-40,-30,-20,-10,10,20,30,40,50]){
  const taps=c.level.replay.taps.map((p,j)=>j===i?{...p,t:p.t+offsetMs/1000}:p),r=runReplay(c.level,taps);timing++;
  if(!r.won)failures.push({chunk:c.id,tap:i,offsetMs,killer:r.killer});
 }
 for(const lane of [0,1,2,3])for(const dim of ['B','R'])for(const vx of [-714,0,714]){
  const level=structuredClone(c.level);level.start={lane,dimension:dim==='B'?'blue':'red'};
  const g=headlessGame(level);g.start('normal');g.player.body.v=vx;
  const step=g.step.bind(g);g.step=h=>{step(h);minWall=Math.min(minWall,g.player.x-8,360-g.player.x-8);};
  const taps=[...entryTaps(lane,dim),...level.replay.taps].sort((a,b)=>a.t-b.t),r=playExperiment(g,taps);
  assert.equal(r.won,true,`${c.id} lane${lane}/${dim}/vx${vx}: ${r.killer}`);
  assert.ok(Math.abs(g.player.x-135)<.01&&Math.abs(g.player.vx)<.1&&g.player.dim==='B');entries++;
 }
 checks++;console.log(`PASS ${c.id}: 24 moving entry states and ±50ms input audit`);
}
let minSeam=Infinity;
for(const a of flows)for(const b of flows){const gap=a.tailRest+b.firstTap;assert.ok(gap>=INFINITY_MIN_SEAM_SEC);minSeam=Math.min(minSeam,gap);}
checks++;assert.ok(minWall>=0);
const bad=structuredClone(book);bad.chunks[5].level.replay.taps[0].t=.2;assert.throws(()=>validateChunkBook(bad),/Ruhe am Übergang/);checks++;
const level=JSON.parse(readFileSync('assets/levels/singularity-rush.json'));
const critical=[19,69,73,77,81,86,88,90,92,98,102];
for(const tap of critical)for(const sign of [-1,1]){const taps=level.replay.taps.map((p,i)=>i===tap?{...p,t:p.t+sign*.05}:p);assert.equal(runReplay(level,taps).won,true,'Singularity critical input '+tap+' / '+sign);}
checks++;
// Widened passages must not create a route around a CLOSED seal.
for(const c of book.chunks)for(const seal of c.level.objects.filter(o=>o.type==='seal')){
 const row=c.level.objects.filter(o=>Math.abs(o.y-seal.y)<.01&&(o.type==='seal'||o.type==='obstacle'&&o.dimension==='both')).sort((a,b)=>a.x-b.x);
 let edge=0,maxGap=0;for(const o of row){maxGap=Math.max(maxGap,o.x-edge);edge=Math.max(edge,o.x+o.w);}maxGap=Math.max(maxGap,360-edge);assert.ok(maxGap<16,c.id+' '+seal.id+' closed-seal bypass');
}
checks++;
mkdirSync('test-results/m78',{recursive:true});writeFileSync('test-results/m78/endless-flow.json',JSON.stringify({checks,entries,timing,minWall,minSeam,flows,failures},null,2));
assert.equal(failures.length,0,JSON.stringify(failures));console.log(`${checks} flow groups, ${entries} moving entries, ${timing} timing variations, 400 seam contracts passed`);
