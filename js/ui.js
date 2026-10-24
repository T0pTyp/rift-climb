import { COLORS } from './dimensions.js';

const $ = (sel) => document.querySelector(sel);

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
    if (onGesture) onGesture();
    const now = performance.now();
    if (now - lastFire < 450) return;
    lastFire = now;
    e.preventDefault();
    e.stopPropagation();
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
      menuBest: $('#menu-best'),
      menuAttempts: $('#menu-attempts'),
      soundBtn: $('#btn-sound'),
      deathPct: $('#death-pct'),
      deathBest: $('#death-best'),
      deathNew: $('#death-new'),
      deathTitle: $('#death-title'),
      winSub: $('#win-sub'),
      checkpoint: $('#checkpoint-toast'),
    };
    const g = h.onGesture;
    bindTap($('#btn-start'), () => h.onStart('normal'), g);
    bindTap($('#btn-practice'), () => h.onStart('practice'), g);
    bindTap(this.el.soundBtn, () => h.onSoundToggle(), g);
    bindTap($('#btn-pause'), () => h.onPause(), g);
    bindTap($('#btn-resume'), () => h.onResume(), g);
    for (const id of ['#btn-pause-restart', '#btn-death-restart', '#btn-win-restart']) bindTap($(id), () => h.onRestart(), g);
    for (const id of ['#btn-pause-menu', '#btn-death-menu', '#btn-win-menu']) bindTap($(id), () => h.onMenu(), g);
    this.lastHud = '';
  }

  show(name) {
    for (const [key, el] of Object.entries(this.screens)) el.hidden = key !== name;
    const inGame = name !== 'menu';
    this.hud.hidden = !inGame;
    this.hints.hidden = name !== null;
    document.body.dataset.screen = name || 'play';
  }

  updateMenu(stats, muted) {
    this.el.menuBest.textContent = `${stats.best}%`;
    this.el.menuAttempts.textContent = String(stats.attempts);
    this.updateSound(muted);
  }

  updateSound(muted) {
    this.el.soundBtn.textContent = muted ? 'Sound: AUS' : 'Sound: AN';
    this.el.soundBtn.setAttribute('aria-pressed', String(!muted));
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

  showDeath({ pct, best, isNewBest }) {
    this.el.deathPct.textContent = `${pct}%`;
    this.el.deathBest.textContent = `${best}%`;
    this.el.deathNew.hidden = !isNewBest;
    this.show('death');
  }

  showWin({ mode, attempts }) {
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
