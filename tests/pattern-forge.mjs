import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parsePattern,patternStatus,certifyPattern,duplicatePattern,mergePatterns,localPatternBook} from '../js/pattern-library.js';
import {validateChunkBook,EndlessWorld} from '../js/endless.js';
import {RiftDirector,chunkFingerprint,directorSignature} from '../js/rift-director.js';
import {difficultyAt,INFINITY_BALANCE} from '../js/infinity-balance.js';
import {MOMENTUM_CONFIG,effectiveDifficultyHeight} from '../js/momentum.js';
import {headlessGame,runReplay} from '../js/playcheck.js';
import {trapPose,makeTrap,TrapField} from '../js/traps.js';
const root='assets/endless/patterns/',idx=JSON.parse(readFileSync(root+'index.json'));
const patterns=idx.patterns.map(p=>parsePattern(JSON.parse(readFileSync(root+p.file))));
const book=validateChunkBook(JSON.parse(readFileSync('assets/endless/director.json')));
const report={groups:0,patterns:[],runs:[],generation:[],distribution:[]};
function test(name,fn){fn();report.groups++;console.log('PASS '+name);}
test('24 independent source files, stable P01–P24, common lossless level schema',()=>{
 assert.equal(patterns.length,24);patterns.forEach((l,i)=>{assert.equal(l.chunk.pattern,`P${String(i+1).padStart(2,'0')}`);assert.equal(l.arenaStyle,'narrow');assert.equal(patternStatus(l),'VERIFIED');assert.equal(l.chunk.validation.entries.length,9);const published=book.chunks.find(c=>c.id===l.id);if(l.chunk.enabled!==false&&(l.chunk.weight??1)>0)assert.deepEqual(published.level,l);else assert.equal(published,undefined);assert.ok(l.chunk.idea.length>20);report.patterns.push({id:l.chunk.pattern,name:l.name,tier:l.chunk.tier,objects:l.objects.length,inputs:l.replay.taps.length,duration:l.finish.y/260,status:patternStatus(l),fixtures:9,timing:l.chunk.validation.timing.runs});});
 assert.ok(new Set(patterns.map(l=>JSON.stringify(l.replay.taps))).size>=18);
});
test('New curve exactly halves the old heights; ceiling and continuous boundaries',()=>{
 assert.deepEqual(INFINITY_BALANCE.zones,[0,75,200,450,800,1200,1750]);
 const oldZones=[0,150,400,900,1600,2400,3500],smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
 const old=m=>{for(let i=0;i<6;i++)if(m<oldZones[i+1])return i+smooth((m-oldZones[i])/(oldZones[i+1]-oldZones[i]));return 6+smooth((m-3500)/900);};
 for(let m=0;m<=5000;m+=.5)assert.equal(difficultyAt(m),old(m*2));
 assert.equal(difficultyAt(1500),old(3000));
 for(const m of INFINITY_BALANCE.zones.slice(1))assert.ok(Math.abs(difficultyAt(m-.01)-difficultyAt(m+.01))<.0001);
});
test('Momentum retains proof / tiers; reduced bonus never exceeds proven height',()=>{
 assert.deepEqual(MOMENTUM_CONFIG.strength,[0,1.1,2.4]);
 for(const tier of [0,1,2])for(const p of [400,1200,3000]){let previous=0;for(let x=0;x<=p*1.2;x+=.5){const f=effectiveDifficultyHeight(x,{version:1,tier,provenHeight:p});assert.ok(f>=x&&f>=previous&&f<=(x>p?x:p));if(x<65)assert.equal(f,x);previous=f;}}
});
test('Standalone projected lasers; no compulsory neutral bars in P05–P08/P22',()=>{
 for(const i of [4,5,6,7,21]){const l=patterns[i];assert.ok(l.objects.some(o=>o.type==='laser'));assert.ok(!l.objects.some(o=>o.type==='obstacle'&&o.dimension==='both'));for(const o of l.objects.filter(o=>o.type==='laser')){assert.ok(o.x===0||o.x===244);assert.ok(o.warnSec>=.9);assert.ok(o.beamWidth<=8);}}
});
test('Two and three simultaneous saw bodies use sine phases and reset cleanly',()=>{
 const twins=patterns[9].objects.filter(o=>o.type==='saw'),triple=patterns[20].objects.filter(o=>o.type==='saw');
 assert.equal(twins.filter(o=>o.y===twins[0].y).length,2);assert.equal(triple.filter(o=>o.y>=triple[0].y&&o.y<=triple[0].y+100).length,3);
 assert.ok(triple[2].y-triple[0].y>=60,'Third body must be readable instead of stacked on the other two');
 for(const o of [...twins,...triple]){const a=makeTrap(o),f=new TrapField([a]);for(let t=0;t<5;t+=1/240){const p=trapPose(a,t),q=trapPose(a,t+1/240);assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<1);assert.deepEqual(p,trapPose(makeTrap(o),t));}a.state='destroyed';a.disabledUntil=100;f.reset();assert.equal(a.state,'idle');assert.equal(a.disabledUntil,-Infinity);}
});
test('Every requested task fails without action; real recorded inputs succeed',()=>{
 for(const l of patterns){assert.equal(runReplay(l,[]).won,false,l.id);assert.equal(runReplay(l,l.replay.taps).won,true,l.id);}
});
test('Twin saws remain live through the first pulse; Pulse Break still destroys its target',()=>{
 const twins=patterns[9],g=headlessGame(twins);g.start('normal');let i=0;while(g.state==='playing'&&g.t<1.25){while(i<twins.replay.taps.length&&twins.replay.taps[i].t<=g.t+1/480)g.press(twins.replay.taps[i++].dir);g.step(1/240);}
 assert.equal(g.state,'playing');assert.equal(g.traps.traps.filter(o=>o.y===g.traps.traps[0].y&&o.state!=='destroyed').length,2);
 const l=patterns[17],p=headlessGame(l);p.start('normal');i=0;while(p.state==='playing'){while(i<l.replay.taps.length&&l.replay.taps[i].t<=p.t+1/480)p.press(l.replay.taps[i++].dir);p.step(1/240);}assert.equal(p.state,'won');assert.ok(p.traps.traps.some(o=>o.type==='saw'&&o.state==='destroyed'));
});
test('Administrative weights/enabled preserve proof; geometry invalidates it',()=>{
 const l=structuredClone(patterns[9]),hash=chunkFingerprint(l);l.chunk.weight=.5;l.chunk.enabled=false;assert.equal(chunkFingerprint(l),hash);assert.equal(patternStatus(l),'VERIFIED');l.objects[0].x+=1;assert.equal(patternStatus(l),'UNVERIFIED');
 const copy=duplicatePattern(patterns[0],'pattern-custom');assert.equal(copy.chunk.enabled,false);assert.equal(patternStatus(copy),'UNVERIFIED');assert.equal(patternStatus(certifyPattern(copy).level),'VERIFIED');assert.equal(patterns[0].id,'pattern-p01');
 assert.throws(()=>parsePattern({...l,chunk:{...l.chunk,weight:-1}}));assert.throws(()=>parsePattern({...l,objects:[{...l.objects[0],x:-100}]}));
 const merged=mergePatterns(patterns,[{level:{...patterns[0],name:'Eigene Version'}}]);assert.equal(merged[0].name,'Eigene Version');assert.equal(patterns[0].name,'Single Shift');
 const b=structuredClone(book),signature=directorSignature(b);b.chunks[4].level.chunk.weight=2;assert.notEqual(directorSignature(b),signature,'Replay signature must cover selection weights even though geometry proof does not');
 const reviewed=structuredClone(patterns[0]);reviewed.chunk.validation.review={hash:chunkFingerprint(reviewed),at:'test-fixture'};assert.equal(patternStatus(certifyPattern(reviewed).level),'REVIEWED','Unchanged geometry must retain explicit manual review metadata');
 const savedService=structuredClone(book.chunks[1].level);savedService.chunk.weight=2;const local=validateChunkBook(localPatternBook(book,[...patterns,savedService]));assert.equal(local.chunks.length,book.chunks.length);assert.equal(local.chunks.find(c=>c.id===savedService.id).level.chunk.weight,2);assert.equal(book.chunks[1].level.chunk.weight,undefined);
});
test('Disabled and zero-weight patterns never selected; unverified certificate rejected',()=>{
 const b=structuredClone(book);for(const c of b.chunks)if(c.level.chunk.tier>0)c.level.chunk.enabled=false;
 const d=new RiftDirector(validateChunkBook(b),()=>.3);d.select(0);for(let i=0;i<100;i++)assert.equal(d.select(50000).level.chunk.tier,0);
 const stale=structuredClone(book);stale.chunks[4].level.chunk.validation.status='unverified';assert.throws(()=>validateChunkBook(stale));
 const noFallback=structuredClone(book),m=noFallback.chunks[4].level.chunk;m.exit.dimension='red';m.validation.hash=chunkFingerprint(noFallback.chunks[4].level);assert.throws(()=>validateChunkBook(noFallback));
});
test('Distribution: 40 seeds × 80 choices, no boundary jumps, expert tasks recover to FLOW',()=>{
 for(const height of [0,74,75,76,199,200,201,449,450,451,799,800,801,1199,1200,1201,1499,1500,1501,1749,1750,1751,2200,5000]){
  const counts={};let sum=0;for(let seed=1;seed<=40;seed++){let rng=seed;const d=new RiftDirector(book,()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;});d.select(0);let streak=0;for(let i=0;i<80;i++){const m=d.select(height*10).level.chunk;counts[m.pattern]=(counts[m.pattern]||0)+1;sum+=m.tier;streak=m.category==='FLOW'?0:streak+1;assert.ok(streak<=4);}}
  report.distribution.push({height,choices:3200,meanTier:sum/3200,expertRate:Object.entries(counts).filter(([p])=>patterns.find(l=>l.chunk.pattern===p)?.chunk.tier===6).reduce((s,[,n])=>s+n,0)/3200,counts});
 }
 for(const z of INFINITY_BALANCE.zones.slice(1)){const a=report.distribution.find(d=>d.height===z-1),b=report.distribution.find(d=>d.height===z+1);assert.ok(Math.abs(a.meanTier-b.meanTier)<.035);}
});
test('Technical generation to 5000m, 20 seeds, deterministic sequence and bounded retention',()=>{
 for(let seed=1;seed<=20;seed++){const a=new EndlessWorld(book,seed),b=new EndlessWorld(book,seed);let maxLoaded=0,maxObjects=0;for(let y=0;y<=50000;y+=200){a.ensure(y);b.ensure(y);assert.deepEqual(a.chunks.map(c=>c.id),b.chunks.map(c=>c.id));maxLoaded=Math.max(maxLoaded,a.chunks.length);maxObjects=Math.max(maxObjects,a.chunks.reduce((n,c)=>n+c.rt.obstacles.length+c.rt.traps.length,0));}assert.ok(maxLoaded<=9&&maxObjects<160);report.generation.push({seed,meters:5000,generated:a.generated,maxLoaded,maxObjects,type:'generation-only'});}
});
test('Actual 5000m input replays: seeds 3/53/991, Momentum 0/2; no seam resets',()=>{
 for(const tier of [0,2])for(const seed of [3,53,991]){const g=headlessGame(book.chunks[0].level);g.debug.autoplay=true;g.startEndless(book,seed,g.storage,null,{version:1,tier,provenHeight:tier?1500:0});for(const m of [500,1000,2500,5000]){const end=Math.ceil((m+1)/26*240);while(g.state==='playing'&&g.stats.steps<end)g.update(Math.min(.2,(end-g.stats.steps)/240));assert.equal(g.state,'playing',g.killer?.o?.id);}report.runs.push({seed,tier,meters:g.y*.1,seconds:g.t,inputs:g.stats.impulses,pulses:g.rift.emitted,loaded:g.endless.chunks.length,maxObjects:g.endless.maxObjects,type:'actual-Game-input-replay'});assert.equal(g.stats.impulses,g.rift.emitted);}
});
mkdirSync('test-results/m83',{recursive:true});writeFileSync('test-results/m83/patterns.json',JSON.stringify(report,null,2));console.log(`${report.groups} Pattern Forge groups passed`);
