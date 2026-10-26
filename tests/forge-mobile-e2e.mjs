// LEVEL FORGE mobil: End-to-End-Tests (Spezifikation M4.5, Abschnitt 20) mit echter Touch-Emulation.
// Chromium mit iPhone-13-Profil bei 390 × 844 CSS-px; Finger-Gesten über CDP Input.dispatchTouchEvent
// (erzeugt echte Pointer Events vom Typ „touch“ – Tipp, Ziehen, langes Drücken, Pinch, Zwei-Finger-Schieben).
// Dazu Querformat, Tablet, Desktop-Gegenprobe und ein WebKit-Kurztest. Ein echtes iOS Safari ersetzt das nicht.
// Voraussetzung: lokaler Server auf BASE_URL (Standard http://localhost:8080/) und `npm i -D playwright`.
// Aufruf: node tests/forge-mobile-e2e.mjs
import { chromium, webkit, devices } from 'playwright';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const cdp = await context.newCDPSession(page);
const F = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);

async function ready() {
  await page.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15000 });
  await wait(150);
}

async function at(wx, wy) {
  return F(([x, y]) => {
    const f = window.__FORGE;
    const r = f.view.canvas.getBoundingClientRect();
    const s = f.view.toScreen(x, y);
    return { x: r.left + s.x, y: r.top + s.y };
  }, [wx, wy]);
}

const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });

async function tapAt(p, hold = 40) {
  await touch('touchStart', [p]);
  await wait(hold);
  await touch('touchEnd', []);
  await wait(60);
}
const tapWorld = async (wx, wy) => tapAt(await at(wx, wy));

async function dragPts(a, b, steps = 10) {
  await touch('touchStart', [a]);
  await wait(30);
  for (let i = 1; i <= steps; i++) {
    await touch('touchMove', [{ x: a.x + (b.x - a.x) * i / steps, y: a.y + (b.y - a.y) * i / steps }]);
    await wait(16);
  }
  // Finger kurz ruhig halten: sonst wertet Chromium das Loslassen als Wischen (Fling) und unterdrückt den nächsten Klick
  await wait(120);
  await touch('touchEnd', []);
  await wait(60);
}

async function longPressWorld(wx, wy) {
  const p = await at(wx, wy);
  await touch('touchStart', [p]);
  await wait(650);
  await touch('touchEnd', []);
  await wait(80);
  return p;
}

/** Zwei Finger: Abstand d0 → d1 um die Mitte c, Mitte verschiebt sich dabei um (dx, dy). */
async function twoFinger(c, d0, d1, dx = 0, dy = 0, steps = 10) {
  const pts = (d, ox, oy) => [{ x: c.x - d / 2 + ox, y: c.y + oy }, { x: c.x + d / 2 + ox, y: c.y + oy }];
  await touch('touchStart', [pts(d0, 0, 0)[0]]);
  await wait(20);
  await touch('touchStart', pts(d0, 0, 0));
  await wait(20);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await touch('touchMove', pts(d0 + (d1 - d0) * t, dx * t, dy * t));
    await wait(16);
  }
  await wait(120);
  await touch('touchEnd', [pts(d1, dx, dy)[1]]);
  await wait(20);
  await touch('touchEnd', []);
  await wait(80);
}

