// LEVEL FORGE: End-to-End-Tests der QS-Liste (Spezifikation M4, Abschnitt 17) mit echten Maus- und Tastatureingaben.
// Voraussetzung: lokaler Server auf BASE_URL (Standard http://localhost:8080/) und `npm i -D playwright`.
// Aufruf: node tests/forge-e2e.mjs   (Punkt 22, mobiles Gameplay, zusätzlich ausführlich in tests/e2e.mjs;
// mobiler Touch-Editor: tests/forge-mobile-e2e.mjs)
import { chromium, devices } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:8080/';
const FORGE = BASE + 'assets/forge/';
let failed = 0;
let total = 0;
function check(name, cond, detail = '') {
  total++;
  if (!cond) failed++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  – ' + detail : ''}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const F = (fn, arg) => page.evaluate(fn, arg);
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

async function ready() {
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15000 });
  await page.waitForTimeout(100);
}

/** Weltkoordinate -> Seitenkoordinate (für echte Mausaktionen). */
async function at(wx, wy) {
  return F(([x, y]) => {
    const f = window.__FORGE;
    const r = f.view.canvas.getBoundingClientRect();
    const s = f.view.toScreen(x, y);
    return { x: r.left + s.x, y: r.top + s.y };
  }, [wx, wy]);
}

async function centerCamera(y) {
  await F((yy) => { const f = window.__FORGE; f.view.cam.y = yy; f.view.cam.x = 180; f.view.cam.z = f.view.fitZoom(); f.actions.requestRender(); }, y);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(50);
}

async function clickWorld(wx, wy, opts = {}) {
  const p = await at(wx, wy);
  for (const m of opts.modifiers || []) await page.keyboard.down(m);
  await page.mouse.click(p.x, p.y);
  for (const m of opts.modifiers || []) await page.keyboard.up(m);
  await page.waitForTimeout(30);
}

async function deselect() {
  await page.keyboard.press('Escape');
  const r = await page.locator('#view').boundingBox();
  await page.mouse.click(r.x + 6, r.y + r.height / 2);
  await page.waitForTimeout(30);
}

async function dragWorld(a, b, steps = 8) {
  const p = await at(a[0], a[1]);
  const q = await at(b[0], b[1]);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps });
  await page.mouse.up();
  await page.waitForTimeout(30);
}

const docState = () => F(() => {
  const f = window.__FORGE;
  return { name: f.doc.level.name, id: f.doc.level.id, n: f.doc.objects.length, sel: [...f.S.selection], undo: f.doc.undoStack.length, json: JSON.stringify(f.doc.level) };
});
const obj = (id) => F((i) => { const o = window.__FORGE.doc.get(i); return o && JSON.parse(JSON.stringify(o)); }, id);

// ---------------------------------------------------------------- 1. Editor öffnen
await page.goto(FORGE);
await ready();
{
  const s = await F(() => ({
    title: document.title,
    tools: document.querySelectorAll('.tool[data-tool]').length,
    palette: [...document.querySelectorAll('.pal')].map((b) => b.dataset.kind),
    spikes: document.querySelector('.pal[data-kind="spikes"]').classList.contains('unavailable'),
    name: window.__FORGE.doc.level.name,
    check: document.querySelector('#check-summary').textContent,
  }));
  check('[1] Editor öffnet ohne Fehler (Werkzeuge, Palette, Eigenschaften, Prüfung)', /LEVEL FORGE/.test(s.title) && s.tools === 6 && s.palette.length === 10 && errors.length === 0, `${s.name}: ${s.check}`);
  check('[1] Stacheln in der Palette als „nicht verfügbar“ gekennzeichnet (keine erfundene Mechanik)', s.spikes);
  const sp = await page.locator('.pal[data-kind="spikes"]').boundingBox();
  await page.mouse.click(sp.x + sp.width / 2, sp.y + sp.height / 2);
  await page.waitForTimeout(50);
  const t = await F(() => [window.__FORGE.S.tool, document.querySelector('#toast').textContent]);
  check('[1] Klick auf Stacheln setzt nichts und erklärt warum', t[0] === 'select' && /gibt es im Spiel nicht/.test(t[1]));
}

// ---------------------------------------------------------------- 2. Neues Level
await page.click('#btn-new');
await page.waitForTimeout(150);
{
  const s = await docState();
  const c = await F(() => document.querySelector('#check-summary').textContent);
  check('[2] Neues Level: leer, gültig, Start und Ziel vorhanden', s.n === 0 && s.name === 'Neues Level' && /^level-/.test(s.id) && /^0 Fehler/.test(c), c);
}

