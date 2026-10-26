import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';
let checks=0;const observations=[];
const check=(name,ok)=>{assert.ok(ok,name);checks++;console.log('PASS '+name);};
mkdirSync('test-results/m77/browser',{recursive:true});
for(const [engine,profile,label] of [[chromium,devices['Pixel 7'],'android'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{...devices['iPhone SE'],viewport:{width:320,height:568}},'small']]){
 const browser=await engine.launch(),context=await browser.newContext(profile),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(BASE+'?manual=1&debug=1');await page.waitForFunction(()=>window.__RIFT);
 check(label+' campaign and infinity are offered, compact lab stays hidden, and there is no graphics selector',await page.evaluate(()=>!document.querySelector('#nav-play').hidden&&document.querySelector('#nav-play').textContent.includes('RIFT CAMPAIGN')&&document.querySelector('#nav-lab').hidden&&!document.querySelector('#nav-infinity').hidden&&![...document.querySelectorAll('select,button')].some(e=>e.offsetParent&&/graphics quality|grafikqualität|performance mode/i.test(e.textContent))));
 // Exercise the real shared button handler: distinct touches <450 ms apart are
 // valid; the compatibility click belonging to a touch must not fire twice.
 await page.evaluate(async()=>{const {bindTap}=await import('./js/ui.js');const b=document.createElement('button');b.id='tap-probe';b.textContent='Tap';b.style='position:fixed;top:100px;left:10px;width:80px;height:60px;z-index:10000';document.body.append(b);window.__tapCount=0;bindTap(b,()=>window.__tapCount++);});
 await page.tap('#tap-probe');await page.waitForTimeout(60);await page.tap('#tap-probe');
 check(label+' two genuine rapid UI taps are accepted once each',await page.evaluate(()=>__tapCount===2));
 await page.evaluate(()=>{document.querySelector('#tap-probe').click();document.querySelector('#tap-probe').remove();});
 check(label+' no ghost compatibility click after touch',await page.evaluate(()=>__tapCount===2));
 await page.evaluate(()=>__RIFT.ui.openPage('levels'));await page.tap('#btn-start');await page.waitForTimeout(220);
 const pos=await page.evaluate(()=>{const r=document.querySelector('canvas').getBoundingClientRect();return {left:r.x+r.width*.15,right:r.x+r.width*.85,y:r.y+r.height*.65};});
 await page.touchscreen.tap(pos.left,pos.y);
 check(label+' left display half immediately flies right and switches/pulses exactly once',await page.evaluate(()=>__RIFT.player.lane===2&&__RIFT.player.dim==='R'&&__RIFT.stats.impulses===1&&__RIFT.rift.emitted===1));
 await page.waitForTimeout(60);await page.touchscreen.tap(pos.right,pos.y);
 check(label+' right display half immediately flies left and switches/pulses exactly once',await page.evaluate(()=>__RIFT.player.lane===1&&__RIFT.player.dim==='B'&&__RIFT.stats.impulses===2&&__RIFT.rift.emitted===2));
 await page.waitForTimeout(60);await page.evaluate(()=>document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:9,pointerType:'touch',isPrimary:false,clientX:20,clientY:400,button:0})));
 check(label+' a deliberate second-finger tap is accepted after the normal 45-ms interval',await page.evaluate(()=>__RIFT.stats.impulses===3&&__RIFT.player.dim==='R'));
 await page.waitForTimeout(60);await page.evaluate(()=>document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:9,pointerType:'touch',isPrimary:false,clientX:20,clientY:400,button:0})));
 check(label+' duplicate pointerdown for the same held contact cannot switch again',await page.evaluate(()=>__RIFT.stats.impulses===3));
 await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:9})));
 await page.evaluate(()=>{const g=__RIFT;g.restart();while(g.state==='playing')g.step(1/240);});
 check(label+' death reports actual collision at age zero',await page.evaluate(()=>__RIFT.state==='dying'&&__RIFT.deathAge===0&&__RIFT.deathLog.length===1&&!!__RIFT.killer.o.id));
 await page.keyboard.press('r');
 check(label+' first retry key at death age zero restarts without firing',await page.evaluate(()=>__RIFT.state==='playing'&&__RIFT.t===0&&__RIFT.stats.impulses===0&&__RIFT.player.dim==='B'));
 await page.keyboard.down('r');await page.keyboard.down('r');await page.keyboard.up('r');
 check(label+' held retry key creates no extra attempts',await page.evaluate(()=>__ASCENSION.level('first-pulse').attempts===3));
 await page.evaluate(()=>{const g=__RIFT;g.debug.autoplay=true;g.setupAutoplay();advanceTime(12000);g.pause();});
 const frozen=await page.evaluate(()=>JSON.stringify([__RIFT.t,__RIFT.player.x,__RIFT.traps.snapshot()]));await page.evaluate(()=>advanceTime(3000));
 check(label+' pause leaves exact simulation unchanged',await page.evaluate(s=>JSON.stringify([__RIFT.t,__RIFT.player.x,__RIFT.traps.snapshot()])===s,frozen));
 await page.tap('#btn-resume');await page.evaluate(()=>advanceTime(40000));
 check(label+' normal full level completion after retry/pause',await page.evaluate(()=>__RIFT.state==='won'&&__RIFT.progress===100&&__ASCENSION.level('first-pulse').clears===1));
 const cache=await page.evaluate(async()=>{
  const {drawTrap}=await import('./js/art/traps.js'),{makeTrap,TRAP_DEFAULTS}=await import('./js/traps.js');
  const NativePath=window.Path2D,c=document.createElement('canvas');c.width=c.height=220;const ctx=c.getContext('2d',{willReadFrequently:true}),o=makeTrap({id:'cache',type:'saw',...TRAP_DEFAULTS.saw,x:86,y:100,axis:'none'});
  const draw=()=>{ctx.clearRect(0,0,220,220);drawTrap(ctx,o,1.13,110,'B');};
  try {draw();const cached=ctx.getImageData(0,0,220,220).data;window.Path2D=undefined;draw();const fallback=ctx.getImageData(0,0,220,220).data;return {identical:cached.every((v,i)=>v===fallback[i])};}
  finally {window.Path2D=NativePath;}
 });
 check(label+' cached saw artwork is pixel-identical to the original geometry',cache.identical);
 await page.screenshot({path:`test-results/m77/browser/${label}-complete.png`});
 observations.push({label,viewport:profile.viewport,audioAPI:await page.evaluate(()=>!!(window.AudioContext||window.webkitAudioContext)),lookahead:await page.evaluate(()=>__RIFT.lookaheadSec),errors});
 check(label+' no runtime errors',errors.length===0);await browser.close();
}
writeFileSync('test-results/m77/browser/refinement.json',JSON.stringify({checks,observations},null,2));console.log(`${checks} refinement browser checks passed`);
