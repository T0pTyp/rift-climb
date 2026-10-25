import { COLORS } from './dimensions.js';

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
  let downInside = false;
  let lastFire = -Infinity;
  const fire = (e) => {
    e.stopPropagation();
    if (onGesture) onGesture();
    const now = performance.now();
    if (now - lastFire < 450) return;
    lastFire = now;
    e.preventDefault();
    if (e.type === 'pointerup') clickShieldUntil = now + CLICK_SHIELD_MS;
    action(e);
  };
  el.addEventListener('pointerdown', (e) => {
    downInside = true;
    e.stopPropagation();
  });
  el.addEventListener('pointerup', (e) => {
    if (!downInside) return;
    downInside = false;
    fire(e);
  });
  el.addEventListener('pointercancel', () => { downInside = false; });
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
  }

  /** Levelauswahl im Menü (nur bei mehreren Leveln); im Playtest führen „Menü“-Buttons zurück in den Editor. */
  setLevels(levels, current, playtest, catalog = new Map()) {
    this.current = current;
    this.levels = levels || [];
    this.el.levelPick.replaceChildren();
    this.el.levelPick.hidden = !!playtest;
    document.body.dataset.theme = current.theme || 'spire';
    this.cards = new Map();
    for (const [i,l] of this.levels.entries()) {
      const data=catalog.get(l.id), button=document.createElement('button');
      button.type='button';button.className='level-card';button.dataset.level=l.id;
      button.dataset.theme=data?.theme || 'spire';button.setAttribute('aria-pressed',String(l.id===current.id));
      const number=document.createElement('span');number.className='level-number';number.textContent=String(i+1).padStart(2,'0');
      const copy=document.createElement('span');copy.className='level-copy';
      const name=document.createElement('strong');name.textContent=l.name;
      const meta=document.createElement('span');meta.className='level-meta';
      const difficulty={easy:'EINFACH',medium:'MITTEL',hard:'SCHWER'}[data?.difficulty] || 'ARCHIV';
      meta.textContent=difficulty+(data ? ` · ${(data.finish.y/260).toFixed(1)} s` : '');
      const stats=document.createElement('span');stats.className='level-result';
      const best=document.createElement('b'),attempts=document.createElement('small');stats.append(best,attempts);
      const progress=document.createElement('i');progress.className='level-best-bar';
      copy.append(name,meta);button.append(number,copy,stats,progress);
      bindTap(button,()=>this.h.onLevelChange(l.id),this.h.onGesture);
      this.el.levelPick.append(button);this.cards.set(l.id,{button,best,attempts,progress});
    }
    this.refreshCards();
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
  }

  updateMenu(stats, muted) {
    this.refreshCards();
    this.updateSound(muted);
  }

  refreshCards() {
    for (const [id,c] of this.cards || []) {
      const stats=this.h.getStats?.(id) || {best:0,attempts:0,clears:0};
      c.best.textContent=`${stats.clears ? '✓ ' : ''}${stats.best}%`;
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

  showDeath({ pct, best, isNewBest, reason }) {
    this.el.deathPct.textContent = `${pct}%`;
    this.el.deathReason.textContent = reason || '';
    this.el.deathBest.textContent = `${best}%`;
    this.el.deathNew.hidden = !isNewBest;
    this.show('death');
  }

  showWin({ mode, attempts }) {
    $('#win-level').textContent = this.current?.name || 'RIFT CLEARED';
    this.el.winSub.textContent = mode === 'practice'
      ? `Übungsmodus geschafft – jetzt im Normalmodus! (${attempts} Versuche)`
      : `Normalmodus geschafft nach ${attempts} Versuchen.`;
    this.show('win');
  }

  toast(text) {
    const el = this.el.checkpoint;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }
}
