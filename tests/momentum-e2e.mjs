import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {Progression} from '../js/progression.js';
const BASE=process.env.BASE_URL||'http://localhost:8080/',out=process.env.M81_OUT||'test-results/m81/browser';mkdirSync(out,{recursive:true});
let checks=0;const observations=[],check=(n,ok)=>{assert.ok(ok,n);checks++;console.log('PASS '+n);};
// Explicit synthetic fixtures, isolated browser contexts. These are not human play records.
function fixture(tier){const p=new Progression({storage:{getItem(){return null;},setItem(){}}});p.data.endless.bestHeight=1400;p.data.endless.tutorialSeen=true;for(const h of [1180,1240,1210].slice(0,tier===2?3:tier===1?2:0)){const a=p.infinityStorage(37),r=a.beginRun();a.finish(r,h/26,0,'death');}return p.data;}
for(const [engine,device,label] of [[chromium,devices['Pixel 7'],'android'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{...devices['iPhone SE'],viewport:{width:320,height:568}},'small']]){
 const b=await engine.launch();try{for(const tier of [0,1,2]){
 const c=await b.newContext(device);await c.addInitScript(data=>{if(!sessionStorage.getItem('momentum-fixture')){localStorage.setItem('riftclimb.ascension.v2',JSON.stringify(data));sessionStorage.setItem('momentum-fixture','1');}},fixture(tier));
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));const tag=label+' M'+tier;
 await p.goto(BASE+'?manual=1&trace=1&seed=37');await p.waitForFunction(()=>window.__RIFT?.art.ready);
 check(tag+' normal public menu has no Momentum/arena selection',await p.evaluate(()=>[...document.querySelectorAll('#page-home button')].filter(e=>e.getClientRects().length).map(e=>e.id).join(',')==='nav-play,nav-settings'&&!document.querySelector('#forge-link').getClientRects().length));
 await p.tap('#nav-play');check(tag+' start at 0m, blue / 270 / 90 / frozen run snapshot',await p.evaluate(tier=>__RIFT.t===0&&__RIFT.y===0&&__RIFT.player.dim==='B'&&__RIFT.arena.width===270&&__RIFT.arena.step===90&&__RIFT.endless.momentum.tier===tier&&Object.isFrozen(__RIFT.endless.momentum),tier));
 await p.waitForTimeout(240);await p.touchscreen.tap(3,device.viewport.height*.6);await p.evaluate(()=>advanceTime(80));
 check(tag+' left display half moves right, one switch and one pulse',await p.evaluate(()=>__RIFT.player.x>135&&__RIFT.player.dim==='R'&&__RIFT.rift.emitted===1));
 await p.waitForTimeout(60);await p.touchscreen.tap(device.viewport.width-3,device.viewport.height*.6);await p.evaluate(()=>advanceTime(80));
 check(tag+' right display half retargets left, exactly two switches/pulses',await p.evaluate(()=>__RIFT.player.lane===1&&__RIFT.player.dim==='B'&&__RIFT.rift.emitted===2));
 await p.tap('#btn-pause');const time=await p.evaluate(()=>__RIFT.t);await p.evaluate(()=>advanceTime(1000));check(tag+' pause freezes simulation and cancels sources',await p.evaluate(t=>__RIFT.state==='paused'&&__RIFT.t===t&&__RIFT.audio.voices.size===0,time));await p.tap('#btn-resume');
 await p.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.restart();__RIFT.recordEndlessInputs();advanceTime(20000);});
 check(tag+' actual height and virtual difficulty remain separate; debug exposes evidence',await p.evaluate(tier=>{const r=JSON.parse(render_game_to_text());return __RIFT.state==='playing'&&r.infinity.height===Math.floor(__RIFT.y*.1+1e-6)&&__ASCENSION.data.endless.lastHeight===r.infinity.height&&r.infinity.momentum.effectiveDifficultyHeight>=r.infinity.height&&(tier===0||r.infinity.momentum.effectiveDifficultyHeight>r.infinity.height)&&Array.isArray(r.debug.momentum.qualifyingHeights);},tier));
 await p.screenshot({path:`${out}/${label}-m${tier}-flow.png`});
 await p.evaluate(()=>advanceTime(30000));
 check(tag+' replay v2 reconstructs actual 50s run, including Momentum',await p.evaluate(async tier=>{const g=__RIFT,{runEndlessReplay}=await import('./js/playcheck.js'),r=g.exportEndlessReplay(),played=runEndlessReplay(g.endless.book,r);return r.version===2&&r.momentum.tier===tier&&played.ok&&played.state==='playing'&&played.x===g.player.x&&played.dimension===g.player.dim;},tier));
 if(tier===2){await p.evaluate(()=>{__RIFT.debug.hitboxes=true;});await p.screenshot({path:`${out}/${label}-debug.png`});await p.evaluate(()=>{__RIFT.debug.hitboxes=false;advanceTime((385-__RIFT.t)*1000);});check(tag+' real adaptive 10000m run and bounded resources',await p.evaluate(()=>__RIFT.state==='playing'&&__RIFT.y>=100000&&__RIFT.endless.chunks.length<=9&&__RIFT.endless.maxObjects<160&&__RIFT.audio.voices.size===0));}
 await p.evaluate(()=>{__RIFT.debug.autoplay=false;__RIFT.autoplayQueue=[];advanceTime(60000);});
 check(tag+' actual collision saves actual meters; developer replay adds no evidence',await p.evaluate(tier=>['dead','dying'].includes(__RIFT.state)&&!!__RIFT.killer&&__ASCENSION.data.endless.lastHeight===Math.floor(__RIFT.y*.1+1e-6)&&__ASCENSION.data.endless.momentum.recentRuns.length===(tier===2?3:tier===1?2:0),tier));
 await p.tap('#btn-death-restart');check(tag+' immediate Retry keeps snapshot and resets flight, traps, time',await p.evaluate(tier=>__RIFT.t===0&&__RIFT.state==='playing'&&__RIFT.player.x===135&&__RIFT.player.dim==='B'&&__RIFT.rift.emitted===0&&__RIFT.endless.momentum.tier===tier&&__RIFT.traps.traps.every(o=>o.state==='idle'),tier));
 const best=await p.evaluate(()=>__ASCENSION.data.endless.bestHeight);await p.reload();await p.waitForFunction(()=>window.__RIFT);
 check(tag+' reload preserves proof and actual high score',await p.evaluate(({tier,best})=>__ASCENSION.data.endless.momentum.tier===tier&&__ASCENSION.data.endless.bestHeight===best&&__RIFT.state==='menu',{tier,best}));
 await p.tap('#nav-play');await p.evaluate(async()=>{const {blankMomentum}=await import('./js/momentum.js');__ASCENSION.data.endless.momentum=blankMomentum();advanceTime(50);});
 check(tag+' profile changes never alter active run; next Retry adopts new snapshot',await p.evaluate(tier=>{const g=__RIFT,old=g.endless.momentum.tier;g.restart();return old===tier&&g.endless.momentum.tier===0&&g.y===0&&g.rift.emitted===0;},tier));
 check(tag+' no horizontal overflow / fixed quality / no uncaught browser exceptions',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&!document.querySelector('#btn-gfx'))&&errors.length===0);
 observations.push({label,tier,best,errors});await c.close();
 }}finally{await b.close();}
}
writeFileSync(`${out}/report.json`,JSON.stringify({checks,observations},null,2));console.log(checks+' Rift Momentum browser checks passed');
