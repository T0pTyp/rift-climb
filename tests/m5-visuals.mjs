// M5: Tests für Figur, Animationen, Effekte und Grafikstufen (Spezifikation Abschnitt 19, Punkte 1–9).
// Läuft im echten Spiel (Chromium, iPhone-13-Profil), Simulation über ?manual=1 schrittweise gesteuert.
// Voraussetzung: lokaler Server auf BASE_URL (Standard http://localhost:8080/) und `npm i -D playwright`.
// Aufruf: node tests/m5-visuals.mjs
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
let failed = 0;
let total = 0;
function check(name, cond, detail = '') {
  total++;
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  – ' + detail : ''}`);
}

const browser = await chromium.launch();

async function open(query, device = 'iPhone 13', extra = {}) {
  const ctx = await browser.newContext({ ...devices[device], ...extra });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${BASE}?manual=1${query}`);
  await page.waitForFunction(() => window.__RIFT && window.__RIFT.art.promise);
  await page.evaluate(() => window.__RIFT.art.promise);
  return { ctx, page, errors };
}

/** Farbe des Riftling-Kerns auf dem Canvas (Mittelwert eines kleinen Fensters um die Figurenmitte). */
const playerColor = (page) => page.evaluate(() => {
  const g = window.__RIFT;
  g.render();
  const v = g.view;
  const k = v.dpr * v.scale;
  const cx = (g.player.x * v.scale + v.offsetX) * v.dpr;
  const cy = v.playerSY * k;
  const d = g.ctx.getImageData(Math.round(cx - 3 * k), Math.round(cy - 3 * k), Math.round(6 * k), Math.round(6 * k)).data;
  let r = 0; let gr = 0; let b = 0; let n = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 200) continue; r += d[i]; gr += d[i + 1]; b += d[i + 2]; n++; }
  return n ? [Math.round(r / n), Math.round(gr / n), Math.round(b / n), n] : [0, 0, 0, 0];
});

// ---------------------------------------------------------------- 1.–3. Figur, Animationszustände, Dimensionsfarbe
{
  const { ctx, page, errors } = await open('&gfx=high');
  const assets = await page.evaluate(() => {
    const a = window.__RIFT.art;
    return { ready: a.ready, failed: a.failed, imgs: Object.keys(a.images).sort().join(','), sizes: Object.values(a.images).map((i) => `${i.naturalWidth}x${i.naturalHeight}`).join(',') };
  });
  check('[1] Riftling-SVG-Ebenen geladen (Körper Blau, Körper Rot, Auge)', assets.ready && !assets.failed && assets.imgs === 'B,R,eye', JSON.stringify(assets));
  await page.tap('#btn-start');
  await page.evaluate(() => { const g = window.__RIFT; for (let i = 0; i < 30; i++) g.update(1 / 60); });
  const blue = await playerColor(page);
  const s0 = await page.evaluate(() => window.__RIFT.anim.state);
  check('[1] Figur im Spiel gezeichnet: Kern deutlich blau/türkis', blue[3] > 10 && blue[2] > blue[0] + 40, blue.join(','));
  check('[2] Ruhiger Steigflug = Zustand „idle“', s0 === 'idle', s0);

  // press(+1) = Tipp links = schräg rechts hoch (wie Input.js), press(-1) = Tipp rechts = schräg links hoch
  const seq = await page.evaluate(() => {
    const g = window.__RIFT;
    const states = [];
    const blends = [];
    g.press(1);
    for (let i = 0; i < 70; i++) {
      g.update(1 / 120);
      if (i < 12) blends.push(g.anim.pose.blend);
      const st = g.anim.state;
      if (states[states.length - 1] !== st) states.push(st);
    }
    return { states, blends, dim: g.player.dim };
  });
  const flowOk = (st, flight) => st[0] === 'switch' && st.indexOf(flight) > 0 && st.indexOf('idle', st.indexOf(flight)) > 0;
  check('[2] Tipp links: „switch“ → „flightRight“ (Flug schräg rechts) → zurück zu „idle“', flowOk(seq.states, 'flightRight'), seq.states.join(' → '));
  const blend = seq.blends;
  check('[3] Farbwechsel ist ein kurzer Übergang (Blend steigt stetig von Blau nach Rot)', blend[0] < blend[5] && blend[5] < blend[11] && blend[11] > 0.85, blend.map((b) => b.toFixed(2)).join(' '));
  const red = await playerColor(page);
  check('[3] Nach dem Wechsel in Rot: Figur magenta/rot (eigene rote SVG-Ebene)', seq.dim === 'R' && red[0] > red[2] && red[0] > blue[0] + 60, `${red.join(',')} · blau vorher ${blue.join(',')}`);
  const seq2 = await page.evaluate(() => {
    const g = window.__RIFT;
    const states = [];
    g.press(-1);
    for (let i = 0; i < 70; i++) {
      g.update(1 / 120);
      if (states[states.length - 1] !== g.anim.state) states.push(g.anim.state);
    }
    return states;
  });
  check('[2] Tipp rechts: „switch“ → „flightLeft“ → „idle“', flowOk(seq2, 'flightLeft'), seq2.join(' → '));
  check('[1–3] Konsole fehlerfrei', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- 4. + 8. Hitbox und Spielgeschwindigkeit unabhängig von Grafik/Animation
{
  const taps = [[0.5, -1], [2.5, 1], [4.0, 1], [5.6, -1], [7.1, 1]];
  async function trace(gfx, noAnim) {
    const { ctx, page } = await open(`&gfx=${gfx}`);
    await page.tap('#btn-start');
    const r = await page.evaluate(([T, off]) => {
      const g = window.__RIFT;
      if (off) g.anim.update = () => ({ blend: 0, tilt: 0, sx: 3, sy: 0.2, bob: 9, eye: 1, flash: 0, glow: 1, alpha: 1 });
      const out = [];
      let i = 0;
      const dt = 1 / 60;
      for (let f = 0; f < 60 * 9 && g.state === 'playing'; f++) {
        while (i < T.length && g.t + dt >= T[i][0]) { g.press(T[i][1]); i++; }
        g.update(dt);
        g.render();
        if (f % 10 === 0) out.push([g.t.toFixed(5), g.y.toFixed(3), g.player.x.toFixed(4), g.player.dim, g.state].join(' '));
      }
      return { out, state: g.state, t: g.t, y: g.y, cap: g.gfx.cap, n: g.particles.count };
    }, [taps, noAnim]);
    await ctx.close();
    return r;
  }
  const hi = await trace('high', false);
  const lo = await trace('low', false);
  const na = await trace('medium', true);
  check('[8] Simulation identisch in Hoch und Niedrig (Zeit, Höhe, Position, Zustand)', JSON.stringify(hi.out) === JSON.stringify(lo.out) && hi.t === lo.t, `${hi.out.length} Proben · t ${hi.t.toFixed(3)} / ${lo.t.toFixed(3)}`);
  check('[4] Extreme Animationswerte (Squash, Bob, Neigung) ändern Kollision und Bahn nicht', JSON.stringify(hi.out) === JSON.stringify(na.out), `Endzustand ${hi.state} / ${na.state}`);
  check('[8] Steiggeschwindigkeit 260 u/s unabhängig von der Grafikstufe', Math.abs(hi.y / hi.t - 260) < 1 && Math.abs(lo.y / lo.t - 260) < 1, `${(hi.y / hi.t).toFixed(1)} / ${(lo.y / lo.t).toFixed(1)} u/s`);
}

// ---------------------------------------------------------------- 5. Tod und Respawn
{
  const { ctx, page } = await open('&gfx=high');
  await page.tap('#btn-start');
  const d = await page.evaluate(() => {
    const g = window.__RIFT;
    let guard = 0;
    while (g.state === 'playing' && guard++ < 3000) g.update(1 / 60);
    const n = g.particles.count;
    const alphas = [];
    for (let i = 0; i < 40; i++) { g.update(1 / 60); g.render(); alphas.push(g.anim.pose.alpha); }
    return { n, state: g.state, anim: g.anim.state, minAlpha: Math.min(...alphas), first: alphas[0] };
  });
  check('[5] Tod (Normalmodus): Zustand „death“, Figur löst sich auf (Alpha → 0), Splitter-Partikel', d.anim === 'death' && d.minAlpha === 0 && d.first > 0.5 && d.n >= 10, JSON.stringify(d));
  await ctx.close();
}
{
  const { ctx, page, errors } = await open('&gfx=high');
  await page.tap('#btn-practice');
  const r = await page.evaluate(() => {
    const g = window.__RIFT;
    const seen = [];
    const note = () => { const k = `${g.state}/${g.anim.state}`; if (seen[seen.length - 1] !== k) seen.push(k); };
    let guard = 0;
    while (g.state === 'playing' && guard++ < 3000) { g.update(1 / 60); note(); }
    const deathParticles = g.particles.count;
    const alphaDying = [];
    for (let i = 0; i < 400 && !(g.state === 'playing' && g.anim.state === 'idle'); i++) {
      if ((g.state === 'dead' || g.state === 'dying') && g.deathAge > 0.5) g.press(1);
      g.update(1 / 60);
      g.render();
      note();
      if (g.anim.state === 'death') alphaDying.push(g.anim.pose.alpha);
    }
    return { seen, deathParticles, minAlpha: Math.min(...alphaDying), state: g.state };
  });
  check('[5] Tod im Übungsmodus: „death“ mit Splitter-Partikeln vor dem schnellen Respawn', r.seen.some((s) => s.endsWith('/death')) && r.deathParticles >= 10, `${r.deathParticles} Partikel`);
  check('[5] Respawn (Übungsmodus): „respawn“-Aufbau, danach wieder „idle“', r.seen.some((s) => s.endsWith('/respawn')) && r.state === 'playing' && r.seen.at(-1) === 'playing/idle', r.seen.join(' → '));
  check('[5] Konsole fehlerfrei', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

// ---------------------------------------------------------------- 6. Partikel (fester Pool, Obergrenze je Stufe)
{
  const res = {};
  for (const q of ['high', 'medium', 'low']) {
    const { ctx, page } = await open(`&gfx=${q}`);
    await page.tap('#btn-start');
    res[q] = await page.evaluate(() => {
      const g = window.__RIFT;
      const pool = g.particles;
      const items = pool.items;
      const first = items[0];
      const len0 = items.length;
      g.press(-1);
      g.update(1 / 60);
      const afterSwitch = pool.count;
      for (let i = 0; i < 60; i++) { g.impulse(i % 2 ? 1 : -1); }
      const flood = pool.count;
      return { cap: pool.cap, afterSwitch, flood, same: pool.items === items && items.length === len0 && items[0] === first && len0 === pool.cap };
    });
    await ctx.close();
  }
  check('[6] Wechsel erzeugt Partikel (Funken, Ring) in jeder Stufe', res.high.afterSwitch > 10 && res.low.afterSwitch > 0 && res.high.afterSwitch > res.low.afterSwitch, `${res.high.afterSwitch} / ${res.medium.afterSwitch} / ${res.low.afterSwitch}`);
  check('[6] Pool-Obergrenze hält auch bei 60 Wechseln am Stück (320 / 200 / 96)', res.high.flood <= 320 && res.medium.flood <= 200 && res.low.flood <= 96 && res.high.cap === 320 && res.low.cap === 96, `${res.high.flood} / ${res.medium.flood} / ${res.low.flood}`);
  check('[6] Fester Pool: vorab angelegte Partikel werden wiederverwendet (keine neuen Objekte im Lauf)', res.high.same && res.medium.same && res.low.same);
}

// ---------------------------------------------------------------- 7. Niedrige Grafik senkt die Renderlast
{
  const t = {};
  for (const q of ['high', 'low']) {
    const { ctx, page } = await open(`&gfx=${q}`, 'Pixel 7');
    await page.tap('#btn-start');
    t[q] = await page.evaluate(() => {
      const g = window.__RIFT;
      for (let i = 0; i < 300; i++) g.update(1 / 60);
      const c = g.ctx;
      for (let i = 0; i < 10; i++) { g.render(); c.getImageData(0, 0, 1, 1); }
      const t0 = performance.now();
      for (let i = 0; i < 80; i++) { g.update(1 / 60); g.render(); c.getImageData(0, 0, 1, 1); }
      return { ms: (performance.now() - t0) / 80, px: g.canvas.width * g.canvas.height };
    });
    await ctx.close();
  }
  check('[7] Niedrig rendert deutlich schneller als Hoch (Frame inkl. Rasterung)', t.low.ms < t.high.ms * 0.6, `Hoch ${t.high.ms.toFixed(2)} ms · Niedrig ${t.low.ms.toFixed(2)} ms · Pixel ${t.high.px} / ${t.low.px}`);
}

// ---------------------------------------------------------------- 9. Lesbarkeit auf kleinen Displays
for (const [label, opts] of [['320 × 568', { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }], ['iPhone SE', {}]]) {
  const device = label === 'iPhone SE' ? 'iPhone SE' : 'iPhone 13';
  const { ctx, page, errors } = await open('&gfx=medium', device, opts);
  const menu = await page.evaluate(() => { const r = document.querySelector('#menu .panel').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, ih: innerHeight, iw: innerWidth }; });
  await page.tap('#btn-start');
  const m = await page.evaluate(() => {
    const g = window.__RIFT;
    for (let i = 0; i < 30; i++) g.update(1 / 60);
    const v = g.view;
    return { scale: v.scale, figure: 72 * 0.56 * v.scale, bar: 14 * v.scale, lane: 90 * v.scale, look: g.lookaheadSec };
  });
  check(`[9] ${label}: Menü passt vollständig`, menu.top >= 0 && menu.bottom <= menu.ih, JSON.stringify(menu));
  check(`[9] ${label}: Figur ≥ 26 CSS-px hoch, Hindernis ≥ 6 px dick, Spur ≥ 60 px breit`, m.figure >= 26 && m.bar >= 6 && m.lane >= 60, `Figur ${m.figure.toFixed(1)} px · Balken ${m.bar.toFixed(1)} px · Spur ${m.lane.toFixed(1)} px`);
  check(`[9] ${label}: Konsole fehlerfrei`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}

await browser.close();
console.log(`\n${total - failed}/${total} M5-Grafik-Checks bestanden`);
process.exit(failed ? 1 : 0);
