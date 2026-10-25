// Performance-Messung im echten requestAnimationFrame-Loop über das ganze Level (Overload ~67 s):
// JS-Zeit pro Frame (update + render) und Frame-Intervalle. Chromium, Pixel-7-Emulation, standardmäßig 4× CPU-Drosselung.
// Aufruf: node tests/perf.mjs   (Headless ohne GPU: Werte sind ein grober Anhaltspunkt, kein Geräte-Ersatz)
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'] });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.THROTTLE || 4) });
const level = process.env.LEVEL || 'overload';
await page.goto(`${BASE}?level=${level}&autoplay=1`);
await page.waitForFunction(() => window.__RIFT);
await page.evaluate(() => {
  const g = window.__RIFT;
  const m = (window.__PERF = { js: [], gaps: [], drift: [], sourcesMax: 0, last: 0, heap0: performance.memory ? performance.memory.usedJSHeapSize : 0 });
  const render = g.render.bind(g);
  g.render = () => {
    const t0 = performance.now();
    render();
    if (g.state === 'playing') {
      m.sourcesMax = Math.max(m.sourcesMax, g.audio.voices?.size || 0);
      if (g.t > 1) m.drift.push(Math.abs(g.audio.metrics?.drift || 0));
      m.js.push(performance.now() - t0 + (m.updMs || 0));
      if (m.last) m.gaps.push(t0 - m.last);
      m.last = t0;
    }
    m.updMs = 0;
  };
  const update = g.update.bind(g);
  g.update = (dt) => { const t0 = performance.now(); update(dt); m.updMs = (m.updMs || 0) + performance.now() - t0; };
});
await page.tap('#btn-start');
await page.waitForFunction(() => window.__RIFT.state === 'won', null, { timeout: 120000 });
const r = await page.evaluate(() => {
  const m = window.__PERF;
  const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const heap1 = performance.memory ? performance.memory.usedJSHeapSize : 0;
  return {
    audio: window.__RIFT.audio.status(), sourcesMax: m.sourcesMax, driftP95: q(m.drift, .95),
    frames: m.js.length, jsAvg: avg(m.js), jsP95: q(m.js, 0.95), jsP99: q(m.js, 0.99),
    fps: 1000 / avg(m.gaps), gapP95: q(m.gaps, 0.95), longFrames: m.gaps.filter((g) => g > 25).length,
    heapKB: (heap1 - m.heap0) / 1024,
  };
});
console.log(`Level: ${level}, feste hochwertige Darstellung`);
console.log(`Frames ${r.frames}, Ø-FPS ${r.fps.toFixed(1)}, Frame-Intervall p95 ${r.gapP95.toFixed(1)} ms, Frames > 25 ms: ${r.longFrames}`);
console.log(`JS pro Frame (update+render): Ø ${r.jsAvg.toFixed(2)} ms, p95 ${r.jsP95.toFixed(2)} ms, p99 ${r.jsP99.toFixed(2)} ms; Heap-Δ ${r.heapKB.toFixed(0)} KB`);
mkdirSync('test-results/m7', { recursive: true });
writeFileSync('test-results/m7/performance.json', JSON.stringify(r, null, 2));
console.log(`Audio drift p95 ${(r.driftP95 * 1000).toFixed(2)} ms; peak live sources ${r.sourcesMax}; resyncs ${r.audio.resyncs}`);
await browser.close();
process.exit(r.jsP95 < 8 ? 0 : 1);
