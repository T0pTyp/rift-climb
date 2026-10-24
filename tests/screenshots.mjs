// Erzeugt Portrait-Screenshots (iPhone 13, WebKit): Menü, Rift Pulse öffnet ein Siegel, Annäherung (Reichweite),
// Debug-Modus mit Pulse-Radius/Siegel-Hitboxen/Restzeit, Todesscreen an einem geschlossenen Siegel.
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
    while (g.state === 'playing' && g.beat < b) g.update(1 / 240);
  }, beat);
  if (extra) await page.evaluate(extra);
  await page.evaluate(() => window.__RIFT.render());
  await page.waitForTimeout(100);
  return { ctx, page };
}

// Menü
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.waitForFunction(() => window.__RIFT);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/rift-climb-m3-menu.png` });
  await ctx.close();
}

// Rift Pulse öffnet ein Siegel (Diagonale in Abschnitt C, Siegel bei Beat 61): Welle, Öffnungsblitz, Partikel
{
  const { ctx, page } = await at('', 61 - 0.5 + 0.2);
  await page.screenshot({ path: `${DIR}/rift-climb-m3-pulse.png` });
  await ctx.close();
}

// Annäherung: Siegel leuchtet, Reichweitenkreis sichtbar (Abschnitt A, kurz vor dem ersten Siegel)
{
  const { ctx, page } = await at('', 20 - 0.62);
  await page.screenshot({ path: `${DIR}/rift-climb-m3-reach.png` });
  await ctx.close();
}

// Debug: Pulse-Radius, Siegel-Hitboxen, Öffnungsstatus und Restzeit
{
  const { ctx, page } = await at('&debug=1', 60.78);
  await page.screenshot({ path: `${DIR}/rift-climb-m3-debug.png` });
  await ctx.close();
}

// Todesscreen: kein Tipp vor dem ersten Siegel
{
  const { ctx, page } = await at('', 18.5, () => {
    const g = window.__RIFT;
    g.autoplayQueue.length = 0;
    g.debug.autoplay = false;
    while (g.state === 'playing' || g.state === 'dying') g.update(1 / 120);
    g.update(0.1);
  });
  await page.screenshot({ path: `${DIR}/rift-climb-m3-death.png` });
  await ctx.close();
}

await browser.close();
console.log(`Screenshots in ${DIR}`);
