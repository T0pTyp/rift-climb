import { ARENAS } from './arena.js';
import { AscensionPanels } from './ascension-ui.js';
import { medal } from './art/ui-assets.js';
import { COLORS } from './dimensions.js';
import { withInputEvent } from './input-time.js';

const $ = (sel) => document.querySelector(sel);

// iOS/WebKit stellt den nachgelagerten "click" eines Touches erst nach dem Ausblenden des Overlays zu;
// er würde sonst das Element darunter treffen (z. B. den Pause-Button). Buttons reagieren auf pointerup,
// daher blockiert dieser kurze Schutz nur Geister-Klicks, keine echten Eingaben.
const CLICK_SHIELD_MS = 400;
let clickShieldUntil = 0;
document.addEventListener('click', (e) => {
  if (performance.now() < clickShieldUntil) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

/**
 * Zuverlässiger Tap-Handler für Overlay-Buttons (Fix für iOS Safari):
 * - reagiert auf pointerup UND click, führt die Aktion aber nur einmal aus
 *   (keine Doppelauslösung, kein "zweimal tippen nötig" durch Hover-Emulation),
 * - ruft onGesture bei jedem Gesten-Event synchron auf (WebAudio-Unlock).
 */
export function bindTap(el, action, onGesture) {
  let downId = null;
  const fire = (e) => {
    e.stopPropagation();
    if(el.disabled||!el.getClientRects().length)return;
    if(e.type==='pointerup'){
      const r=el.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)return;
    }
    if (onGesture) onGesture();
    const now = performance.now();
    e.preventDefault();
    if (e.type === 'pointerup') clickShieldUntil = now + CLICK_SHIELD_MS;
    withInputEvent(e.timeStamp,()=>action(e));
  };
  el.addEventListener('pointerdown', (e) => {
    if(e.button>0||downId!==null)return;
    downId=e.pointerId;
    try{el.setPointerCapture?.(e.pointerId);}catch{/* Synthetic test events have no native capture. */}
    // Unlock before pointerup preventDefault. Some browsers only open audio on the first event of the tap.
    if (onGesture) onGesture();
    e.stopPropagation();
  });
  el.addEventListener('pointerup', (e) => {
    if (downId!==e.pointerId) return;
    downId = null;
    e.preventDefault();
    clickShieldUntil=performance.now()+CLICK_SHIELD_MS;
    fire(e);
  });
  const cancel=e=>{if(downId===e.pointerId)downId=null;};
  el.addEventListener('pointercancel',cancel);
  el.addEventListener('lostpointercapture',cancel);
  el.addEventListener('click', fire);
}

export class UI {
  constructor(h) {
    this.h = h;
    this.screens = {
      menu: $('#menu'),
      pause: $('#pause'),
      death: $('#death'),
      win: $('#win'),
    };
    this.hud = $('#hud');
    this.hints = $('#touch-hints');
    this.flashEl = $('#flash');
    this.el = {
      pct: $('#hud-pct'),
      bar: $('#hud-bar-fill'),
      dim: $('#hud-dim'),
      attempts: $('#hud-attempts'),
      mode: $('#hud-mode'),
      playtest: $('#hud-playtest'),
      levelPick: $('#level-pick'),
      soundBtn: $('#btn-sound'),
      deathPct: $('#death-pct'),
      deathBest: $('#death-best'),
      deathNew: $('#death-new'),
      deathTitle: $('#death-title'),
      deathReason: $('#death-reason'),
      winSub: $('#win-sub'),
      checkpoint: $('#checkpoint-toast'),
    };
    const g = h.onGesture;
    for (const summary of document.querySelectorAll('summary')) summary.addEventListener('keydown', e => e.stopPropagation());
    bindTap($('#btn-start'), () => h.onStart('normal'), g);
    bindTap($('#btn-practice'), () => h.onStart('practice'), g);
    bindTap(this.el.soundBtn, () => h.onSoundToggle(), g);
    bindTap($('#btn-pause'), () => h.onPause(), g);
    bindTap($('#btn-resume'), () => h.onResume(), g);
    for (const id of ['#btn-pause-restart', '#btn-death-restart', '#btn-win-restart']) bindTap($(id), () => h.onRestart(), g);
    for (const id of ['#btn-pause-menu', '#btn-death-menu', '#btn-win-menu']) bindTap($(id), () => h.onMenu(), g);
    // Tipp irgendwo auf den Todesscreen = sofortiger Neustart (Buttons stoppen die Weitergabe selbst)
    bindTap(this.screens.death, () => h.onDeathTap(), g);
    for (const slider of document.querySelectorAll('[data-volume]')) {
      slider.addEventListener('pointerdown', e => { e.stopPropagation(); g?.(); });
      slider.addEventListener('input', e => { e.stopPropagation(); h.onVolume(slider.dataset.volume, Number(slider.value)); });
      slider.addEventListener('keydown', e => e.stopPropagation());
    }
    this.lastHud = '';
    this.panels = new AscensionPanels(this,h,bindTap);
    this.panels.open('home');
  }

  /** Levelauswahl im Menü (nur bei mehreren Leveln); im Playtest führen „Menü“-Buttons zurück in den Editor. */
  setLevels(levels, current, playtest, catalog = new Map()) {
    this.current=current;this.levels=levels||[];this.playtest=playtest;
    this.panels.buildCards(this.levels,current,catalog);
    this.el.levelPick.hidden=!!playtest;
    document.body.dataset.theme=current.theme||'spire';
    if (playtest) {
      document.body.dataset.playtest = '1';
      this.el.playtest.hidden = false;
      this.el.playtest.textContent = `PLAYTEST · ${current.name}`.slice(0, 32);
      for (const id of ['#btn-pause-menu', '#btn-death-menu', '#btn-win-menu']) $(id).textContent = 'Editor';
    }
  }

  show(name) {
    for (const [key, el] of Object.entries(this.screens)) el.hidden = key !== name;
    const inGame = name !== 'menu';
    this.hud.hidden = !inGame;
    this.hints.hidden = name !== null;
    document.body.dataset.screen = name || 'play';
    if(name==='menu'){this.el.checkpoint.classList.remove('show');this.panels?.open(this.panels.page);}
  }

  updateMenu(stats, muted) {
    this.refreshCards();
    this.updateSound(muted);
  }

  refreshCards() {
    for (const [id,c] of this.cards || []) {
      const stats=this.h.getStats?.(id) || {best:0,attempts:0,clears:0};
      c.best.textContent=`${stats.clears ? '✓ ' : ''}${stats.best}%`;
      if(c.medal)c.medal.innerHTML=medal(stats.medal || 'none');
      if(c.status)c.status.textContent=stats.completed||stats.clears?'COMPLETE':'BESTLEISTUNG';
      c.attempts.textContent=`${stats.attempts} Versuche`;
      c.progress.style.transform=`scaleX(${stats.best/100})`;
      c.button.dataset.complete=stats.clears>0?'1':'0';
      c.button.setAttribute('aria-label',`${c.button.querySelector('strong').textContent}, ${stats.best} Prozent, ${stats.attempts} Versuche, ${stats.clears ? 'abgeschlossen' : 'offen'}`);
    }
  }

  updateSound(muted) {
    this.el.soundBtn.innerHTML = `<small>Sound</small>${muted ? 'AUS' : 'AN'}`;
    this.el.soundBtn.setAttribute('aria-pressed', String(!muted));
  }

  updateVolumes(settings) {
    for (const slider of document.querySelectorAll('[data-volume]')) slider.value = settings[slider.dataset.volume];
  }

  updateHud(pct, dim, attempts, mode) {
    $('#hud-infinity').hidden=true;this.el.bar.parentElement.hidden=false;
    const key = `${pct}|${dim}|${attempts}|${mode}`;
    if (key === this.lastHud) return;
    this.lastHud = key;
    this.el.pct.textContent = `${pct}%`;
    this.el.bar.style.transform = `scaleX(${pct / 100})`;
    this.el.dim.textContent = COLORS[dim].name;
    this.el.dim.dataset.dim = dim;
    this.el.attempts.textContent = `Versuch ${attempts}`;
    this.el.mode.hidden = mode !== 'practice';
    document.body.dataset.dim = dim;
  }

  showDeath(options) {
    const {pct,best,isNewBest,reason}=options;
    this.panels.result('death',options);
    this.el.deathPct.textContent = `${pct}${options.endless?' m':'%'}`;
    this.el.deathReason.textContent = reason || '';
    this.el.deathBest.textContent = `${best}${options.endless?' m':'%'}`;
    this.el.deathTitle.textContent=options.endless?'RIFT INFINITY':'Rift verloren';
    this.el.deathNew.hidden = !isNewBest;
    this.show('death');
  }

  showWin(options) {
    const {mode,attempts}=options;
    this.panels.result('win',options);
    $('#win-level').textContent = options.levelName||this.current?.name || 'RIFT CLEARED';
    this.el.winSub.textContent = mode === 'lab'?'Arena-Vergleich abgeschlossen. Dein Testlauf wurde gespeichert.':mode === 'practice'
      ? `Übungsmodus geschafft – jetzt im Normalmodus! (${attempts} Versuche)`
      : `Normalmodus geschafft nach ${attempts} Versuchen.`;
    this.show('win');
  }

  openPage(page) { this.panels.open(page); }
  setArena(style,mode){
    const lab=mode==='lab',el=$('#hud-arena');el.hidden=!lab&&style!=='compact'&&style!=='narrow';el.textContent=(lab?'LAB · ':'')+(ARENAS[style]?.label||String(style||'').toUpperCase());
    document.body.dataset.arena=style;
    if(!this.playtest)for(const id of ['pause','death','win'])$('#btn-'+id+'-menu').textContent=lab?'ARENA LAB':'Levelauswahl';
  }
  updateEndlessHud(height,best,tier,dim,attempts) {
    const key=`infinity|${height}|${best}|${tier}|${dim}|${attempts}`;
    if(this.lastHud===key)return;this.lastHud=key;this.el.bar.parentElement.hidden=true;this.el.pct.textContent=height+' m';
    const label=$('#hud-infinity');label.hidden=false;label.textContent=`REKORD ${best} m · ${tier}`;
    this.el.dim.textContent=COLORS[dim].name;this.el.dim.dataset.dim=dim;this.el.attempts.textContent='Versuch '+attempts;this.el.mode.hidden=true;document.body.dataset.dim=dim;
  }
  setSkin(id) {
    const prefix=id==='original'?'body-':id+'-';
    document.querySelector('.rb-b').src=`assets/riftling/${prefix}${id==='original'?'blue':'B'}.svg`;
    document.querySelector('.rb-r').src=`assets/riftling/${prefix}${id==='original'?'red':'R'}.svg`;
  }
  animate(now,state) { this.panels.animate(now,state); }

  toast(text) {
    const el = this.el.checkpoint;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
}
