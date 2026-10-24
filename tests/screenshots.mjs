// Erzeugt Portrait-Screenshots (iPhone 13, WebKit): Menü, Gameplay mit Dimensionswechsel, Debug-Modus, Todesscreen.
// Aufruf: SHOT_DIR=/pfad node tests/screenshots.mjs   (lokaler Server auf BASE_URL, Standard http://localhost:8080/)
import { webkit, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const DIR = process.env.SHOT_DIR || '.';
const browser = await webkit.launch();

async function at(query, beat, extra) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}?manual=1&autoplay=1${query}`);
  await page.waitForFunction(() => window.__RIFT);
  await page.tap('#btn-start');
  await page.evaluate((b) => {
    const g = window.__RIFT;
    while (g.state === 'playing' && g.beat < b) g.update(1 / 120);
  }, beat);
  if (extra) await page.evaluate(extra);
  await page.waitForTimeout(150);
  return { ctx, page };
}

// Menü
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForFunction(() => window.__RIFT);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/rift-climb-m2-menu.png` });
  await ctx.close();
}

// Gameplay kurz nach einem Dimensionswechsel im Abschnitt C (Ring, Partikel, Farbimpuls sichtbar)
{
  const sol = await (async () => {
    const { ctx, page } = await at('', 0);
    const r = await page.evaluate(() => {
      const g = window.__RIFT;
      const q = g.autoplayQueue.find((e) => e.t / 0.5 > 64.5);
      return q.t / 0.5;
    });
    await ctx.close();
    return r;
  })();
  const { ctx, page } = await at('', sol + 0.12);
  await page.evaluate(() => window.__RIFT.render());
  await page.screenshot({ path: `${DIR}/rift-climb-m2-gameplay.png` });
  await ctx.close();
}

// Debug-Modus mit Hitboxen und Bewegungsdaten
{
  const { ctx, page } = await at('&debug=1', 47.3);
  await page.evaluate(() => window.__RIFT.render());
  await page.screenshot({ path: `${DIR}/rift-climb-m2-debug.png` });
  await ctx.close();
}

// Todesscreen mit Todesgrund (Tod durch erzwungenen Fehl-Tipp)
{
  const { ctx, page } = await at('', 21.2, () => {
    const g = window.__RIFT;
    g.autoplayQueue.length = 0;
    g.debug.autoplay = false;
    g.impulse(-1);
    while (g.state === 'playing' || g.state === 'dying') g.update(1 / 120);
    g.update(0.1);
    g.render();
  });
  await page.screenshot({ path: `${DIR}/rift-climb-m2-death.png` });
  await ctx.close();
}

await browser.close();
console.log(`Screenshots in ${DIR}`);