// ---------------------------------------------------------------- 3. Hindernis platzieren (Palette -> Klick, Vorschau)
await centerCamera(600);
await page.click('.pal[data-kind="blue"]');
{
  const p = await at(140, 515);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(50);
  const ghost = await F(() => window.__FORGE.S.ghost);
  check('[3] Vorschau am Mauszeiger (gesnappt auf Spur und Beat)', ghost && ghost.x === 93 && ghost.y === 520, JSON.stringify(ghost && { x: ghost.x, y: ghost.y }));
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(50);
  const s = await docState();
  const o = await obj(s.sel[0]);
  check('[3] Blaues Hindernis platziert und ausgewählt', s.n === 1 && o && o.type === 'obstacle' && o.dimension === 'blue' && o.x === 93 && o.y === 520 && o.w === 84 && o.h === 14, JSON.stringify(o));
  // Drag-and-drop direkt aus der Palette
  const pal = await page.locator('.pal[data-kind="neutral"]').boundingBox();
  const q = await at(320, 905);
  await page.keyboard.press('Escape');
  await page.mouse.move(pal.x + 20, pal.y + 10);
  await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(50);
  const s2 = await docState();
  const o2 = await obj(s2.sel[0]);
  check('[3] Drag-and-drop aus der Palette ins Feld', s2.n === 2 && o2 && o2.dimension === 'both' && o2.x === 273 && o2.y === 910, JSON.stringify(o2 && { x: o2.x, y: o2.y }));
}

// ---------------------------------------------------------------- 4. Objekt auswählen
await page.keyboard.press('v');
const blueId = (await F(() => window.__FORGE.doc.objects.find((o) => o.dimension === 'blue').id));
const neutralId = (await F(() => window.__FORGE.doc.objects.find((o) => o.dimension === 'both').id));
await clickWorld(20, 700);
{
  const s = await docState();
  const title = await F(() => document.querySelector('#props-body .panel-title').textContent);
  check('[4] Klick ins Leere hebt die Auswahl auf (Level-Einstellungen sichtbar)', s.sel.length === 0 && title === 'Level', title);
  await clickWorld(135, 520);
  const s2 = await docState();
  const t2 = await F(() => document.querySelector('#props-body .panel-title').textContent);
  check('[4] Klick wählt das Objekt, Eigenschaften zeigen „Hindernis“', s2.sel.length === 1 && s2.sel[0] === blueId && t2 === 'Hindernis');
}

// ---------------------------------------------------------------- 5. Verschieben (ein Drag = ein Undo-Schritt)
{
  const before = (await docState()).undo;
  await dragWorld([135, 520], [225, 650], 12);
  const o = await obj(blueId);
  const s = await docState();
  const label = await F(() => window.__FORGE.doc.undoStack.at(-1).label);
  check('[5] Ziehen verschiebt mit Snap (eine Spur rechts, ein Beat höher)', o.x === 183 && o.y === 650, `x ${o.x} y ${o.y}`);
  check('[13] Ein Drag über viele Mausbewegungen = genau ein Undo-Schritt', s.undo === before + 1 && label === 'Verschieben', label);
}

// ---------------------------------------------------------------- 6. Eigenschaften ändern
{
  await page.fill('#props-body input[data-key="w"]', '174');
  await page.locator('#props-body input[data-key="w"]').press('Enter');
  await page.selectOption('#props-body select[data-key="dimension"]', 'red');
  await page.waitForTimeout(50);
  let o = await obj(blueId);
  check('[6] Breite und Dimension über die Eigenschaftenleiste geändert (sofort wirksam)', o.w === 174 && o.dimension === 'red', JSON.stringify(o));
  await page.fill('#props-body input[data-key="x"]', '9999');
  const invalid = await F(() => document.querySelector('#props-body input[data-key="x"]').classList.contains('invalid'));
  await page.locator('#props-body input[data-key="x"]').press('Tab');
  o = await obj(blueId);
  check('[6] Ungültiger Wert wird markiert und nicht übernommen', invalid && o.x === 183);
  // Eingabefelder: Shortcuts lösen nicht aus
  await page.click('#props-body input[data-key="h"]');
  const n0 = (await docState()).n;
  await page.keyboard.press(`${mod}+d`);
  await page.keyboard.press('Delete');
  await page.keyboard.press('x');
  const s = await docState();
  const tool = await F(() => window.__FORGE.S.tool);
  check('[5] Shortcuts (Strg+D, Entf, Werkzeugtasten) lösen in Eingabefeldern nicht aus', s.n === n0 && tool === 'select' && s.sel[0] === blueId);
  await page.locator('#props-body input[data-key="h"]').press('Escape');
  await page.click('#view', { position: { x: 5, y: 300 } });
}

// ---------------------------------------------------------------- 7. Mehrfachauswahl (Rahmen + Shift-Klick)
{
  const a = await at(-40, 980);
  const b = await at(400, 480);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await page.mouse.up();
  let s = await docState();
  check('[7] Rahmenauswahl wählt beide Objekte', s.sel.length === 2, s.sel.join(','));
  await clickWorld(315, 910, { modifiers: ['Shift'] });
  s = await docState();
  check('[7] Shift-Klick entfernt ein Objekt aus der Auswahl', s.sel.length === 1 && s.sel[0] === blueId);
  await clickWorld(315, 910, { modifiers: ['Shift'] });
  s = await docState();
  const undo0 = s.undo;
  await dragWorld([270, 650], [270, 780]);
  const o1 = await obj(blueId);
  const o2 = await obj(neutralId);
  s = await docState();
  check('[7] Mehrfachauswahl gemeinsam verschieben (ein Undo-Schritt)', s.sel.length === 2 && o1.y === 780 && o2.y === 1040 && s.undo === undo0 + 1, `${o1.y}/${o2.y}`);
}

