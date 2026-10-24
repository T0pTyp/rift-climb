import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { MAX_FRAME_DT } from './config.js';
import { validateLevelData, validateIndex } from './level-data.js';
import { QUALITY, defaultQuality, nextQuality } from './art/quality.js';

const STORAGE_KEY = 'riftclimb.pulse.v1';
const LEVEL_DIR = 'assets/levels/';
// Übergabe aus LEVEL FORGE (gleicher Origin): { level, from, mode, debug }
export const PLAYTEST_KEY = 'riftforge.playtest';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    // localStorage kann (z. B. im privaten Modus) blockiert sein – dann nur Session-Werte.
    return null;
  }
}

/** Fortschritt pro Level (Hauptlevel unter dem bisherigen Schlüssel); Sound-Einstellung global. */
function createStorage(levelId, memoryOnly) {
  const key = levelId === 'rift-main' ? STORAGE_KEY : `${STORAGE_KEY}.${levelId}`;
  const stats = { best: 0, attempts: 0, clears: 0 };
  const main = readJson(STORAGE_KEY);
  const own = memoryOnly ? null : readJson(key);
  if (own && own.stats) Object.assign(stats, own.stats);
  return {
    stats,
    muted: !!(main && main.muted),
    gfx: main && QUALITY[main.gfx] ? main.gfx : defaultQuality(),
    gfxManual: !!(main && main.gfxManual),
    save() {
      // Playtest aus dem Editor: nichts dauerhaft speichern (keine Bestleistung, keine Versuche)
      if (memoryOnly) return;
      try {
        localStorage.setItem(key, JSON.stringify({ stats: this.stats, muted: this.muted, gfx: this.gfx, gfxManual: this.gfxManual }));
        if (key !== STORAGE_KEY) {
          const m = readJson(STORAGE_KEY) || {};
          m.muted = this.muted;
          m.gfx = this.gfx;
          m.gfxManual = this.gfxManual;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
        }
      } catch { /* ignorieren */ }
    },
  };
}

const params = new URLSearchParams(location.search);
const playtest = params.has('playtest');
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

async function fetchJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/** Lädt Levelindex und das gewählte Level (?level=<id>), geprüft wie im Editor. */
async function loadLevel() {
  if (playtest) {
    const handoff = readJson(PLAYTEST_KEY);
    if (!handoff || !handoff.level) throw new Error('Kein Playtest-Level übergeben. Bitte den Playtest im Editor starten.');
    const res = validateLevelData(handoff.level);
    if (!res.ok) throw new Error(`Level ungültig: ${res.issues.find((i) => i.severity === 'error').message}`);
    return { level: res.level, index: null, handoff };
  }
  const idx = validateIndex(await fetchJson(`${LEVEL_DIR}index.json`));
  if (!idx.index) throw new Error('Levelindex ungültig');
  const wanted = params.get('level');
  const entry = idx.index.levels.find((l) => l.id === wanted) || idx.index.levels.find((l) => l.id === idx.index.default);
  const res = validateLevelData(await fetchJson(LEVEL_DIR + entry.file));
  if (!res.ok) throw new Error(`${entry.file}: ${res.issues.find((i) => i.severity === 'error').message}`);
  return { level: res.level, index: idx.index, handoff: null };
}

function postToEditor(msg) {
  if (window.parent && window.parent !== window) window.parent.postMessage(msg, location.origin);
}

function showBootError(message) {
  const tag = document.querySelector('#menu .tagline');
  if (tag) {
    tag.textContent = message;
    tag.classList.add('error');
  }
  for (const id of ['#btn-start', '#btn-practice']) {
    const el = document.querySelector(id);
    if (el) el.disabled = true;
  }
  document.body.dataset.screen = 'menu';
}

