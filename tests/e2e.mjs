// End-to-End-Tests mit Playwright (Chromium + WebKit, Desktop + Mobile-Emulation).
// Voraussetzung: lokaler Server auf BASE_URL (Standard http://localhost:8080) und `npm i -D playwright`.
import { chromium, webkit, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const SHOTS = process.env.SHOT_DIR || '';
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
  await page.goto(BASE + query);
  await page.waitForFunction(() => window.__RIFT && document.querySelector('#menu:not([hidden])'));
  return { browser, context, page, errors };
}

const state = (page) => page.evaluate(() => {
  const g = window.__RIFT;
  return { state: g.state, mode: g.mode, lane: g.player.lane, dim: g.player.dim, t: g.t, pct: g.progress,
    sessionAttempts: g.sessionAttempts, cp: g.checkpoint, stored: JSON.parse(localStorage.getItem('riftclimb.pulse.v1') || 'null') };
});

async function desktopTests(type, label) {
  const { browser, page, errors } = await open(type, { viewport: { width: 1280, height: 800 } });
  if (SHOTS && label === 'chromium') await page.screenshot({ path: `${SHOTS}/desktop-menu.png` });

  await page.click('#btn-start');
  let s = await state(page);
  check(`[${label}] Start per Klick`, s.state === 'playing' && s.mode === 'normal');
  check(`[${label}] HUD sichtbar`, await page.isVisible('#hud'));

  await page.keyboard.press('ArrowRight');
  s = await state(page);
  check(`[${label}] D/→ = rechts oben + Dimensionswechsel`, s.lane === 2 && s.dim === 'R', `lane=${s.lane} dim=${s.dim}`);
  await page.waitForTimeout(400);
  await page.keyboard.press('a');
  s = await state(page);
  check(`[${label}] A/← = links oben + Dimensionswechsel`, s.lane === 1 && s.dim === 'B', `lane=${s.lane} dim=${s.dim}`);
  await page.waitForTimeout(120);
  check(`[${label}] HUD zeigt aktive Dimension`, (await page.textContent('#hud-dim')).trim() === 'BLAU');

  // Pause per Esc, Resume per Button
  await page.keyboard.press('Escape');
  check(`[${label}] Pause per Esc`, (await state(page)).state === 'paused' && await page.isVisible('#pause'));
  await page.click('#btn-resume');
  check(`[${label}] Weiter per Button`, (await state(page)).state === 'playing');

  // Kollision mit aktivem Hindernis: Spieler in Spur 1/Blau, Reihe Beat 8 = "BB.." -> Tod
  await page.waitForFunction(() => window.__RIFT.state === 'dead', null, { timeout: 8000 });
  s = await state(page);
  check(`[${label}] Kollision mit aktiver Farbe beendet Versuch`, s.state === 'dead' && await page.isVisible('#death'), `pct=${s.pct}`);
  check(`[${label}] Todesscreen zeigt Fortschritt`, (await page.textContent('#death-pct')).trim() === `${s.pct}%`);
  check(`[${label}] Bestleistung in localStorage`, s.stored && s.stored.stats.best === s.pct, JSON.stringify(s.stored));
  const attemptsBefore = s.stored.stats.attempts;

  // Sofort-Neustart + inaktive Farbe passieren
  await page.click('#btn-death-restart');
  s = await state(page);
  check(`[${label}] Sofort-Neustart`, s.state === 'playing' && s.t < 0.2 && s.stored.stats.attempts === attemptsBefore + 1);
  await page.waitForTimeout(250);
  await page.keyboard.press('a'); await page.waitForTimeout(380);
  await page.keyboard.press('a'); await page.waitForTimeout(380);
  await page.keyboard.press('d');
  s = await state(page);
  check(`[${label}] Wand-Tipp wechselt nur Dimension`, s.lane === 1 && s.dim === 'R', `lane=${s.lane} dim=${s.dim}`);
  await page.waitForFunction(() => window.__RIFT.t > 9, null, { timeout: 12000 });
  s = await state(page);
  check(`[${label}] Inaktive (blaue) Hindernisse sind passierbar`, s.state === 'playing', `t=${s.t.toFixed(2)}`);
  await page.waitForFunction(() => window.__RIFT.state === 'dead', null, { timeout: 4000 });
  s = await state(page);
  check(`[${label}] Aktive (rote) Reihe Beat 20 tötet`, s.state === 'dead' && Math.abs(s.t - 10) < 0.2, `t=${s.t.toFixed(2)}`);

  await page.keyboard.press('Enter');
  check(`[${label}] Enter = Neustart`, (await state(page)).state === 'playing');
  await page.keyboard.press('Escape');
  await page.click('#btn-pause-menu');
  check(`[${label}] Zurück ins Menü`, await page.isVisible('#menu') && (await page.textContent('#menu-best')).includes('%'));

  // visibilitychange -> Pause
  await page.click('#btn-start');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  check(`[${label}] Auto-Pause bei visibilitychange`, (await state(page)).state === 'paused');

  check(`[${label}] Konsole fehlerfrei`, errors.length === 0, errors.join(' | '));
  await browser.close();
}