// ---------------------------------------------------------------- 8. Duplizieren, Kopieren/Einfügen
{
  await page.keyboard.press(`${mod}+d`);
  const s = await docState();
  const ys = await F(() => [...window.__FORGE.S.selection].map((id) => window.__FORGE.doc.get(id).y).sort((a, b) => a - b));
  check('[8] Strg/Cmd+D dupliziert die Auswahl einen Beat höher mit neuen IDs', s.n === 4 && s.sel.length === 2 && !s.sel.includes(blueId) && ys[0] === 910 && ys[1] === 1170, ys.join(','));
  await page.keyboard.press(`${mod}+c`);
  await centerCamera(1300);
  const p = await at(200, 1560);
  await page.mouse.move(p.x, p.y);
  await page.keyboard.press(`${mod}+v`);
  const s2 = await docState();
  const ys2 = await F(() => [...window.__FORGE.S.selection].map((id) => window.__FORGE.doc.get(id).y).sort((a, b) => a - b));
  check('[8] Strg/Cmd+C / Strg/Cmd+V fügt an der Mausposition ein', s2.n === 6 && ys2[0] === 1560, ys2.join(','));
}

// ---------------------------------------------------------------- 9. Löschen
{
  await page.keyboard.press('Delete');
  const s = await docState();
  check('[9] Entf löscht die Auswahl', s.n === 4 && s.sel.length === 0);
  await page.keyboard.press('x');
  const id = await F(() => window.__FORGE.doc.objects.at(-1).id);
  const o = await obj(id);
  await centerCamera(o.y);
  await clickWorld(o.x + o.w / 2, o.y);
  const s2 = await docState();
  check('[9] Löschwerkzeug entfernt das angeklickte Objekt', s2.n === 3 && !(await obj(id)));
  await page.keyboard.press('v');
}

// ---------------------------------------------------------------- 10. Undo / Redo
{
  const n0 = (await docState()).n;
  await page.keyboard.press(`${mod}+z`);
  const n1 = (await docState()).n;
  await page.keyboard.press(`${mod}+z`);
  const n2 = (await docState()).n;
  await page.keyboard.press(`${mod}+y`);
  const n3 = (await docState()).n;
  await page.keyboard.press(`${mod}+Shift+z`);
  const n4 = (await docState()).n;
  check('[10] Undo stellt Löschen wieder her, Redo (Strg+Y / Strg+Shift+Z) wiederholt', n1 === n0 + 1 && n2 === n0 + 3 && n3 === n0 + 1 && n4 === n0, `${n0} ${n1} ${n2} ${n3} ${n4}`);
  for (let i = 0; i < 40; i++) await page.keyboard.press(`${mod}+z`);
  const empty = await docState();
  for (let i = 0; i < 40; i++) await page.keyboard.press(`${mod}+y`);
  const full = await docState();
  check('[10] Komplette History rückwärts (leeres Level) und vorwärts', empty.n === 0 && full.n === n0 && !(await F(() => window.__FORGE.doc.canRedo)), `${empty.n} -> ${full.n}`);
  await page.click('#btn-undo');
  const b1 = (await docState()).n;
  await page.click('#btn-redo');
  const b2 = (await docState()).n;
  check('[10] Undo-/Redo-Buttons funktionieren', b1 === n0 + 1 && b2 === n0);
}

// ---------------------------------------------------------------- 11. Raster / Snap
{
  await page.click('#btn-grid-settings');
  await page.selectOption('#snap-x', 'off');
  await page.selectOption('#snap-y', 'off');
  await page.click('#btn-grid-settings');
  await page.click('.pal[data-kind="red"]');
  await clickWorld(151.3, 1333.7);
  let o = await obj((await docState()).sel[0]);
  check('[11] Snap aus: pixelgenaue Platzierung (0,5 u)', o.x === 109.5 && o.y === 1333.5, `x ${o.x} y ${o.y}`);
  await page.click('#btn-grid-settings');
  await page.selectOption('#snap-x', 'grid');
  await page.selectOption('#snap-y', 'grid');
  await page.selectOption('#grid-size', '30');
  await page.click('#btn-grid-settings');
  await clickWorld(151.3, 1333.7);
  o = await obj((await docState()).sel[0]);
  check('[11] Raster 30 u: Position auf Rastervielfache', o.x === 120 && o.y === 1320, `x ${o.x} y ${o.y}`);
  await page.keyboard.press('Escape');
  await page.keyboard.press('g');
  const off = await F(() => window.__FORGE.S.grid.enabled);
  await page.click('.pal[data-kind="red"]');
  await clickWorld(151.3, 1450.2);
  o = await obj((await docState()).sel[0]);
  await page.keyboard.press('Escape');
  await page.click('#btn-grid-toggle');
  const on = await F(() => window.__FORGE.S.grid.enabled);
  check('[11] G / Raster-Button schaltet Snap aus und wieder an', !off && on && o.x === 109.5 && o.y === 1450, `x ${o.x} y ${o.y}`);
  await page.click('#btn-grid-settings');
  await page.selectOption('#snap-x', 'lane');
  await page.selectOption('#snap-y', 'beat');
  await page.selectOption('#grid-size', '10');
  await page.click('#btn-grid-settings');
  // BPM ändert das Beat-Raster (Steiggeschwindigkeit bleibt): 150 BPM -> 104 u pro Beat
  await deselect();
  await page.fill('#props-body input[data-key="bpm"]', '150');
  await page.locator('#props-body input[data-key="bpm"]').press('Enter');
  await centerCamera(1600);
  await page.click('.pal[data-kind="neutral"]');
  await clickWorld(45, 1660);
  o = await obj((await docState()).sel[0]);
  check('[8/11] BPM 150: Beat-Snap nutzt 104 u (= 0,4 s bei 260 u/s)', o.y === 1664 && o.x === 3, `y ${o.y}`);
  await page.keyboard.press('Escape');
  await deselect();
  await page.fill('#props-body input[data-key="bpm"]', '120');
  await page.locator('#props-body input[data-key="bpm"]').press('Enter');
}