async function boot() {
  let loaded;
  try {
    loaded = await loadLevel();
  } catch (err) {
    showBootError(`Level konnte nicht geladen werden: ${err.message}`);
    if (playtest) postToEditor({ type: 'forge:error', message: err.message });
    return;
  }
  const { level, index, handoff } = loaded;
  if (handoff && handoff.debug) debug.hitboxes = true;

  const canvas = document.getElementById('game');
  const storage = createStorage(level.id, playtest);
  const audio = new AudioEngine({ timers: !debug.manual });
  audio.simulationOnly = debug.manual;
  audio.setMuted(audio.settings.muted || storage.muted);
  storage.muted = audio.muted;

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
    onVolume: (bus, value) => { audio.setVolume(bus, value); ui.updateVolumes(audio.settings); },
    onGfxToggle: () => {
      storage.gfx = nextQuality(game.gfx.id);
      storage.gfxManual = true;
      storage.save();
      applyQuality(storage.gfx);
    },
    onPause: () => game.pause(),
    onResume: () => game.resume(),
    onRestart: () => game.restart(),
    onDeathTap: () => game.confirm(),
    onMenu: () => (playtest ? postToEditor({ type: 'forge:exit' }) : game.toMenu()),
    onLevelChange: (id) => {
      const q = new URLSearchParams(location.search);
      if (id === (index && index.default)) q.delete('level');
      else q.set('level', id);
      const s = q.toString();
      location.search = s ? `?${s}` : '';
    },
  });

  const input = new Input(canvas, {
    onPress: (dir, ts) => {
      // Simulation erst bis zum Eingabezeitpunkt vorspulen: der Impuls wirkt dort,
      // wo die Figur beim Tipp tatsächlich war (keine Verzögerung um bis zu einen Frame).
      advanceTo(eventTime(ts));
      if (!audio.ready) unlockAudio();
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

  const events = playtest ? {
    onWin: (r) => postToEditor({ type: 'forge:result', won: true, mode: r.mode, attempts: r.attempts, replay: r.replay, from: r.from }),
  } : {};
  game = new Game({ canvas, ui, audio, input, storage, debug, level, events, quality: params.get('gfx') || storage.gfx });
  window.__RIFT = game;
  audio.onInterrupt = () => game.pause();
  ui.updateVolumes(audio.settings);
  window.render_game_to_text = () => JSON.stringify({
    coordinates: 'x right, y up, world units; y = simulation seconds * 260',
    state: game.state, mode: game.mode, t: game.t, progress: game.progress,
    player: { x: game.player.x, y: game.y, vx: game.player.vx, lane: game.player.lane, dimension: game.player.dim },
    timeline: audio.timeline.at(game.t), audio: audio.status(), checkpoint: game.checkpoint,
    obstacles: game.obstacles.filter(o => o.y > game.y - 50 && o.y < game.y + game.lookaheadSec * 260).map(o => ({ x: o.x0, y: o.y, w: o.x1 - o.x0, color: o.color, deadly: game.deadlyNow(o, game.player.dim) })),
  });
  window.advanceTime = ms => {
    for (let remaining = ms / 1000; remaining > 1e-9; remaining -= Math.min(1 / 60, remaining)) game.update(Math.min(1 / 60, remaining));
    game.render();
  };

  function applyQuality(id) {
    game.setQuality(id);
    resize();
    ui.updateGfx(game.gfx.label);
  }

  // Automatische Stufe nur ohne eigene Wahl: ruckelt es im Lauf deutlich, eine Stufe tiefer (nur Darstellung).
  const autoGfx = !storage.gfxManual && !params.get('gfx') && !debug.manual;
  const perf = { sum: 0, n: 0, last: 0 };
  function watchFrameRate(now) {
    if (!autoGfx || game.state !== 'playing' || document.hidden) { perf.last = 0; return; }
    if (perf.last) {
      const gap = now - perf.last;
      if (gap < 250) { perf.sum += gap; perf.n++; }
    }
    perf.last = now;
    if (perf.n < 180) return;
    const avg = perf.sum / perf.n;
    perf.sum = 0;
    perf.n = 0;
    if (avg > 24 && game.gfx.id !== 'low') {
      storage.gfx = game.gfx.id === 'high' ? 'medium' : 'low';
      storage.save();
      applyQuality(storage.gfx);
    }
  }

  function resize() {
    const vv = window.visualViewport;
    const w = Math.round(vv ? vv.width : window.innerWidth);
    const h = Math.round(vv ? vv.height : window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, game.gfx.dprCap);
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
  window.addEventListener('pagehide', () => { game.pause(); audio.stop(); });

  // Doppeltipp-Zoom und Pinch auf iOS verhindern (nur außerhalb von Buttons).
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  ui.setLevels(index ? index.levels : null, level, playtest);
  ui.updateMenu(storage.stats, storage.muted);
  ui.updateGfx(game.gfx.label);

  let last = performance.now();
  let clockRevision = game.timelineRevision;
  let clockArmed = false;

  function eventTime(ts) {
    const now = performance.now();
    return Number.isFinite(ts) && ts <= now && ts > now - 1000 ? ts : now;
  }

  function advanceTo(now) {
    if (debug.manual || now <= last) return;
    if (clockRevision !== game.timelineRevision) { clockRevision = game.timelineRevision; clockArmed = false; last = now; return; }
    const elapsed = (now - last) / 1000;
    // Pause when an already running soundtrack could continue across a long render stall.
    if (elapsed > .25 && clockArmed && audio.active && (game.state === 'playing' || game.state === 'respawn')) game.pause();
    const dt = Math.min(MAX_FRAME_DT, elapsed) * debug.speed;
    last = now;
    game.update(dt);
    clockArmed = game.state === 'playing' || game.state === 'respawn';
  }

  function frame(now) {
    advanceTo(now);
    watchFrameRate(now);
    game.render();
    requestAnimationFrame(frame);
  }

  if (playtest) {
    // Esc beendet den Playtest (zurück zum Editor); P pausiert weiterhin
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      postToEditor({ type: 'forge:exit' });
    }, true);
    // Direkt starten, kurzer Halt (wie beim Respawn), damit der Fokus nach dem Wechsel aus dem Editor sitzt
    const mode = handoff.mode === 'practice' ? 'practice' : 'normal';
    const from = handoff.from && Number.isFinite(handoff.from.y) ? handoff.from : null;
    game.start(mode, from);
    // iframe navigation is not a reliable iOS audio gesture: explicit ready/Weiter button.
    game.pause();
    postToEditor({ type: 'forge:ready', levelId: level.id });
    window.focus();
  } else {
    ui.show('menu');
  }
  requestAnimationFrame(frame);
}

boot();