const docState = () => F(() => {
  const f = window.__FORGE;
  return { n: f.doc.objects.length, sel: [...f.S.selection], undo: f.doc.undoStack.length, redo: f.doc.redoStack.length, json: JSON.stringify(f.doc.level), tool: f.S.tool, kind: f.S.kind, cam: { ...f.view.cam } };
});
const obj = (id) => F((i) => { const o = window.__FORGE.doc.get(i); return o ? { ...o } : null; }, id);
const visibleBox = async (sel) => F((s) => {
  const e = document.querySelector(s);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  const cs = getComputedStyle(e);
  return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right, shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 };
}, sel);
const tapSel = async (sel) => {
  await F((s) => { const e = document.querySelector(s); if (e) e.scrollIntoView({ block: 'nearest', inline: 'center' }); }, sel);
  await wait(30);
  const b = await visibleBox(sel);
  await tapAt({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
};

async function centerCamera(y) {
  await F((yy) => { const f = window.__FORGE; f.view.cam.y = yy; f.view.cam.x = 180; f.view.cam.z = f.view.fitZoom(); f.actions.requestRender(); }, y);
  await wait(50);
}

await page.goto(FORGE);
await ready();

// ---------------------------------------------------------------- 1. Editor auf Smartphone-Größe
{
  const L = await F(() => {
    const vis = (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.width > 0 && r.bottom <= innerHeight + 0.5 && r.right <= innerWidth + 0.5; };
    const c = document.getElementById('view');
    const targets = [...document.querySelectorAll('#dock button, .m-actions button, .toolbar .tool, .toolbar .pal')].filter((b) => getComputedStyle(b).display !== 'none');
    const small = targets.map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44).length;
    const cr = c.getBoundingClientRect();
    return {
      dock: vis('#dock'), tools: vis('.toolbar'), top: vis('.m-actions'), propsHidden: getComputedStyle(document.querySelector('.props')).display === 'none',
      desktopMenuHidden: getComputedStyle(document.querySelector('.topbar .menu')).display === 'none', banner: getComputedStyle(document.body, '::before').content,
      scrollW: document.scrollingElement.scrollWidth, iw: innerWidth, small, targets: targets.length,
      canvasH: cr.height, canvasW: cr.width, dpr: Math.min(devicePixelRatio, 2), cw: c.width, ch: c.height, touchAction: getComputedStyle(c).touchAction,
      viewport: document.querySelector('meta[name=viewport]').content,
    };
  });
  check('[1] Editor öffnet auf 390 × 844: Topbar, große Levelansicht, Werkzeugleiste und Dock sichtbar', L.dock && L.tools && L.top && L.propsHidden && L.desktopMenuHidden && L.canvasH > 500, JSON.stringify({ canvasH: L.canvasH, dock: L.dock, tools: L.tools }));
  check('[1] Kein „nur Desktop“-Hinweis, kein horizontales Scrollen', (L.banner === 'none' || L.banner === 'normal') && L.scrollW <= L.iw, `${L.banner} ${L.scrollW}/${L.iw}`);
  check('[1] Touch-Ziele ≥ 44 CSS-px (Dock, Topbar, Werkzeuge, Palette)', L.small === 0, `${L.small} von ${L.targets} zu klein`);
  check('[1] Canvas DPR-korrekt, touch-action: none, viewport-fit=cover', Math.abs(L.cw - L.canvasW * L.dpr) <= 1 && Math.abs(L.ch - L.canvasH * L.dpr) <= 1 && L.touchAction === 'none' && L.viewport.includes('viewport-fit=cover'), JSON.stringify(L));
  const pal = await F(() => [...document.querySelectorAll('.toolbar .pal')].map((b) => b.dataset.kind));
  check('[1] Mobile Palette: Neutral, Blau, Rot, Barriere, Rift-Siegel, Hinweis, Start, Ziel, Testmarker; Stacheln als „nicht verfügbar“', ['neutral', 'blue', 'red', 'barrier', 'seal', 'hint', 'start', 'finish', 'test', 'spikes'].every((k) => pal.includes(k)), pal.join(','));
}

// ---------------------------------------------------------------- 2. Neues Level
{
  await tapSel('#m-menu');
  await wait(150);
  const menuOpen = (await visibleBox('#menu-sheet')).shown;
  await tapSel('#menu-sheet [data-click="#btn-new"]');
  await wait(200);
  if (await F(() => !document.querySelector('#modal').hidden)) await page.locator('#modal-actions .btn', { hasText: 'Verwerfen' }).tap();
  await wait(200);
  const s = await docState();
  const name = await F(() => window.__FORGE.doc.level.name);
  check('[2] Menü-Sheet → „Neu“ legt ein leeres Level an', menuOpen && s.n === 0 && name === 'Neues Level' && (await visibleBox('#menu-sheet')).shown === false, `${s.n} Objekte, ${name}`);
}

let blueId;
// This gesture suite uses authored 360-u campaign coordinates (including x315).
// New documents now default to 270 u; test that arena separately in director-e2e.
await F(()=>{const f=window.__FORGE;f.app.edit('Classic campaign fixture',tx=>f.app.setArenaStyle(tx,'classic'));});
// ---------------------------------------------------------------- 3./4. Objekt auswählen und platzieren
{
  await centerCamera(500);
  await tapSel('.pal[data-kind="spikes"]');
  const spikes = await docState();
  await tapSel('.pal[data-kind="blue"]');
  const s = await docState();
  const chip = await F(() => document.querySelector('#sel-info').textContent);
  const active = await F(() => document.querySelector('.pal[data-kind="blue"]').classList.contains('active'));
  check('[3] Palette antippen aktiviert den Platzierungsmodus (deutlich markiert), Stacheln bleiben gesperrt', spikes.tool !== 'place' && s.tool === 'place' && s.kind === 'blue' && active && chip.includes('Setzen'), chip);
  await tapWorld(135, 520);
  const s2 = await docState();
  blueId = s2.sel[0];
  const o = await obj(blueId);
  check('[4] Tipp ins Feld platziert genau ein Objekt mit Snap (Spur + Beat)', s2.n === 1 && o && o.dimension === 'blue' && o.x === 93 && o.y === 520, JSON.stringify(o));
  // Ziehen im Platzierungsmodus zeigt Vorschau und setzt erst beim Loslassen
  const a = await at(225, 260);
  const b = await at(315, 390);
  await touch('touchStart', [a]);
  await wait(30);
  for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: a.x + (b.x - a.x) * i / 6, y: a.y + (b.y - a.y) * i / 6 }]); await wait(16); }
  const mid = await F(() => ({ ghost: !!window.__FORGE.S.ghost, n: window.__FORGE.doc.objects.length }));
  await touch('touchEnd', []);
  await wait(60);
  const s3 = await docState();
  const o3 = await obj(s3.sel[0]);
  check('[4] Ziehen im Platzierungsmodus: Vorschau folgt dem Finger, gesetzt wird beim Loslassen', mid.ghost && mid.n === 1 && s3.n === 2 && o3.y === 390, JSON.stringify(o3));
  await F(() => window.__FORGE.doc.undo());
}