async function practiceTests() {
  const { browser, page, errors } = await open(chromium, { viewport: { width: 420, height: 860 } });
  await page.click('#btn-start');
  await page.waitForFunction(() => window.__RIFT.state === 'dead', null, { timeout: 8000 });
  const bestBefore = (await state(page)).stored.stats.best;
  await page.click('#btn-death-menu');

  await page.click('#btn-practice');
  let s = await state(page);
  check('[practice] Übungsmodus startet', s.state === 'playing' && s.mode === 'practice');
  await page.waitForTimeout(120);
  check('[practice] PRACTICE-Kennzeichnung sichtbar', await page.isVisible('#hud-mode'));
  await page.waitForFunction(() => window.__RIFT.state === 'respawn', null, { timeout: 8000 });
  s = await state(page);
  check('[practice] Tod -> Respawn statt Todesscreen', !(await page.isVisible('#death')) && s.sessionAttempts === 2);
  check('[practice] Respawn am Start-Checkpoint', s.t === 0);
  check('[practice] keine reguläre Bestleistung', s.stored.stats.best === bestBefore);
  await browser.close();

  // Practice mit Autopilot: Checkpoints sammeln, dann erzwungener Tod -> Respawn am letzten Checkpoint
  const b2 = await open(chromium, { viewport: { width: 420, height: 860 } }, '?autoplay=1&speed=4');
  await b2.page.click('#btn-practice');
  await b2.page.waitForFunction(() => window.__RIFT.checkpoint.beat >= 40, null, { timeout: 20000 });
  const cp = (await state(b2.page)).cp;
  await b2.page.evaluate(() => window.__RIFT.die());
  s = await state(b2.page);
  check('[practice] Automatische Checkpoints', cp.beat >= 40, `beat=${cp.beat}`);
  check('[practice] Respawn am letzten Checkpoint', s.state === 'respawn' && Math.abs(s.t - cp.t) < 1e-9 && s.lane === cp.lane && s.dim === cp.dim);
  await b2.page.waitForFunction(() => window.__RIFT.state === 'won', null, { timeout: 30000 });
  s = await state(b2.page);
  check('[practice] Nach Respawn weiter bis 100 % spielbar', s.pct === 100 && (!s.stored || s.stored.stats.best !== 100));
  check('[practice] Konsole fehlerfrei', errors.length === 0 && b2.errors.length === 0, [...errors, ...b2.errors].join(' | '));
  await b2.browser.close();
}

async function fullRunTest() {
  const { browser, page, errors } = await open(chromium, { viewport: { width: 420, height: 860 } }, '?autoplay=1&speed=6');
  await page.click('#btn-start');
  await page.waitForFunction(() => ['won', 'dead'].includes(window.__RIFT.state), null, { timeout: 40000 });
  const s = await state(page);
  check('[normal] Level bis 100 % durchspielbar (Autopilot mit Solver-Lösung)', s.state === 'won' && s.pct === 100, `state=${s.state} pct=${s.pct}`);
  check('[normal] Win-Screen + Bestleistung 100 %', await page.isVisible('#win') && s.stored.stats.best === 100);
  check('[normal] Konsole fehlerfrei', errors.length === 0, errors.join(' | '));
  await browser.close();
}

