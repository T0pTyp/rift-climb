// Real app/Forge lifecycles, regular physics replays, pointer/touch controls. No collision bypasses.
import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';
const ids=['shattered-gears','voltage-run','singularity-rush'];
mkdirSync('test-results/expansion/browser',{recursive:true});let checks=0;
const check=(name,ok)=>{assert.ok(ok,name);checks++;console.log('PASS '+name);};
for(const [engine,device,label] of [[chromium,devices['Pixel 7'],'touch'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{viewport:{width:1280,height:900}},'desktop']]){
 const b=await engine.launch(),c=await b.newContext(device),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));const click=s=>device.isMobile?p.tap(s):p.click(s);
 await p.goto(BASE+'?manual=1&autoplay=1');await p.waitForFunction(()=>window.__RIFT);await p.evaluate(()=>__RIFT.ui.openPage('levels'));
 for(const id of ids){
  await click(`[data-level="${id}"]`);await click('#btn-start');
  check(label+' '+id+' starts with own score and traps',await p.evaluate(id=>__RIFT.state==='playing'&&__RIFT.t===0&&__RIFT.player.dim==='B'&&__RIFT.audio.timeline.music===id&&__RIFT.traps.traps.length>0,id));
  await p.evaluate(()=>advanceTime(__RIFT.level.finishY/260*550));await p.screenshot({path:`test-results/expansion/browser/${label}-${id}.png`});
  await p.evaluate(()=>advanceTime(__RIFT.level.finishY/260*460));
  check(label+' '+id+' normal replay earns 100% and one Gold/clear',await p.evaluate(id=>__RIFT.state==='won'&&__RIFT.progress===100&&__ASCENSION.level(id).clears===1&&__ASCENSION.level(id).medal==='gold',id));
  check(label+' last expansion has no Next',id!=='singularity-rush'||await p.isHidden('#btn-next-level'));
  await click('#btn-win-menu');await click('#btn-practice');
  const normal=await p.evaluate(()=>JSON.stringify(__ASCENSION.data));
  await p.evaluate(()=>advanceTime(__RIFT.level.finishY/260*510));
  const frozen=await p.evaluate(()=>{__RIFT.pause();return JSON.stringify([__RIFT.t,__RIFT.traps.snapshot()]);});
  await p.evaluate(()=>advanceTime(3000));check(label+' '+id+' pause freezes dynamic hazards',await p.evaluate(s=>JSON.stringify([__RIFT.t,__RIFT.traps.snapshot()])===s,frozen));
  await click('#btn-resume');await p.evaluate(()=>{const g=__RIFT;g.debug.autoplay=false;g.autoplayQueue=[];advanceTime(4000);advanceTime(500);g.debug.autoplay=true;g.setupAutoplay();advanceTime(g.level.finishY/260*1000);});
  check(label+' '+id+' Practice death/CP recovery completes without rewards',await p.evaluate(s=>__RIFT.state==='won'&&JSON.stringify(__ASCENSION.data)===s,normal));
  await click('#btn-win-menu');
 }
 // A bounded seeded world uses the same Game and the M8 store, without campaign rewards.
 await p.evaluate(()=>__RIFT.ui.openPage('infinity'));
 const before=await p.evaluate(()=>{const d=structuredClone(__ASCENSION.data);delete d.endless;return JSON.stringify(d);});
 await click('#btn-infinity-start');const seed=await p.evaluate(()=>__RIFT.endless.seed);
 await p.evaluate(()=>advanceTime(128000));
 check(label+' Infinity crosses all tiers without finish/percent or rewards',await p.evaluate(s=>{const g=__RIFT,d=structuredClone(__ASCENSION.data);delete d.endless;return g.state==='playing'&&g.mode==='endless'&&g.y>33000&&g.endless.chunks.length<=5&&g.level.finishY===Infinity&&document.querySelector('#hud-pct').textContent.includes('m')&&JSON.stringify(d)===s;},before));
 await p.screenshot({path:`test-results/expansion/browser/${label}-infinity.png`});
 await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));Object.defineProperty(document,'hidden',{configurable:true,value:false});});
 const frozen=await p.evaluate(()=>JSON.stringify([__RIFT.t,__RIFT.traps.snapshot()]));await p.evaluate(()=>advanceTime(5000));
 await p.waitForTimeout(35); // Audio envelopes release over 12 ms of real audio time.
 check(label+' Infinity pause freezes simulation and sources',await p.evaluate(s=>JSON.stringify([__RIFT.t,__RIFT.traps.snapshot()])===s&&!__RIFT.audio.active&&__RIFT.audio.voices.size===0,frozen));
 await click('#btn-resume');await p.evaluate(()=>{__RIFT.debug.autoplay=false;__RIFT.autoplayQueue=[];advanceTime(15000);});
 check(label+' Infinity real collision saves height and shows record',await p.evaluate(()=>['dying','dead'].includes(__RIFT.state)&&__ASCENSION.data.endless.bestHeight>=3328&&__ASCENSION.data.endless.recordAt&&document.querySelector('#death-pct').textContent.includes('m')));
 const best=await p.evaluate(()=>__ASCENSION.data.endless.bestHeight);await click('#btn-death-restart');
 check(label+' Infinity Retry resets traps, repeats seed, counts one attempt',await p.evaluate(seed=>__RIFT.t===0&&__RIFT.player.dim==='B'&&__RIFT.endless.seed===seed&&__ASCENSION.data.endless.attempts===2&&__RIFT.traps.traps.every(t=>t.state==='idle'),seed));
 await p.waitForTimeout(470);await click('#btn-pause');await click('#btn-pause-menu');await p.evaluate(()=>__RIFT.ui.openPage('infinity'));
 await click('#btn-infinity-seed');check(label+' fresh seed selectable',await p.evaluate(seed=>__RIFT.ui.panels.seed!==seed,seed));
 await p.reload();await p.waitForFunction(()=>window.__RIFT);check(label+' Infinity record persists alongside all campaign records',await p.evaluate(best=>__ASCENSION.data.endless.bestHeight===best&&__ASCENSION.level('singularity-rush').clears===1,best));
 // Forge opens all JSON definitions without dropping trap fields; original export is byte-identical.
 for(const id of ids){
  await p.goto(BASE+'assets/forge/');await p.waitForFunction(()=>document.body.dataset.ready==='1');
  await p.evaluate(async id=>{const f=__FORGE,index=await f.actions.gameLevels();await f.actions.openGameLevel(index.levels.find(e=>e.id===id));},id);
  const original=await (await p.request.get(BASE+'assets/levels/'+id+'.json')).text();
  check(label+' '+id+' Forge lossless JSON and every trap visible',await p.evaluate(text=>__FORGE.actions.exportText().text===text&&__FORGE.doc.objects.some(o=>['saw','mine','laser'].includes(o.type)),original));
  await p.evaluate(()=>{const f=__FORGE,tx=f.doc.begin('trap edit'),o=f.doc.objects.find(o=>['saw','mine','laser'].includes(o.type));tx.touch(o.id).x+=.25;tx.commit();});
  await p.evaluate(()=>__FORGE.actions.playtest());await p.waitForFunction(()=>document.querySelector('#pt-frame').contentWindow?.__RIFT?.state==='paused');
  const frame=await(await p.$('#pt-frame')).contentFrame();await frame.evaluate(()=>{__RIFT.debug.manual=true;__RIFT.audio.simulationOnly=true;});await frame.click('#btn-resume');
  check(label+' '+id+' edited Forge run completes with isolated progress',await frame.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();advanceTime(__RIFT.level.finishY/260*1000+50);return __RIFT.state==='won'&&__ASCENSION.isolated&&__ASCENSION.summary().totalNormalAttempts===0;}));
  await click('#pt-exit');check(label+' '+id+' return preserves editor edit/history',await p.evaluate(()=>__FORGE.doc.canUndo));
 }
 check(label+' no page errors',errors.length===0);await b.close();
}
writeFileSync('test-results/expansion/browser/results.json',JSON.stringify({checks},null,2));console.log(`${checks} Expansion browser checks passed`);