// ---------------------------------------------------------------- 6. Pinch-Zoom (ohne versehentliches Platzieren)
{
  const before = await docState();
  const c = await at(180, 560);
  await twoFinger(c, 90, 180);
  const s = await docState();
  const ratio = s.cam.z / before.cam.z;
  check('[6] Zwei Finger auseinander = Zoom ≈ ×2 um die Fingermitte', ratio > 1.8 && ratio < 2.2, ratio.toFixed(2));
  check('[6] Pinch im Platzierungsmodus setzt kein Objekt', s.n === before.n && s.undo === before.undo, `${before.n} -> ${s.n}`);
  await twoFinger(c, 180, 90);
  const s2 = await docState();
  check('[6] Zusammenziehen zoomt wieder heraus', Math.abs(s2.cam.z / before.cam.z - 1) < 0.12, (s2.cam.z / before.cam.z).toFixed(2));
}

// ---------------------------------------------------------------- 7. Ansicht verschieben
{
  const s0 = await docState();
  const c = await at(180, 560);
  await twoFinger(c, 120, 120, 0, 150);
  const s1 = await docState();
  const dyWorld = (s1.cam.y - s0.cam.y) * s0.cam.z;
  check('[7] Zwei Finger schieben die Ansicht (150 px nach unten = Welt nach oben)', Math.abs(dyWorld - 150) < 12 && s1.n === s0.n, `${dyWorld.toFixed(1)} px`);
  await tapSel('.tool[data-tool="select"]');
  const e = await at(320, 760);
  const s2 = await docState();
  await dragPts(e, { x: e.x, y: e.y - 120 });
  const s3 = await docState();
  check('[7] Ein Finger auf leerer Fläche schiebt ebenfalls (Auswahlwerkzeug), ohne Auswahlrahmen', Math.abs((s2.cam.y - s3.cam.y) * s2.cam.z - 120) < 12 && s3.n === s2.n, `${((s2.cam.y - s3.cam.y) * s2.cam.z).toFixed(1)} px`);
  await centerCamera(560);
}

