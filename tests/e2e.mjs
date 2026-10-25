// End-to-End-Tests mit Playwright (Chromium + WebKit, Desktop + Mobile-Emulation).
// Voraussetzung: lokaler Server auf BASE_URL (Standard http://localhost:8080) und `npm i -D playwright`.
import { chromium, webkit, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const results = [];
let failed = 0;

function check(name, cond, detail = '') {
  results.push({ name, ok: !!cond, detail });
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  – ' + detail : ''}`);
}

async function open(browserType, ctxOpts, query = '') {
  const browser = await browserType.launch();
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  const url = new URL(query, BASE);url.searchParams.set('level','rift-main');
  await page.goto(url.href);
  await page.waitForFunction(() => window.__RIFT && document.querySelector('#menu:not([hidden])'));
  return { browser, context, page, errors };
}

const state = (page) => page.evaluate(() => {
  const g = window.__RIFT;
  return { state: g.state, mode: g.mode, lane: g.player.lane, dim: g.player.dim, t: g.t, pct: g.progress,
    sessionAttempts: g.sessionAttempts, cp: g.checkpoint, reason: g.killer && g.killer.reason,
    killerColor: g.killer && g.killer.o.color, killerBeat: g.killer && g.killer.o.beat, deathAge: g.deathAge,
    stored: JSON.parse(localStorage.getItem('riftclimb.pulse.v1') || 'null') };
});

const waitState = (page, states, timeout = 10000) =>
  page.waitForFunction((s) => s.includes(window.__RIFT.state), states, { timeout });

// ------------------------------------------------------------ Level

async function levelTest() {
  const { browser, page } = await open(chromium, { viewport: { width: 400, height: 800 } });
  const v = await page.evaluate(() => {
    const g = window.__RIFT;
    return { ok: g.validation.ok, errors: g.validation.errors, rows: g.rows.length };
  });
  check('[level] Handgebautes Level per Solver lösbar (jede Reihe erreichbar, kein Zustand ohne Ausweg)', v.ok, `${v.rows} Reihen ${v.errors.join(',')}`);
  await browser.close();
}

// ------------------------------------------------------------ Deterministische Szenarien (manuelle Zeitsteuerung)

async function scenarioTests() {
  const { browser, page, errors } = await open(chromium, { viewport: { width: 390, height: 844 } }, '?manual=1');
  await page.click('#btn-start');
  const run = (taps, dt = 1 / 60) => page.evaluate(({ taps, dt }) => {
    const g = window.__RIFT;
    g.restart();
    const q = taps.slice();
    while (g.state === 'playing' && g.t < 60) {
      g.update(dt);
      while (q.length && q[0].t <= g.t) g.impulse(q.shift().dir);
    }
    return { state: g.state, t: g.t, lane: g.player.lane, dim: g.player.dim,
      color: g.killer && g.killer.o.color, beat: g.killer && g.killer.o.beat, reason: g.killer && g.killer.reason,
      ky: g.killer && g.killer.y, oy: g.killer && g.killer.o.y };
  }, { taps, dt });

  let r = await run([]);
  check('[szenario] Ohne Tipp: Tod an der ersten Reihe (Weiß)', r.state === 'dying' && r.beat === 4 && r.color === 'W' && /WEISS/.test(r.reason), JSON.stringify(r));
  check('[szenario] Todesposition passt zum sichtbaren Hindernis', Math.abs(r.ky - r.oy) <= 13 + 1e-6, `Abstand ${(r.ky - r.oy).toFixed(2)} u`);

  r = await run([{ t: 0.5, dir: -1 }, { t: 2.5, dir: 1 }]);
  check('[szenario] Blaue Dimension: rote Reihe (inaktiv) passierbar, blaue Reihe tötet', r.beat === 13 && r.color === 'B' && /BLAU/.test(r.reason), JSON.stringify(r));

  r = await run([{ t: 0.5, dir: -1 }, { t: 2.5, dir: 1 }, { t: 4.0, dir: 1 }]);
  check('[szenario] Rote Dimension: rote Reihe tötet', r.beat === 10 && r.color === 'R' && /ROT/.test(r.reason), JSON.stringify(r));

  // Rift-Siegel bei Beat 20 (10 s): ohne Öffnungs-Tipp tödlich, mit Tipp 0,25 s davor passierbar
  r = await run([{ t: 0.5, dir: -1 }, { t: 2.5, dir: 1 }, { t: 5.6, dir: 1 }]);
  check('[m3] Geschlossenes Rift-Siegel tötet (mit Todesgrund)', r.beat === 20 && r.color === 'S' && /SIEGEL war zu/.test(r.reason), JSON.stringify(r));
  r = await run([{ t: 0.5, dir: -1 }, { t: 2.5, dir: 1 }, { t: 5.6, dir: 1 }, { t: 9.75, dir: 1 }]);
  check('[m3] Rift Pulse öffnet das Siegel -> passierbar (nächster Tod erst an einer Farbreihe)', r.beat === 28 && r.color === 'B', JSON.stringify(r));

  // Kollisionsgenauigkeit unabhängig von der Bildrate (auch bei 10 FPS)
  const tDeath = [];
  for (const dt of [1 / 10, 1 / 30, 1 / 60, 1 / 144]) {
    const x = await run([], dt);
    tDeath.push(x.t);
  }
  const spread = Math.max(...tDeath) - Math.min(...tDeath);
  check('[szenario] Todeszeitpunkt identisch bei 10/30/60/144 FPS (kein Tunneln)', spread < 1e-9, tDeath.map((t) => t.toFixed(6)).join(' / '));

  check('[szenario] Konsole fehlerfrei', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ------------------------------------------------------------ Bildratenunabhängigkeit

async function framerateTests() {
  const { browser, page, errors } = await open(chromium, { viewport: { width: 390, height: 844 } }, '?manual=1&autoplay=1&trace=1');
  await page.click('#btn-start');
  const runs = {};
  for (const [label, dts] of [['30 FPS', [1 / 30]], ['60 FPS', [1 / 60]], ['144 FPS', [1 / 144]], ['unregelmäßig 20–200 FPS', [1 / 20, 1 / 200, 1 / 61, 1 / 33, 1 / 144, 1 / 90]]]) {
    runs[label] = await page.evaluate((dts) => {
      const g = window.__RIFT;
      g.restart();
      let i = 0;
      while (g.state === 'playing' && g.t < 60) g.update(dts[i++ % dts.length]);
      return { state: g.state, pct: g.progress, trace: g.trace.join('|'), samples: g.trace.length };
    }, dts);
  }
  const ref = runs['60 FPS'];
  check('[framerate] Autopilot schafft 100 % bei allen Bildraten', Object.values(runs).every((r) => r.state === 'won' && r.pct === 100),
    Object.entries(runs).map(([k, r]) => `${k}:${r.state}`).join(', '));
  check('[framerate] Flugbahn identisch bei 30/60/144 FPS und unregelmäßigen Frames', Object.values(runs).every((r) => r.trace === ref.trace),
    `${ref.samples} Stichproben je Lauf`);
  check('[framerate] Konsole fehlerfrei', errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ------------------------------------------------------------ Desktop

async function desktopTests(type, label) {
  const { browser, page, errors } = await open(type, { viewport: { width: 1280, height: 800 } });

  await page.click('#btn-start');
  let s = await state(page);
  check(`[${label}] Start per Klick`, s.state === 'playing' && s.mode === 'normal');
  check(`[${label}] HUD sichtbar`, await page.isVisible('#hud'));

  await page.keyboard.press('ArrowRight');
  s = await state(page);
  check(`[${label}] D/→ = rechts oben + Dimensionswechsel (sofort im selben Event)`, s.lane === 2 && s.dim === 'R', `lane=${s.lane} dim=${s.dim}`);
  await page.waitForTimeout(300);
  await page.keyboard.press('a');
  s = await state(page);
  check(`[${label}] A/← = links oben + Dimensionswechsel`, s.lane === 1 && s.dim === 'B', `lane=${s.lane} dim=${s.dim}`);
  await page.waitForTimeout(120);
  check(`[${label}] HUD zeigt aktive Dimension`, (await page.textContent('#hud-dim')).trim() === 'BLAU');

  // Doppelt verarbeiteter Touch (zwei pointerdown im selben Moment) -> genau ein Impuls
  const dbl = await page.evaluate(() => {
    const g = window.__RIFT;
    const c = document.getElementById('game');
    const before = { lane: g.player.lane, dim: g.player.dim, ign: g.input.ignored, pulses: g.rift.emitted };
    const r = c.getBoundingClientRect();
    for (let i = 0; i < 2; i++) {
      c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: r.left + r.width * 0.2, clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true, button: 0 }));
    }
    return { before, after: { lane: g.player.lane, dim: g.player.dim, ign: g.input.ignored, pulses: g.rift.emitted } };
  });
  check(`[${label}] Doppelte Touch-Verarbeitung -> nur ein Impuls/Dimensionswechsel`,
    dbl.after.lane === dbl.before.lane + 1 && dbl.after.dim !== dbl.before.dim && dbl.after.ign === dbl.before.ign + 1, JSON.stringify(dbl));
  check(`[${label}] Doppelte Touch-Verarbeitung -> genau ein Rift Pulse`, dbl.after.pulses === dbl.before.pulses + 1);
  await page.waitForTimeout(300);
  await page.keyboard.press('a');

  await page.keyboard.press('Escape');
  check(`[${label}] Pause per Esc`, (await state(page)).state === 'paused' && await page.isVisible('#pause'));
  await page.click('#btn-resume');
  check(`[${label}] Weiter per Button`, (await state(page)).state === 'playing');

  // Tod an der ersten Reihe (Weiß), Spieler steht auf Spur 1
  await waitState(page, ['dying', 'dead']);
  s = await state(page);
  check(`[${label}] Kollision beendet Versuch mit Todesgrund`, s.killerColor === 'W' && /WEISS/.test(s.reason), s.reason);
  await page.keyboard.press('d');
  check(`[${label}] Kein versehentlicher Neustart direkt im Todesmoment`, ['dying', 'dead'].includes((await state(page)).state));
  await waitState(page, ['dead']);
  s = await state(page);
  check(`[${label}] Todesscreen zeigt Fortschritt + Grund`, (await page.textContent('#death-pct')).trim() === `${s.pct}%` && (await page.textContent('#death-reason')).includes('WEISS'));
  check(`[${label}] Bestleistung in localStorage`, s.stored && s.stored.stats.best === s.pct, JSON.stringify(s.stored));
  const attemptsBefore = s.stored.stats.attempts;

  // Sofortiger Neustart per Taste (A/D)
  await page.keyboard.press('d');
  s = await state(page);
  check(`[${label}] Sofort-Neustart per Taste`, s.state === 'playing' && s.t < 0.2 && s.lane === 1 && s.dim === 'B' && s.stored.stats.attempts === attemptsBefore + 1, JSON.stringify({ st: s.state, t: s.t, lane: s.lane, dim: s.dim }));

  // Wand-Tipp: Spur 1 -> 0 (Rot), dann gegen die Wand -> nur Dimensionswechsel
  await page.waitForTimeout(250);
  await page.keyboard.press('a'); await page.waitForTimeout(300);
  await page.keyboard.press('a');
  s = await state(page);
  check(`[${label}] Wand-Tipp wechselt nur Dimension`, s.lane === 0 && s.dim === 'B', `lane=${s.lane} dim=${s.dim}`);

  // Neustart per Klick auf den Todesscreen (irgendwo, nicht auf Buttons)
  await waitState(page, ['dead'], 12000);
  await page.mouse.click(640, 760);
  s = await state(page);
  check(`[${label}] Klick irgendwo auf den Todesscreen = Neustart`, s.state === 'playing' && s.t < 0.3);
  await waitState(page, ['dead'], 12000);
  await page.keyboard.press('Enter');
  check(`[${label}] Enter = Neustart`, (await state(page)).state === 'playing');
  await page.keyboard.press('Escape');
  await page.click('#btn-pause-menu');
  check(`[${label}] Zurück ins Menü`, await page.isVisible('#menu') && (await page.textContent('[data-level=rift-main] .level-result')).includes('%'));

  await page.click('#btn-start');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check(`[${label}] Auto-Pause bei visibilitychange`, (await state(page)).state === 'paused');

  check(`[${label}] Konsole fehlerfrei`, errors.length === 0, errors.join(' | '));
  await browser.close();
}

// ------------------------------------------------------------ Practice

async function practiceTests() {
  const { browser, page, errors } = await open(chromium, { viewport: { width: 420, height: 860 } });
  await page.click('#btn-start');
  await waitState(page, ['dead']);
  const bestBefore = (await state(page)).stored.stats.best;
  const attemptsBefore = (await state(page)).stored.stats.attempts;
  await page.click('#btn-death-menu');

  await page.click('#btn-practice');
  let s = await state(page);
  check('[practice] Übungsmodus startet', s.state === 'playing' && s.mode === 'practice');
  await page.waitForTimeout(120);
  check('[practice] PRACTICE-Kennzeichnung sichtbar', await page.isVisible('#hud-mode'));
  await waitState(page, ['respawn']);
  s = await state(page);
  check('[practice] Tod -> Respawn statt Todesscreen', !(await page.isVisible('#death')) && s.sessionAttempts === 2);
  check('[practice] Respawn am Start-Checkpoint', s.t === 0);
  check('[practice] Normal-Statistik unberührt (Best + Versuche)', s.stored.stats.best === bestBefore && s.stored.stats.attempts === attemptsBefore);
  await browser.close();

  const b2 = await open(chromium, { viewport: { width: 420, height: 860 } }, '?autoplay=1&speed=4');
  await b2.page.click('#btn-practice');
  await b2.page.waitForFunction(() => window.__RIFT.checkpoint.beat >= 40, null, { timeout: 20000 });
  const cp = (await state(b2.page)).cp;
  await b2.page.evaluate(() => window.__RIFT.die(window.__RIFT.obstacles[0]));
  await waitState(b2.page, ['respawn'], 3000);
  s = await state(b2.page);
  check('[practice] Automatische Checkpoints', cp.beat >= 40, `beat=${cp.beat}`);
  check('[practice] Respawn am letzten Checkpoint (Spur + Dimension)', Math.abs(s.t - cp.t) < 1e-9 && s.lane === cp.lane && s.dim === cp.dim);
  await waitState(b2.page, ['won'], 30000);
  s = await state(b2.page);
  check('[practice] Nach Respawn weiter bis 100 % spielbar', s.pct === 100 && (!s.stored || s.stored.stats.best !== 100));
  check('[practice] Konsole fehlerfrei', errors.length === 0 && b2.errors.length === 0, [...errors, ...b2.errors].join(' | '));
  await b2.browser.close();
}

// ------------------------------------------------------------ Kompletter Lauf

async function fullRunTest() {
  for (const offset of [0.07, 0.3]) {
    const { browser, page, errors } = await open(chromium, { viewport: { width: 420, height: 860 } }, `?autoplay=1&speed=6&offset=${offset}`);
    await page.click('#btn-start');
    await waitState(page, ['won', 'dead'], 40000);
    const s = await state(page);
    check(`[normal] Level bis 100 % durchspielbar (Tipps ${offset * 1000} ms nach der vorigen Reihe)`, s.state === 'won' && s.pct === 100, `state=${s.state} pct=${s.pct} ${s.reason || ''}`);
    if (offset === 0.07) {
      check('[normal] Win-Screen + Bestleistung 100 % + Abschluss gezählt', await page.isVisible('#win') && s.stored.stats.best === 100 && s.stored.stats.clears === 1);
    }
    check(`[normal] Konsole fehlerfrei (offset ${offset})`, errors.length === 0, errors.join(' | '));
    await browser.close();
  }
}

// ------------------------------------------------------------ Mobile

async function mobileTests(type, deviceName, label) {
  const dev = devices[deviceName];
  const { browser, page, errors } = await open(type, { ...dev });

  const vp = page.viewportSize();
  await page.tap('#btn-start');
  let s = await state(page);
  check(`[${label}] Start-Button per Touch (1 Tap)`, s.state === 'playing');
  check(`[${label}] Start-Tap löst keinen Impuls aus`, s.lane === 1 && s.dim === 'B');

  await page.waitForTimeout(250);
  const pulses0 = await page.evaluate(() => window.__RIFT.rift.emitted);
  await page.touchscreen.tap(vp.width * 0.2, vp.height * 0.6);
  s = await state(page);
  check(`[${label}] Tipp links = schräg rechts oben (genau 1 Impuls)`, s.lane === 2 && s.dim === 'R', `lane=${s.lane} dim=${s.dim}`);
  const pulses1 = await page.evaluate(() => window.__RIFT.rift.emitted);
  check(`[${label}] Touch-Tipp sendet genau einen Rift Pulse (ohne Zusatzverzögerung, im selben Event)`, pulses1 === pulses0 + 1, `${pulses0} -> ${pulses1}`);
  await page.waitForTimeout(300);
  await page.touchscreen.tap(vp.width * 0.8, vp.height * 0.6);
  s = await state(page);
  check(`[${label}] Tipp rechts = schräg links oben (genau 1 Impuls)`, s.lane === 1 && s.dim === 'B', `lane=${s.lane} dim=${s.dim}`);

  const layout = await page.evaluate(() => {
    const c = document.getElementById('game');
    return {
      dpr: devicePixelRatio, cw: c.width, ch: c.height, cssW: c.clientWidth, cssH: c.clientHeight,
      iw: innerWidth, ih: innerHeight, look: window.__RIFT.lookaheadSec,
      scrollH: document.scrollingElement.scrollHeight, scrollW: document.scrollingElement.scrollWidth,
      cap: 2.5,
    };
  });
  const expDpr = Math.min(layout.dpr, layout.cap);
  check(`[${label}] DPR-korrektes Canvas`, Math.abs(layout.cw - layout.cssW * expDpr) <= 1 && Math.abs(layout.ch - layout.cssH * expDpr) <= 1, JSON.stringify(layout));
  check(`[${label}] Kein Scrollen (Inhalt = Viewport)`, layout.scrollH <= layout.ih && layout.scrollW <= layout.iw);
  check(`[${label}] Kamera-Vorschau ≥ 1,5 s (Hindernisse früh sichtbar)`, layout.look >= 1.5, `${layout.look.toFixed(2)} s`);

  await page.tap('#btn-pause');
  check(`[${label}] Pause-Button per Touch`, (await state(page)).state === 'paused');
  await page.tap('#btn-resume');
  check(`[${label}] Weiter-Button per Touch`, (await state(page)).state === 'playing');

  // Tod, dann Tipp auf die Stelle des Pause-Buttons: muss neu starten, nicht pausieren (kein Ghost-Click)
  await waitState(page, ['dead'], 12000);
  const pb = await page.locator('#btn-pause').boundingBox();
  await page.touchscreen.tap(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.waitForTimeout(150);
  s = await state(page);
  check(`[${label}] Tipp irgendwo auf Todesscreen = Neustart (kein Ghost-Click auf Pause)`, s.state === 'playing' && s.t < 0.5, `state=${s.state}`);
  await waitState(page, ['dead'], 12000);
  await page.tap('#btn-death-restart');
  check(`[${label}] Neustart-Button per Touch`, (await state(page)).state === 'playing');
  await page.waitForTimeout(250);
  await page.tap('#btn-pause');
  await page.tap('#btn-pause-menu');
  await page.tap('#btn-sound');
  const muted = (await state(page)).stored.muted;
  check(`[${label}] Sound-Toggle per Touch + gespeichert`, muted === true && (await page.textContent('#btn-sound')).includes('AUS'));
  const fit = await page.evaluate(() => { const r = document.querySelector('#menu .panel').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, ih: innerHeight }; });
  check(`[${label}] Menü passt komplett in den Viewport`, fit.top >= 0 && fit.bottom <= fit.ih, JSON.stringify(fit));
  check(`[${label}] Eine feste hochwertige Darstellung ohne Grafikmenü`, await page.locator('#btn-gfx').count() === 0 && await page.evaluate(() => !('gfx' in __RIFT)));
  await page.tap('#btn-practice');
  check(`[${label}] Übungsmodus-Button per Touch`, (await state(page)).mode === 'practice');

  check(`[${label}] Konsole fehlerfrei`, errors.length === 0, errors.join(' | '));
  await browser.close();
}

await levelTest();
await scenarioTests();
await framerateTests();
await desktopTests(chromium, 'chromium');
await desktopTests(webkit, 'webkit');
await practiceTests();
await fullRunTest();
await mobileTests(webkit, 'iPhone 13', 'webkit-iphone');
await mobileTests(chromium, 'Pixel 7', 'chromium-pixel');

console.log(`\n${results.length - failed}/${results.length} Checks bestanden`);
process.exit(failed ? 1 : 0);
