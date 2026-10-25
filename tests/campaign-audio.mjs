// Render all three complete compositions through the real Web Audio graph, in BOTH dimensions.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync,writeFileSync } from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';
mkdirSync('test-results/m7/audio',{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage();await page.goto(BASE);
const results=[];
for(const id of (process.env.LEVEL_IDS||'first-pulse,fractured-rhythm,overload,shattered-gears,voltage-run,singularity-rush').split(',')) for(const dim of ['B','R']) {
 const r=await page.evaluate(async({id,dim})=>{
  const {AudioEngine}=await import('./js/audio.js'),{scoreStep}=await import('./js/pulse/score.js');
  const {buildLevelRuntime,validateLevelData}=await import('./js/level-data.js');
  const l=validateLevelData(await(await fetch(`assets/levels/${id}.json`)).json()).level,duration=l.finish.y/260;
  const rate=22050,c=new OfflineAudioContext(1,Math.ceil((duration+1)*rate),rate),a=new AudioEngine({context:c,timers:false});
  a.setLevel(buildLevelRuntime(l));a.setDimension(dim,true);
  for(let step=0;step*a.step<duration-1e-8;step++)scoreStep(step,a.timeline,(type,f,g,d,layer)=>a.voice(type,step*a.step+.01,f,g,d,layer));
  // Include the real key-matched victory fanfare and its overlap with the final decay.
  const chord=(await import('./js/pulse/score.js')).ARRANGEMENTS[id].chords[0];
  [...chord,chord[0]+12].forEach((n,i)=>a.voice('air',duration+i*.1,440*2**((n-69)/12),.07,.28,'sfx'));
  const buffer=await c.startRendering(),data=buffer.getChannelData(0);
  let peak=0,tail=0;const rms=l.sections.map(()=>0),counts=rms.map(()=>0);
  for(let i=0;i<data.length;i++) {
    const sample=data[i],t=i/rate;peak=Math.max(peak,Math.abs(sample));
    if(t<duration){const section=a.timeline.at(t).section;rms[section]+=sample*sample;counts[section]++;}
    if(t>duration+.9)tail=Math.max(tail,Math.abs(sample));
  }
  const pcm=new Uint8Array(data.length*2),view=new DataView(pcm.buffer);
  for(let i=0;i<data.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
  let binary='';for(let i=0;i<pcm.length;i+=32768)binary+=String.fromCharCode(...pcm.subarray(i,i+32768));
  return {id,dim,duration,peak,rms:rms.map((v,i)=>Math.sqrt(v/counts[i])),tail,pcm:btoa(binary)};
 },{id,dim});
 assert.ok(r.peak<.98 && r.rms.every(v=>v>.005),JSON.stringify({...r,pcm:undefined}));assert.ok(r.tail<.0001);
 const pcm=Buffer.from(r.pcm,'base64'),h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(pcm.length+36,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(22050,24);h.writeUInt32LE(44100,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(pcm.length,40);
 writeFileSync(`test-results/m7/audio/${id}-${dim}.wav`,Buffer.concat([h,pcm]));delete r.pcm;results.push(r);console.log('PASS',JSON.stringify(r));
}
await browser.close();writeFileSync('test-results/m7/audio/metrics.json',JSON.stringify(results,null,2));console.log('Full soundtrack renders passed');
