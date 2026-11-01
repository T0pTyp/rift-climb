import {HybridSimulation} from './simulation.js';
import {HybridDirector,composeCourse,certified} from './director.js';
import {hybridConfig,HYBRID_DEFAULTS,PARAMS,jumpMetrics,defaultPhysics} from './config.js';
import {HybridRenderer} from './renderer.js';
import {HybridAudio} from './audio.js';
import {HybridStats} from './statistics.js';
import {Game} from '../../js/game.js';
import {Progression} from '../../js/progression.js';
import {createEmptyLevel} from '../../js/level-data.js';
import {validateChunkBook} from '../../js/endless.js';
import {isTrap,trapPose} from '../../js/traps.js';

const $=s=>document.querySelector(s),query=new URLSearchParams(location.search),manual=query.has('manual');
const canvas=$('#game'),renderer=new HybridRenderer(canvas),audio=new HybridAudio({timers:!manual}),stats=new HybridStats();
audio.simulationOnly=manual;
const json=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Testdaten fehlen: '+url);return r.json();};
const [book,course,publicBook]=await Promise.all([json('data/book.json'),json('data/first-run.json'),json('../../assets/endless/director.json')]);
if(book.chunks.length!==14||!book.chunks.every(certified))throw Error('Hybrid-Bibliothek enthält ungeprüfte Daten.');
validateChunkBook(publicBook);
const track=composeCourse(book.chunks,course);
let sim=null,baseline=null,director=null,kind='course',config=hybridConfig(),seed=37,run=null,lastResult=null,automated=false,last=performance.now(),lastQueued=-1;
let pointerEpoch=last,pendingReplay=[],fps=60;const pointers=new Set();
function screen(id){for(const el of document.querySelectorAll('.screen'))el.hidden=el.id!==id;$('#hud').hidden=!!id;$('#controls').hidden=!!id;}
function resize(){const w=Math.round(visualViewport?.width||innerWidth),h=Math.round(visualViewport?.height||innerHeight);renderer.resize(w,h,devicePixelRatio||1);baseline?.resize(w,h,devicePixelRatio||1);}
resize();addEventListener('resize',resize);visualViewport?.addEventListener('resize',resize);
const id=()=>crypto.randomUUID?.()??Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-');
function finish(outcome) {
  if(!run||run.finished)return;run.finished=true;
  const summary=baseline?{duration:baseline.t,distance:baseline.y*.1,counts:{touches:run.touches,jumps:0,flaps:0,phases:baseline.stats.impulses,pulses:baseline.rift.emitted,portals:0,interactions:baseline.traps.events},completed:false,death:baseline.killer?{type:baseline.killer.o.type,id:baseline.killer.o.id,mode:'auto',t:baseline.t}:null,parameters:{arenaWidth:270,travelPerTouch:90,climbSpeed:260}}:sim.summary();
  lastResult={schema:'rift-hybrid-run',version:1,id:run.id,kind,seed,source:automated?'automated':'interactive',outcome,...summary,inputs:baseline?run.inputs.slice(-16000):sim.inputs.slice(-16000),entry:baseline?'auto':{x:0,y:8,vy:0,mode:'ground',dim:'B'}};
  stats.add(lastResult);$('#storage-warning').textContent=stats.warning;
}
function showResult() {
  finish((baseline?baseline.state==='won':sim.state==='complete')?'complete':'death');audio.stop();audio.effect(lastResult.completed?'complete':'death',baseline?.player.dim||sim?.p.dim);
  $('#result-label').textContent=automated?'AUTOMATISIERTES REPLAY':'TEST ERGEBNIS';$('#result-title').textContent=lastResult.completed?'RUN COMPLETE':'RIFT LOST';
  $('#result-distance').textContent=lastResult.completed?'100 %':lastResult.distance.toFixed(1)+' m';
  $('#result').classList.toggle('complete',lastResult.completed);
  $('#result-info').textContent=`${lastResult.duration.toFixed(1)} s · ${lastResult.counts.jumps} Sprünge · ${lastResult.counts.flaps} Flaps · ${lastResult.counts.phases} Phasen${lastResult.death?' · '+lastResult.death.type:''}`;
  $('#feedback').hidden=automated;$('#feedback').open=false;$('#rating-status').textContent='';for(const s of document.querySelectorAll('#rating-fields select'))s.value='';screen('result');
}
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function queueNewPieces(){if(!automated||!director)return;for(const p of sim.pieces)if(p.index>lastQueued){const c=book.chunks.find(c=>c.id===p.id);for(const a of c.replay.inputs)sim.input(a.action,a.t+p.offset/config.speed);lastQueued=p.index;}}
function start(which='course',options={}) {
  if((which==='endless'||options.automated)&&!defaultPhysics(config)){screen('params');$('#param-error').textContent='Für zertifiziertes Endless / Replay bitte Standardwerte verwenden.';return false;}
  finish('aborted');audio.stop();baseline=null;sim=null;renderer.sim=null;kind=which;automated=!!options.automated;director=null;lastQueued=-1;
  run={id:id(),finished:false,touches:0,inputs:[]};pendingReplay=[];pointerEpoch=performance.now();last=pointerEpoch;
  if(kind==='auto') {
    const progression=new Progression({storage:memory(),isolated:true}),storage=progression.infinityStorage(seed,{momentumEligible:false});
    baseline=new Game({canvas,audio,level:createEmptyLevel({arenaStyle:'narrow'}),storage,input:{guard(){},ignored:0},debug:{manual,trace:true,autoplay:false,speed:1},ui:{show(){},setArena(){},updateMenu(){},updateHud(){},updateEndlessHud(){},toast(){},showDeath:showResult,showWin:showResult}});
    baseline.resize(renderer.w,renderer.h,devicePixelRatio||1);baseline.startEndless(publicBook,seed,storage);window.__BASELINE=baseline;
    $('#run-name').textContent='AUTO-CLIMB · ISOLIERTE REFERENZ';$('#motion-hint').textContent='LINKS → RECHTS';$('#controls span:last-child').textContent='RECHTS → LINKS';$('#controls').style.setProperty('--split','50%');
  } else {
    sim=new HybridSimulation({config,pieces:kind==='course'?track.pieces:[],endless:kind==='endless',source:automated?'automated':'interactive'});renderer.bind(sim);
    if(kind==='endless'){director=new HybridDirector(book.chunks,{seed,config});director.ensure(sim);queueNewPieces();}
    else if(automated)for(const a of track.inputs)sim.input(a.action,a.t);
    sim.onEvent(e=>{if(e.kind==='phase')audio.setDimension(e.dim);if(!['death','complete'].includes(e.kind))audio.effect(e.kind,e.dim);});
    audio.configure(kind==='endless');audio.setDimension('B',true);audio.effect('portal','B');audio.update(0);
    $('#run-name').textContent=kind==='endless'?'HYBRID INFINITY':'RIFT HYBRID · FIRST RUN';$('#controls span:last-child').textContent='PHASE ◇';$('#controls').style.setProperty('--split',config.actionSplit*100+'%');
  }
  screen(null);resize();return true;
}
function home(){finish('aborted');audio.stop();sim=null;baseline=null;director=null;renderer.sim=null;screen('menu');pointerEpoch=performance.now();last=pointerEpoch;}
function pause() {if(baseline){baseline.pause(true);}else if(sim?.state==='playing'){pendingReplay=automated?sim.queue.slice():[];sim.pause();}if((baseline?.state||sim?.state)==='paused'){audio.stop();pointerEpoch=performance.now();screen('paused');}}
function resume(){audio.unlock();if(baseline)baseline.resume();else{sim?.resume();if(automated)for(const a of pendingReplay)sim.input(a.action,a.t);pendingReplay=[];audio.seek(sim.t);audio.update(sim.t);}last=performance.now();pointerEpoch=last;screen(null);}
function advance(seconds){
  if(baseline){baseline.update(seconds);if(['dead','dying','won'].includes(baseline.state)&&!run.finished)showResult();return;}
  if(!sim)return;
  let remaining=seconds;
  while(remaining>1e-9&&sim.state==='playing'){
    director?.ensure(sim);queueNewPieces();const dt=Math.min(remaining,1/60);sim.advance(dt);renderer.update(dt);remaining-=dt;
  }
  if(sim.state==='playing')audio.update(sim.t);
  if(['dead','complete'].includes(sim.state)&&!run.finished)showResult();
}
function advanceReal(now){const elapsed=(now-last)/1000;last=now;if(manual||elapsed<=0)return;if(elapsed>.25){pause();return;}advance(elapsed);}
function sendAt(x,timeStamp) {
  const now=performance.now(),stamp=timeStamp>1e12?timeStamp-performance.timeOrigin:timeStamp;
  if(stamp<pointerEpoch-1||now-stamp>1000)return;
  advanceReal(now);audio.unlock();
  if(run?.finished){start(kind);return;}
  if(baseline){if(baseline.state!=='playing')return;const dir=x<renderer.w/2?1:-1;run.touches++;const before=baseline.stats.impulses,t=baseline.t;baseline.press(dir);if(baseline.stats.impulses>before)run.inputs.push({t,dir});}
  else if(sim?.state==='playing')sim.input(x<renderer.w*config.actionSplit?'motion':'phase');
}
// Only pointerdown produces actions. No hold repeat, no second touch/click event path.
if(globalThis.PointerEvent){
  canvas.addEventListener('pointerdown',e=>{e.preventDefault();if(e.pointerType==='mouse'&&e.button!==0||pointers.has(e.pointerId))return;pointers.add(e.pointerId);if(e.isTrusted)canvas.setPointerCapture?.(e.pointerId);sendAt(e.clientX,e.timeStamp);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>pointers.delete(e.pointerId));
}else{
  canvas.addEventListener('touchstart',e=>{e.preventDefault();for(const p of e.changedTouches)if(!pointers.has(p.identifier)){pointers.add(p.identifier);sendAt(p.clientX,e.timeStamp);}},{passive:false});
  for(const name of ['touchend','touchcancel'])canvas.addEventListener(name,e=>{for(const p of e.changedTouches)pointers.delete(p.identifier);});
}
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')||e.repeat)return;
  if(['Space','ArrowUp','KeyX'].includes(e.code)){e.preventDefault();sendAt(0,e.timeStamp);}
  if(['KeyC','ArrowRight'].includes(e.code)){e.preventDefault();sendAt(renderer.w,e.timeStamp);}
  if(['Escape','KeyP'].includes(e.code)){e.preventDefault();if((baseline?.state||sim?.state)==='paused')resume();else pause();}
  if(e.code==='KeyF'){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.();}
});
for(const which of ['course','endless','auto'])$('#start-'+which).onclick=()=>{audio.unlock();start(which);};
$('#pause').onclick=pause;$('#resume').onclick=resume;
for(const key of ['retry','paused-retry'])$('#'+key).onclick=()=>{audio.unlock();start(kind);};
for(const b of document.querySelectorAll('.home'))b.onclick=home;
audio.onInterrupt=pause;document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});addEventListener('blur',pause);addEventListener('pagehide',()=>{finish('aborted');audio.stop();});
function fields(values=config){
  $('#param-fields').replaceChildren();for(const [key,[min,max,step,title]] of Object.entries(PARAMS)){const label=document.createElement('label'),input=document.createElement('input');label.textContent=title;input.type='number';input.id='p-'+key;Object.assign(input,{min,max,step:key==='jumpImpulse'?'any':step,value:values[key]});label.append(input);$('#param-fields').append(label);}
  $('#music').value=audio.settings.music;$('#sfx').value=audio.settings.sfx;$('#muted').checked=audio.muted;derived();
  $('#seed').value=seed;
}
function derived(){const metrics=jumpMetrics({gravity:Number($('#p-gravity').value),jumpImpulse:Number($('#p-jumpImpulse').value),speed:Number($('#p-speed').value),maxFall:Number($('#p-maxFall').value)});$('#jump-height').value=metrics.height.toFixed(1);$('#derived').textContent=`Sprungweite ${metrics.range.toFixed(1)} u · Flugzeit ${metrics.airtime.toFixed(3)} s`;}
$('#open-params').onclick=()=>{fields();$('#param-error').textContent='';screen('params');};
$('#param-fields').addEventListener('input',derived);$('#jump-height').oninput=()=>{const v=Math.sqrt(2*Number($('#p-gravity').value)*Number($('#jump-height').value));$('#p-jumpImpulse').value=v.toFixed(2);};
$('#jump-height').onchange=derived;
$('#param-form').onsubmit=e=>{e.preventDefault();try{const values=Object.fromEntries(Object.keys(PARAMS).map(k=>[k,Number($('#p-'+k).value)])),next=hybridConfig(values),nextSeed=Number($('#seed').value);if(!Number.isInteger(nextSeed)||nextSeed<0||nextSeed>4294967295)throw Error('Seed: 0–4294967295');config=next;seed=nextSeed;home();}catch(err){$('#param-error').textContent=err.message;}};
$('#defaults').onclick=()=>fields(hybridConfig());
$('#music').oninput=e=>audio.setVolume('music',e.target.value);$('#sfx').oninput=e=>audio.setVolume('sfx',e.target.value);$('#muted').onchange=e=>audio.setMuted(e.target.checked);
for(const [key,title] of Object.entries({control:'Steuerung',fun:'Spielspaß',fairness:'Fairness',retry:'Noch ein Versuch?'})){
  const label=document.createElement('label'),select=document.createElement('select');label.textContent=title;select.id='rating-'+key;select.innerHTML='<option value="">1–5 wählen</option>'+[1,2,3,4,5].map(n=>'<option>'+n+'</option>').join('');label.append(select);$('#rating-fields').append(label);
}
$('#save-rating').onclick=()=>{const accepted=stats.rate(lastResult?.id,Object.fromEntries(['control','fun','fairness','retry'].map(k=>[k,Number($('#rating-'+k).value)])));$('#rating-status').textContent=accepted?(stats.warning?'Bewertung für diese Sitzung erfasst. '+stats.warning:'Bewertung gespeichert.'):'Bitte alle vier Werte wählen.';$('#storage-warning').textContent=stats.warning;};
function report(){
  $('#summaries').replaceChildren();const value=v=>v==null?'—':v.toFixed(1);
  for(const key of ['auto','course','endless'])for(const group of stats.groups(key).length?stats.groups(key):[null]){
    const s=stats.summary(key,group),el=document.createElement('article');el.className='report-card';const h=document.createElement('h3');h.textContent={auto:'AUTO-CLIMB',course:'FIRST RUN',endless:'HYBRID INFINITY'}[key];el.append(h);
    const dl=document.createElement('dl');for(const [title,val] of [['Echte abgeschlossene Runs',s.runs],['Ø Dauer',value(s.duration)+' s'],['Ø Distanz / Höhe',value(s.distance)+' m'],['Teststrecke geschafft',s.completionRate==null?'—':Math.round(s.completionRate*100)+' %']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=title;dd.textContent=val;dl.append(dt,dd);}el.append(dl);
    for(const text of [group?'Parameter '+group:'Noch keine echten Daten.',Object.entries(s.ratings).map(([k,v])=>k+' '+value(v)).join(' · '),'Todesursachen: '+(Object.entries(s.deaths).map(([k,n])=>k+' × '+n).join(', ')||'—')]){const p=document.createElement('p');p.textContent=text;el.append(p);}$('#summaries').append(el);
  }
}
$('#open-stats').onclick=()=>{report();screen('stats');};
$('#export').onclick=()=>{const u=URL.createObjectURL(new Blob([JSON.stringify(stats.data,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='rift-hybrid-tests.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
for(const key of ['course','endless'])$('#replay-'+key).onclick=()=>{audio.unlock();start(key,{automated:true});};
function render(dt){
  if(dt>0)fps+=(1/dt-fps)*.08;
  if(baseline)baseline.render();else renderer.draw(dt);
  if(!sim&&!baseline)return;
  const p=sim?.p,t=baseline?.t??sim.t;$('#distance').textContent=((baseline?.y??p.x)*.1).toFixed(1)+' m';$('#mode').textContent=(baseline?'AUTO':p.mode.toUpperCase())+' · '+((baseline?.player.dim??p.dim)==='B'?'BLAU':'ROT');
  if(sim)$('#run-name').textContent=(!defaultPhysics(config)?'UNVERIFIED · ':kind==='endless'?'INFINITY · ':'FIRST RUN · ')+(sim.currentPiece()?.name??'COMPLETE').toUpperCase();
  $('#motion-hint').textContent=baseline?'LINKS → RECHTS':p.mode==='ground'?'JUMP ↑':'FLAP ↑';
  if(query.has('debug')){
    $('#debug').hidden=false;const current=sim?.currentPiece(),player=p??{x:baseline.player.x,y:baseline.y,vy:260,dim:baseline.player.dim,mode:'auto'};
    $('#debug').textContent=`seed ${seed} · t ${t.toFixed(3)} · ${fps.toFixed(0)} FPS\n${current?.id??'AUTO'} · ${defaultPhysics(config)?'VERIFIED':'UNVERIFIED'} · ${player.mode}/${player.dim}\nx ${player.x.toFixed(1)} y ${player.y.toFixed(1)} vy ${player.vy.toFixed(1)}\nentry ${current?.entry??'auto'} → ${current?.exit??'auto'} · objects ${sim?sim.objects.length+sim.traps.traps.length:baseline.obstacles.length}\ngenerated ${director?.generated??0} · rejected ${director?.rejected??0} · audio ${audio.voices.size}\nlookahead ${(baseline?.lookaheadSec??(renderer.worldWidth-80)/config.speed).toFixed(2)} s${sim?.death?'\ndeath '+sim.death.type+' / '+sim.death.id:''}`;
  }else $('#debug').hidden=true;
}
function frame(now){const dt=Math.min(.05,Math.max(0,(now-last)/1000));advanceReal(now);render(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);
window.advanceTime=ms=>{for(let remaining=ms/1000;remaining>1e-9;){const h=Math.min(1/60,remaining);advance(h);remaining-=h;}render(0);};
window.render_game_to_text=()=>{
  const t=baseline?.t??sim?.t??0;
  const visible=sim?[...sim.objects,...sim.traps.traps,...sim.portals].filter(o=>o.x>sim.p.x-80&&o.x<sim.p.x+renderer.worldWidth):baseline?[...baseline.obstacles,...baseline.traps.traps].filter(o=>o.y>baseline.y-100&&o.y<baseline.y+baseline.view.viewH):[];
  return JSON.stringify({coordinateSystem:'x right, y up; hybrid floor0, units .1m; fixed240Hz',kind,state:baseline?.state??sim?.state??'menu',t,player:sim?.p??(baseline?{x:baseline.player.x,y:baseline.y,vx:baseline.player.vx,dim:baseline.player.dim}:null),counts:sim?.counts??(baseline?{impulses:baseline.stats.impulses,pulses:baseline.rift.emitted}:null),death:sim?.death,piece:sim?.currentPiece(),objects:visible.map(o=>({id:o.id,type:o.type,x:o.x??o.x0,y:o.y,dimension:o.dimension??o.color,state:o.state,target:o.target,...(isTrap(o)?{pose:trapPose(o,t,{})}:{}),...(o.type==='seal'?{open:sim?.rift.isOpen(o,t)}:{})})),isolated:true,lookaheadSec:baseline?.lookaheadSec??(renderer.worldWidth-80)/config.speed});
};
window.__HYBRID={get sim(){return sim;},get baseline(){return baseline;},get director(){return director;},get config(){return config;},get kind(){return kind;},audio,stats,renderer,book,course,track,start,pause,resume,home};
$('#storage-warning').textContent=stats.warning;document.body.dataset.ready='1';