async function mobileTests(type, deviceName, label) {
  const dev = devices[deviceName];
  const { browser, page, errors } = await open(type, { ...dev });
  if (SHOTS && label === 'webkit-iphone') await page.screenshot({ path: `${SHOTS}/mobile-menu.png` });

  const vp = page.viewportSize();
  await page.tap('#btn-start');
  let s = await state(page);
  check(`[${label}] Start-Button per Touch (1 Tap)`, s.state === 'playing');
  check(`[${label}] Start-Tap löst keinen Impuls aus`, s.lane === 1 && s.dim === 'B');

  await page.waitForTimeout(250);
  await page.touchscreen.tap(vp.width * 0.2, vp.height * 0.6);
  s = await state(page);
  check(`[${label}] Tipp links = schräg rechts oben (genau 1 Impuls)`, s.lane === 2 && s.dim === 'R', `lane=${s.lane} dim=${s.dim}`);
  await page.waitForTimeout(380);
  await page.touchscreen.tap(vp.width * 0.8, vp.height * 0.6);
  s = await state(page);
  check(`[${label}] Tipp rechts = schräg links oben (genau 1 Impuls)`, s.lane === 1 && s.dim === 'B', `lane=${s.lane} dim=${s.dim}`);

  const layout = await page.evaluate(() => {
    const c = document.getElementById('game');
    return {
      dpr: devicePixelRatio, cw: c.width, ch: c.height, cssW: c.clientWidth, cssH: c.clientHeight,
      iw: innerWidth, ih: innerHeight,
      scrollH: document.scrollingElement.scrollHeight, scrollW: document.scrollingElement.scrollWidth,
    };
  });
  const expDpr = Math.min(layout.dpr, 2.5);
  check(`[${label}] DPR-korrektes Canvas`, Math.abs(layout.cw - layout.cssW * expDpr) <= 1 && Math.abs(layout.ch - layout.cssH * expDpr) <= 1, JSON.stringify(layout));
  check(`[${label}] Kein Scrollen (Inhalt = Viewport)`, layout.scrollH <= layout.ih && layout.scrollW <= layout.iw);

  await page.waitForTimeout(600);
  if (SHOTS && label === 'webkit-iphone') await page.screenshot({ path: `${SHOTS}/mobile-gameplay.png` });

  await page.tap('#btn-pause');
  check(`[${label}] Pause-Button per Touch`, (await state(page)).state === 'paused');
  await page.tap('#btn-resume');
  check(`[${label}] Weiter-Button per Touch`, (await state(page)).state === 'playing');

  await page.waitForFunction(() => window.__RIFT.state === 'dead', null, { timeout: 12000 });
  await page.tap('#btn-death-restart');
  check(`[${label}] Neustart-Button per Touch`, (await state(page)).state === 'playing');
  await page.waitForTimeout(250);
  // Practice-Button im Menü per Touch
  await page.tap('#btn-pause');
  await page.tap('#btn-pause-menu');
  await page.tap('#btn-sound');
  const muted = (await state(page)).stored.muted;
  check(`[${label}] Sound-Toggle per Touch + gespeichert`, muted === true && (await page.textContent('#btn-sound')).includes('AUS'));
  await page.tap('#btn-practice');
  check(`[${label}] Übungsmodus-Button per Touch`, (await state(page)).mode === 'practice');

  check(`[${label}] Konsole fehlerfrei`, errors.length === 0, errors.join(' | '));
  await browser.close();
}

async function levelTest() {
  const { browser, page } = await open(chromium, { viewport: { width: 400, height: 800 } });
  const v = await page.evaluate(() => {
    const val = window.__RIFT.validation;
    return { ok: val.ok, errors: val.errors, rows: window.__RIFT.rows.length };
  });
  check('[level] Handgebautes Level per Solver lösbar (keine unmöglichen Kombinationen)', v.ok, `${v.rows} Reihen ${v.errors.join(',')}`);
  await browser.close();
}

await levelTest();
await desktopTests(chromium, 'chromium');
await desktopTests(webkit, 'webkit');
await practiceTests();
await fullRunTest();
await mobileTests(webkit, 'iPhone 13', 'webkit-iphone');
await mobileTests(chromium, 'Pixel 7', 'chromium-pixel');

console.log(`\n${results.length - failed}/${results.length} Checks bestanden`);
process.exit(failed ? 1 : 0);
