import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/',out='test-results/m84/browser';mkdirSync(out,{recursive:true});
let checks=0;const results=[],check=(name,ok)=>{assert.ok(ok,name);checks++;console.log('PASS '+name);};
for(const [engine,device,label] of [[chromium,devices['Pixel 7'],'android'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{...devices['iPhone SE'],viewport:{width:320,height:568}},'small'],[chromium,{viewport:{width:1280,height:800}},'desktop']]){
 const browser=await engine.launch();try{
 const context=await browser.newContext({...device,acceptDownloads:true}),p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(BASE);await p.waitForFunction(()=>window.__RIFT);await p.evaluate(()=>{localStorage.setItem('hybrid-isolation-sentinel','kept');});
 const publicBefore=await p.evaluate(()=>Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)])));
 await p.goto(BASE+'experiments/ground-flight/?manual');await p.waitForFunction(()=>document.body.dataset.ready==='1');
 check(label+' lab ready and fits viewport',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`${out}/${label}-menu.png`});
 await p.click('#start-course');check(label+' starts genuine ground run at floor',await p.evaluate(()=>__HYBRID.sim.p.grounded&&__HYBRID.sim.p.mode==='ground'&&__HYBRID.sim.p.hitRadius===8&&__HYBRID.sim.t===0));
 if(engine===chromium&&device.isMobile){
   const cdp=await context.newCDPSession(p);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:75,y:400,id:1},{x:device.viewport.width-20,y:400,id:2}]});await p.evaluate(()=>advanceTime(10));
   check(label+' trusted simultaneous touches: one jump + one phase + one pulse',await p.evaluate(()=>__HYBRID.sim.counts.jumps===1&&__HYBRID.sim.counts.phases===1&&__HYBRID.sim.rift.emitted===1));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:85,y:390,id:1},{x:device.viewport.width-25,y:390,id:2}]});await p.evaluate(()=>advanceTime(500));
   check(label+' held / moved fingers never auto-repeat',await p.evaluate(()=>__HYBRID.sim.counts.jumps===1&&__HYBRID.sim.counts.phases===1));
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }else{
   await p.keyboard.press('Space');await p.keyboard.press('KeyC');await p.evaluate(()=>advanceTime(10));
   check(label+' same-tick independent inputs and pulse',await p.evaluate(()=>__HYBRID.sim.counts.jumps===1&&__HYBRID.sim.counts.phases===1&&__HYBRID.sim.rift.emitted===1));
   await p.keyboard.down('Space');await p.evaluate(()=>advanceTime(400));await p.keyboard.up('Space');check(label+' air jump not repeated',await p.evaluate(()=>__HYBRID.sim.counts.jumps===1));
 }
 await p.click('#pause');const t=await p.evaluate(()=>__HYBRID.sim.t);await p.evaluate(()=>advanceTime(3000));check(label+' pause freezes position and audio timeline',await p.evaluate(t=>__HYBRID.sim.t===t&&!__HYBRID.audio.active,t));
 await p.click('#resume');await p.click('#pause');await p.click('#paused-retry');check(label+' retry resets motion, dimension, Pulse and queue',await p.evaluate(()=>__HYBRID.sim.t===0&&__HYBRID.sim.counts.jumps===0&&__HYBRID.sim.rift.emitted===0&&__HYBRID.sim.p.dim==='B'));
 await p.evaluate(()=>advanceTime(2000));check(label+' actual neutral collision produces death and immediate retry',await p.evaluate(()=>__HYBRID.sim.state==='dead'&&__HYBRID.sim.death.type==='rect')&&await p.locator('#retry').isVisible());await p.screenshot({path:`${out}/${label}-death.png`});
 await p.locator('#feedback summary').click();for(const k of ['control','fun','fairness','retry'])await p.selectOption('#rating-'+k,'4');await p.click('#save-rating');check(label+' local optional feedback saved',await p.evaluate(()=>__HYBRID.stats.data.runs.at(-1).ratings.control===4));
 await p.click('#retry');check(label+' first retry gesture is consumed, not a jump',await p.evaluate(()=>__HYBRID.sim.t===0&&__HYBRID.sim.counts.jumps===0));
 await p.click('#pause');await p.locator('#paused .home').click();await p.click('#open-params');await p.fill('#p-speed','200');await p.fill('#jump-height','80');await p.click('#param-form button[type=submit]');
 check(label+' height edit derives a valid fractional impulse for next run',await p.evaluate(()=>__HYBRID.config.speed===200&&Math.abs(__HYBRID.config.jumpImpulse-395.98)<.001));
 await p.click('#start-endless');check(label+' unverified custom config cannot enter certified endless',await p.locator('#param-error').textContent().then(t=>t.includes('Standardwerte')));
 await p.click('#defaults');await p.click('#param-form button[type=submit]');await p.click('#start-auto');
 check(label+' actual public Game with isolated profile270/90/260',await p.evaluate(()=>__HYBRID.baseline.constructor.name==='Game'&&__HYBRID.baseline.arena.width===270&&__HYBRID.baseline.arena.step===90&&__HYBRID.baseline.storage.progression.isolated));
 await p.evaluate(()=>advanceTime(400));
 if(device.isMobile)await p.touchscreen.tap(40,300);else await p.mouse.click(40,300);
 check(label+' inverted baseline touch still moves right and switches once',await p.evaluate(()=>__HYBRID.baseline.player.lane===2&&__HYBRID.baseline.player.dim==='R'&&__HYBRID.baseline.rift.emitted===1));
 await p.click('#pause');await p.locator('#paused .home').click();await p.click('#open-stats');await p.locator('#stats details summary').click();await p.click('#replay-course');
 await p.evaluate(()=>advanceTime(13900));await p.screenshot({path:`${out}/${label}-lasers.png`});check(label+' double laser sequence uses standalone projectors',await p.evaluate(()=>__HYBRID.sim.currentPiece().id==='G03'&&__HYBRID.sim.state==='playing'&&__HYBRID.sim.traps.traps.filter(o=>o.chunk==='G03').length===2));
 await p.evaluate(()=>advanceTime(18500));await p.screenshot({path:`${out}/${label}-portal.png`});check(label+' first portal preserves phase and emits no Pulse',await p.evaluate(()=>__HYBRID.sim.p.mode==='ground'&&__HYBRID.sim.counts.portals===0));
 await p.evaluate(()=>advanceTime(200));check(label+' portal transforms seamlessly',await p.evaluate(()=>__HYBRID.sim.p.mode==='flight'&&__HYBRID.sim.counts.portals===1&&__HYBRID.sim.rift.emitted===4));
 await p.click('#pause');await p.evaluate(()=>advanceTime(1000));await p.click('#resume');await p.evaluate(()=>advanceTime(23700));await p.screenshot({path:`${out}/${label}-saws.png`});
 check(label+' replay survives pause and shows twin saw corridor',await p.evaluate(()=>__HYBRID.sim.state==='playing'&&__HYBRID.sim.currentPiece().id==='F04'&&__HYBRID.sim.traps.traps.filter(o=>o.chunk==='F04'&&o.type==='saw').length===2));
 await p.evaluate(()=>advanceTime(30000));check(label+' real replay completes80s with four portals',await p.evaluate(()=>__HYBRID.sim.state==='complete'&&__HYBRID.sim.t===80&&__HYBRID.sim.counts.portals===4&&__HYBRID.sim.counts.phases===10));await p.waitForTimeout(450);await p.screenshot({path:`${out}/${label}-complete.png`});
 check(label+' automated completion excluded from human feedback/comparison',await p.locator('#feedback').isHidden()&&await p.evaluate(()=>__HYBRID.stats.data.runs.at(-1).source==='automated'));
 await p.locator('#result .home').click();await p.click('#open-stats');if(!await p.locator('#stats details').evaluate(e=>e.open))await p.locator('#stats details summary').click();await p.click('#replay-endless');await p.evaluate(()=>advanceTime(120000));
 check(label+' actual120s Endless replay and bounded retained objects',await p.evaluate(()=>__HYBRID.sim.state==='playing'&&__HYBRID.sim.p.x*.1>=2160&&__HYBRID.sim.pieces.length<=6&&__HYBRID.director.sequence.length<=16));
 await p.click('#pause');await p.locator('#paused .home').click();await p.click('#open-params');await p.fill('#music','0.35');await p.fill('#sfx','0.4');await p.check('#muted');await p.locator('#params .home').click();
 await p.reload();await p.waitForFunction(()=>document.body.dataset.ready==='1');
 check(label+' local history, ratings, own audio preferences persist',await p.evaluate(()=>__HYBRID.stats.data.runs.some(r=>r.ratings?.control===4)&&__HYBRID.audio.settings.music===.35&&__HYBRID.audio.settings.sfx===.4&&__HYBRID.audio.muted));
 check(label+' public localStorage unchanged byte-for-byte',await p.evaluate(before=>Object.keys(before).every(k=>localStorage.getItem(k)===before[k])&&Object.keys(localStorage).every(k=>Object.hasOwn(before,k)||k.startsWith('riftclimb.experiment.hybrid')),publicBefore));
 await p.click('#open-stats');const downloading=p.waitForEvent('download');await p.click('#export');check(label+' JSON report exports',!!await downloading);
 check(label+' no uncaught page errors',errors.length===0);results.push({label,errors,checks});
 }finally{await browser.close();}
}
writeFileSync(out+'/report.json',JSON.stringify({checks,results},null,2));console.log(checks+' Hybrid browser checks passed');
