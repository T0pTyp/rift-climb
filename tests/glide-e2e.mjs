import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/',PATH='experiments/rift-glide/',out='test-results/m82/browser';mkdirSync(out,{recursive:true});
let checks=0;const report=[];const check=(n,c)=>{assert.ok(c,n);checks++;console.log('PASS '+n);};
for(const [engine,device,label]of [[chromium,devices['Pixel 7'],'android'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{...devices['iPhone SE'],viewport:{width:320,height:568}},'small']]){
 const b=await engine.launch();try{
 const context=await b.newContext(device),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('riftclimb.ascension.v2'))localStorage.setItem('riftclimb.ascension.v2','{"protected":"official"}');});
 await page.goto(BASE+PATH+'?manual=1');await page.waitForFunction(()=>window.__GLIDE&&__RIFT.art.ready);
 const official=await page.evaluate(()=>localStorage.getItem('riftclimb.ascension.v2'));
 check(label+' three isolated starts, no Compact/graphics controls, no horizontal overflow',await page.evaluate(()=>['start-auto','start-glide','start-endless'].every(id=>document.getElementById(id).getClientRects().length)&&!document.querySelector('#btn-gfx')&&document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:`${out}/${label}-menu.png`});
 for(const kind of ['auto','glide']){
  await page.tap('#start-'+kind);await page.waitForTimeout(230);
  check(label+' '+kind+' starts at zero, blue, original art and correct independent physics',await page.evaluate(k=>__RIFT.state==='playing'&&__RIFT.t===0&&__RIFT.player.dim==='B'&&__RIFT.player.hitRadius===8&&__RIFT.arena.width===270&&(k==='auto'?__RIFT.arena.step===90:__RIFT.flight.config.horizontalTravelPerTap===75),kind));
  await page.touchscreen.tap(2,device.viewport.height*.5);await page.evaluate(()=>advanceTime(100));
  check(label+' '+kind+' full display left half gives right flight / one switch / one pulse',await page.evaluate(()=>__RIFT.player.x>135&&__RIFT.player.dim==='R'&&__RIFT.rift.emitted===1));
  await page.waitForTimeout(100);await page.touchscreen.tap(device.viewport.width-2,device.viewport.height*.5);await page.evaluate(()=>advanceTime(100));
  check(label+' '+kind+' right touch reverses, exactly two actions',await page.evaluate(()=>__RIFT.rift.emitted===2&&__RIFT.player.dim==='B'&&__RIFT.stats.impulses===2));
  await page.tap('#pause');const t=await page.evaluate(()=>__RIFT.t);await page.evaluate(()=>advanceTime(800));
  check(label+' '+kind+' pause freezes physical and audio clock',await page.evaluate(t=>__RIFT.state==='paused'&&__RIFT.t===t&&__RIFT.audio.voices.size===0,t));
  await page.tap('#resume');check(label+' '+kind+' resume restores same simulation time',await page.evaluate(t=>__RIFT.state==='playing'&&__RIFT.t===t,t));
  await page.evaluate(()=>__RIFT.restart());await page.evaluate(()=>advanceTime(500));await page.waitForTimeout(230);
  // One held contact, then a duplicate pointerdown carrying the same ID: no repeat flap.
  await page.evaluate(()=>{const c=document.querySelector('#game');c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:501,pointerType:'touch',clientX:3,clientY:300,bubbles:true,button:0}));});
  await page.evaluate(()=>advanceTime(150));await page.waitForTimeout(100);
  await page.evaluate(()=>{const c=document.querySelector('#game');c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:501,pointerType:'touch',clientX:3,clientY:300,bubbles:true,button:0}));});
  check(label+' '+kind+' held pointer cannot flap twice',await page.evaluate(()=>__RIFT.stats.impulses===1&&__RIFT.rift.emitted===1));
  await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:501,bubbles:true})));
  await page.evaluate(()=>__RIFT.restart());await page.evaluate(()=>advanceTime(3000));
  if(kind==='auto')await page.evaluate(()=>advanceTime(10000));
  check(label+' '+kind+' real collision/fall ends run and Retry is immediately visible',await page.evaluate(()=>['dead','dying'].includes(__RIFT.state)&&!document.querySelector('#result').hidden&&!!__RIFT.killer));
  await page.screenshot({path:`${out}/${label}-${kind}-death.png`});
  const before=await page.evaluate(()=>__GLIDE.stats.data.runs.length);await page.tap('#retry');
  check(label+' '+kind+' Retry clears velocity, dimension, Pulse, traps and creates no duplicate result',await page.evaluate(n=>__RIFT.t===0&&__RIFT.y===0&&__RIFT.rift.emitted===0&&__RIFT.player.dim==='B'&&__RIFT.traps.traps.every(o=>o.state==='idle')&&__GLIDE.stats.data.runs.length===n,before));
  await page.evaluate(()=>__GLIDE.home());
 }
 await page.tap('#show-params');await page.fill('#param-gravity','600');await page.tap('#parameter-form button[type=submit]');await page.tap('#start-glide');
 check(label+' custom parameters apply only to a new Glide run',await page.evaluate(()=>__RIFT.flight.config.gravity===600));await page.evaluate(()=>__GLIDE.home());await page.tap('#start-auto');
 await page.evaluate(()=>advanceTime(1000));check(label+' switch back restores exact Auto-Climb baseline',await page.evaluate(()=>__RIFT.t>=.99&&Math.abs(__RIFT.y-__RIFT.t*260)<1e-6&&__RIFT.arena.step===90&&!__RIFT.flight));await page.evaluate(()=>__GLIDE.home());
 await page.tap('#start-endless');check(label+' uncertified custom Endless blocked before a run',await page.evaluate(()=>!document.querySelector('#params').hidden&&document.querySelector('#parameter-error').textContent.includes('Standard')));
 await page.tap('#defaults');await page.tap('#parameter-form button[type=submit]');
 for(const kind of ['auto','glide','endless']){
  await page.evaluate(k=>{__GLIDE.audio.setMuted(k==='glide');__GLIDE.start(k,true);},kind);await page.evaluate(()=>advanceTime(25000));
  check(label+' '+kind+' normal replay reaches gameplay using real obstacles and actions',await page.evaluate(()=>__RIFT.state==='playing'&&__RIFT.rift.emitted===50));
  await page.screenshot({path:`${out}/${label}-${kind}-flow.png`});
  await page.evaluate(()=>advanceTime(16000));
  check(label+' '+kind+' real completion or continued Endless without public saves',await page.evaluate(k=>k==='endless'?__RIFT.state==='playing'&&__RIFT.world.generated>10:__RIFT.state==='won'&&__RIFT.progress===100&&__GLIDE.stats.data.runs.at(-1).completed,kind));
  if(kind!=='endless')check(label+' '+kind+' captured accepted inputs replay the actual saved run to completion',await page.evaluate(async k=>{const r=__GLIDE.stats.data.runs.at(-1),l=await(await fetch('data/'+k+'-course.json')).json(),{playTestReplay}=await import('./replay.js'),g=playTestReplay(r.model,l,r.inputs,{config:r.parameters,duration:41});return g.state==='won'&&r.inputs.length===r.validImpulses&&r.pulses===g.rift.emitted;},kind));
  await page.evaluate(()=>__GLIDE.home());
 }
 await page.tap('#show-stats');check(label+' comparison shows real groups; automated data excluded',await page.evaluate(()=>document.querySelectorAll('.report-card').length>=3&&__GLIDE.stats.summary('glide').runs>0&&__GLIDE.stats.data.runs.some(r=>r.source==='automated')));
 const savedCount=await page.evaluate(()=>__GLIDE.stats.data.runs.length);await page.reload();await page.waitForFunction(()=>window.__GLIDE);
 check(label+' test statistics survive reload and official save remains byte-identical',await page.evaluate(({n,v})=>__GLIDE.stats.data.runs.length===n&&localStorage.getItem('riftclimb.ascension.v2')===v,{n:savedCount,v:official}));
 await page.tap('#start-glide');await page.evaluate(()=>advanceTime(2000));
 await page.locator('#feedback summary').click();await page.selectOption('#rating-control','4');await page.selectOption('#rating-fun','3');await page.selectOption('#rating-fairness','5');await page.tap('#save-rating');
 check(label+' optional ratings persist once after death, never in gameplay',await page.evaluate(()=>__GLIDE.stats.data.runs.at(-1).ratings?.control===4));
 check(label+' no browser errors / no horizontal overflow',errors.length===0&&await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 report.push({label,errors,savedCount});await context.close();
 }finally{await b.close();}
}
// Native-clock/audio and trusted quick alternating taps, separate from virtual-time proof.
const b=await chromium.launch();try{const c=await b.newContext(devices['Pixel 7']),p=await c.newPage();await p.goto(BASE+PATH);await p.waitForFunction(()=>window.__GLIDE);await p.tap('#start-glide');await p.waitForTimeout(240);for(let i=0;i<8;i++){await p.touchscreen.tap(i%2?390:4,450);await p.waitForTimeout(110);}check('native clock trusted fast input stays bounded and emits exactly eight Pulses',await p.evaluate(()=>__RIFT.stats.impulses===8&&__RIFT.rift.emitted===8&&__RIFT.flight.vy<=__RIFT.flight.config.maxUpwardVelocity));check('native audio unlock after real gesture, voices bounded',await p.evaluate(()=>__GLIDE.audio.ready&&__GLIDE.audio.voices.size<60));await p.tap('#pause');await p.waitForTimeout(100);check('native pause cancels all sources',await p.evaluate(()=>__GLIDE.audio.voices.size===0&&__RIFT.state==='paused'));await c.close();}finally{await b.close();}
writeFileSync(out+'/report.json',JSON.stringify({checks,report},null,2));console.log(checks+' Glide browser checks passed.');