// ---------------------------------------------------------------- 3b./5. Auswählen und mit einem Finger verschieben
{
  await tapWorld(20, 300);
  const none = await docState();
  await tapWorld(135, 520);
  const s = await docState();
  const title = await F(() => document.querySelector('#props-body .panel-title').textContent);
  check('[3] Tipp wählt das Objekt (Tipp ins Leere hebt die Auswahl auf)', none.sel.length === 0 && s.sel.length === 1 && s.sel[0] === blueId && title === 'Hindernis');
  const before = s.undo;
  await dragPts(await at(135, 520), await at(225, 650), 12);
  const o = await obj(blueId);
  const s2 = await docState();
  const label = await F(() => window.__FORGE.doc.undoStack.at(-1).label);
  check('[5] Ein Finger zieht das Objekt live mit Snap (eine Spur rechts, ein Beat höher)', o.x === 183 && o.y === 650, `x ${o.x} y ${o.y}`);
  check('[5] Ein Zieh-Vorgang = genau ein Undo-Schritt', s2.undo === before + 1 && label === 'Verschieben', label);
  // Zweiter Finger während des Ziehens: Verschieben wird abgebrochen (Ausgangslage), es wird gezoomt
  const a = await at(225, 650);
  await touch('touchStart', [a]);
  await wait(20);
  await touch('touchMove', [{ x: a.x + 40, y: a.y }]);
  await wait(20);
  await touch('touchMove', [{ x: a.x + 90, y: a.y }]);
  await wait(20);
  await touch('touchStart', [{ x: a.x + 90, y: a.y }, { x: a.x - 60, y: a.y + 40 }]);
  await wait(20);
  await touch('touchMove', [{ x: a.x + 100, y: a.y }, { x: a.x - 80, y: a.y + 40 }]);
  await wait(20);
  await touch('touchEnd', []);
  await wait(80);
  const o2 = await obj(blueId);
  const s3 = await docState();
  check('[5] Zweiter Finger bricht das Verschieben sauber ab (kein Undo-Eintrag, Position unverändert)', o2.x === 183 && o2.y === 650 && s3.undo === s2.undo, JSON.stringify({ x: o2.x, y: o2.y }));
  await centerCamera(560);
  // Größe über Touch-Griff (rechte Kante)
  await tapWorld(225, 650);
  const h = await F((id) => { const f = window.__FORGE; const p = f.view.handlePoints(f.doc.get(id)).r; const r = f.view.canvas.getBoundingClientRect(); return { x: r.left + p.x, y: r.top + p.y }; }, blueId);
  const target = await at(357, 650);
  await dragPts(h, { x: target.x, y: h.y }, 8);
  const o3 = await obj(blueId);
  check('[5] Großer Touch-Griff ändert die Breite (Snap auf Spurkante)', o3.w === 174, `w ${o3.w}`);
  await F(() => window.__FORGE.doc.undo());
}

// ---------------------------------------------------------------- 8./9. Langes Drücken: Duplizieren, Löschen
{
  await centerCamera(700);
  const n0 = (await docState()).n;
  await longPressWorld(225, 650);
  const menu = await visibleBox('#ctx-menu');
  check('[8] Langes Drücken öffnet das Kontextmenü (Duplizieren, Löschen, Eigenschaften)', menu.shown && (await F(() => [...document.querySelectorAll('#ctx-menu button:not([hidden])')].map((b) => b.textContent).join('|'))) === 'Duplizieren|Löschen|Eigenschaften');
  await tapSel('#ctx-menu [data-act="duplicate"]');
  const s = await docState();
  const copy = await obj(s.sel[0]);
  check('[8] Duplizieren: Kopie einen Beat höher, ausgewählt, Kontextmenü zu', s.n === n0 + 1 && copy && copy.id !== blueId && copy.y === 780 && copy.x === 183 && !(await visibleBox('#ctx-menu')).shown, JSON.stringify(copy));
  await longPressWorld(225, 780);
  await tapSel('#ctx-menu [data-act="delete"]');
  const s2 = await docState();
  check('[9] Löschen über das Kontextmenü entfernt genau die Kopie', s2.n === n0 && !(await obj(copy.id)) && !!(await obj(blueId)));
  await longPressWorld(30, 600);
  check('[8] Langes Drücken ins Leere öffnet kein Menü und setzt nichts', !(await visibleBox('#ctx-menu')).shown && (await docState()).n === n0);
}

