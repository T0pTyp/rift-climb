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
      levelSelect: $('#level-select'),
      menuBest: $('#menu-best'),
      menuAttempts: $('#menu-attempts'),
      soundBtn: $('#btn-sound'),
      gfxBtn: $('#btn-gfx'),
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
    bindTap(this.el.gfxBtn, () => h.onGfxToggle(), g);
    bindTap($('#btn-pause'), () => h.onPause(), g);
    bindTap($('#btn-resume'), () => h.onResume(), g);
    for (const id of ['#btn-pause-restart', '#btn-death-restart', '#btn-win-restart']) bindTap($(id), () => h.onRestart(), g);
    for (const id of ['#btn-pause-menu', '#btn-death-menu', '#btn-win-menu']) bindTap($(id), () => h.onMenu(), g);
    // Tipp irgendwo auf den Todesscreen = sofortiger Neustart (Buttons stoppen die Weitergabe selbst)
    bindTap(this.screens.death, () => h.onDeathTap(), g);
    this.el.levelSelect.addEventListener('change', () => h.onLevelChange(this.el.levelSelect.value));
    for (const slider of document.querySelectorAll('[data-volume]')) {
      slider.addEventListener('pointerdown', e => { e.stopPropagation(); g?.(); });
      slider.addEventListener('input', e => { e.stopPropagation(); h.onVolume(slider.dataset.volume, Number(slider.value)); });
      slider.addEventListener('keydown', e => e.stopPropagation());
    }
    this.lastHud = '';
  }

  /** Levelauswahl im Menü (nur bei mehreren Leveln); im Playtest führen „Menü“-Buttons zurück in den Editor. */
  setLevels(levels, current, playtest) {
    const sel = this.el.levelSelect;
    sel.textContent = '';
    if (levels && levels.length > 1) {
      for (const l of levels) {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = l.name;
        sel.appendChild(opt);
      }
      sel.value = current.id;
      this.el.levelPick.hidden = false;
    }
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
    this.el.menuBest.textContent = `${stats.best}%`;
    this.el.menuAttempts.textContent = String(stats.attempts);
    this.updateSound(muted);
  }

  updateSound(muted) {
    this.el.soundBtn.innerHTML = `<small>Sound</small>${muted ? 'AUS' : 'AN'}`;
    this.el.soundBtn.setAttribute('aria-pressed', String(!muted));
  }

  updateVolumes(settings) {
    for (const slider of document.querySelectorAll('[data-volume]')) slider.value = settings[slider.dataset.volume];
  }

  updateGfx(label) {
    this.el.gfxBtn.innerHTML = `<small>Grafik</small>${label}`;
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
