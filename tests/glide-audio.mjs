// Native wall-clock run: this is not a physical phone or virtual-time audio test.
import {chromium,devices} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const b=await chromium.launch(),report={samples:[],errors:[]};
try{
 const c=await b.newContext(devices['Pixel 7']),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto((process.env.BASE_URL||'http://localhost:8080/')+'experiments/rift-glide/');await p.waitForFunction(()=>window.__GLIDE);
 await p.tap('#start-glide');await p.waitForFunction(()=>__GLIDE.audio.ready);
 await p.evaluate(()=>{__GLIDE.start('glide',true);const a=__GLIDE.audio,voice=a.voice.bind(a);a.maxObservedVoices=0;a.voice=(...args)=>{const r=voice(...args);a.maxObservedVoices=Math.max(a.maxObservedVoices,a.voices.size);return r;};});
 let elapsed=0;
 for(const wallSeconds of [5,21,35]){
  await p.waitForTimeout((wallSeconds-elapsed)*1000);elapsed=wallSeconds;
  const s=await p.evaluate(()=>({t:__RIFT.t,state:__RIFT.state,pulses:__RIFT.rift.emitted,audio:__GLIDE.audio.status(),maxVoices:__GLIDE.audio.maxObservedVoices}));
  assert.equal(s.state,'playing');assert.ok(s.audio.active&&s.audio.sources>0);assert.ok(s.audio.scheduled>0);assert.ok(s.maxVoices<64);report.samples.push(s);console.log('PASS native Glide music still active at '+s.t.toFixed(2)+'s, '+s.maxVoices+' max voices');
 }
 await p.waitForFunction(()=>__RIFT.state==='won',{},{timeout:15000});await p.waitForTimeout(900);
 assert.ok(await p.evaluate(()=>__GLIDE.audio.voices.size===0&&!__GLIDE.audio.active&&__RIFT.progress===100));assert.deepEqual(report.errors,[]);
 console.log('PASS native 40s course complete, scheduler stopped, no remaining voices or page errors');await c.close();
}finally{await b.close();}
mkdirSync('test-results/m82',{recursive:true});writeFileSync('test-results/m82/native-audio.json',JSON.stringify(report,null,2));
