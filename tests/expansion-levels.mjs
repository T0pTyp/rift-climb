import assert from 'node:assert/strict';
import {existsSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {Game} from '../js/game.js';
import {runReplay} from '../js/playcheck.js';
import {validateLevelData,serializeLevel} from '../js/level-data.js';
const noop=()=>{},reports=[];let checks=0;const check=(n,f)=>{f();checks++;console.log('PASS '+n);};
function game(level,mode='normal') {const g=new Game({canvas:{getContext:()=>null},ui:{show:noop,showDeath:noop,showWin:noop,updateHud:noop,updateMenu:noop,toast:noop},audio:{seek:noop,sfx:noop,update:noop,stop:noop,suspend:noop,resume:noop},input:{guard:noop},storage:{stats:{best:0,attempts:0,clears:0},save:noop},debug:{autoplay:true,trace:true},level});g.start(mode);return g;}
for(const id of ['shattered-gears','voltage-run','singularity-rush']) {
 const path=`assets/levels/${id}.json`;if(!existsSync(path))continue;
 const raw=readFileSync(path,'utf8'),res=validateLevelData(JSON.parse(raw)),l=res.level;
 check(id+' valid editable JSON with lossless export',()=>{assert.ok(res.ok);assert.equal(res.issues.filter(i=>i.severity==='warning').length,0);assert.equal(serializeLevel(l),raw);});
 check(id+' regular replay reaches 100% with active traps/collisions',()=>assert.ok(runReplay(l,l.replay.taps).won));
 let trace;
 for(const [fps,dt] of [[5,.2],[30,1/30],[60,1/60],[144,1/144]])check(id+' same complete simulation at '+fps+' FPS',()=>{const g=game(l);while(g.state==='playing')g.update(dt);assert.equal(g.state,'won');if(trace)assert.deepEqual(g.trace,trace);else trace=g.trace;assert.ok(g.traps.traps.every(o=>Number.isFinite(o.pose.x)));assert.ok(g.traps.events>0);if(l.objects.some(o=>o.type==='mine'))assert.ok(g.traps.events>0);});
 check(id+' Practice restores exact moving hazards and completes',()=>{const g=game(l,'practice');let t=0,n=0;while(g.state!=='won'&&n++<100000){g.update(1/60);if(g.state==='playing'&&g.checkpoint.t>t){t=g.checkpoint.t;const cp=g.checkpoint;g.update(.06);g.respawn();assert.deepEqual(g.traps.snapshot(),cp.traps);assert.equal(g.player.x,cp.x);}}assert.equal(g.state,'won');assert.equal(g.storage.stats.best,0);});
 check(id+' no-input collision and restart reset every trap',()=>{const g=game(l);g.autoplayQueue=[];while(g.state==='playing')g.update(1/60);assert.ok(g.killer);g.restart();assert.equal(g.t,0);assert.ok(g.traps.traps.every(o=>o.state==='idle'&&o.disabledUntil===-Infinity));});
 let early=100,late=100;
 for(let i=0;i<l.replay.taps.length;i++)for(const sign of [-1,1]){let ok=0;for(let ms=10;ms<=100;ms+=10){const rep=l.replay.taps.map((tap,j)=>i===j?{...tap,t:tap.t+sign*ms/1000}:tap);if(!runReplay(l,rep).won)break;ok=ms;}if(sign<0)early=Math.min(early,ok);else late=Math.min(late,ok);}
 check(id+' input windows exceed a single simulation tick',()=>{assert.ok(early>=10);assert.ok(late>=10);});
 const counts=Object.fromEntries(['saw','mine','laser','seal','obstacle'].map(type=>[type,l.objects.filter(o=>o.type===type).length]));
 reports.push({id,duration:l.finish.y/260,taps:l.replay.taps.length,...counts,earlyMs:early,lateMs:late});
 console.log(JSON.stringify(reports.at(-1)));
}
mkdirSync('test-results/expansion',{recursive:true});writeFileSync('test-results/expansion/levels.json',JSON.stringify({checks,reports},null,2));console.log(`${checks} expansion level checks passed`);
