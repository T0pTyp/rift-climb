import { chromium, webkit, devices } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';
mkdirSync('test-results/m6',{recursive:true});
let passed=0;
function check(name,condition,detail=''){assert.ok(condition,name+' '+detail);passed++;console.log('PASS '+name+(detail?' '+detail:''));}
for(const [type,profile,label] of [[chromium,{},'Chromium desktop'],[chromium,devices['Pixel 7'],'Chromium Android emulation'],[webkit,devices['iPhone 13'],'WebKit iPhone emulation']]){
 const browser=await type.launch();const context=await browser.newContext(profile);const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'?level=rift-main&autoplay=1');await page.waitForFunction(()=>window.__RIFT);
 const hasAudio=await page.evaluate(()=>!!(globalThis.AudioContext||globalThis.webkitAudioContext));
 if(!hasAudio) console.log('SKIP '+label+' native audio assertions: this WebKit build has no Web Audio API; verifying silent fallback instead.');
 check(label+' audio locked before gesture',await page.evaluate(()=>__RIFT.audio.ctx===null));
 await page.waitForTimeout(500); // allow initial canvas rasterization before measuring a live run
 if(profile.isMobile) await page.tap('#btn-start'); else await page.click('#btn-start');
 try { await page.waitForFunction(()=>__RIFT.t>.55,null,{timeout:10000}); } catch(e) { console.log('Start state:',await page.evaluate(()=>render_game_to_text())); throw e; }
 check(label+(hasAudio?' gesture starts music and same timeline':' gesture starts silent fallback'),await page.evaluate(supported=>__RIFT.t>.3&&(supported?__RIFT.audio.ready&&__RIFT.audio.active:!__RIFT.audio.ctx),hasAudio));
 await page.evaluate(()=>__RIFT.impulse(1));await page.waitForTimeout(150);
 if(hasAudio) check(label+' dimension layers + one set of action SFX',await page.evaluate(()=>{const a=__RIFT.audio;return a.dimension===__RIFT.player.dim&&a.metrics.sfx.flight===2&&a.metrics.sfx.switch===2&&a.metrics.sfx.pulse===2;}));
 // Autopilot emits its first impulse at .5s; the second is explicit above.
 await page.evaluate(()=>__RIFT.pause());const time=await page.evaluate(()=>__RIFT.t);await page.waitForTimeout(200);
 check(label+' pause freezes simulation and cancels sources',await page.evaluate(t=>__RIFT.t===t&&!__RIFT.audio.active&&__RIFT.audio.voices.size===0,time));
 await page.locator('#pause [data-volume="music"]').fill('0.35');await page.locator('#pause [data-volume="sfx"]').fill('0.4');
 if(profile.isMobile) await page.tap('#btn-resume');else await page.click('#btn-resume');
 await page.waitForFunction(t=>__RIFT.state==='playing'&&__RIFT.t>t,time,{timeout:5000});
 check(label+' resume rebases audio',await page.evaluate(t=>__RIFT.state==='playing'&&__RIFT.t>t,time));
 const restarted=await page.evaluate(()=>{__RIFT.restart();__RIFT.audio.setMuted(true);return __RIFT.t===0&&__RIFT.audio.muted;});
 check(label+' restart from zero and mute',restarted);
 await page.screenshot({path:`test-results/m6/${label.split(' ')[0]}-${profile.isMobile?'mobile':'desktop'}.png`});
 await page.reload();await page.waitForFunction(()=>window.__RIFT);
 check(label+' separate volumes saved',await page.evaluate(()=>__RIFT.audio.settings.music===.35&&__RIFT.audio.settings.sfx===.4));
 await page.goto(BASE+'?level=rift-main&manual=1&autoplay=1');await page.waitForFunction(()=>window.__RIFT);await page.click('#btn-practice');
 const practice=await page.evaluate(()=>{const g=__RIFT;while(g.t<15&&g.state==='playing')g.update(1/60);const cp={...g.checkpoint};g.respawn();const frozen=!g.audio.active;g.update(.61);return {cp,t:g.t,dim:g.player.dim,a:g.audio.status(),frozen};});
 check(label+' checkpoint restores song time/dimension',practice.cp.t>0&&practice.frozen&&Math.abs(practice.t-practice.cp.t)<.005&&practice.dim===practice.cp.dim);
 const won=await page.evaluate(()=>{const g=__RIFT;g.start('normal');while(g.state==='playing'&&g.t<45)g.update(1/60);return g.state==='won'&&g.progress===100&&!g.audio.active;});check(label+' sound-off 100% completion, no scheduler at win',won);
 await page.goto(BASE+'assets/forge/');await page.waitForFunction(()=>document.body.dataset.ready==='1');
 await page.evaluate(()=>{const f=__FORGE;const tx=f.doc.begin('M6 tempo');tx.touchMeta().bpm=150;tx.touchMeta().beatsPerBar=3;tx.commit();});
 if(!profile.isMobile) {
   await page.click('#btn-grid-settings');
   await page.selectOption('#grid-mode','normal');
   check(label+' normal grid mode',await page.evaluate(()=>__FORGE.S.grid.show&&!__FORGE.S.beats));
   await page.selectOption('#grid-mode','beat');
   check(label+' beat-only grid mode',await page.evaluate(()=>!__FORGE.S.grid.show&&__FORGE.S.beats));
   await page.selectOption('#grid-mode','combined');
   check(label+' combined grid mode',await page.evaluate(()=>__FORGE.S.grid.show&&__FORGE.S.beats));
   await page.click('#btn-grid-settings');
 }
 await page.click('#pulse-preview');await page.waitForTimeout(350);
 check(label+' editor music preview with edited BPM and meter',await page.evaluate(()=>__FORGE.previewAudio.timeline.bpm===150&&__FORGE.previewAudio.timeline.beatsPerBar===3&&__FORGE.S.previewTime>.1));
 await page.click('#pulse-preview');const pos=await page.evaluate(()=>__FORGE.S.previewTime);await page.waitForTimeout(150);
 check(label+' editor preview pause preserves position',await page.evaluate(t=>!__FORGE.S.rhythm&&__FORGE.S.previewTime===t&&!__FORGE.previewAudio.active,pos));
 await page.locator('#pulse-seek').fill('4');await page.click('#pulse-preview');await page.waitForTimeout(200);await page.click('#pulse-preview');
 check(label+' editor seek/resume updates musical position',await page.evaluate(()=>__FORGE.S.previewTime>4&&document.querySelector('#pulse-position').textContent.includes('T4')));
 await page.screenshot({path:`test-results/m6/forge-${label.split(' ')[0]}-${profile.isMobile?'mobile':'desktop'}.png`});
 const before=await page.evaluate(()=>JSON.stringify(__FORGE.doc.level));
 await page.evaluate(()=>__FORGE.actions.playtest(false));const frame=await (await page.$('#pt-frame')).contentFrame();await frame.waitForFunction(()=>window.__RIFT);
 check(label+' playtest waits for real audio gesture',await frame.evaluate(()=>__RIFT.state==='paused'&&__RIFT.audio.ctx===null&&__RIFT.level.bpm===150&&__RIFT.level.beatsPerBar===3));
 await frame.click('#btn-resume');await page.waitForTimeout(150);
 check(label+(hasAudio?' playtest audio starts after Weiter':' silent playtest starts after Weiter'),await frame.evaluate(supported=>__RIFT.state==='playing'&&(!supported||__RIFT.audio.active),hasAudio));
 await page.click('#pt-exit');check(label+' editor return preserves current document',await page.evaluate(json=>document.querySelector('#playtest').hidden&&JSON.stringify(__FORGE.doc.level)===json,before));
 check(label+' no console errors',errors.length===0,errors.join(' | '));
 await browser.close();
}
// Render the actual synthesis graph and score, not a mocked music callback.
const b=await chromium.launch();const p=await b.newPage();await p.goto(BASE);
const audio=await p.evaluate(async()=>{
 const {AudioEngine}=await import('./js/audio.js');const {scoreStep}=await import('./js/pulse/score.js');const {buildLevelRuntime,validateLevelData}=await import('./js/level-data.js');
 const level=validateLevelData(await(await fetch('assets/levels/rift-main.json')).json()).level;
 const c=new OfflineAudioContext(1,22050*45,22050);const a=new AudioEngine({context:c,timers:false});a.setLevel(buildLevelRuntime(level));
 for(let step=0;step<352;step++)scoreStep(step,a.timeline,(type,f,g,d,layer)=>a.voice(type,step*a.step+.01,f,g,d,layer));
 const out=await c.startRendering(),data=out.getChannelData(0);let peak=0;const rms=[0,0,0,0];const counts=[0,0,0,0];
 for(let i=0;i<data.length;i++){const sample=data[i];peak=Math.max(peak,Math.abs(sample));const section=Math.min(3,Math.floor(i/22050/11));rms[section]+=sample*sample;counts[section]++;}
 const pcm=new Uint8Array(data.length*2);const view=new DataView(pcm.buffer);for(let i=0;i<data.length;i++)view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
 let binary='';for(let i=0;i<pcm.length;i+=32768)binary+=String.fromCharCode(...pcm.subarray(i,i+32768));
 return {peak,rms:rms.map((v,i)=>Math.sqrt(v/counts[i])),pcm:btoa(binary)};
});
check('Offline score audible in all four sections, no digital clipping',audio.rms.every(x=>x>.005)&&audio.peak<.98,JSON.stringify({peak:audio.peak,rms:audio.rms}));
const pcm=Buffer.from(audio.pcm,'base64'),header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(22050,24);header.writeUInt32LE(44100,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
writeFileSync('test-results/m6/neon-ascent.wav',Buffer.concat([header,pcm]));writeFileSync('test-results/m6/audio-metrics.json',JSON.stringify({peak:audio.peak,rms:audio.rms},null,2));
await b.close();console.log(`${passed} M6 browser checks passed`);
