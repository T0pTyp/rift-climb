import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';
mkdirSync('test-results/m8/browser',{recursive:true});let checks=0;
const check=(name,ok)=>{assert.ok(ok,name);checks++;console.log('PASS '+name);};
for(const [type,device,label] of [[chromium,devices['Pixel 7'],'touch'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{viewport:{width:1280,height:900}},'desktop']]) {
 const b=await type.launch(),c=await b.newContext(device),p=await c.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));const click=selector=>device.isMobile?p.tap(selector):p.click(selector);
 const snap=name=>p.screenshot({path:`test-results/m8/browser/${label}-${name}.png`});
 await p.goto(BASE+'?manual=1');await p.waitForFunction(()=>window.__RIFT);
 check(label+' five home destinations',await p.locator('.nav-tile:visible').count()===5);await snap('home');
 await click('#nav-collection');check(label+' five skins, original equipped',await p.evaluate(()=>document.querySelectorAll('.skin-card').length===5&&__ASCENSION.data.cosmetics.selectedSkinId==='original'));
 await click('[data-skin="golden"]');check(label+' locked preview cannot equip',await p.isDisabled('#btn-equip'));await p.waitForTimeout(200);await snap('locked-golden');
 await click('#page-collection [data-home]');await click('#nav-play');
 check(label+' three cards with two actions and actual artwork',await p.evaluate(()=>document.querySelectorAll('.level-art').length===3&&document.querySelectorAll('.card-actions .btn').length===6&&[...document.querySelectorAll('.level-art')].every(i=>i.naturalWidth>0)));
 await click('#btn-start');await p.waitForTimeout(220);
 check(label+' normal start counted once; First Flight',await p.evaluate(()=>__ASCENSION.summary().totalNormalAttempts===1&&!!__ASCENSION.data.achievements['first-flight']));
 await p.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();advanceTime(21000);});
 check(label+' Bronze/Halfway earned; notices deferred',await p.evaluate(()=>__ASCENSION.level('first-pulse').medal==='bronze'&&!!__ASCENSION.data.achievements['halfway-there']&&document.querySelector('#reward-notice').hidden));
 const time=await p.evaluate(()=>__ASCENSION.summary().activePlaytimeMs);
 await click('#btn-pause');await p.evaluate(()=>advanceTime(5000));check(label+' paused time excluded',await p.evaluate(t=>__ASCENSION.summary().activePlaytimeMs===t,time));await click('#btn-resume');
 await p.evaluate(()=>advanceTime(10000));check(label+' Silver at 75%',await p.evaluate(()=>__ASCENSION.level('first-pulse').medal==='silver'));
 await p.evaluate(()=>advanceTime(10000));
 check(label+' real First Pulse win: Gold, Azure, First Victory',await p.evaluate(()=>__RIFT.state==='won'&&__ASCENSION.level('first-pulse').clears===1&&__ASCENSION.data.cosmetics.unlockedSkinIds.includes('azure')&&!!__ASCENSION.data.achievements['first-victory']));
 check(label+' completion medal, rewards, Next Level',await p.evaluate(()=>!document.querySelector('#btn-next-level').hidden&&document.querySelector('#win-medal img').alt==='Gold'&&document.querySelector('#win-rewards').textContent.includes('Azure')));await p.waitForTimeout(500);await snap('complete');
 await p.evaluate(()=>{__RIFT.win();__RIFT.win();});check(label+' duplicate wins ignored',await p.evaluate(()=>__ASCENSION.level('first-pulse').clears===1));
 await click('#btn-next-level');check(label+' Next starts Fractured',await p.evaluate(()=>__RIFT.level.id==='fractured-rhythm'&&__RIFT.state==='playing'&&__ASCENSION.summary().totalNormalAttempts===2));
 await p.evaluate(()=>advanceTime(57000));check(label+' real Fractured win grants Crimson',await p.evaluate(()=>__RIFT.state==='won'&&__ASCENSION.data.cosmetics.unlockedSkinIds.includes('crimson')));
 await click('#btn-next-level');await p.evaluate(()=>advanceTime(68000));
 check(label+' real Overload win: Golden Ascent and all skins',await p.evaluate(()=>__RIFT.state==='won'&&__ASCENSION.summary().goldMedals===3&&__ASCENSION.summary().skins===5&&!!__ASCENSION.data.achievements['golden-ascent']));check(label+' no Next after Overload',await p.isHidden('#btn-next-level'));
 await click('#btn-win-menu');await click('#page-levels [data-home]');await click('#nav-collection');await click('[data-skin="golden"]');await click('#btn-equip');
 check(label+' earned design applied to actual renderer',await p.evaluate(()=>__RIFT.skinId==='golden'&&__ASCENSION.data.cosmetics.selectedSkinId==='golden'));await p.waitForTimeout(180);await snap('collection');
 await p.reload();await p.waitForFunction(()=>window.__RIFT);
 check(label+' reload retains skin, medals and attempts',await p.evaluate(()=>__RIFT.skinId==='golden'&&__ASCENSION.summary().goldMedals===3&&__ASCENSION.summary().totalNormalAttempts===3));
 if(!await p.isVisible('#nav-play'))await click('#page-levels [data-home]');
 await click('#nav-play');await click('[data-level="first-pulse"]');await click('#btn-practice');const before=await p.evaluate(()=>JSON.stringify(__ASCENSION.data));
 await p.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();advanceTime(41000);});check(label+' Practice win leaves progression unchanged',await p.evaluate(s=>__RIFT.state==='won'&&JSON.stringify(__ASCENSION.data)===s,before));
 await click('#btn-next-level');check(label+' Practice Next remains isolated Practice',await p.evaluate(()=>__RIFT.level.id==='fractured-rhythm'&&__RIFT.mode==='practice'&&__ASCENSION.summary().totalNormalAttempts===3));
 await click('#btn-pause');await click('#btn-pause-menu');await click('[data-level="first-pulse"]');await click('#btn-start');await p.evaluate(()=>{__RIFT.debug.autoplay=false;__RIFT.autoplayQueue=[];advanceTime(2000);});
 check(label+' death counted once, Retry immediately visible',await p.evaluate(()=>['dying','dead'].includes(__RIFT.state)&&__ASCENSION.level('first-pulse').deaths===1&&!document.querySelector('#death').hidden));
 await click('#btn-death-restart');check(label+' Retry starts exactly one attempt',await p.evaluate(()=>__RIFT.state==='playing'&&__RIFT.t===0&&__RIFT.player.dim==='B'&&__ASCENSION.level('first-pulse').deaths===1&&__ASCENSION.level('first-pulse').attempts===3));
 await p.evaluate(()=>{__RIFT.debug.autoplay=false;__RIFT.autoplayQueue=[];advanceTime(2200);});await snap('death');await click('#btn-death-home');await click('#nav-achievements');
 check(label+' all eight achievement cards',await p.locator('.achievement-card').count()===8);await snap('achievements');await click('#page-achievements [data-home]');await click('#nav-profile');
 check(label+' profile contains measured stats and per-level records',await p.locator('.stat-card').count()===8&&await p.locator('.profile-level').count()===3);await snap('profile');
 await click('#page-profile [data-home]');await click('#nav-settings');await click('#btn-sound');check(label+' mute saved in audio preferences',await p.evaluate(()=>JSON.parse(localStorage.getItem('riftclimb.audio.v1')).muted===true));
 await p.reload();await p.waitForFunction(()=>window.__RIFT);check(label+' mute restored, fixed high graphics',await p.evaluate(()=>__RIFT.audio.muted&&!document.querySelector('#btn-gfx')&&__RIFT.particles.cap===320));
 const saved=await p.evaluate(()=>localStorage.getItem('riftclimb.ascension.v2'));
 await p.goto(BASE+'assets/forge/');await p.waitForFunction(()=>document.body.dataset.ready==='1');await p.evaluate(()=>__FORGE.actions.playtest());await p.waitForFunction(()=>document.querySelector('#pt-frame').contentWindow?.__RIFT?.state==='paused');
 const frame=await(await p.$('#pt-frame')).contentFrame();await frame.evaluate(()=>{__RIFT.debug.manual=true;__RIFT.audio.simulationOnly=true;});await frame.click('#btn-resume');await frame.evaluate(()=>{__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();advanceTime(41000);});
 check(label+' Forge reaches 100% with explicitly isolated progression',await frame.evaluate(()=>__RIFT.state==='won'&&__ASCENSION.isolated&&__ASCENSION.summary().totalNormalAttempts===0&&__ASCENSION.summary().achievements===0));
 await click('#pt-exit');check(label+' normal save unchanged after Forge',await p.evaluate(s=>localStorage.getItem('riftclimb.ascension.v2')===s,saved));
 const artwork=await p.evaluate(async()=>{
  const {riftlingArt,drawRiftling}=await import('./../../js/art/riftling.js'),{RiftlingAnimator}=await import('./../../js/art/riftling-anim.js');
  const hashes=[],states=new Set();
  for(const skin of ['original','azure','crimson','golden','void']){
   await riftlingArt.loadSkin(skin);const c=document.createElement('canvas');c.width=c.height=120;const g=c.getContext('2d'),a=new RiftlingAnimator();let hash=0;
   for(const state of ['idle','flight','switch','death','respawn']){
    a.reset(0);if(state==='switch')a.onSwitch(1);if(state==='death')a.onDeath();if(state==='respawn')a.onRespawn();
    a.update(.08,{vx:state==='flight'?400:0,tilt:.2,targetBlend:state==='switch'?1:0,alive:state!=='death'});states.add(a.state);
    g.setTransform(2.5,0,0,2.5,60,60);g.clearRect(-24,-24,48,48);drawRiftling(g,0,0,a.pose,2.5,skin);
    const pixels=g.getImageData(0,0,120,120).data;let opaque=0;for(let i=0;i<pixels.length;i++){hash=(hash+pixels[i]*(i%37+1))>>>0;if(i%4===3&&pixels[i]>0)opaque++;}if(opaque<50)return false;
   }
   hashes.push(hash);
  }
  return new Set(hashes).size===5&&['idle','flightRight','switch','death','respawn'].every(s=>states.has(s));
 });
 check(label+' five distinct designs render all shared animation states',artwork);check(label+' no page errors',errors.length===0);await b.close();
}
for(const mode of ['legacy','corrupt','blocked']) {
 const b=await chromium.launch(),c=await b.newContext(devices['Pixel 7']);
 await c.addInitScript(mode=>{if(mode==='blocked'){Storage.prototype.setItem=()=>{throw new DOMException('Quota','QuotaExceededError');};}else if(mode==='legacy'){localStorage.setItem('riftclimb.pulse.v1.first-pulse',JSON.stringify({stats:{best:100,attempts:12,clears:2},gfx:'low'}));}else localStorage.setItem('riftclimb.ascension.v2','{bad');},mode);
 const p=await c.newPage();await p.goto(BASE);await p.waitForFunction(()=>window.__RIFT);
 if(mode==='legacy')check('M7 migration preserves evidence, rewards and unknown history',await p.evaluate(()=>__ASCENSION.level('first-pulse').attempts===12&&__ASCENSION.data.cosmetics.unlockedSkinIds.includes('azure')&&__ASCENSION.summary().historyIncomplete&&__ASCENSION.level('first-pulse').firstCompletedAt===null));
 else check(mode+' storage shows explanatory warning without crashing',await p.evaluate(()=>!!__ASCENSION.warning&&!document.querySelector('#save-notice').hidden));await b.close();
}
for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[768,1024]]) {
 const b=await chromium.launch(),p=await b.newPage({viewport:{width,height},isMobile:true,hasTouch:true});await p.goto(BASE);await p.waitForFunction(()=>window.__RIFT);
 for(const page of ['home','levels','collection','achievements','profile','settings']) {
  await p.evaluate(page=>__RIFT.ui.openPage(page),page);
  check(`${width} ${page} scrollable without horizontal overflow`,await p.evaluate(()=>{const r=document.querySelector('#menu .panel').getBoundingClientRect();return document.documentElement.scrollWidth===innerWidth&&r.left>=0&&r.right<=innerWidth&&r.top>=0;}));
 }
 await b.close();
}
{
 const b=await chromium.launch(),p=await b.newPage();await p.goto(BASE);await p.waitForFunction(()=>window.__RIFT);
 const peak=await p.evaluate(async()=>{
  const {AudioEngine}=await import('./js/audio.js');
  const ctx=new OfflineAudioContext(1,44100,44100),a=new AudioEngine({context:ctx,timers:false});
  Object.defineProperty(a,'ready',{value:true});a.sfx('reward');a.sfx('record');a.sfx('win');
  const rendered=await ctx.startRendering();return Math.max(...rendered.getChannelData(0).map(Math.abs));
 });
 check('Reward, record and win effects together stay audible without digital clipping',peak>.001&&peak<.98);await b.close();
}
writeFileSync('test-results/m8/browser/results.json',JSON.stringify({checks},null,2));console.log(`${checks} Ascension browser checks passed`);
