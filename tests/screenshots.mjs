// Erzeugt Screenshots (Hauptmenü + Gameplay im Portrait-Viewport, iPhone-13-Emulation).
import { webkit, devices } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const OUT = process.env.SHOT_DIR || '.';

const browser = await webkit.launch();
const page = await (await browser.newContext({ ...devices['iPhone 13'] })).newPage();
await page.goto(BASE + '?autoplay=1&speed=2');
await page.waitForFunction(() => window.__RIFT && document.querySelector('#menu:not([hidden])'));
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/rift-climb-menu-portrait.png` });
await page.tap('#btn-start');
await page.waitForFunction(() => window.__RIFT.t > 47.2, null, { timeout: 30000 });
await page.screenshot({ path: `${OUT}/rift-climb-gameplay-portrait.png` });
await browser.close();
