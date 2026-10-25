// Erzeugt die M5-Bilder: Riftling-Figurenblatt (beide Dimensionen + Animationsposen), Gameplay im Hochformat,
// mobiler LEVEL FORGE (390 × 844) mit geöffnetem Eigenschaften-Sheet und Kontextmenü.
// Aufruf: SHOT_DIR=/pfad node tests/m5-screenshots.mjs   (lokaler Server auf BASE_URL, Standard http://localhost:8080/)
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const DIR = process.env.SHOT_DIR || '.';
const browser = await chromium.launch();

// ---------------------------------------------------------------- Figurenblatt
{
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.evaluate(async () => {
    const { drawRiftling, riftlingArt, IDLE_POSE } = await import('/js/art/riftling.js');
    await riftlingArt.load();
    document.body.innerHTML = '';
    document.body.style.cssText = 'margin:0;background:#04040c';
    const c = document.createElement('canvas');
    c.width = 1600;
    c.height = 900;
    document.body.append(c);
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 900);
    bg.addColorStop(0, '#0b0b24');
    bg.addColorStop(1, '#04040c');
    g.fillStyle = bg;
    g.fillRect(0, 0, 1600, 900);
    const halo = (x, col) => {
      const r = g.createRadialGradient(x, 330, 10, x, 330, 300);
      r.addColorStop(0, col);
      r.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = r;
      g.fillRect(x - 320, 20, 640, 620);
    };
    halo(470, 'rgba(47,214,255,0.16)');
    halo(1130, 'rgba(255,45,138,0.16)');
    const big = 11;
    const draw = (x, y, pose, ppu) => {
      g.setTransform(ppu, 0, 0, ppu, x, y);
      drawRiftling(g, 0, 0, { ...IDLE_POSE, ...pose }, ppu, 2);
      g.setTransform(1, 0, 0, 1, 0, 0);
    };
    draw(470, 330, { blend: 0 }, big);
    draw(1130, 330, { blend: 1 }, big);
    g.font = '900 34px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = '#2fd6ff';
    g.fillText('BLAUE DIMENSION', 470, 610);
    g.fillStyle = '#ff2d8a';
    g.fillText('ROTE DIMENSION', 1130, 610);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = '900 46px system-ui, sans-serif';
    g.fillText('RIFTLING', 800, 70);
    g.font = '600 18px system-ui, sans-serif';
    g.fillStyle = 'rgba(232,236,255,0.6)';
    g.fillText('Echte SVG-Ebenen (Körper Blau, Körper Rot, Auge) · im Spiel einmal je Zoomstufe gerastert', 800, 102);
    const poses = [
      ['IDLE', { blend: 0 }],
      ['FLIGHT', { blend: 0, tilt: 0.32, sx: 0.93, sy: 1.13 }],
      ['SWITCH', { blend: 0.5, sx: 1.2, sy: 0.83, flash: 0.45, glow: 1.8 }],
      ['FLIGHT', { blend: 1, tilt: -0.32, sx: 0.93, sy: 1.13 }],
      ['DEATH', { blend: 1, sx: 1.3, sy: 1.3, alpha: 0.45, eye: 0, glow: 0.6 }],
      ['RESPAWN', { blend: 0, sx: 0.7, sy: 0.7, flash: 0.6, alpha: 0.7, glow: 1.6 }],
    ];
    g.font = '800 15px system-ui, sans-serif';
    poses.forEach(([label, pose], i) => {
      const x = 230 + i * 228;
      draw(x, 740, pose, 3.6);
      g.fillStyle = 'rgba(232,236,255,0.75)';
      g.fillText(label, x, 850);
    });
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${DIR}/rift-climb-m5-riftling.png` });
  await ctx.close();
}

// ---------------------------------------------------------------- Gameplay im Hochformat (iPhone 13, Grafik Hoch)
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?manual=1&autoplay=1`);
  await page.waitForFunction(() => window.__RIFT && window.__RIFT.art.ready);
  await page.tap('#btn-start');
  await page.evaluate(() => {
    const g = window.__RIFT;
    while (g.t < 8.72 && g.state === 'playing') g.update(1 / 60);
    g.render();
  });
  await page.screenshot({ path: `${DIR}/rift-climb-m5-gameplay.png` });
  await ctx.close();
}

// ---------------------------------------------------------------- Mobiler LEVEL FORGE (390 × 844, Bottom Sheet)
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}assets/forge/`);
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  await page.waitForTimeout(300);
  const prep = async (selectType, y) => page.evaluate(([type, yy]) => {
    const f = window.__FORGE;
    const o = f.doc.objects.find((x) => x.type === type);
    f.view.cam.x = 180;
    f.view.cam.z = f.view.fitZoom();
    f.view.cam.y = yy;
    f.view.touch = true;
    if (o) f.actions.setSelection([o.id]);
    f.actions.requestRender();
    document.querySelector('#toast').classList.remove('show');
    return o && o.id;
  }, [selectType, y]);
  const seal = await prep('seal', 0);
  const sealY = await page.evaluate((id) => window.__FORGE.doc.get(id).y, seal);
  await prep('seal', sealY - 120);
  await page.tap('#dk-props');
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#toast').classList.remove('show'));
  await page.screenshot({ path: `${DIR}/rift-climb-m5-forge-mobile.png` });
  await page.tap('#sheet-close');
  await page.evaluate(() => document.querySelector('.toolbar').scrollTo({ left: 160 }));
  const pt = await page.evaluate((id) => { const f = window.__FORGE; const o = f.doc.get(id); const r = f.view.canvas.getBoundingClientRect(); const s = f.view.toScreen(o.x + o.w / 2, o.y); return { x: r.left + s.x, y: r.top + s.y }; }, seal);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pt.x, y: pt.y, id: 0 }] });
  await page.waitForTimeout(650);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('#toast').classList.remove('show'));
  await page.screenshot({ path: `${DIR}/rift-climb-m5-forge-mobile-context.png` });
  await ctx.close();
}

await browser.close();
console.log(`Screenshots in ${DIR}`);
