import assert from 'node:assert/strict';
import {chromium,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const root='test-results/m84/native';mkdirSync(root,{recursive:true});
const b=await chromium.launch(),c=await b.newContext(devices['Pixel 7']),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto((process.env.BASE_URL||'http://localhost:8080/')+'experiments/ground-flight/');await p.waitForFunction(()=>document.body.dataset.ready==='1');
 assert.equal(await p.evaluate(()=>__HYBRID.audio.ctx),null);console.log('PASS audio locked before gesture');
 await p.click('#open-stats');await p.locator('#stats details summary').click();await p.click('#replay-course');
 await p.waitForFunction(()=>__HYBRID.sim.t>3&&__HYBRID.audio.active&&__HYBRID.audio.ready);
 console.log('PASS trusted gesture starts native AudioContext and real-time simulation');
 await p.evaluate(()=>{window.__samples=[];let last=performance.now();function sample(now){__samples.push({delta:now-last,sources:__HYBRID.audio.voices.size,objects:(__HYBRID.sim?.objects.length??0)+(__HYBRID.sim?.traps.traps.length??0)});last=now;if(__samples.length<7000)requestAnimationFrame(sample);}requestAnimationFrame(sample);});
 await p.waitForFunction(()=>__HYBRID.sim.t>7);await p.evaluate(()=>__HYBRID.audio.ctx.suspend());await p.waitForFunction(()=>__HYBRID.sim.state==='paused');
 const t=await p.evaluate(()=>__HYBRID.sim.t);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>__HYBRID.sim.t),t);console.log('PASS actual suspended AudioContext pauses hybrid physics');
 await p.click('#resume');const checkpoints=[];
 for(const at of [20,40,60,79]){
   await p.waitForFunction(at=>__HYBRID.sim.t>=at,at,{timeout:45000});
   const snapshot=await p.evaluate(()=>({t:__HYBRID.sim.t,state:__HYBRID.sim.state,mode:__HYBRID.sim.p.mode,audio:__HYBRID.audio.status()}));
   assert.equal(snapshot.state,'playing');assert.equal(snapshot.audio.active,true);assert.ok(snapshot.audio.sources<=48);checkpoints.push(snapshot);console.log('PASS native music/physics at '+snapshot.t.toFixed(2)+'s '+snapshot.mode);
 }
 await p.waitForFunction(()=>__HYBRID.sim.state==='complete',null,{timeout:10000});await p.screenshot({path:root+'/complete.png'});
 assert.equal(await p.evaluate(()=>__HYBRID.sim.t),80);assert.equal(await p.evaluate(()=>__HYBRID.sim.counts.phases),10);console.log('PASS native80s replay completes without audio-driven physics');
 await p.click('#retry');await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>__HYBRID.sim.rift.emitted),0);assert.ok(await p.evaluate(()=>__HYBRID.audio.voices.size<=48));
 await p.click('#pause');await p.waitForTimeout(150);assert.equal(await p.evaluate(()=>__HYBRID.audio.voices.size),0);console.log('PASS native retry and pause cancel every old voice');
 const samples=await p.evaluate(()=>__samples),deltas=samples.map(s=>s.delta).slice(1).sort((a,b)=>a-b),mean=deltas.reduce((a,b)=>a+b,0)/deltas.length;
 assert.deepEqual(errors,[]);writeFileSync(root+'/report.json',JSON.stringify({checkpoints,errors,frames:deltas.length,meanFrameMs:mean,meanFPS:1000/mean,p95FrameMs:deltas[Math.floor(deltas.length*.95)],maxSources:Math.max(...samples.map(s=>s.sources)),note:'Unthrottled desktop Chromium with Pixel7 viewport; not a physical phone benchmark.'},null,2));console.log('PASS no page errors; frame report written');
}finally{await b.close();}