// ---------------------------------------------------------------- 10. Eigenschaften im Bottom Sheet
{
  await centerCamera(560);
  await tapWorld(225, 650);
  await tapSel('#dk-props');
  await wait(250);
  const sh = await F(() => {
    const p = document.querySelector('.props').getBoundingClientRect();
    const d = document.querySelector('#dock').getBoundingClientRect();
    const x = document.querySelector('#props-body [data-key="x"]');
    return { top: p.top, bottom: p.bottom, dockTop: d.top, ih: innerHeight, title: document.querySelector('#sheet-title').textContent, font: parseFloat(getComputedStyle(x).fontSize), h: x.getBoundingClientRect().height, steppers: document.querySelectorAll('#props-body .step-btn').length };
  });
  const sel = await F((id) => { const f = window.__FORGE; const r = f.view.canvas.getBoundingClientRect(); return f.view.toScreen(0, f.doc.get(id).y).y + r.top; }, blueId);
  check('[10] Eigenschaften öffnen als Bottom Sheet über dem Dock, Objekt bleibt darüber sichtbar', sh.bottom <= sh.dockTop + 1 && sh.top > sh.ih * 0.3 && sel < sh.top && sh.title === 'Hindernis', JSON.stringify({ ...sh, sel }));
  check('[10] Eingabefelder ≥ 16 px Schrift (kein iOS-Zoom), ≥ 44 px hoch, −/+-Schaltflächen', sh.font >= 16 && sh.h >= 44 && sh.steppers >= 8, JSON.stringify(sh));
  const xIn = page.locator('#props-body [data-key="x"]');
  await xIn.tap();
  await xIn.fill('273');
  const live = await obj(blueId);
  await xIn.press('Enter');
  await F(() => document.activeElement && document.activeElement.blur());
  await wait(60);
  const s = await docState();
  check('[10] Zahlenfeld ändert X sofort (live) und ergibt einen Undo-Schritt', live.x === 273 && (await obj(blueId)).x === 273 && (await F(() => window.__FORGE.doc.undoStack.at(-1).label)) === 'X (linke Kante)', `x ${live.x}`);
  const plus = page.locator('#props-body [data-key="y"]').locator('xpath=following-sibling::button[1]');
  await plus.tap();
  const o = await obj(blueId);
  check('[10] „+“ bei Y erhöht in 10er-Schritten (650 → 660)', o.y === 660, `y ${o.y}`);
  await page.locator('#props-body [data-key="dimension"]').selectOption('red').catch(() => {});
  const dim = (await obj(blueId)).dimension;
  check('[10] Dimension im Sheet umstellbar', dim === 'red', dim);
  // Tastatur-Simulation: sichtbarer Bereich schrumpft → Sheet bleibt über der Tastatur bedienbar
  await F(() => {
    const st = document.documentElement.style;
    st.setProperty('--kb', '300px');
    st.setProperty('--vvh', `${innerHeight - 300}px`);
    document.body.dataset.kb = '1';
  });
  const kb = await F(() => { const p = document.querySelector('.props').getBoundingClientRect(); const c = document.querySelector('#sheet-close').getBoundingClientRect(); return { bottom: p.bottom, top: p.top, close: c.top, limit: innerHeight - 300 }; });
  check('[10] Mit Bildschirmtastatur (simuliert 300 px): Sheet endet über der Tastatur, Schließen bleibt erreichbar', kb.bottom <= kb.limit + 1 && kb.close >= 0 && kb.top >= 0, JSON.stringify(kb));
  await F(() => window.__FORGE && document.body.dataset && (document.body.dataset.kb = '0'));
  await F(() => { const st = document.documentElement.style; st.setProperty('--kb', '0px'); st.setProperty('--vvh', `${innerHeight}px`); });
  await tapSel('#dk-check');
  const chk = await F(() => ({ sheet: document.body.dataset.sheet, list: getComputedStyle(document.querySelector('.check')).display, body: getComputedStyle(document.querySelector('#props-body')).display }));
  check('[10] Prüfung als eigenes Sheet (Dock-Knopf)', chk.sheet === 'check' && chk.list !== 'none' && chk.body === 'none', JSON.stringify(chk));
  await tapSel('#sheet-close');
  check('[10] Sheet schließt per ✕', !(await F(() => document.body.dataset.sheet)));
}

