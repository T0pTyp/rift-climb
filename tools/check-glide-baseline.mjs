// Compare the real pre-experiment Game directly, without a reimplementation.
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {Game} from '../js/game.js';
import {gameOptions} from '../experiments/rift-glide/game.js';
import {validateChunkBook} from '../js/endless.js';
import {SIM_DT} from '../js/config.js';
const base='52adbc6',url=new URL('../js/game.js',import.meta.url);
const source=execFileSync('git',['show',base+':js/game.js'],{encoding:'utf8'}).replace(/from\s+(['"])(\.\/[^'"]+)\1/g,(_,q,s)=>'from '+q+new URL(s,url).href+q);
const {Game:OriginalGame}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const book=validateChunkBook(JSON.parse(readFileSync('assets/endless/director.json','utf8'))),level=JSON.parse(readFileSync('experiments/rift-glide/data/auto-course.json','utf8'));
const protectedPaths=['js/player.js','js/config.js','js/arena.js','js/input.js','js/physics.js','js/rift.js','js/traps.js','js/endless.js','js/rift-director.js','js/infinity-balance.js','js/momentum.js','js/main.js','index.html','assets/levels','assets/endless','assets/characters','js/forge','.github/workflows'];
assert.equal(execFileSync('git',['diff',base,'--',...protectedPaths],{encoding:'utf8'}),'');
const report={base,protectedPaths,scenarios:[],comparedSteps:0};
const state=g=>({t:g.t,y:g.y,x:g.player.x,vx:g.player.vx,dim:g.player.dim,pulses:g.rift.emitted,state:g.state,killer:g.killer?.o.id,traps:g.traps.snapshot()});
for(const mode of ['course',0,1,2]){
 const games=[OriginalGame,Game].map(C=>new C(gameOptions(level,{debug:{autoplay:true}})));
 for(const g of games)if(mode==='course')g.start();else g.startEndless(book,37,g.storage,null,{version:1,tier:mode,provenHeight:mode?1210:0});
 const n=mode==='course'?9600:240*80;
 for(let i=0;i<n;i++){
  for(const g of games){if(g.state!=='playing')break;if(g.endless?.ensure(g.y)){g.endless.apply(g);g.setupAutoplay();}g.step(SIM_DT);}
  assert.deepEqual(state(games[0]),state(games[1]));report.comparedSteps++;
 }
 report.scenarios.push({mode,...state(games[1])});
 console.log('PASS pristine '+base+' Game identical at every tick: '+mode);
}
mkdirSync('test-results/m82',{recursive:true});writeFileSync('test-results/m82/baseline-parity.json',JSON.stringify(report,null,2));console.log(report.comparedSteps+' exact tick comparisons passed; protected sources unchanged.');
