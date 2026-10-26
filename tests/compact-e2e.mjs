import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';let checks=0;
const check=(n,v)=>{assert.ok(v,n);checks++;console.log('PASS '+n);};mkdirSync('test-results/compact/browser',{recursive:true});
for(const [engine,device,label] of [[chromium,devices['Pixel 7'],'touch'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{viewport:{width:1280,height:900}},'desktop']]){
 const b=await engine.launch(),c=await b.newContext(device),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const click=s=>device.isMobile?p.tap(s):p.click(s);
 await p.goto(BASE+'?manual=1');await p.waitForFunction(()=>window.__RIFT);check(label+' home offers two-tap play and hides the other widths',await p.evaluate(()=>{const play=document.querySelector('#nav-play'),lab=document.querySelector('#nav-lab'),inf=document.querySelector('#nav-infinity');return !!play&&!play.hidden&&play.textContent.includes('ZWEI TIPPS')&&lab.hidden&&!inf.hidden&&!!document.querySelector('#page-lab');}));await p.goto(BASE+'?lab=compact&manual=1');await p.waitForFunction(()=>window.__RIFT&&document.querySelector('#page-lab')&&!document.querySelector('#page-lab').hidden);
 check(label+' only the two-tap arena is offered and there is no quality selector',await p.evaluate(()=>[...document.querySelectorAll('.arena-card')].filter(b=>!b.hidden).map(b=>b.dataset.arena).join()==='narrow'&&document.querySelector('.arena-card[data-arena="classic"]').hidden&&document.querySelector('.arena-card[data-arena="compact"]').hidden&&!document.querySelector('#btn-gfx')));
 await p.evaluate(()=>__RIFT.ui.h.onLabStyle('compact'));check(label+' selection persisted',await p.evaluate(()=>__ASCENSION.data.lab.style==='compact'&&JSON.parse(localStorage.getItem('riftclimb.ascension.v2')).lab.style==='compact'&&document.querySelector('.arena-card[data-arena="compact"]').getAttribute('aria-pressed')==='true'));
 await p.waitForTimeout(180);await p.screenshot({path:`test-results/compact/browser/${label}-lab.png`});
 const before=await p.evaluate(()=>{const d=structuredClone(__ASCENSION.data);delete d.lab;return JSON.stringify(d);});
 await click('#btn-lab-start');await p.waitForTimeout(240);await p.evaluate(()=>advanceTime(250));
 check(label+' centered narrow arena retains camera scale and hitbox',await p.evaluate(()=>{const g=__RIFT;return g.arena.width===216&&g.player.x===108&&g.player.hitRadius===8&&g.view.scale===Math.min(innerWidth/360,innerHeight/600)&&Math.abs(g.view.offsetX-(innerWidth-216*g.view.scale)/2)<.01;}));
 check(label+' running run cannot change style',await p.evaluate(()=>!__RIFT.ui.h.onLabStyle('classic')&&__ASCENSION.data.lab.style==='compact'));
 // Real touches well OUTSIDE the narrow corridor, still inside their full display halves.
 const tap=async x=>{if(device.isMobile)await p.touchscreen.tap(x,Math.floor(device.viewport.height*.60));else await p.mouse.click(x,540);};
 const width=await p.evaluate(()=>innerWidth);await tap(8);await p.evaluate(()=>advanceTime(60));await p.waitForTimeout(60);await tap(8);await p.evaluate(()=>advanceTime(350));
 check(label+' two full-display left taps move right, flip twice and emit two pulses',await p.evaluate(()=>__RIFT.player.lane===4&&__RIFT.player.x>196.5&&__RIFT.player.dim==='B'&&__RIFT.rift.emitted===2));
 await p.screenshot({path:`test-results/compact/browser/${label}-right-wall.png`});
 await p.waitForTimeout(60);await tap(width-8);await p.evaluate(()=>advanceTime(60));await p.waitForTimeout(60);await tap(width-8);await p.evaluate(()=>advanceTime(350));
 check(label+' right screen half moves left without losing touches',await p.evaluate(()=>__RIFT.player.lane===2&&__RIFT.player.x<110&&__RIFT.stats.impulses===4));
 await p.waitForTimeout(60);await tap(width-8);await p.evaluate(()=>advanceTime(60));await p.waitForTimeout(60);await tap(width-8);await p.evaluate(()=>advanceTime(350));
 check(label+' two right-half taps from center reach left wall symmetrically',await p.evaluate(()=>__RIFT.player.lane===0&&__RIFT.player.x<19.5&&__RIFT.player.x>=18&&__RIFT.rift.emitted===6));
 await p.screenshot({path:`test-results/compact/browser/${label}-left-wall.png`});
 await click('#btn-pause');const frozen=await p.evaluate(()=>JSON.stringify([__RIFT.t,__RIFT.player.x,__RIFT.traps.snapshot()]));await p.evaluate(()=>advanceTime(5000));check(label+' pause freezes movement and traps',await p.evaluate(s=>JSON.stringify([__RIFT.t,__RIFT.player.x,__RIFT.traps.snapshot()])===s,frozen));
 await click('#btn-pause-menu');
 for(const style of ['classic','compact']){
  await click(`.arena-card[data-arena="${style}"]`);await p.waitForTimeout(470);await click('#btn-lab-start');
  await p.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();advanceTime(21500);});
  await p.screenshot({path:`test-results/compact/browser/${label}-${style}-game.png`});await p.evaluate(()=>advanceTime(19000));
  check(label+' '+style+' real replay completes with exact Lab result',await p.evaluate(style=>__RIFT.state==='won'&&__RIFT.progress===100&&__RIFT.arena.id===style&&__ASCENSION.data.lab.stats[style].clears===1&&__ASCENSION.data.lab.stats[style].best===100,style));
  check(label+' '+style+' no official medal/Next or campaign-data changes',await p.evaluate(s=>{const d=structuredClone(__ASCENSION.data);delete d.lab;return document.querySelector('#win-medal').children.length===0&&document.querySelector('#btn-next-level').hidden&&JSON.stringify(d)===s;},before));
  await click('#btn-win-restart');check(label+' '+style+' immediate retry counts once and resets',await p.evaluate(()=>__RIFT.state==='playing'&&__RIFT.t===0&&__RIFT.player.dim==='B'&&__RIFT.traps.traps.every(t=>t.state==='idle')));
  await p.evaluate(()=>{__RIFT.debug.autoplay=false;__RIFT.autoplayQueue=[];advanceTime(10000);});check(label+' '+style+' genuine death counted once',await p.evaluate(style=>['dying','dead'].includes(__RIFT.state)&&__ASCENSION.data.lab.stats[style].deaths===1,style));
  await click('#btn-death-menu');
 }
 await p.evaluate(()=>__RIFT.ui.h.onLabFeedback('equal'));await p.reload();await p.waitForFunction(()=>window.__RIFT);
 check(label+' reload preserves variant, real stats, average and feedback',await p.evaluate(()=>__ASCENSION.data.lab.style==='compact'&&__ASCENSION.data.lab.feedback==='equal'&&__ASCENSION.data.lab.stats.classic.clears===1&&__ASCENSION.data.lab.stats.compact.clears===1&&document.querySelector('#lab-stats').textContent.includes('Durchschnitt')));
 await click('#page-lab [data-home]');await p.evaluate(()=>__RIFT.ui.openPage('levels'));await click('#btn-start');check(label+' campaign ignores Compact selection and uses untouched Classic',await p.evaluate(()=>__RIFT.mode==='normal'&&__RIFT.arena.width===360&&__RIFT.level.id==='first-pulse'&&__ASCENSION.level('first-pulse').attempts===1));
 await click('#btn-pause');await click('#btn-pause-menu');await p.evaluate(()=>__RIFT.ui.openPage('infinity'));await click('#btn-infinity-start');
 check(label+' Infinity ignores Lab Compact preference and remains Classic',await p.evaluate(()=>__RIFT.mode==='endless'&&__RIFT.arena.width===360&&__ASCENSION.data.lab.style==='compact'));
 // Existing editor: choose metadata on an empty level, protect pre-authored Classic geometry.
 await p.goto(BASE+'assets/forge/');await p.waitForFunction(()=>document.body.dataset.ready==='1');
 await p.evaluate(async()=>{const f=__FORGE,idx=await f.actions.gameLevels();await f.actions.openGameLevel(idx.levels.find(l=>l.id==='overload'));f.actions.setSelection([]);});
 if(device.isMobile)await click('#dk-props');
 await p.locator('[data-key="arenaStyle"]').selectOption('compact');
 check(label+' editor refuses silently shrinking existing campaign',await p.evaluate(()=>!__FORGE.doc.level.arenaStyle&&__FORGE.view.arena.width===360));
 if(device.isMobile)await click('#sheet-close');
 await p.evaluate(async()=>{const {createEmptyLevel}=await import('../../js/level-data.js');__FORGE.actions.loadDocument(createEmptyLevel());});if(device.isMobile)await click('#dk-props');
 await p.locator('[data-key="arenaStyle"]').selectOption('compact');
 check(label+' editor metadata changes bounds/start/choices without scaling',await p.evaluate(()=>__FORGE.doc.level.arenaStyle==='compact'&&__FORGE.view.arena.width===216&&__FORGE.doc.level.start.lane===2&&document.querySelectorAll('[data-key="start-lane"] option').length===5));
 if(device.isMobile)await click('#sheet-close');
 await p.evaluate(()=>{const f=__FORGE;f.view.cam.y=520;f.actions.requestRender();});await click('.pal[data-kind="blue"]');
 const at=async x=>p.evaluate(x=>{const f=__FORGE,r=f.view.canvas.getBoundingClientRect(),s=f.view.toScreen(x,520);return{x:s.x+r.x,y:s.y+r.y};},x);
 const point=await at(210);if(device.isMobile)await p.touchscreen.tap(point.x,point.y);else await p.mouse.click(point.x,point.y);
 check(label+' placement and JSON honor narrow boundaries',await p.evaluate(()=>{const f=__FORGE,o=f.doc.objects[0],j=JSON.parse(f.actions.exportText().text);return o.x>=0&&o.x+o.w<=216&&j.arenaStyle==='compact';}));
 const outside=await at(250);if(device.isMobile)await p.touchscreen.tap(outside.x,outside.y);else await p.mouse.click(outside.x,outside.y);
 check(label+' decorative area cannot accept Compact placements',await p.evaluate(()=>__FORGE.doc.objects.length===1));
 await p.evaluate(async()=>{const l=await(await fetch('../lab/compact.json')).json();__FORGE.actions.loadDocument(l);});
 const json=await p.evaluate(()=>__FORGE.actions.exportText().text);
 check(label+' Compact Lab imports/exports same shared schema',await p.evaluate(async text=>{const {parseLevelText,serializeLevel}=await import('../../js/level-data.js');const v=parseLevelText(text);return v.ok&&serializeLevel(v.level)===text;},json));
 await p.evaluate(()=>__FORGE.actions.playtest());await p.waitForFunction(()=>document.querySelector('#pt-frame').contentWindow?.__RIFT?.state==='paused');const frame=await(await p.$('#pt-frame')).contentFrame();
 await frame.evaluate(()=>{__RIFT.debug.manual=true;__RIFT.audio.simulationOnly=true;});await frame.click('#btn-resume');
 check(label+' compact Forge playtest uses correct physics and completes with no rewards',await frame.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();advanceTime(40020);return __RIFT.state==='won'&&__RIFT.arena.width===216&&__ASCENSION.isolated&&__ASCENSION.summary().totalNormalAttempts===0;}));
 await click('#pt-exit');check(label+' Forge return preserves Compact document',await p.evaluate(()=>__FORGE.doc.level.arenaStyle==='compact'));await p.screenshot({path:`test-results/compact/browser/${label}-forge.png`});
 check(label+' no page errors',errors.length===0);await b.close();
}
// Lab page is scrollable and remains within narrow portrait safe layouts.
const b=await chromium.launch();for(const [w,h] of [[320,568],[360,640],[390,844],[430,932],[768,1024]]){const p=await b.newPage({viewport:{width:w,height:h},hasTouch:true,isMobile:true});await p.goto(BASE+'?lab=compact');await p.waitForFunction(()=>window.__RIFT);check(`${w} Lab no horizontal overflow / touch targets`,await p.evaluate(()=>document.documentElement.scrollWidth===innerWidth&&document.querySelector('#btn-lab-start').getBoundingClientRect().height>=44&&document.querySelector('#menu .panel').getBoundingClientRect().top>=0));await p.close();}await b.close();writeFileSync('test-results/compact/browser/results.json',JSON.stringify({checks},null,2));console.log(`${checks} Compact browser checks passed`);