// ---------------------------------------------------------------- 11. Undo / Redo
{
  const y0 = (await obj(blueId)).dimension;
  await tapSel('#m-undo');
  const a = await obj(blueId);
  await tapSel('#m-undo');
  const b = await obj(blueId);
  await tapSel('#m-redo');
  await tapSel('#m-redo');
  const c = await obj(blueId);
  check('[11] Undo/Redo-Knöpfe in der Topbar (Dimension, dann Y zurück und wieder vor)', y0 === 'red' && a.dimension === 'blue' && b.y === 650 && c.y === 660 && c.dimension === 'red', `${a.dimension} ${b.y} ${c.y}`);
}

// ---------------------------------------------------------------- 12./13. Lokal speichern, neu laden
let savedJson;
{
  await tapSel('#m-save');
  await wait(300);
  const st = await F(async () => {
    const f = window.__FORGE;
    const list = await f.store.listLevels();
    return { ids: list.map((l) => l.id), id: f.doc.level.id, status: document.querySelector('#save-status').dataset.state, dirty: document.querySelector('#m-save').classList.contains('dirty') };
  });
  savedJson = await F(()=>window.__FORGE.actions.exportText().text);
  check('[12] Speichern-Knopf legt das Level lokal ab (IndexedDB), Status „Gespeichert“', st.ids.includes(st.id) && st.status === 'ok' && !st.dirty, JSON.stringify(st));
  await F(() => window.__FORGE.actions.setSelection([]));
  await wait(700);
  await page.reload();
  await ready();
  const s = await docState();
  check('[13] Nach Neuladen: letzter Stand automatisch wiederhergestellt (identisches JSON)', await F(()=>window.__FORGE.actions.exportText().text) === savedJson, `${s.n} Objekte`);
  const note = await F(() => document.querySelector('#m-storage-note').textContent);
  check('[12] Hinweis: lokale Browserdaten können verloren gehen (keine Cloud)', /nur lokal/.test(note) && /verloren|entfernen/.test(note) && /exportieren/i.test(note));
}

// ---------------------------------------------------------------- 14. JSON exportieren (Teilen + Download-Rückfall)
let exported;
{
  await tapSel('#m-menu');
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await tapSel('#m-export');
  const d = await dl;
  let txt = null;
  if (d) txt = readFileSync(await d.path(), 'utf8');
  exported = txt;
  const lvl = txt ? JSON.parse(txt) : null;
  check('[14] Export ohne Web Share: Download einer gültigen JSON-Datei', !!lvl && lvl.objects.length === 1 && d.suggestedFilename() === `${lvl.id}.json`, d ? d.suggestedFilename() : 'kein Download');
  await F(() => {
    window.__shared = null;
    navigator.canShare = (data) => !!(data && data.files && data.files.length);
    navigator.share = async (data) => { window.__shared = { name: data.files[0].name, type: data.files[0].type, text: await data.files[0].text() }; };
  });
  await tapSel('#m-menu');
  await tapSel('#m-export');
  await wait(200);
  const sh = await F(() => window.__shared);
  check('[14] Mit Web Share API: Datei wird über den Teilen-Dialog übergeben (gleicher Inhalt)', sh && sh.name.endsWith('.json') && sh.text === exported && sh.type === 'application/json', sh ? sh.name : 'nicht geteilt');
  await F(() => { navigator.share = async () => { throw new DOMException('abgebrochen', 'AbortError'); }; });
  const dl2 = page.waitForEvent('download', { timeout: 1200 }).catch(() => null);
  await tapSel('#m-menu');
  await tapSel('#m-export');
  check('[14] Teilen abgebrochen: kein ungewollter Download', !(await dl2));
}

