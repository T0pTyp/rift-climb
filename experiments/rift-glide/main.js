import {makeTestGame} from './game.js';
import {glideConfig} from './config.js';
import {GlideWorld,configMatches} from './director.js';
import {ExperimentStats} from './statistics.js';
import {ExperimentAudio} from './audio.js';
import {Input} from '../../js/input.js';
import {inputTime,currentInputEventTime} from '../../js/input-time.js';
import {riftlingArt,drawRiftling} from '../../js/art/riftling.js';
import {MAX_FRAME_DT} from '../../js/config.js';

const $=s=>document.querySelector(s),params=new URLSearchParams(location.search),manual=params.has('manual');
const stats=new ExperimentStats(),audio=new ExperimentAudio({timers:!manual});audio.simulationOnly=manual;
const canvas=$('#game');let game,kind='glide',config=glideConfig(),seed=37,run=null,lastResult=null,last=performance.now(),revision=0,armed=false;
const files=await Promise.all(['auto-course','glide-course','chunks'].map(async n=>{const r=await fetch('data/'+n+'.json');if(!r.ok)throw Error('Testdaten fehlen: '+n);return r.json();}));
const [autoCourse,glideCourse,book]=files;
function screen(id){for(const el of document.querySelectorAll('.overlay'))el.hidden=el.id!==id;$('#hud').hidden=!!id;}
const ui={show:id=>screen(id==='pause'?'pause-screen':id==='menu'?'menu':null),updateHud(){},updateMenu(){},toast(){},showDeath(){},showWin(){}};
const input=new Input(canvas,{
 onPress:(dir,ts)=>{advanceTo(inputTime(ts));audio.unlock();game.press(dir);},
 onPause:()=>{advanceTo(performance.now());if(game.state==='paused'){audio.unlock();game.resume();}else game.pause();},
 onConfirm:()=>{advanceTo(performance.now());audio.unlock();return game.confirm();},
});
canvas.addEventListener('pointerdown',()=>{if(game?.state==='playing'&&run)run.touches++;},true);
if(!window.PointerEvent)canvas.addEventListener('touchstart',()=>{if(game?.state==='playing'&&run)run.touches++;},{capture:true,passive:true});

