import { ACHIEVEMENTS, SKINS, MEDAL_NAMES, medalFor } from './rewards.js';
import { icon, medal, levelPreview, escapeText as esc } from './art/ui-assets.js';
import { drawRiftling, riftlingArt } from './art/riftling.js';
import { RiftlingAnimator } from './art/riftling-anim.js';
const $=s=>document.querySelector(s);
export class AscensionPanels {
 constructor(ui,h,bind){
  this.ui=ui;this.h=h;this.bind=bind;this.progression=h.progression;this.page='home';this.skin=this.progression.data.cosmetics.selectedSkinId;this.anim=new RiftlingAnimator();this.previewTime=0;this.last=0;this.thumbs=new Map();
  for(const [id,page] of [['play','levels'],['infinity','infinity'],['collection','collection'],['achievements','achievements'],['profile','profile'],['settings','settings']])bind($('#nav-'+id),()=>this.open(page),h.onGesture);
  this.seed=h.initialSeed;
  bind($('#btn-infinity-start'),()=>h.onInfinityStart(this.seed),h.onGesture);
  bind($('#btn-infinity-seed'),()=>{this.seed=crypto.getRandomValues(new Uint32Array(1))[0];this.renderInfinity();},h.onGesture);
  for(const el of document.querySelectorAll('[data-home]'))bind(el,()=>this.open('home'),h.onGesture);
  bind($('#btn-death-home'),()=>h.onHome(),h.onGesture);bind($('#btn-next-level'),()=>h.onNext(),h.onGesture);
  bind($('#btn-equip'),()=>{if(this.progression.equip(this.skin)){h.onEquip(this.skin);this.renderCollection();}},h.onGesture);
  for(const el of document.querySelectorAll('#menu button,#menu input,#menu summary,#death button,#win button'))el.addEventListener('keydown',e=>e.stopPropagation());
  $('#menu').addEventListener('keydown',e=>{if(e.target.closest('button,input,summary'))e.stopPropagation();});
  this.startBtn=$('#btn-start');this.practiceBtn=$('#btn-practice');
 }
 open(page){
  this.page=page;document.body.dataset.menu=page;
  for(const el of document.querySelectorAll('.menu-page'))el.hidden=el.id!=='page-'+page;
  $('#menu .brand-row').hidden=page!=='home';$('#menu .tagline').hidden=page!=='home';
  $('#menu').scrollTop=0;
  if(page==='collection')this.renderCollection();if(page==='achievements')this.renderAchievements();if(page==='profile')this.renderProfile();if(page==='levels')this.ui.refreshCards();
  if(page==='infinity')this.renderInfinity();
  this.refreshWarning();
 }
 refreshWarning(){const el=$('#save-notice');el.hidden=!this.progression.warning;el.textContent=this.progression.warning;}
 renderInfinity(){const e=this.progression.data.endless;$('#infinity-best').textContent=e.bestHeight+' m';$('#infinity-attempts').textContent=e.attempts;$('#infinity-last').textContent='Letzter Aufstieg: '+e.lastHeight+' m';$('#infinity-seed').textContent='SEED '+this.seed+' · RETRY = GLEICHE WELT';$('#btn-infinity-start').disabled=!this.h.infinityAvailable();$('#infinity-error').hidden=!this.h.infinityError();$('#infinity-error').textContent=this.h.infinityError();}
 buildCards(levels,current,catalog){
  this.ui.current=current;this.ui.cards=new Map();const pick=$('#level-pick');pick.replaceChildren();
  for(const [i,l] of levels.entries()) {
   const data=catalog.get(l.id),card=document.createElement('article');card.className='level-card';card.dataset.theme=data?.theme||'spire';card.dataset.selected=String(l.id===current.id);
   if(data&&!this.thumbs.has(l.id))this.thumbs.set(l.id,levelPreview(data));
   card.innerHTML=`<img class="level-art" src="${this.thumbs.get(l.id)||''}" alt=""><button class="level-heading" data-level="${esc(l.id)}" type="button" aria-pressed="${l.id===current.id}"><span class="level-number">${String(i+1).padStart(2,'0')}</span><span class="level-copy"><strong>${esc(l.name)}</strong><span class="level-meta">${{easy:'EINFACH',medium:'MITTEL',hard:'SCHWER',expert:'MITTEL–SCHWER',extreme:'EXTREM'}[data?.difficulty]||'ARCHIV'} · ${data?(data.finish.y/260).toFixed(1):''} s</span></span></button><div class="card-results"><span class="card-medal"></span><span class="level-result"><b></b><small></small></span><span class="level-status"></span></div><div class="card-actions"></div><i class="level-best-bar"></i>`;
   const button=card.querySelector('[data-level]');this.bind(button,()=>this.h.onLevelChange(l.id),this.h.onGesture);
   const actions=card.querySelector('.card-actions');
   if(l.id===current.id)actions.append(this.startBtn,this.practiceBtn);
   else for(const [mode,text] of [['normal','PLAY'],['practice','PRACTICE']]){const btn=document.createElement('button');btn.type='button';btn.className=mode==='normal'?'btn primary':'btn';btn.textContent=text;btn.dataset.mode=mode;this.bind(btn,()=>{this.h.onLevelChange(l.id);this.h.onStart(mode);},this.h.onGesture);actions.append(btn);}
   pick.append(card);this.ui.cards.set(l.id,{card,button,best:card.querySelector('.level-result b'),attempts:card.querySelector('.level-result small'),progress:card.querySelector('.level-best-bar'),medal:card.querySelector('.card-medal'),status:card.querySelector('.level-status')});
  }
  this.ui.refreshCards();
 }
 renderCollection(){
  const skin=SKINS.find(s=>s.id===this.skin)||SKINS[0],owned=this.progression.data.cosmetics.unlockedSkinIds,selected=this.progression.data.cosmetics.selectedSkinId;
  $('#skin-name').textContent=skin.name;$('#skin-description').textContent=skin.description;$('#skin-condition').textContent=skin.condition;
  const equip=$('#btn-equip');equip.disabled=!owned.includes(skin.id)||selected===skin.id;equip.textContent=selected===skin.id?'ANGELEGT':owned.includes(skin.id)?'ANLEGEN':'GESPERRT';
  const list=$('#skin-cards');list.replaceChildren();
  for(const s of SKINS){const btn=document.createElement('button');btn.type='button';btn.className='skin-card';btn.style.setProperty('--skin-accent',s.accent);btn.dataset.skin=s.id;btn.setAttribute('aria-pressed',String(this.skin===s.id));
   const body=s.id==='original'?'body-blue.svg':s.id+'-B.svg';
   btn.innerHTML=`<span class="skin-mini"><img src="assets/riftling/${body}" alt=""><img src="assets/riftling/eye.svg" alt=""></span><span><strong>${esc(s.name.replace(' Riftling',''))}</strong><small>${selected===s.id?'ANGELEGT':owned.includes(s.id)?'VERFÜGBAR':'◇ GESPERRT'}</small></span>`;
   btn.setAttribute('aria-label',s.name+'. '+(owned.includes(s.id)?'Freigeschaltet.':s.condition));this.bind(btn,()=>{this.skin=s.id;this.renderCollection();},this.h.onGesture);list.append(btn);
  }
  riftlingArt.loadSkin(this.skin);
 }
 renderAchievements(){
  $('#achievement-count').textContent=`${Object.keys(this.progression.data.achievements).length} / 8 FREIGESCHALTET`;
  $('#achievement-list').innerHTML=ACHIEVEMENTS.map(a=>{const earned=this.progression.data.achievements[a.id];return `<article class="achievement-card ${earned?'earned':''}" data-achievement="${a.id}">${icon(a.icon)}<div><h3>${a.name}</h3><p>${a.description}</p><small>${earned?(earned.unlockedAt?new Date(earned.unlockedAt).toLocaleDateString('de-DE'):'Aus früherer Leistung übernommen'):'NOCH NICHT FREIGESCHALTET'}</small></div><b aria-hidden="true">${earned?'✓':'◇'}</b></article>`;}).join('');
 }
 renderProfile(){
  const s=this.progression.summary(),items=[['Normalversuche',s.totalNormalAttempts],['Todesfälle'+(s.historyIncomplete?' seit M8':''),s.totalDeaths],['Erfolgreiche Durchläufe',s.totalCompletions],['Abgeschlossene Levels',s.completedLevels],['Goldmedaillen',s.goldMedals],['Achievements',s.achievements+' / 8'],['Riftling-Designs',s.skins+' / 5'],['Aktive Spielzeit'+(s.historyIncomplete?' seit M8':''),Math.floor(s.activePlaytimeMs/60000)+'m '+Math.floor(s.activePlaytimeMs/1000)%60+'s']];
  $('#profile-stats').innerHTML=items.map(([name,n])=>`<div class="stat-card"><strong>${n}</strong><span>${name}</span></div>`).join('');
  $('#profile-levels').innerHTML=this.ui.levels.filter(l=>l.campaign).map(l=>{const stats=this.progression.level(l.id);return `<div class="profile-level">${medal(stats.medal)}<span>${esc(l.name)}<small>${stats.completed?'ABGESCHLOSSEN':'IN AUFSTIEG'}</small></span><strong>${stats.best}%</strong></div>`;}).join('');
  $('#history-note').textContent=s.historyIncomplete?'Frühere Bestwerte, Versuche und Abschlüsse wurden übernommen, einschließlich Archivlevels. Todesfälle und Spielzeit wurden damals nicht erfasst; diese Angaben zählen seit M8. Frühere Zeitpunkte sind unbekannt.':'Spielzeit zählt ausschließlich aktive Simulationszeit in Normal-Runs. Alle Daten liegen lokal in diesem Browser.';
 }
 result(type,options){
  if(options.endless){$('#death-medal').replaceChildren();$('#death-attempts').textContent=`Endless-Versuch ${options.attempts}`;if(options.isNewBest)this.h.onRewardSound('record');return;}
  const practice=options.mode==='practice'||document.body.dataset.playtest==='1';
  const rank=practice?'none':options.medal||medalFor(options.best||0),fresh=options.rewards?.some(r=>r.type==='medal'&&r.id===rank);
  $('#'+type+'-medal').innerHTML=practice?'':medal(rank,fresh);
  if(type==='death')$('#death-attempts').textContent=`Versuch ${options.attempts} · ${MEDAL_NAMES[rank]}`;
  else {
   $('#win-record').hidden=practice||!options.isNewBest;
   const rewards=practice?[]:options.rewards.filter(r=>r.type!=='medal');
   $('#win-rewards').innerHTML=rewards.map(r=>`<p>${icon(r.icon)}<span><small>${r.type==='skin'?'DESIGN FREIGESCHALTET':'ACHIEVEMENT'}</small>${esc(r.name)}</span></p>`).join('');
   $('#btn-next-level').hidden=!!this.ui.playtest||!this.h.hasNext?.();
  }
  if(options.isNewBest&&!practice)this.h.onRewardSound('record');this.refreshWarning();
 }
 animate(now,state){
  const dt=Math.min(.05,(now-(this.last||now))/1000);this.last=now;
  if(state==='menu'&&this.page==='collection') {
   const before=Math.floor(this.previewTime/2.5);this.previewTime+=dt;const phase=Math.floor(this.previewTime/2.5),blend=phase%2;
   if(before!==phase)this.anim.onSwitch(blend?1:-1);
   const since=this.previewTime%2.5,vx=since<.35?(blend?1:-1)*500*Math.sin(since/.35*Math.PI):0;
   const pose=this.anim.update(dt,{vx,tilt:vx*.001,targetBlend:blend,alive:true});
   const c=$('#skin-preview'),g=c.getContext('2d');g.setTransform(2,0,0,2,0,0);g.clearRect(0,0,320,230);
   g.strokeStyle=blend?'#ff2d8a':'#2fd6ff';g.globalAlpha=.22;g.lineWidth=1;
   for(let i=0;i<3;i++){g.beginPath();g.ellipse(160,140,68+i*28,26+i*9,0,0,Math.PI*2);g.stroke();}
   g.globalAlpha=1;g.save();g.translate(160+Math.sin(this.previewTime*1.3)*12,103);g.scale(3.1,3.1);drawRiftling(g,0,0,pose,6.2,this.skin);g.restore();
   if(since<.65){g.globalAlpha=(1-since/.65)*.6;g.beginPath();g.ellipse(160,122,30+since*150,12+since*55,0,0,Math.PI*2);g.stroke();g.globalAlpha=1;}
   $('#preview-dimension').textContent=blend?'ROT':'BLAU';$('#preview-dimension').dataset.dim=blend?'R':'B';
  }
  const notice=$('#reward-notice'),safe=['menu','dead','won'].includes(state);
  if(!safe){notice.hidden=true;return;}
  if(this.currentNotice){this.noticeAge+=dt;if(this.noticeAge>=2.5){this.currentNotice=null;notice.hidden=true;}}
  if(!this.currentNotice&&this.progression.queue.length){
   const r=this.progression.queue.shift();this.currentNotice=r;this.noticeAge=0;
   notice.innerHTML=`${r.type==='medal'?medal(r.id,true):icon(r.icon)}<span><small>${r.type==='achievement'?'ACHIEVEMENT UNLOCKED':r.type==='skin'?'RIFTLING UNLOCKED':'MEDAILLE VERDIENT'}</small><strong>${esc(r.name)}</strong></span>`;
   notice.classList.remove('arrive');void notice.offsetWidth;notice.classList.add('arrive');this.h.onRewardSound('reward');
  }
  notice.hidden=!this.currentNotice;
 }
}