// ---------------------------------------------------------------- 15. JSON importieren
{
  const dir = mkdtempSync(join(tmpdir(), 'forge-m-'));
  const l = JSON.parse(exported);
  l.name = 'Vom Handy importiert';
  l.objects.push({ ...l.objects[0], id: 'obs-imported', y: l.objects[0].y + 130 });
  const file = join(dir, 'import.json');
  writeFileSync(file, JSON.stringify(l, null, 2));
  await tapSel('#m-menu');
  const fc = page.waitForEvent('filechooser', { timeout: 5000 });
  await tapSel('#menu-sheet [data-click="#btn-import"]');
  const chooser = await fc;
  await chooser.setFiles(file);
  await wait(300);
  if (await F(() => !document.querySelector('#modal').hidden)) await page.locator('#modal-actions .btn', { hasText: 'Verwerfen' }).tap();
  await wait(300);
  const s = await F(() => ({ name: window.__FORGE.doc.level.name, n: window.__FORGE.doc.objects.length, title: document.querySelector('#level-title').textContent }));
  check('[15] Import über Menü → Dateiauswahl lädt die JSON-Datei (gleiches Format wie am Desktop)', s.name === 'Vom Handy importiert' && s.n === 2 && s.title === s.name, JSON.stringify(s));
}

// ---------------------------------------------------------------- 16./17. Playtest und zurück
{
  const json0 = (await docState()).json;
  const store0 = await F(() => Object.keys(localStorage).filter((k) => k.startsWith('riftclimb.pulse') || k.startsWith('riftclimb.ascension')).sort().join(','));
  await tapSel('#dk-play');
  await page.waitForFunction(() => !document.querySelector('#playtest').hidden);
  const frame = page.frameLocator('#pt-frame');
  const fr = page.frames().find((f) => f.url().includes('playtest=1')) || (await (await page.$('#pt-frame')).contentFrame());
  await fr.waitForFunction(() => window.__RIFT && (window.__RIFT.state === 'paused'), null, { timeout: 15000 });
  const lay = await F(() => {
    const f = document.querySelector('#pt-frame').getBoundingClientRect();
    const b = document.querySelector('#pt-exit').getBoundingClientRect();
    return { fw: f.width, fh: f.height, bw: b.width, bh: b.height, btop: b.top, bbottom: b.bottom, ih: innerHeight };
  });
  check('[16] Playtest startet im Vollbild mit der echten Simulation (Level aus dem Editor)', lay.fw >= 389 && lay.fh > 700 && (await fr.evaluate(() => window.__RIFT.level.name)) === 'Vom Handy importiert', JSON.stringify(lay));
  check('[16] „Zurück zum Editor“ groß und vollständig sichtbar (≥ 44 px)', lay.bh >= 44 && lay.bw >= 150 && lay.btop >= 0 && lay.bbottom <= lay.ih, JSON.stringify(lay));
  await fr.tap('#btn-resume');
  await fr.waitForFunction(() => window.__RIFT.state === 'playing', null, { timeout: 5000 });
  await wait(250); // existing 200ms start-touch guard after the explicit Weiter gesture
  const lane0 = await fr.evaluate(() => window.__RIFT.player.lane);
  const fb = await (await page.$('#pt-frame')).boundingBox();
  await tapAt({ x: fb.x + fb.width * 0.2, y: fb.y + fb.height * 0.6 });
  await wait(80);
  const lane1 = await fr.evaluate(() => window.__RIFT.player.lane);
  check('[16] Touch-Steuerung im Playtest aktiv (Tipp links = Spurwechsel)', lane1 === lane0 + 1, `${lane0} -> ${lane1}`);
  await frame.locator('body').waitFor();
  await tapSel('#pt-exit');
  await wait(200);
  const s = await F(() => ({ hidden: document.querySelector('#playtest').hidden, src: document.querySelector('#pt-frame').getAttribute('src') }));
  const json1 = (await docState()).json;
  const store1 = await F(() => Object.keys(localStorage).filter((k) => k.startsWith('riftclimb.pulse') || k.startsWith('riftclimb.ascension')).sort().join(','));
  check('[17] „Zurück zum Editor“ schließt den Playtest zuverlässig', s.hidden && s.src === 'about:blank');
  check('[17] Ungespeicherte Bearbeitungen bleiben erhalten, keine regulären Spielstände verändert', json1 === json0 && store1 === store0, `${store0} | ${store1}`);
}