// ---------------------------------------------------------------- 12. Zoom / Scroll
{
  await centerCamera(800);
  const p = await at(100, 900);
  await page.mouse.move(p.x, p.y);
  const z0 = await F(() => window.__FORGE.view.cam.z);
  await page.keyboard.down(mod);
  await page.mouse.wheel(0, -400);
  await page.keyboard.up(mod);
  await page.waitForTimeout(50);
  const z1 = await F(() => window.__FORGE.view.cam.z);
  const w = await F(([x, y]) => { const f = window.__FORGE; const r = f.view.canvas.getBoundingClientRect(); return f.view.toWorld(x - r.left, y - r.top); }, [p.x, p.y]);
  check('[12] Strg+Mausrad zoomt um den Mauszeiger (Weltpunkt bleibt stehen)', z1 > z0 * 1.5 && Math.abs(w.x - 100) < 0.5 && Math.abs(w.y - 900) < 0.5, `z ${z0.toFixed(2)} -> ${z1.toFixed(2)}`);
  const y0 = await F(() => window.__FORGE.view.cam.y);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(50);
  const y1 = await F(() => window.__FORGE.view.cam.y);
  check('[12] Mausrad scrollt vertikal', y1 > y0 + 50, `${y0.toFixed(0)} -> ${y1.toFixed(0)}`);
  const before = await docState();
  await deselect();
  await page.keyboard.down(' ');
  const c = await at(180, y1);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 40, c.y + 120, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up(' ');
  const y2 = await F(() => window.__FORGE.view.cam.y);
  check('[12] Leertaste + Ziehen verschiebt die Kamera, keine Objekte', y2 > y1 + 20 && (await docState()).json === before.json);
  await page.click('#btn-zoom-reset');
  await page.waitForTimeout(50);
  const z2 = await F(() => [window.__FORGE.view.cam.z, window.__FORGE.view.fitZoom(), document.querySelector('#zoom-label').textContent]);
  check('[12] Zoom zurücksetzen passt die Spielfeldbreite ein', Math.abs(z2[0] - z2[1]) < 1e-9 && z2[2] === '100%', z2.join(' '));
  const stats = await F(() => [window.__FORGE.S.stats.drawn, window.__FORGE.doc.objects.length]);
  check('[16] Nur sichtbare Objekte werden gezeichnet', stats[0] <= stats[1]);
}

// ---------------------------------------------------------------- 13. Dimensionen umschalten
{
  const red = await obj(blueId);
  await centerCamera(red.y);
  const px = async () => {
    await page.waitForTimeout(60);
    const p = await at(red.x + red.w / 2, red.y);
    return F(([x, y]) => {
      const c = document.querySelector('#view');
      const r = c.getBoundingClientRect();
      const k = c.width / r.width;
      const d = c.getContext('2d').getImageData(Math.round((x - r.left) * k), Math.round((y - r.top) * k), 1, 1).data;
      return [d[0], d[1], d[2]];
    }, [p.x, p.y]);
  };
  const json0 = (await docState()).json;
  const both = await px();
  await page.click('.seg [data-dim="B"]');
  const blue = await px();
  await page.click('.seg [data-dim="R"]');
  const redv = await px();
  await page.keyboard.press('1');
  const mode = await F(() => window.__FORGE.S.dimMode);
  const json1 = (await docState()).json;
  check('[13] Blau-Ansicht: rotes Hindernis wird zum transparenten Geist', blue[0] < both[0] * 0.5, `beide ${both} · blau ${blue}`);
  check('[13] Rot-Ansicht: rotes Hindernis massiv hervorgehoben', redv[0] > 150 && redv[0] > blue[0] * 2, `rot ${redv}`);
  check('[13] Umschalten verändert keine gespeicherten Daten', json0 === json1 && mode === 'both');
}

