import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { MAX_FRAME_DT } from './config.js';

const STORAGE_KEY = 'riftclimb.pulse.v1';

function createStorage() {
  let data = { stats: { best: 0, attempts: 0, clears: 0 }, muted: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      data = { stats: { ...data.stats, ...parsed.stats }, muted: !!parsed.muted };
    }
  } catch {
    // localStorage kann (z. B. im privaten Modus) blockiert sein – dann nur Session-Werte.
  }
  return {
    stats: data.stats,
    muted: data.muted,
    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ stats: this.stats, muted: this.muted }));
      } catch { /* ignorieren */ }
    },
  };
}

const params = new URLSearchParams(location.search);
const debug = {
  autoplay: params.has('autoplay'),
  autoplayOffset: clampNum(parseFloat(params.get('offset')), 0.06, 0.32, 0.12),
  sealLead: clampNum(parseFloat(params.get('lead')), 0.08, 0.45, 0.25),
  speed: clampNum(parseFloat(params.get('speed')), 0.25, 8, 1),
  hitboxes: params.has('debug'),
  manual: params.has('manual'),
  trace: params.has('trace'),
};

function clampNum(v, min, max, fallback) {
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

const canvas = document.getElementById('game');
const storage = createStorage();
const audio = new AudioEngine();
audio.setMuted(storage.muted);

let game;
const unlockAudio = () => audio.unlock();

const ui = new UI({
  onGesture: unlockAudio,
  onStart: (mode) => game.start(mode),
  onSoundToggle: () => {
    storage.muted = !storage.muted;
    storage.save();
    audio.setMuted(storage.muted);
    ui.updateSound(storage.muted);
  },
  onPause: () => game.pause(),
  onResume: () => game.resume(),
  onRestart: () => game.restart(),
  onDeathTap: () => game.confirm(),
  onMenu: () => game.toMenu(),
});

const input = new Input(canvas, {
  onPress: (dir, ts) => {
    // Simulation erst bis zum Eingabezeitpunkt vorspulen: der Impuls wirkt dort,
    // wo die Figur beim Tipp tatsächlich war (keine Verzögerung um bis zu einen Frame).
    advanceTo(eventTime(ts));
    game.press(dir);
  },
  onPause: () => (game.state === 'paused' ? game.resume() : game.pause()),
  onConfirm: () => {
    unlockAudio();
    if (game.state === 'menu') {
      game.start('normal');
      return true;
    }
    return game.confirm();
  },
});

game = new Game({ canvas, ui, audio, input, storage, debug });
window.__RIFT = game;

function resize() {
  const vv = window.visualViewport;
  const w = Math.round(vv ? vv.width : window.innerWidth);
  const h = Math.round(vv ? vv.height : window.innerHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  game.resize(w, h, dpr);
  if (landscapeQuery.matches) game.pause();
}
const landscapeQuery = window.matchMedia('(orientation: landscape) and (pointer: coarse) and (max-height: 520px)');
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.pause();
    audio.suspend();
  }
});
window.addEventListener('pagehide', () => game.pause());

// Doppeltipp-Zoom und Pinch auf iOS verhindern (nur außerhalb von Buttons).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

ui.updateMenu(storage.stats, storage.muted);
ui.show('menu');

let last = performance.now();

function eventTime(ts) {
  const now = performance.now();
  return Number.isFinite(ts) && ts <= now && ts > now - 1000 ? ts : now;
}

function advanceTo(now) {
  if (debug.manual || now <= last) return;
  const dt = Math.min(MAX_FRAME_DT, (now - last) / 1000) * debug.speed;
  last = now;
  game.update(dt);
}

function frame(now) {
  advanceTo(now);
  game.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