check('[1–17] Keine Konsolen- oder Seitenfehler (390 × 844)', errors.length === 0, errors.slice(0, 3).join(' | '));
await context.close();

// ---------------------------------------------------------------- Querformat, Tablet, Desktop-Gegenprobe (18)
async function layoutAt(opts) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  await p.goto(FORGE);
  await p.waitForFunction(() => document.body.dataset.ready === '1');
  const r = await p.evaluate(() => {
    const shown = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; };
    const c = document.getElementById('view').getBoundingClientRect();
    return { dock: shown('#dock'), props: shown('.props'), menu: shown('.topbar .menu'), toolbarW: document.querySelector('.toolbar').getBoundingClientRect().width, cw: c.width, ch: c.height, sw: document.scrollingElement.scrollWidth, iw: innerWidth };
  });
  await ctx.close();
  return r;
}
{
  const land = await layoutAt({ ...devices['iPhone 13 landscape'] });
  check('[17] Querformat (iPhone 13): Dock sichtbar, Levelansicht nutzbar, kein Überlauf', land.dock && !land.props && land.ch > 150 && land.sw <= land.iw, JSON.stringify(land));
  const tab = await layoutAt({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  check('[18] Tablet (820 × 1180): Seitenleisten bleiben, schmaler; Ansicht groß', !tab.dock && tab.props && tab.menu && tab.toolbarW <= 140 && tab.cw > 380 && tab.sw <= tab.iw, JSON.stringify(tab));
  const desk = await layoutAt({ viewport: { width: 1440, height: 900 } });
  check('[18] Desktop (1440 × 900): bisheriges Layout, keine mobilen Elemente', !desk.dock && desk.props && desk.menu && desk.toolbarW === 188, JSON.stringify(desk));
}
await browser.close();

// ---------------------------------------------------------------- WebKit-Kurztest (Safari-Engine, kein echtes iOS)
{
  const b = await webkit.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(FORGE);
  await p.waitForFunction(() => document.body.dataset.ready === '1', null, { timeout: 15000 });
  await p.evaluate(() => { const f = window.__FORGE; f.view.cam.y = 560; f.view.cam.x = 180; f.view.cam.z = f.view.fitZoom(); f.actions.requestRender(); });
  const n0 = await p.evaluate(() => window.__FORGE.doc.objects.length);
  await p.tap('.pal[data-kind="red"]');
  const pt = await p.evaluate(() => { const f = window.__FORGE; const r = f.view.canvas.getBoundingClientRect(); const s = f.view.toScreen(225, 650); return { x: r.left + s.x, y: r.top + s.y }; });
  await p.touchscreen.tap(pt.x, pt.y);
  await p.waitForTimeout(150);
  const r = await p.evaluate(() => ({ n: window.__FORGE.doc.objects.length, sel: window.__FORGE.doc.get([...window.__FORGE.S.selection][0]) }));
  check('[WebKit] iPhone-13-Profil: Palette + Tipp setzt ein rotes Hindernis', r.n === n0 + 1 && r.sel && r.sel.dimension === 'red', JSON.stringify(r.sel));
  await p.tap('#dk-props');
  const sheet = await p.evaluate(() => document.body.dataset.sheet);
  check('[WebKit] Bottom Sheet öffnet, keine Seitenfehler', sheet === 'props' && errs.length === 0, errs.join(' | '));
  await b.close();
}

console.log(`\n${total - failed}/${total} Mobile-LEVEL-FORGE-Checks bestanden (Chromium-Touch-Emulation + WebKit; kein echtes iOS Safari)`);
process.exit(failed ? 1 : 0);
