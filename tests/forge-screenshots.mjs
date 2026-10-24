// Erzeugt Desktop-Screenshots von LEVEL FORGE: Editor mit ausgewähltem Rift-Siegel, laufender Playtest, Prüfliste mit Fehler.
// Aufruf: SHOT_DIR=/pfad node tests/forge-screenshots.mjs   (lokaler Server auf BASE_URL, Standard http://localhost:8080/)
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const DIR = process.env.SHOT_DIR || '.';
const browser = await chromium.launch();

async function editor() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}assets/forge/`);
  await page.waitForFunction(() => document.body.dataset.ready === '1');
  await page.waitForTimeout(300);
  return { ctx, page };
}

async function show(page, y, select) {
  await page.evaluate(([yy, id]) => {
    const f = window.__FORGE;
    f.view.cam.x = 180;
    f.view.cam.z = f.view.fitZoom();
    f.view.cam.y = yy;
    if (id) f.actions.setSelection([id]);
    f.actions.requestRender();
    document.querySelector('#toast').classList.remove('show');
  }, [y, select]);
}

// Editor: RIFT FORGE TEST, Rift-Siegel ausgewählt (Griffe, Pulse-Reichweite, Eigenschaften), Mauszeiger über dem Feld
{
  const { ctx, page } = await editor();
  const seal = await page.evaluate(() => window.__FORGE.doc.objects.find((o) => o.type === 'seal' && o.y > 1500).id);
  const y = await page.evaluate((id) => window.__FORGE.doc.get(id).y, seal);
  await show(page, y + 60, seal);
  const r = await page.locator('#view').boundingBox();
  await page.mouse.move(r.x + r.width * 0.62, r.y + r.height * 0.3);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${DIR}/rift-climb-m4-editor.png` });
  await ctx.close();
}

// Playtest: echtes Spiel im Editor, aufgezeichneter Lauf bis kurz vor einem Siegel, dann angehalten
{
  const { ctx, page } = await editor();
  await page.evaluate(() => document.querySelector('#toast').classList.remove('show'));
  await page.click('#btn-playtest');
  await page.waitForFunction(() => { const f = document.querySelector('#pt-frame'); return f.contentWindow && f.contentWindow.__RIFT && f.contentWindow.__RIFT.state !== 'menu'; });
  const frame = page.frames().find((f) => f.url().includes('playtest=1'));
  await frame.evaluate(() => {
    const g = window.__RIFT;
    g.debug.manual = true;
    g.respawnTimer = 0;
    g.state = 'playing';
    const DT = 1 / 240;
    const taps = g.levelData.replay.taps;
    let i = 0;
    while (g.state === 'playing' && g.t < 7.1) {
      while (i < taps.length && taps[i].t <= g.t + DT / 2) g.press(taps[i++].dir);
      g.update(DT);
    }
    g.render();
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${DIR}/rift-climb-m4-playtest.png` });
  await ctx.close();
}

// Validierung: Hindernis ragt aus dem Feld (Fehler, rot markiert), Playtest/Export gesperrt
{
  const { ctx, page } = await editor();
  const id = await page.evaluate(() => {
    const f = window.__FORGE;
    const o = f.doc.objects.find((x) => x.type === 'obstacle' && x.y > 900 && x.y < 1600);
    const tx = f.doc.begin('Verschieben');
    tx.touch(o.id);
    o.x = 310;
    tx.commit();
    return o.id;
  });
  await page.waitForTimeout(500);
  const y = await page.evaluate((i) => window.__FORGE.doc.get(i).y, id);
  await show(page, y + 120, null);
  await page.locator('#check-list .issue.error').first().click();
  await page.mouse.move(5, 5);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${DIR}/rift-climb-m4-validation.png` });
  await ctx.close();
}

await browser.close();
console.log(`Screenshots in ${DIR}`);
