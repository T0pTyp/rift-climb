import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';
let checks=0;const observations=[],check=(n,v)=>{assert.ok(v,n);checks++;console.log('PASS '+n);};
mkdirSync('test-results/m78/browser',{recursive:true});
for(const [engine,profile,label] of [[chromium,devices['Pixel 7'],'android'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{...devices['iPhone SE'],viewport:{width:320,height:568}},'small']]){
 const b=await engine.launch(),c=await b.newContext(profile),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(BASE+'?manual=1&debug=1&level=first-pulse');await p.waitForFunction(()=>window.__RIFT);
 await p.evaluate(async()=>{const {bindTap}=await import('./js/ui.js');const button=document.createElement('button');button.id='flow-tap-probe';button.textContent='Probe';button.style='position:fixed;top:100px;left:10px;width:80px;height:44px;z-index:10000';document.body.append(button);window.__probeCount=0;bindTap(button,()=>window.__probeCount++);});
 await p.mouse.move(50,120);await p.mouse.down();await p.mouse.move(220,120);await p.mouse.up();
 check(label+' cancelled captured button release cannot emit a compatibility click',await p.evaluate(()=>__probeCount===0));await p.evaluate(()=>document.querySelector('#flow-tap-probe').remove());
 await p.tap('#btn-start');await p.waitForTimeout(350);await p.evaluate(()=>advanceTime(250));
 const queued=await p.evaluate(()=>{
  const canvas=document.querySelector('canvas'),now=performance.now(),before=__RIFT.t;
  for(const [pointerId,time,x]of [[71,now-100,20],[72,now-40,innerWidth-20]]){
   const e=new PointerEvent('pointerdown',{pointerId,button:0,bubbles:true,clientX:x,clientY:400,pointerType:'touch'});Object.defineProperty(e,'timeStamp',{value:time});canvas.dispatchEvent(e);window.dispatchEvent(new PointerEvent('pointerup',{pointerId}));
  }
  return {before,after:__RIFT.t,impulses:__RIFT.stats.impulses,pulses:__RIFT.rift.emitted,dim:__RIFT.player.dim,flow:JSON.parse(render_game_to_text()).debug.phaseFlow};
 });
 check(label+' two queued valid contacts are both applied, with no simulation timer delay',queued.before===queued.after&&queued.impulses===2&&queued.pulses===2&&queued.dim==='B'&&queued.flow.input.accepted);
 check(label+' diagnostics show interruptible impulse and zero buffers',queued.flow.interruptible&&queued.flow.movementCooldownMs===0&&queued.flow.inputBuffer.durationMs===0&&queued.flow.phaseBuffer.durationMs===0&&!queued.flow.phaseBuffer.active);
 await p.waitForTimeout(60);await p.touchscreen.tap(20,400);
 check(label+' physical left-half tap changes dimension immediately while spring is active',await p.evaluate(()=>__RIFT.player.dim==='R'&&__RIFT.player.lane===2&&__RIFT.lastSwitch.t===__RIFT.t&&__RIFT.rift.emitted===3));
 await p.evaluate(()=>advanceTime(1000/240));await p.screenshot({path:`test-results/m78/browser/${label}-switch.png`});
 check(label+' HUD and exact current-dimension marker are rendered after one simulation tick',await p.evaluate(()=>document.querySelector('#hud-dim').textContent.trim()==='ROT'&&__RIFT.player.dim==='R'));
 await p.tap('#btn-pause');const frozen=await p.evaluate(()=>JSON.stringify([__RIFT.t,__RIFT.player.x,__RIFT.rift.snapshot()]));
 await p.evaluate(()=>{const e=new KeyboardEvent('keydown',{key:'r',bubbles:true});Object.defineProperty(e,'timeStamp',{value:performance.now()-100});window.dispatchEvent(e);advanceTime(2000);});
 check(label+' old queued confirmation cannot resume a paused run',await p.evaluate(s=>__RIFT.state==='paused'&&JSON.stringify([__RIFT.t,__RIFT.player.x,__RIFT.rift.snapshot()])===s,frozen));
 await p.tap('#btn-resume');await p.waitForTimeout(350);
 await p.evaluate(()=>{const e=new PointerEvent('pointerdown',{pointerId:73,button:0,bubbles:true,clientX:20,clientY:400,pointerType:'touch'});Object.defineProperty(e,'timeStamp',{value:__RIFT.input.eventFloor-10});document.querySelector('canvas').dispatchEvent(e);window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:73}));});
 check(label+' no past touch becomes a new impulse after resume',await p.evaluate(()=>__RIFT.stats.impulses===3));
 await p.evaluate(()=>__RIFT.restart());await p.waitForTimeout(350);
 check(label+' restart clears switch/pulse state and leaves no pending buffers',await p.evaluate(()=>__RIFT.t===0&&__RIFT.lastSwitch===null&&__RIFT.rift.emitted===0&&!JSON.parse(render_game_to_text()).debug.phaseFlow.inputBuffer.pending));
 await p.goto(BASE+'?manual=1&level=singularity-rush&arena=306&inputBuffer=100&phaseBuffer=100&debug=1');await p.waitForFunction(()=>window.__RIFT);await p.tap('#btn-start');
 check(label+' internal tuning cannot be activated by URL and campaign stays 360',await p.evaluate(()=>__RIFT.arena.width===360&&document.querySelector('#nav-lab').hidden&&!document.querySelector('#nav-infinity').hidden&&JSON.parse(render_game_to_text()).debug.phaseFlow.phaseBuffer.durationMs===0));
 await p.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();advanceTime(66500);});await p.screenshot({path:`test-results/m78/browser/${label}-finale.png`});
 await p.evaluate(()=>advanceTime(9000));check(label+' balanced Singularity completes with normal collision rules',await p.evaluate(()=>__RIFT.state==='won'&&__RIFT.progress===100&&__ASCENSION.level('singularity-rush').clears===1));
 const view=await p.evaluate(()=>({lookahead:__RIFT.lookaheadSec,width:innerWidth,canvas:document.querySelector('canvas').getBoundingClientRect().width}));
 check(label+' viewport/camera remain readable without zoom or horizontal overflow',view.lookahead>1.7&&Math.abs(view.width-view.canvas)<2);
 check(label+' no runtime errors',errors.length===0);observations.push({label,queued,view,errors});await b.close();
}
// Native queued contacts during a real, sub-pause-threshold browser stall.
// CDP sends genuine touch events while the renderer is busy; no altered timestamps.
{
 const b=await chromium.launch(),c=await b.newContext(devices['Pixel 7']),p=await c.newPage(),cdp=await c.newCDPSession(p);
 await p.goto(BASE+'?level=first-pulse');await p.waitForFunction(()=>window.__RIFT);await p.tap('#btn-start');await p.waitForTimeout(450);
 const before=await p.evaluate(()=>__RIFT.stats.impulses);
 const busy=p.evaluate(()=>{const end=performance.now()+180;while(performance.now()<end){};});
 const send=(delay,type,points)=>new Promise(resolve=>setTimeout(resolve,delay)).then(()=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points}));
 await Promise.all([busy,send(25,'touchStart',[{x:20,y:400,id:81}]),send(45,'touchEnd',[]),send(85,'touchStart',[{x:390,y:400,id:82}]),send(105,'touchEnd',[])]);
 const native=await p.evaluate(()=>({state:__RIFT.state,impulses:__RIFT.stats.impulses,pulses:__RIFT.rift.emitted,input:__RIFT.input.lastDecision}));
 check('native Chromium: both physical queued taps survive a 180-ms renderer stall',native.state==='playing'&&native.impulses===before+2&&native.pulses===before+2);
 check('native Chromium: retained original timestamps expose actual dispatch delay',native.input.accepted&&native.input.dispatchDelayMs>40);
 await p.evaluate(()=>{window.__touchTrace=[];for(const type of ['pointerdown','pointerup','pointercancel','lostpointercapture'])document.addEventListener(type,e=>__touchTrace.push({type,id:e.pointerId,primary:e.isPrimary,target:e.target.id,x:e.clientX,y:e.clientY,state:__RIFT.state}),true);});
 await p.waitForTimeout(80);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:20,y:400,id:83}]});
 await p.evaluate(()=>{let n=0;while(__RIFT.state==='playing'&&n++<20000)__RIFT.step(1/240);});
 const retry=await p.locator('#btn-death-restart').boundingBox(),attempts=await p.evaluate(()=>__RIFT.attemptsDisplay);
 const point={x:retry.x+retry.width/2,y:retry.y+retry.height/2,id:84};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:20,y:400,id:83},point]});
 // With an explicit point, CDP ends that contact; the original finger stays held.
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[point]});
 const retried=await p.evaluate(n=>({ok:__RIFT.state==='playing'&&__RIFT.attemptsDisplay===n+1&&__RIFT.stats.impulses===0&&__RIFT.player.dim==='B',state:__RIFT.state,attempts:__RIFT.attemptsDisplay,impulses:__RIFT.stats.impulses,trace:__touchTrace}),attempts);
 if(!retried.ok)console.log('Retry trace '+JSON.stringify({retry,point,retried}));
 check('native Chromium: secondary finger can Retry while the first finger remains held',retried.ok);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 observations.push({label:'native-queued-stall',native});await b.close();
}
writeFileSync('test-results/m78/browser/results.json',JSON.stringify({checks,observations},null,2));console.log(`${checks} M7.8 browser checks passed`);
