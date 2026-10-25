import { Game } from './game.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { MAX_FRAME_DT } from './config.js';
import { validateLevelData, validateIndex } from './level-data.js';

import { readJson, migrateVisualPreferences } from './storage.js';
import { Progression } from './progression.js';
import { riftlingArt } from './art/riftling.js';
import {validateChunkBook,worldMeters} from './endless.js';
import {trapPose,trapReach} from './traps.js';

const LEVEL_DIR = 'assets/levels/';
export const PLAYTEST_KEY = 'riftforge.playtest';

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
  let { level } = loaded;
  const { index, handoff } = loaded;
  migrateVisualPreferences();
  const catalog = new Map([[level.id, level]]);
  try {
    await Promise.all((index?.levels || []).filter(e => e.campaign && e.id !== level.id).map(async entry => {
      const res = validateLevelData(await fetchJson(LEVEL_DIR + entry.file));
      if (!res.ok) throw new Error(entry.name + ' ist ungültig.');
      catalog.set(entry.id, res.level);
    }));
  } catch (err) { showBootError(err.message); return; }
  const menuLevels = index?.levels.filter(e => e.campaign || e.id === level.id && !e.campaign) || null;
  let infinityBook=null,infinityError='';
  if(!playtest)try{infinityBook=validateChunkBook(await fetchJson('assets/endless/chunks.json'));}catch(err){infinityError='Infinity-Daten nicht verfügbar: '+err.message;}

  if (handoff && handoff.debug) debug.hitboxes = true;

  const canvas = document.getElementById('game');
  const progression = new Progression({isolated:playtest});
  const storageFor = id => progression.storageFor(id);
  let storage = storageFor(level.id);
  const audio = new AudioEngine({ timers: !debug.manual });
  audio.simulationOnly = debug.manual;
  audio.setMuted(readJson('riftclimb.audio.v1')?audio.settings.muted:storage.muted);
  storage.muted = audio.muted;

  let game;
  const unlockAudio = () => audio.unlock();

  const ui = new UI({
    progression,
    initialSeed:params.has('seed')?Number(params.get('seed'))>>>0:Date.now()>>>0,
    infinityAvailable:()=>!!infinityBook,infinityError:()=>infinityError,
    onInfinityStart:seed=>{if(!infinityBook||playtest)return;storage=progression.infinityStorage(seed);storage.muted=audio.muted;game.startEndless(infinityBook,seed,storage);const q=new URLSearchParams(location.search);q.set('endless','1');q.set('seed',String(seed));history.replaceState(null,'',location.pathname+'?'+q);},
    onGesture: unlockAudio,
    onStart: (mode) => {if(game.endless)ui.h.onLevelChange(level.id);game.start(mode);},
    onEquip: id => {game.skinId=id;riftlingArt.loadSkin(id);ui.setSkin(id);},
    onRewardSound: name => audio.sfx(name),
    hasNext: () => !!menuLevels?.[menuLevels.findIndex(l=>l.id===level.id)+1],
    onNext: () => {const next=menuLevels?.[menuLevels.findIndex(l=>l.id===level.id)+1],mode=game.mode;if(next){ui.h.onLevelChange(next.id);ui.openPage('levels');game.start(mode);}},
    onHome: () => {if(playtest)postToEditor({type:'forge:exit'});else{game.toMenu();ui.openPage('home');}},
    getStats: id => storageFor(id).stats,
    onSoundToggle: () => {
      storage.muted = !storage.muted;
      storage.save();
      audio.setMuted(storage.muted);
      ui.updateSound(storage.muted);
    },
    onVolume: (bus, value) => { audio.setVolume(bus, value); ui.updateVolumes(audio.settings); },
    onPause: () => game.pause(),
    onResume: () => game.resume(),
    onRestart: () => game.restart(),
    onDeathTap: () => game.confirm(),
    onMenu: () => {if(playtest)postToEditor({type:'forge:exit'});else{game.toMenu();ui.openPage('levels');}},
    onLevelChange: (id) => {
      if (!catalog.has(id) || id === level.id && !game.endless || playtest) return;
      level = catalog.get(id);
      storage = storageFor(id);
      storage.muted = audio.muted;
      game.setLevelData(level, storage);
      ui.setLevels(menuLevels, level, false, catalog);
      ui.updateMenu(storage.stats, audio.muted);
      const q = new URLSearchParams(location.search);
      q.delete('endless');q.delete('seed');
      if (id === index.default) q.delete('level'); else q.set('level', id);
      history.replaceState(null, '', location.pathname + (q.size ? '?' + q : ''));

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
        if(ui.panels.page!=='levels'){ui.openPage('levels');return true;}
        game.start('normal');
        return true;
      }
      return game.confirm();
    },
  });

  const events = playtest ? {
    onWin: (r) => postToEditor({ type: 'forge:result', won: true, mode: r.mode, attempts: r.attempts, replay: r.replay, from: r.from }),
  } : {};
  game = new Game({ canvas, ui, audio, input, storage, debug, level, events });
  window.__RIFT = game;
  window.__ASCENSION = progression;
  game.skinId=progression.data.cosmetics.selectedSkinId;
  ui.setSkin(game.skinId);
  riftlingArt.loadSkin(game.skinId);
  audio.onInterrupt = () => game.pause();
  ui.updateVolumes(audio.settings);
  window.render_game_to_text = () => JSON.stringify({
    coordinates: 'x right, y up, world units; y = simulation seconds * 260',
    level: game.level.id, state: game.state, mode: game.mode, t: game.t, progress: game.progress,
    menu:ui.panels.page,skin:game.skinId,stats:progression.summary(),
    infinity:game.endless?{seed:game.endless.seed,height:worldMeters(game.y),best:progression.data.endless.bestHeight,chunks:game.endless.chunks.map(c=>({id:c.id,index:c.index})),generated:game.endless.generated}:null,
    traps:game.traps.traps.filter(o=>Math.abs(o.y-game.y)<trapReach(o)+game.lookaheadSec*260).map(o=>({id:o.id,type:o.type,dimension:o.color,state:o.state,...trapPose(o,game.t)})),
    player: { x: game.player.x, y: game.y, vx: game.player.vx, lane: game.player.lane, dimension: game.player.dim },
    timeline: audio.timeline.at(game.t), audio: audio.status(), checkpoint: game.checkpoint ? { t:game.checkpoint.t, lane:game.checkpoint.lane, dim:game.checkpoint.dim, beat:game.checkpoint.beat } : null,
    obstacles: game.obstacles.filter(o => o.y > game.y - 50 && o.y < game.y + game.lookaheadSec * 260).map(o => ({ x: o.x0, y: o.y, w: o.x1 - o.x0, color: o.color, deadly: game.deadlyNow(o, game.player.dim) })),
  });
  window.advanceTime = ms => {
    for (let remaining = ms / 1000; remaining > 1e-9; remaining -= Math.min(1 / 60, remaining)) game.update(Math.min(1 / 60, remaining));
    game.render();
  };

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
  window.addEventListener('pagehide', () => { game.pause(); audio.stop(); });

  // Doppeltipp-Zoom und Pinch auf iOS verhindern (nur außerhalb von Buttons).
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  ui.setLevels(menuLevels, level, playtest, catalog);
  ui.updateMenu(storage.stats, storage.muted);

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
    // Pause a blind stall even without audio. At 5 FPS, all 200 ms still simulate:
    // frame rate must never slow down the ascent or change collision behavior.
    if (elapsed > MAX_FRAME_DT && clockArmed && (game.state === 'playing' || game.state === 'respawn')) game.pause();
    const dt = Math.min(MAX_FRAME_DT, elapsed) * debug.speed;
    last = now;
    game.update(dt);
    clockArmed = game.state === 'playing' || game.state === 'respawn';
  }

  function frame(now) {
    advanceTo(now);
    game.render();
    ui.animate(now,game.state);
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
    if(params.has('level'))ui.openPage('levels');
    if(params.has('endless'))ui.openPage('infinity');
  }
  requestAnimationFrame(frame);
}

boot();