// ---------------------------------------------------------------- 14. Rift-Siegel platzieren und bearbeiten
{
  await centerCamera(2000);
  await page.click('.pal[data-kind="seal"]');
  await clickWorld(180, 2080);
  await page.keyboard.press('Escape');
  const id = (await docState()).sel[0];
  let o = await obj(id);
  check('[14] Rift-Siegel platziert (Standard-Öffnungsdauer 0,5 s)', o.type === 'seal' && o.openSec === 0.5 && o.y === 2080, JSON.stringify(o));
  await page.fill('#props-body input[data-key="openSec"]', '0.8');
  await page.locator('#props-body input[data-key="openSec"]').press('Enter');
  await page.fill('#props-body input[data-key="w"]', '174');
  await page.locator('#props-body input[data-key="w"]').press('Enter');
  await page.fill('#props-body input[data-key="openSec"]', '3');
  const inv = await F(() => document.querySelector('#props-body input[data-key="openSec"]').classList.contains('invalid'));
  await page.locator('#props-body input[data-key="openSec"]').press('Tab');
  o = await obj(id);
  check('[14] Öffnungsdauer und Größe geändert, ungültige Dauer (3 s) abgelehnt', o.openSec === 0.8 && o.w === 174 && inv);
  const info = await F(() => document.querySelector('#props-body').textContent);
  check('[14] Eigenschaften zeigen Pulse-Radius, Pulse-Reaktion und Kollisionsverhalten', /120 u/.test(info) && /Welle/.test(info) && /tödlich in beiden Dimensionen/.test(info));
  await page.selectOption('#props-body select[data-key="preview"]', 'open');
  const prev = await F((i) => [window.__FORGE.S.sealOpen.has(i), JSON.stringify(window.__FORGE.doc.get(i))], id);
  check('[14] Vorschau geöffnet/geschlossen nur im Editor (nicht im Level gespeichert)', prev[0] && !/preview|open"/.test(prev[1]));
  await page.selectOption('#props-body select[data-key="preview"]', 'closed');
  await page.selectOption('#props-body select[data-key="type"]', 'obstacle');
  o = await obj(id);
  const ok1 = o.type === 'obstacle' && o.dimension === 'both' && o.openSec === undefined;
  await page.keyboard.press(`${mod}+z`);
  o = await obj(id);
  check('[14] Typwechsel Siegel ↔ Hindernis (rückgängig machbar)', ok1 && o.type === 'seal' && o.openSec === 0.8);
}

// ---------------------------------------------------------------- 18. Validierung
{
  await deselect();
  await page.fill('#props-body input[data-key="name"]', 'QA Level');
  await page.locator('#props-body input[data-key="name"]').press('Enter');
  const id = await F(() => window.__FORGE.doc.objects.find((o) => o.type === 'obstacle' && o.dimension === 'red' && o.w === 174).id);
  await F((i) => { window.__FORGE.actions.setSelection([i]); }, id);
  await page.fill('#props-body input[data-key="x"]', '300');
  await page.locator('#props-body input[data-key="x"]').press('Enter');
  await page.waitForTimeout(450);
  const v = await F(() => ({ summary: document.querySelector('#check-summary').textContent, items: [...document.querySelectorAll('#check-list .issue')].map((li) => li.className + ': ' + li.textContent) }));
  check('[18] Objekt außerhalb der Feldbreite = Fehler in der Prüfliste', /^1 Fehler/.test(v.summary) && v.items.some((t) => /error/.test(t) && /Spielfeldbreite/.test(t)), v.summary + ' ' + v.items.join(' | '));
  await deselect();
  await page.locator('#check-list .issue.error').first().click();
  const sel = (await docState()).sel;
  check('[18] Klick auf den Eintrag springt zum Objekt und wählt es aus', sel.length === 1 && sel[0] === id);
  await page.click('#btn-playtest');
  const blocked = await F(() => [document.querySelector('#playtest').hidden, document.querySelector('#toast').textContent]);
  check('[18] Playtest und Export bei Fehlern gesperrt (mit Begründung)', blocked[0] && /nicht möglich/.test(blocked[1]), blocked[1]);
  await page.fill('#props-body input[data-key="x"]', '183');
  await page.locator('#props-body input[data-key="x"]').press('Enter');
  await page.waitForTimeout(450);
  const w = await F(() => ({ summary: document.querySelector('#check-summary').textContent, items: [...document.querySelectorAll('#check-list .issue')].map((li) => li.textContent) }));
  check('[18] Warnungen: Überlappung mit widersprüchlicher Dimension, fehlender Nachweis', /^0 Fehler/.test(w.summary) && w.items.some((t) => /überlappt/.test(t)) && w.items.some((t) => /Nicht nachgewiesen|Spur-Solver/.test(t)), w.summary);
  const res = await F(() => {
    const r = window.__FORGE.actions.importText('{"schema":"rift-climb-level"', 'kaputt.json');
    return new Promise((ok) => setTimeout(() => ok({ modal: !document.querySelector('#modal').hidden, text: document.querySelector('#modal-body').textContent }), 100));
  });
  check('[18] Fehlerhafte JSON-Struktur: verständliche Meldung, kein Absturz', res.modal && /Fehlerhafte JSON-Struktur/.test(res.text), res.text.slice(0, 80));
  await page.keyboard.press('Escape');
}

// ---------------------------------------------------------------- 15. JSON-Export
let exported;
{
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
  const text = readFileSync(await dl.path(), 'utf8');
  exported = JSON.parse(text);
  const same = await F((t) => window.__FORGE.actions.exportText().text === t, text);
  const v = await F((t) => import('../../js/level-data.js').then((m) => m.validateLevelData(JSON.parse(t)).ok), text);
  check('[15] Export lädt <id>.json mit allen Leveldaten herunter', /\.json$/.test(dl.suggestedFilename()) && exported.schema === 'rift-climb-level' && exported.version === 1 && exported.name === 'QA Level' && exported.objects.length >= 5 && same && v, dl.suggestedFilename());
  check('[9] JSON enthält Schema-Version, ID, Name, BPM, Höhe, Start, Ziel, Objekte mit stabilen IDs', ['schema', 'version', 'id', 'name', 'description', 'bpm', 'height', 'start', 'finish', 'objects'].every((k) => k in exported) && exported.objects.every((o) => typeof o.id === 'string'));
}

// ---------------------------------------------------------------- 16. JSON-Import
{
  const mod1 = { ...exported, name: 'Importiert QA', id: 'import-qa' };
  await page.setInputFiles('#file-import', { name: 'import-qa.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(mod1)) });
  await page.waitForTimeout(150);
  if (!(await F(() => document.querySelector('#modal').hidden))) await page.click('#modal-actions .btn.danger');
  await page.waitForTimeout(150);
  let s = await docState();
  check('[16] Gültige Datei importiert (alle Objekte übernommen)', s.name === 'Importiert QA' && s.n === exported.objects.length);
  const bad = { ...exported, objects: [...exported.objects, { id: 'spike-1', type: 'spikes', x: 10, y: 600, w: 20, h: 20 }, { id: 'rot-1', type: 'obstacle', x: 3, y: 700, w: 84, h: 14, dimension: 'blue', rotation: 45 }] };
  await page.setInputFiles('#file-import', { name: 'mit-fehlern.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
  await page.waitForTimeout(150);
  const m = await F(() => ({ title: document.querySelector('#modal-title').textContent, body: document.querySelector('#modal-body').textContent }));
  check('[16] Datei mit nicht unterstützten Typen/Rotation: klare Fehlermeldung', /Import mit Fehlern/.test(m.title) && /nicht unterstützt/.test(m.body) && /Rotation/.test(m.body), m.title);
  await page.click('#modal-actions .btn.primary');
  await page.waitForTimeout(150);
  if (!(await F(() => document.querySelector('#modal').hidden))) await page.click('#modal-actions .btn.danger');
  await page.waitForTimeout(150);
  s = await docState();
  const sum = await F(() => document.querySelector('#check-summary').textContent);
  check('[16] „Bereinigt übernehmen“: Stacheln und rotiertes Objekt verworfen, Rest geladen', s.n === exported.objects.length && !(await obj('spike-1')) && !(await obj('rot-1')) && /^0 Fehler/.test(sum), sum);
  await page.setInputFiles('#file-import', { name: 'falsch.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":"anderes-spiel","version":1}') });
  await page.waitForTimeout(150);
  const m2 = await F(() => [document.querySelector('#modal-title').textContent, document.querySelector('#modal-body').textContent]);
  await page.click('#modal-actions .btn.primary');
  const s2 = await docState();
  check('[16] Fremdes Schema wird abgelehnt, Editor-Inhalt bleibt erhalten', /fehlgeschlagen/.test(m2[0]) && /Schema/.test(m2[1]) && s2.n === s.n);
  // Altes Reihenformat (M1–M3) wird migriert
  await page.setInputFiles('#file-import', { name: 'alt.json', mimeType: 'application/json', buffer: Buffer.from('[[4,".WWW"],[8,"SSSS"]]') });
  await page.waitForTimeout(150);
  if (!(await F(() => document.querySelector('#modal').hidden))) await page.click('#modal-actions .btn.danger');
  await page.waitForTimeout(150);
  const s3 = await docState();
  check('[16] Altes Reihenformat wird beim Import migriert', s3.n === 2 && (await F(() => window.__FORGE.doc.objects.map((o) => o.type).join())) === 'obstacle,seal');
  await F((lvl) => window.__FORGE.actions.loadDocument(lvl, { clean: false }), exported);
}

// ---------------------------------------------------------------- 17. Autospeicherung
{
  await centerCamera(400);
  await page.click('.pal[data-kind="hint"]');
  await clickWorld(180, 390);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  const before = await docState();
  const status = await F(() => document.querySelector('#save-status').textContent);
  await page.reload();
  await ready();
  const after = await docState();
  const t = await F(() => document.querySelector('#toast').textContent);
  check('[17] Autospeicherung (IndexedDB): nach Neuladen ist der Stand wiederhergestellt', status.startsWith('Entwurf automatisch gesichert') && after.json === before.json && /wiederhergestellt/.test(t), status);
  await page.keyboard.press(`${mod}+s`);
  await page.waitForTimeout(300);
  const saved = await F(() => [document.querySelector('#save-status').dataset.state, document.querySelector('#toast').textContent]);
  check('[17] Strg/Cmd+S speichert lokal und sagt klar: nicht auf GitHub', saved[0] === 'ok' && /lokal im Browser/.test(saved[1]) && /Exportieren/.test(saved[1]), saved[1]);
}

// ---------------------------------------------------------------- 19./20. Playtest
{
  await page.click('#btn-open');
  await page.waitForTimeout(300);
  await page.locator('.open-list li', { hasText: 'rift-forge-test' }).locator('.btn.primary').click();
  await page.waitForTimeout(400);
  const lvl = await docState();
  const json0 = lvl.json;
  const undo0 = lvl.undo;
  const mainKey = await F(() => localStorage.getItem('riftclimb.pulse.v1'));
  await page.click('#btn-playtest');
  await page.waitForFunction(() => { const f = document.querySelector('#pt-frame'); return f.contentWindow && f.contentWindow.__RIFT && f.contentWindow.__RIFT.state !== 'menu'; }, null, { timeout: 10000 });
  const frame = page.frames().find((f) => f.url().includes('playtest=1'));
  await frame.click('#btn-resume');
  await page.waitForTimeout(1200);
  const g = await frame.evaluate(() => ({ st: __RIFT.state, id: __RIFT.level.id, chip: !document.querySelector('#hud-playtest').hidden, obs: __RIFT.obstacles.length }));
  check('[19] PLAYTEST startet das echte Spiel mit dem aktuellen Level (ohne Export)', g.st === 'playing' && g.id === 'rift-forge-test' && g.chip && g.obs === 15, JSON.stringify(g));
  // Tod und Neustart im Playtest, dann Lauf bis zum Ziel (aufgezeichnet)
  const run = await frame.evaluate(() => {
    const game = __RIFT;
    const DT = 1 / 240;
    while (game.state === 'playing' && game.t < 5) game.update(DT);
    const died = game.state === 'dying';
    game.deathAge = 1;
    game.press(1);
    const restarted = game.state === 'playing' && game.t === 0;
    const taps = game.levelData.replay.taps;
    let i = 0;
    while (game.state === 'playing' && game.t < 30) {
      while (i < taps.length && taps[i].t <= game.t + DT / 2) game.press(taps[i++].dir);
      game.update(DT);
    }
    return { died, restarted, won: game.state === 'won', best: game.storage.stats.best };
  });
  await page.waitForTimeout(300);
  const after = await F(() => ({ mainKey: localStorage.getItem('riftclimb.pulse.v1'), replay: window.__FORGE.doc.level.replay, toast: document.querySelector('#toast').textContent }));
  check('[19] Gleiche Physik: Tod bei Untätigkeit, Neustart, aufgezeichneter Lauf erreicht das Ziel', run.died && run.restarted && run.won, JSON.stringify(run));
  check('[19] Isolierter Testzustand: keine Highscores/Fortschritt im Spielspeicher', after.mainKey === mainKey);
  check('[12] Gewonnener Playtest speichert den Lauf als Nachweis im Level', after.replay && after.replay.taps.length === 7 && /Nachweis/.test(after.toast), after.toast);
  await frame.evaluate(() => document.querySelector('#btn-win-menu').click());
  await page.waitForTimeout(200);
  const closed = await F(() => document.querySelector('#playtest').hidden);
  const s = await docState();
  const withoutReplay = (j) => { const o = JSON.parse(j); delete o.replay; return JSON.stringify(o); };
  check('[20] „Editor“-Button im Spiel beendet den Playtest, Änderungen und History bleiben', closed && withoutReplay(s.json) === withoutReplay(json0) && s.undo === undo0 + 1);
  // ungespeicherte Änderung + Playtest + Esc
  await centerCamera(600);
  await page.click('.pal[data-kind="neutral"]');
  await clickWorld(315, 1170);
  await page.keyboard.press('Escape');
  const mid = await docState();
  await page.click('#btn-playtest');
  await page.waitForTimeout(800);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  const end = await docState();
  check('[20] Esc beendet den Playtest ohne Verlust ungespeicherter Änderungen', (await F(() => document.querySelector('#playtest').hidden)) && end.json === mid.json && end.undo === mid.undo);
  // PLAY FROM HERE
  await centerCamera(2300);
  await page.click('.pal[data-kind="test"]');
  await clickWorld(315, 2340);
  await page.keyboard.press('Escape');
  await page.click('#btn-playfrom');
  await page.waitForFunction(() => { const f = document.querySelector('#pt-frame'); return f.contentWindow && f.contentWindow.__RIFT && f.contentWindow.__RIFT.state !== 'menu'; }, null, { timeout: 10000 });
  const frame2 = page.frames().find((f) => f.url().includes('playtest=1'));
  const g2 = await frame2.evaluate(() => ({ y: __RIFT.y, lane: __RIFT.player.lane, dim: __RIFT.player.dim, rec: __RIFT.recording, passed: __RIFT.lastRowPassed, lines: __RIFT.lines.filter((l) => l.y < 2340).length }));
  check('[19] PLAY FROM HERE startet konsistent an Testmarker-Höhe und -Spur', Math.abs(g2.y - 2340) < 1 && g2.lane === 3 && g2.passed === g2.lines - 1 && g2.rec === null, JSON.stringify(g2));
  await page.click('#pt-exit');
  check('[20] „Zurück zum Editor“ schließt den Playtest', await F(() => document.querySelector('#playtest').hidden));
}

// ---------------------------------------------------------------- 21. Bestehendes Spiellevel laden
{
  await page.click('#btn-open');
  await page.waitForTimeout(300);
  await page.locator('.open-list li', { hasText: 'rift-main' }).locator('.btn.primary').click();
  await page.waitForTimeout(150);
  if (!(await F(() => document.querySelector('#modal').hidden))) await page.click('#modal-actions .btn.danger');
  await page.waitForTimeout(600);
  const s = await docState();
  const sum = await F(() => document.querySelector('#check-summary').textContent);
  const out = await F(() => window.__FORGE.actions.exportText().text);
  const file = await (await page.request.get(BASE + 'assets/levels/rift-main.json')).text();
  check('[21] Hauptlevel „RIFT CLIMB“ im Editor geöffnet, Spur-Solver bestätigt Lösbarkeit', s.id === 'rift-main' && s.n === JSON.parse(file).objects.length && /Spur-Solver/.test(sum), `${s.id}, ${s.n} Objekte: ${sum}`);
  check('[21] Unverändert exportiert = Byte-gleich mit assets/levels/rift-main.json (verlustfrei)', out === file);
  // Rhythmus-Vorschau mit Metronom
  await page.check('#tg-metronome');
  await page.click('#btn-rhythm');
  const y0 = await F(() => window.__FORGE.S.playhead ?? window.__FORGE.S.rhythm.y);
  await page.waitForTimeout(500);
  const y1 = await F(() => window.__FORGE.S.playhead);
  await page.click('#btn-rhythm');
  check('[8] Rhythmus-Vorschau steigt mit Spielgeschwindigkeit (~260 u/s)', y1 - y0 > 80 && y1 - y0 < 200 && (await F(() => window.__FORGE.S.rhythm === null)), `${(y1 - y0).toFixed(0)} u in 0,5 s`);
}

check('Keine Konsolen- oder Seitenfehler im Editor', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();

// ---------------------------------------------------------------- 22. Normales Mobile-Gameplay (Kurzprüfung; ausführlich: tests/e2e.mjs)
{
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto(BASE + '?autoplay=1&speed=6');
  await p.waitForFunction(() => window.__RIFT && document.querySelector('#menu:not([hidden])'));
  const m = await p.evaluate(() => ({ level: window.__RIFT.level.id, select: !document.querySelector('#level-pick').hidden, forge: getComputedStyle(document.querySelector('#forge-link')).display, menuFits: document.querySelector('#menu .panel').getBoundingClientRect().bottom <= innerHeight + 1 }));
  await p.tap('#btn-start');
  await p.waitForFunction(() => window.__RIFT.state === 'won' || window.__RIFT.state === 'dead', null, { timeout: 30000 });
  const won = await p.evaluate(() => window.__RIFT.state);
  check('[22] Mobil (iPhone 13): Hauptlevel aus JSON, Autopilot bis 100 %, Editor-Link auch mobil sichtbar (Touch-Editor seit M4.5)', m.level === 'rift-main' && m.select && m.forge !== 'none' && m.menuFits && won === 'won', JSON.stringify(m));
  await p.goto(BASE + '?level=rift-forge-test&autoplay=1&speed=4');
  await p.waitForFunction(() => window.__RIFT && document.querySelector('#menu:not([hidden])'));
  await p.tap('#btn-start');
  await p.waitForFunction(() => window.__RIFT.state === 'won' || window.__RIFT.state === 'dead', null, { timeout: 20000 });
  const r2 = await p.evaluate(() => [window.__RIFT.level.id, window.__RIFT.state, localStorage.getItem('riftclimb.pulse.v1.rift-forge-test') !== null]);
  check('[22] Mobil: RIFT FORGE TEST über ?level= spielbar (eigener Fortschritt pro Level)', r2[0] === 'rift-forge-test' && r2[1] === 'won' && r2[2], r2.join(' '));
  check('[22] Mobil: keine Konsolenfehler', errs.length === 0, errs.join(' | '));
  await b.close();
}

console.log(`\n${total - failed}/${total} LEVEL-FORGE-Checks bestanden`);
process.exit(failed ? 1 : 0);
