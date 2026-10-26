// Real pointer/keyboard input, shared app lifecycle, mobile layout and Forge roundtrips.
import assert from 'node:assert/strict';
import { chromium, webkit, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';
const ids=['first-pulse','fractured-rhythm','overload'];
mkdirSync('test-results/m7/browser',{recursive:true});
let checks=0;const observations=[];
function check(name,ok,detail=''){assert.ok(ok,name+' '+detail);checks++;console.log('PASS '+name);}
for(const [type,profile,label] of [[chromium,{viewport:{width:1280,height:800}},'desktop'],[chromium,devices['Pixel 7'],'android-touch'],[webkit,devices['iPhone 13'],'webkit-touch']]) {
 const browser=await type.launch(),context=await browser.newContext(profile),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{
   localStorage.setItem('riftclimb.pulse.v1',JSON.stringify({stats:{best:87,attempts:19,clears:0},gfx:'low',gfxManual:true}));
 });
 await page.goto(BASE+'?manual=1');await page.waitForFunction(()=>window.__RIFT);await page.evaluate(()=>__RIFT.ui.openPage('levels'));
 const session=await page.evaluate(()=>{window.__APP_TOKEN=Math.random();return __APP_TOKEN;});
 check(label+' six immediate level cards and no visual settings',await page.evaluate(()=>document.querySelectorAll('.level-card').length===6&&!document.querySelector('#btn-gfx')&&!('gfx' in __RIFT)));
 check(label+' old visual prefs removed without losing legacy stats',await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('riftclimb.pulse.v1'));return p.stats.best===87&&p.stats.attempts===19&&!('gfx' in p)&&!('gfxManual' in p);}));
 await page.screenshot({path:`test-results/m7/browser/${label}-menu.png`});
 const trigger=selector=>profile.isMobile?page.tap(selector):page.click(selector);
 for(const id of ids) {
   await trigger(`[data-level="${id}"]`);
   check(label+' '+id+' same app / correct start identity',await page.evaluate(({id,session})=>__APP_TOKEN===session&&__RIFT.level.id===id&&__RIFT.state==='menu'&&__RIFT.t===0&&__RIFT.player.dim==='B',{id,session}));
   await trigger('#btn-start');await page.waitForTimeout(240);
   const replay=await page.evaluate(()=>__RIFT.levelData.replay.taps);
   if(label==='android-touch') {
     // ALL inputs of ALL levels use real pointerdown through the existing Input class.
     for(const tap of replay) {
       await page.evaluate(t=>advanceTime(Math.max(0,t-__RIFT.t)*1000),tap.t);
       const vp=page.viewportSize();await page.touchscreen.tap(vp.width*(tap.dir===1?.25:.75),vp.height*.65);
       await page.waitForTimeout(48); // existing real-time 45ms double-event guard
     }
     await page.evaluate(()=>advanceTime((__RIFT.level.finishY/260-__RIFT.t+.02)*1000));
   } else {
     await page.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();});
     for(const fraction of [.15,.4,.62,.83]) {
       await page.evaluate(f=>advanceTime((__RIFT.level.finishY/260*f-__RIFT.t)*1000),fraction);
       check(label+' '+id+' playable at '+Math.round(fraction*100)+'%',await page.evaluate(()=>__RIFT.state==='playing'&&__RIFT.killer===null));
       if(fraction===.62||id==='overload'&&fraction===.83)await page.screenshot({path:`test-results/m7/browser/${label}-${id}-${fraction}.png`});
     }
     await page.evaluate(()=>advanceTime((__RIFT.level.finishY/260-__RIFT.t+.025)*1000));
   }
   const result=await page.evaluate(()=>({state:__RIFT.state,pct:__RIFT.progress,t:__RIFT.t,recorded:__RIFT.recording.length,stats:{...__RIFT.storage.stats},audio:__RIFT.audio.status()}));
   observations.push({label,id,...result});
   check(label+' '+id+' valid replay reaches 100%, best/attempts/clear persisted',result.state==='won'&&result.pct===100&&result.recorded===replay.length&&result.stats.best===100&&result.stats.attempts===1&&result.stats.clears===1,JSON.stringify(result));
   await page.evaluate(()=>advanceTime(350));await page.screenshot({path:`test-results/m7/browser/${label}-${id}-clear.png`});
   await trigger('#btn-win-restart');check(label+' '+id+' restart resets song and state',await page.evaluate(()=>__RIFT.t===0&&__RIFT.state==='playing'&&__RIFT.player.dim==='B'));
   await trigger('#btn-pause');await trigger('#btn-pause-menu');
   check(label+' '+id+' completion visible on card',await page.locator(`[data-level="${id}"]`).getAttribute('data-complete')==='1');
   // AudioContext created by the first gesture is reused across every selection.
   await page.evaluate(()=>{window.__AUDIO_CONTEXT ??= __RIFT.audio.ctx;});
   check(label+' '+id+' reuses same AudioContext',await page.evaluate(()=>__AUDIO_CONTEXT===__RIFT.audio.ctx));
 }
 // A second selection proves earlier per-level results are not copied into another key.
 check(label+' isolated per-level local stats',await page.evaluate(ids=>ids.every(id=>{const s=JSON.parse(localStorage.getItem('riftclimb.ascension.v2')).levels[id];return s.best===100&&s.clears===1&&s.attempts===2;}),ids));
 await page.goto(BASE+'assets/forge/');await page.waitForFunction(()=>document.body.dataset.ready==='1');
 for(const id of ids) {
   await page.evaluate(async id=>{const f=__FORGE;const idx=await f.actions.gameLevels();await f.actions.openGameLevel(idx.levels.find(e=>e.id===id));},id);
   const initial=await page.evaluate(()=>({json:__FORGE.actions.exportText().text,count:__FORGE.doc.objects.length,bpm:__FORGE.doc.level.bpm}));
   const file=await(await page.request.get(BASE+`assets/levels/${id}.json`)).text();
   check(label+' '+id+' all Forge objects + lossless JSON export',initial.json===file&&initial.count===JSON.parse(file).objects.length);
   // Genuine transaction, movable obstacle, editable dimension/open time/BPM/music.
   await page.evaluate(()=>{const f=__FORGE,tx=f.doc.begin('M7 editor test');const o=f.doc.objects.find(o=>o.type==='obstacle'),s=f.doc.objects.find(o=>o.type==='seal');tx.touch(o.id).x+=.5;tx.touch(s.id).openSec+=.05;tx.touchMeta().bpm+=1;tx.commit();});
   if(label==='desktop') {
     await page.locator('#props-body input[data-key="section-1-name"]').fill('M7 SECTION');
     await page.locator('#props-body input[data-key="section-1-name"]').press('Enter');
     await page.waitForFunction(()=>__FORGE.doc.level.sections[1].name==='M7 SECTION'&&document.querySelector('#pulse-rail').textContent.includes('M7 SECTION'));
     check(id+' editable section metadata reflected in the musical timeline',await page.evaluate(()=>__FORGE.doc.level.sections[1].name==='M7 SECTION'&&document.querySelector('#pulse-rail').textContent.includes('M7 SECTION')));
   }
   const edited=await page.evaluate(()=>__FORGE.actions.exportText().text);
   await trigger('#pulse-preview');await page.waitForTimeout(180);
   check(label+' '+id+' preview uses selected score/BPM and actual sections',await page.evaluate(id=>__FORGE.previewAudio.timeline.music===id&&__FORGE.previewAudio.timeline.bpm===__FORGE.doc.level.bpm&&__FORGE.S.previewTime>0&&document.querySelectorAll('#pulse-rail span').length===__FORGE.doc.level.sections.length,id));
   await trigger('#pulse-preview');
   await page.evaluate(()=>__FORGE.actions.playtest());
   await page.waitForFunction(()=>document.querySelector('#pt-frame').contentWindow?.__RIFT?.state==='paused');
   const frame=await(await page.$('#pt-frame')).contentFrame();
   check(label+' '+id+' edited playtest loads same objects and music',await frame.evaluate(expected=>__RIFT.levelData.bpm===expected.bpm+1&&__RIFT.levelData.objects.length===expected.count&&__RIFT.audio.timeline.music===__RIFT.level.id,initial));
   // Turn on controlled stepping after the real explicit resume gesture.
   await frame.evaluate(()=>{__RIFT.debug.manual=true;__RIFT.audio.simulationOnly=true;});await frame.click('#btn-resume');
   check(label+' '+id+' playtest still completable after safe object/tempo edits',await frame.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();advanceTime((__RIFT.level.finishY/260+.02)*1000);return __RIFT.state==='won';}));
   await trigger('#pt-exit');
   // A won Forge test intentionally refreshes the replay; geometry/metadata must stay edited.
   check(label+' '+id+' editor returns with edits/history intact',await page.evaluate(json=>{const a=JSON.parse(json),b=__FORGE.doc.level;delete a.replay;const c=JSON.parse(JSON.stringify(b));delete c.replay;return Object.keys(a).every(k=>JSON.stringify(a[k])===JSON.stringify(c[k]))&&__FORGE.doc.canUndo;},edited));
   if(id==='overload')await page.screenshot({path:`test-results/m7/browser/${label}-forge.png`});
 }
 check(label+' no page errors',errors.length===0,errors.join(' | '));await browser.close();
}
// Live Web Audio transport for each M7 score (separate from accelerated replay tests).
{
 const b=await chromium.launch(),c=await b.newContext(devices['Pixel 7']),p=await c.newPage();
 await p.goto(BASE);await p.waitForFunction(()=>window.__RIFT);await p.evaluate(()=>__RIFT.ui.openPage('levels'));
 for(const id of ids) {
  await p.tap(`[data-level="${id}"]`);await p.waitForTimeout(200);await p.tap('#btn-start');
  await p.waitForFunction(()=>__RIFT.t>.3&&__RIFT.audio.active);
  check(id+' live gesture starts its own score on the simulation timeline',await p.evaluate(id=>__RIFT.audio.ready&&__RIFT.audio.timeline.music===id&&__RIFT.audio.metrics.scheduled>0&&Math.abs(__RIFT.audio.songTime-__RIFT.t)<.005,id));
  await p.tap('#btn-pause');await p.waitForTimeout(50);
  check(id+' pause releases live sources',await p.evaluate(()=>!__RIFT.audio.active&&__RIFT.audio.voices.size===0));await p.tap('#btn-pause-menu');
 }
 await b.close();
}
// Small portrait viewports and legacy settings cannot change visual density or simulation.
const b=await chromium.launch();
for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024]]) {
 const c=await b.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:3});const p=await c.newPage();await p.goto(BASE+'?manual=1&gfx=low');await p.waitForFunction(()=>window.__RIFT);
 const layout=await p.evaluate(()=>({w:innerWidth,scroll:document.scrollingElement.scrollWidth,cap:__RIFT.particles.cap,look:__RIFT.lookaheadSec,dpr:document.querySelector('#game').width/innerWidth,top:document.querySelector('#menu .panel').getBoundingClientRect().top}));
 check(`${width}x${height} fixed high visuals, safe lookahead and no horizontal overflow`,layout.w===layout.scroll&&layout.cap===320&&layout.look>=1.5&&layout.dpr<=2.501&&layout.top>=0,JSON.stringify(layout));await c.close();
}
{
 const c=await b.newContext(),p=await c.newPage();
 await c.addInitScript(()=>{window.__FRAME_CLOCK=1000;performance.now=()=>__FRAME_CLOCK;window.requestAnimationFrame=callback=>{window.__FRAME_CB=callback;return 1;};});
 await p.goto(BASE+'?autoplay=1');await p.waitForFunction(()=>window.__RIFT,null,{polling:50});
 await p.evaluate(()=>{__RIFT.audio.unlock=()=>{};__RIFT.audio.simulationOnly=true;});
 await p.keyboard.press('Enter');await p.keyboard.press('Enter');
 const clock=await p.evaluate(()=>{__FRAME_CLOCK+=1;__FRAME_CB(__FRAME_CLOCK);for(let i=0;i<10;i++){__FRAME_CLOCK+=200;__FRAME_CB(__FRAME_CLOCK);}const before=__RIFT.t;__FRAME_CLOCK+=300;__FRAME_CB(__FRAME_CLOCK);return {before,after:__RIFT.t,state:__RIFT.state};});
 check('Actual main loop consumes full 200ms frames; silent 300ms blind stall pauses safely',Math.abs(clock.before-2)<.005&&clock.before===clock.after&&clock.state==='paused',JSON.stringify(clock));await c.close();
}
await b.close();writeFileSync('test-results/m7/browser/results.json',JSON.stringify({checks,observations},null,2));console.log(`${checks} M7 browser checks passed`);