function height(){return Math.max(0,(game.flight?.maxY??game.y)*.1);}
function finishRun(outcome){
 if(!run||run.finished)return;run.finished=true;
 const g=game;
 lastResult={schema:'rift-glide-run',version:1,id:run.id,kind,model:kind==='auto'?'auto':'glide',start:{x:135,y:0,vx:0,vy:kind==='auto'?260:0,dimension:'B'},course:kind==='endless'?'glide-endless':g.level.id,parameters:kind==='auto'?{arenaWidth:270,horizontalTravelPerTap:90,climbSpeed:260}:structuredClone(g.flight.config),seed:kind==='endless'?seed:null,source:run.source,maxHeight:height(),duration:g.t,touches:run.touches,validImpulses:g.stats.impulses,dimensionChanges:g.stats.impulses,pulses:g.rift.emitted,pulseInteractions:run.pulseInteractions,deathCause:g.killer?.o.type==='rift-floor'?'rift-floor':g.killer?'obstacle:'+g.killer.o.type:null,death:g.killer?{id:g.killer.o.id,type:g.killer.o.type,x:g.player.x,y:g.y,dimension:g.player.dim,t:g.t}:null,outcome,completed:outcome==='complete',inputs:run.inputs.slice(0,16000),truncated:run.truncated||false};
 // Automated replays remain inspectable but never enter the human comparison.
 stats.add(lastResult);$('#storage-warning').textContent=stats.warning;
}
function resultScreen(){
 screen('result');$('#result-label').textContent=run.source==='automated'?'AUTOMATISIERTES REPLAY':'TEST ERGEBNIS';$('#result-title').textContent=game.state==='won'?'COURSE COMPLETE':'RIFT LOST';$('#result-height').textContent=height().toFixed(1)+' m';
 $('#result-detail').textContent=`${game.t.toFixed(1)} s · ${game.stats.impulses} Impulse · ${game.rift.emitted} Pulses${game.killer?' · '+game.killer.reason:''}`;
 $('#feedback').hidden=run.source!=='interactive';$('#rating-status').textContent='';for(const k of ['control','fun','fairness'])$('#rating-'+k).value='';
}
function instrument(g,automated){
 const restart=g.restart.bind(g);g.restart=()=>{
  // randomUUID needs HTTPS; getRandomValues also works for an iPhone LAN HTTP preview.
  const id=crypto.randomUUID?.()??Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');
  finishRun('retry');restart();run={id,source:automated?'automated':'interactive',touches:0,pulseInteractions:0,inputs:[],finished:false};
  revision=g.timelineRevision;last=performance.now();armed=false;
 };
 const press=g.press.bind(g);g.press=dir=>{
  const t=g.t,n=g.stats.impulses,playing=g.state==='playing',inputMs=currentInputEventTime();
  const result=press(dir);
  if(playing&&g.stats.impulses>n&&run){if(run.inputs.length<16000)run.inputs.push({t,dir,...(inputMs!=null?{inputMs}:{})});else run.truncated=true;}
  return result;
 };
 const seal=g.onSealOpen;g.onSealOpen=(s,wasOpen)=>{if(!wasOpen&&run)run.pulseInteractions++;return seal(s,wasOpen);};
 const trap=g.onTrapEvent;g.onTrapEvent=(o,event)=>{if(['saw-break','mine-disarm','laser-disable'].includes(event)&&run)run.pulseInteractions++;return trap(o,event);};
 for(const [method,outcome] of [['die','death'],['win','complete']]){const original=g[method].bind(g);g[method]=(...args)=>{const before=g.state;original(...args);if(before==='playing'&&['dying','won'].includes(g.state)){finishRun(outcome);resultScreen();}};}
}
function resize(){
 if(!game)return;const v=window.visualViewport,w=Math.round(v?.width||innerWidth),h=Math.round(v?.height||innerHeight);
 canvas.style.width=w+'px';canvas.style.height=h+'px';game.resize(w,h,Math.min(devicePixelRatio||1,2.5));
 if(w>h&&matchMedia('(pointer:coarse)').matches)game.pause(true);
}
function start(which,automated=false){
 if(which==='endless'&&!configMatches(config)){screen('params');$('#parameter-error').textContent='Glide Endless benötigt die Standardwerte der geprüften Bibliothek.';return;}
 finishRun('quit');audio.stop();kind=which;
 const data=which==='auto'?autoCourse:glideCourse;
 game=makeTestGame(which==='auto'?'auto':'glide',data,config,{canvas,ui,input,audio,debug:{manual,autoplay:automated,trace:true,speed:1}});
 game.skinId='original';if(which==='endless')game.world=new GlideWorld(book,seed);
 run=null;instrument(game,automated);resize();game.start('normal');window.__RIFT=game;
 $('#model-name').textContent=which==='auto'?'AUTO-CLIMB · REFERENZ':which==='endless'?'GLIDE ENDLESS':'RIFT GLIDE';
}
function home(){finishRun('quit');game.state='menu';audio.stop();input.guard(0);screen('menu');}
for(const which of ['auto','glide','endless'])$('#start-'+which).onclick=()=>{audio.unlock();start(which);};
$('#retry').onclick=()=>{audio.unlock();game.restart();};$('#pause-retry').onclick=()=>{audio.unlock();game.restart();};
$('#pause').onclick=()=>game.pause();$('#resume').onclick=()=>{audio.unlock();game.resume();};
for(const b of document.querySelectorAll('.home'))b.onclick=home;
const fields=[['horizontalTravelPerTap','Horizontal pro Touch',45,90,1],['relativeFlapImpulse','Relativer Auftrieb',40,90,1],['gravity','Schwerkraft (u/s²)',350,750,10],['maxUpwardVelocity','Max. Aufstieg (u/s)',220,400,10],['maxFallVelocity','Max. Fall (u/s)',150,300,10],['flapCooldownMs','Flap-Abstand (ms)',45,160,5]];
$('#parameter-fields').innerHTML=fields.map(([k,label,min,max,step])=>`<label>${label}<input id="param-${k}" type="number" min="${min}" max="${max}" step="${step}" value="${config[k]}" required></label>`).join('');
function derived(){const c=glideConfig();$('#derived').textContent=`Standard: Aufwärtsimpuls ${c.flapVelocity} u/s · Scheitel nach ${(c.flapVelocity/c.gravity).toFixed(2)} s · ${c.relativeFlapImpulse} u Steighöhe · Hitboxradius 8 u unverändert.`;}derived();
$('#show-params').onclick=()=>{screen('params');$('#music-volume').value=audio.settings.music;$('#sfx-volume').value=audio.settings.sfx;$('#muted').checked=audio.muted;};
$('#parameter-form').onsubmit=e=>{e.preventDefault();try{const c=glideConfig(Object.fromEntries(fields.map(([k])=>[k,Number($('#param-'+k).value)]))),s=Number($('#seed').value);if(!Number.isInteger(s)||s<0||s>4294967295)throw Error('Seed muss eine ganze Zahl von 0 bis 4294967295 sein.');config=c;seed=s;$('#parameter-error').textContent='';home();}catch(err){$('#parameter-error').textContent=err.message;}};
$('#defaults').onclick=()=>{const c=glideConfig();for(const [k]of fields)$('#param-'+k).value=c[k];$('#seed').value=37;};
$('#music-volume').oninput=e=>audio.setVolume('music',e.target.value);$('#sfx-volume').oninput=e=>audio.setVolume('sfx',e.target.value);$('#muted').onchange=e=>audio.setMuted(e.target.checked);
$('#save-rating').onclick=()=>{const ok=stats.rate(lastResult?.id,Object.fromEntries(['control','fun','fairness'].map(k=>[k,Number($('#rating-'+k).value)])));$('#rating-status').textContent=ok?'Bewertung gespeichert.':'Bitte alle drei Werte von 1 bis 5 auswählen.';};
function comparison(){
 const display=v=>v==null?'—':v.toFixed(1);
 $('#summary').replaceChildren();for(const k of ['auto','glide','endless'])for(const group of stats.groups(k).length?stats.groups(k):[null]){
  const s=stats.summary(k,group),el=document.createElement('article');el.className='report-card';el.innerHTML=`<h3>${k==='auto'?'AUTO-CLIMB':k==='glide'?'RIFT GLIDE':'GLIDE ENDLESS'}</h3><dl><dt>Abgeschlossene echte Runs</dt><dd>${s.runs} / Ziel 5</dd><dt>Ø Überlebensdauer</dt><dd>${display(s.meanDuration)} s</dd><dt>Ø maximale Höhe</dt><dd>${display(s.meanHeight)} m</dd><dt>Touches / Minute</dt><dd>${display(s.touchesPerMinute)}</dd><dt>Streckenabschlüsse</dt><dd>${s.completionRate==null?'—':Math.round(s.completionRate*100)+' %'}</dd></dl>`;
  if(group&&k!=='auto'){const c=JSON.parse(group),p=document.createElement('p');p.className='note';p.textContent=`Parameter: g ${c?.gravity??'—'} · Auftrieb ${c?.relativeFlapImpulse??'—'} · seitlich ${c?.horizontalTravelPerTap??'—'} · Cooldown ${c?.flapCooldownMs??'—'} ms`;el.append(p);}
  const ratings=document.createElement('p');ratings.className='note';ratings.textContent=`Bewertung Ø (1–5): Kontrolle ${display(s.ratings.control)} · Spaß ${display(s.ratings.fun)} · Fairness ${display(s.ratings.fairness)}`;el.append(ratings);
  const causes=document.createElement('p');causes.className='note';causes.textContent='Todesursachen: '+(Object.entries(s.deaths).map(([n,c])=>n+' × '+c).join(', ')||'noch keine Daten');el.append(causes);$('#summary').append(el);
 }screen('comparison');
}
$('#show-stats').onclick=comparison;
$('#export-stats').onclick=()=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([JSON.stringify(stats.data,null,2)],{type:'application/json'}));a.href=u;a.download='rift-glide-tests.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
for(const k of ['auto','glide','endless'])$('#replay-'+k).onclick=()=>{audio.unlock();config=glideConfig();start(k,true);};
audio.onInterrupt=()=>game?.pause(true);
function advanceTo(now){
 if(manual||!game||now<=last)return;
 if(revision!==game.timelineRevision){revision=game.timelineRevision;last=now;armed=false;return;}
 const elapsed=(now-last)/1000;last=now;
 if(elapsed>MAX_FRAME_DT&&armed&&game.state==='playing')game.pause(true);
 game.update(Math.min(MAX_FRAME_DT,elapsed));armed=game.state==='playing';
}
function render(){
 game.render();$('#height').textContent=height().toFixed(1)+' m';$('#phase').textContent=game.player.dim==='B'?'BLAU':'ROT';$('#phase').style.color=game.player.dim==='B'?'#4de4ff':'#ff58bb';
 if(!$('#menu').hidden){const c=canvas.getContext('2d'),v=game.view,r=$('.character-space').getBoundingClientRect();c.save();c.setTransform(v.dpr*1.65,0,0,v.dpr*1.65,v.cssW*v.dpr/2,(r.top+r.height/2)*v.dpr);drawRiftling(c,0,0,game.anim.pose,v.dpr*1.65,'original');c.restore();}
}
window.advanceTime=ms=>{if(!Number.isFinite(ms)||ms<0||ms>600000)throw Error('Ungültige Zeit');for(let r=ms/1000;r>1e-9;){const h=Math.min(1/60,r);game.update(h);r-=h;}render();};
window.render_game_to_text=()=>JSON.stringify({coordinates:'u; x right, y up; 10u=1m; time seconds',state:game.state,model:kind,source:run?.source,t:game.t,player:{x:game.player.x,y:game.y,vx:game.player.vx,vy:game.flight?.vy??260,dimension:game.player.dim,radius:8,target:game.player.target??game.player.lane},arena:{width:270,travel:kind==='auto'?90:game.flight.config.horizontalTravelPerTap},maxHeight:height(),camera:game.cameraY,floor:game.flight?.floor,impulses:game.stats.impulses,pulses:game.rift.emitted,progress:game.progress,killer:game.killer?.reason,audio:audio.status(),world:game.world?{seed:game.world.seed,chunks:game.world.chunks.map(c=>c.id),generated:game.world.generated,rejected:game.world.director.rejected,fallbacks:game.world.director.fallbacks}:null,obstacles:game.obstacles.filter(o=>Math.abs(o.y-game.y)<400).map(o=>({id:o.id,x:o.x0,y:o.y,w:o.x1-o.x0,color:o.color})),traps:game.traps.traps.filter(o=>Math.abs(o.y-game.y)<400).map(o=>({id:o.id,type:o.type,state:o.state,dimension:o.color})),storageWarning:stats.warning});
window.__GLIDE={start,stats,audio,get game(){return game;},get config(){return config;},book,home};
document.addEventListener('visibilitychange',()=>{if(document.hidden){game.pause(true);audio.suspend();}});
window.addEventListener('pagehide',()=>{finishRun('quit');game.pause(true);audio.stop();});window.addEventListener('blur',()=>game.pause(true));
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.addEventListener('orientationchange',()=>setTimeout(resize,150));
document.addEventListener('gesturestart',e=>e.preventDefault());canvas.addEventListener('dblclick',e=>e.preventDefault());
window.addEventListener('keydown',e=>{if(e.key==='f'&&!['INPUT','SELECT'].includes(e.target.tagName)){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.();}});
// Initial preview only: does not start or record a run.
game=makeTestGame('glide',glideCourse,config,{canvas,ui,input,audio,debug:{manual,trace:true,speed:1}});window.__RIFT=game;resize();screen('menu');$('#storage-warning').textContent=stats.warning;
function frame(now){advanceTo(now);render();requestAnimationFrame(frame);}requestAnimationFrame(frame);
