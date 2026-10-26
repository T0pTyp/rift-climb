import {arenaFor,arenaCenter} from '../arena.js';
// LEVEL FORGE: Levelansicht (Kamera, Rendering, Treffertests).
// Weltkoordinaten wie im Spiel (x 0–Arena-Breite nach rechts, y ab Startlinie nach oben). Die Kamera ist rein
// darstellend: Zoom/Scroll ändern nie gespeicherte Positionen. Gezeichnet wird mit den Formen des Spiels.
import { WORLD_W, CLIMB_SPEED, PULSE_RADIUS, HIT_RADIUS } from '../config.js';
import { COLORS, isDeadly } from '../dimensions.js';
import { DIMENSION_COLOR, unitsPerBeat, halfHeights, START_DIMENSIONS } from '../level-data.js';
import { drawBar, drawSealClosed, drawSealOpen, drawFinish } from '../shapes.js';
import { drawRiftling, IDLE_POSE } from '../art/riftling.js';
import {isTrap,makeTrap,trapReach} from '../traps.js';
import {drawTrap} from '../art/traps.js';

export const ZOOM_MIN = 0.12;
export const ZOOM_MAX = 6;
const SEL = '#5ff3ff';
const HANDLE_PX = 9;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function objColor(o) {
  return o.type === 'seal' ? 'S' : DIMENSION_COLOR[o.dimension] || 'W';
}

/** Rechteck eines Objekts in Weltkoordinaten (Hinweise: Textbox um die Feldmitte). */
export function objRect(o,arena=arenaFor()) {
  if(isTrap(o)){const a=o.amplitude||0;return{x0:o.x-(o.axis==='x'?a:0),x1:o.x+o.w+(o.axis==='x'?a:0),y0:o.y-o.h/2-(o.axis==='y'?a:0),y1:o.y+o.h/2+(o.axis==='y'?a:0)};}
  if (o.type === 'hint') {
    const w = Math.min(arena.width - 8, Math.max(40, o.text.length * 9));
    return { x0: arena.width / 2 - w / 2, x1: arena.width / 2 + w / 2, y0: o.y - 9, y1: o.y + 9 };
  }
  return { x0: o.x, x1: o.x + o.w, y0: o.y - o.h / 2, y1: o.y + o.h / 2 };
}

export class ForgeView {
  constructor(canvas) {
    this.arena=arenaFor();
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: this.arena.width / 2, y: 300, z: 1 };
    this.W = 1;
    this.H = 1;
    this.dpr = 1;
    // Touch-Bedienung: größere Trefferflächen und Griffe (Finger statt Mauszeiger)
    this.touch = false;
    this.trapCache=new Map();
  }

  /** Schmale Ansicht (Smartphone): Spielfeld fast randlos, Beat-Beschriftung innen. */
  center(lane){return arenaCenter(lane,this.arena);}

  get compact() {
    return this.W < 600;
  }

  get handlePx() {
    return this.touch ? 18 : HANDLE_PX;
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.W * this.dpr);
    this.canvas.height = Math.round(this.H * this.dpr);
  }

  toWorld(sx, sy) {
    const { x, y, z } = this.cam;
    return { x: x + (sx - this.W / 2) / z, y: y - (sy - this.H / 2) / z };
  }

  toScreen(wx, wy) {
    const { x, y, z } = this.cam;
    return { x: this.W / 2 + (wx - x) * z, y: this.H / 2 - (wy - y) * z };
  }

  /** Zoom so, dass die Classic-Referenzbreite (gleiche Objektgröße in beiden Arenen) mit Rand in die Ansicht passt. */
  fitZoom() {
    if (this.compact) return clamp((this.W - 20) / WORLD_W, ZOOM_MIN, 2.4);
    return clamp(Math.min((this.W - 140) / WORLD_W, this.H / (130 * 6)), ZOOM_MIN, 2.4);
  }

  resetZoom() {
    this.cam.z = this.fitZoom();
    this.cam.x = this.arena.width / 2;
  }

  /** Zoomt um den Bildschirmpunkt (sx, sy): der Weltpunkt unter dem Mauszeiger bleibt stehen. */
  zoomAt(sx, sy, factor) {
    const before = this.toWorld(sx, sy);
    this.cam.z = clamp(this.cam.z * factor, ZOOM_MIN, ZOOM_MAX);
    const after = this.toWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
  }

  clampCamera(height) {
    const halfW = this.W / 2 / this.cam.z;
    this.cam.x = clamp(this.cam.x, Math.min(this.arena.width / 2, -halfW + 60 / this.cam.z), Math.max(this.arena.width / 2, this.arena.width + halfW - 60 / this.cam.z));
    this.cam.y = clamp(this.cam.y, -this.H / 2 / this.cam.z + 40, height + this.H / 2 / this.cam.z);
  }

  /** Sichtbarer y-Bereich (Welt). */
  visibleY() {
    const top = this.toWorld(0, 0).y;
    const bottom = this.toWorld(0, this.H).y;
    return { y0: bottom, y1: top };
  }

  /** Objekte im sichtbaren Bereich (binäre Suche auf der nach y sortierten Liste). */
  visibleObjects(doc, margin = 0) {
    const list = doc.byY;
    const { y0, y1 } = this.visibleY();
    const maxHalf = 500;
    let lo = 0;
    let hi = list.length;
    const from = y0 - margin - maxHalf;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].y < from) lo = mid + 1; else hi = mid;
    }
    const out = [];
    for (let i = lo; i < list.length; i++) {
      const o = list[i];
      if (o.y > y1 + margin + maxHalf) break;
      const r = isTrap(o)?{y0:o.y-trapReach(o),y1:o.y+trapReach(o)}:objRect(o,this.arena);
      if (r.y1 < y0 - margin || r.y0 > y1 + margin) continue;
      out.push(o);
    }
    return out;
  }

  /** Treffertest: zuoberst gezeichnetes Objekt unter dem Weltpunkt; Pseudo-Objekte Start/Ziel/Testmarker. */
  hitTest(doc, wx, wy, extras) {
    const tol = (this.touch ? 14 : 4) / this.cam.z;
    const vis = this.visibleObjects(doc, 20);
    let best = null;
    let bestArea = Infinity;
    for (const o of vis) {
      const r = objRect(o,this.arena);
      if (wx < r.x0 - tol || wx > r.x1 + tol || wy < r.y0 - tol || wy > r.y1 + tol) continue;
      const area = (r.x1 - r.x0) * (r.y1 - r.y0);
      if (area <= bestArea) { best = o.id; bestArea = area; }
    }
    if (best) return best;
    const lvl = doc.level;
    if (extras.testMarker && Math.abs(wy - extras.testMarker.y) < 8 / this.cam.z + 4 && wx >= 0 && wx <= this.arena.width) return '__test';
    if (Math.hypot(wx - this.center(lvl.start.lane), wy) < 16 + tol) return '__start';
    if (Math.abs(wy - (lvl.finish.y - 3)) < 6 + tol && wx >= 0 && wx <= this.arena.width) return '__finish';
    return null;
  }

  /** Griffe zum Skalieren eines einzelnen Hindernisses/Siegels. */
  handleAt(o, sx, sy) {
    const pts = this.handlePoints(o);
    if (!pts) return null;
    for (const [k, p] of Object.entries(pts)) {
      if (Math.abs(sx - p.x) <= this.handlePx && Math.abs(sy - p.y) <= this.handlePx) return k;
    }
    return null;
  }

  /** Bildschirmpositionen der Griffe; bei dünnen Objekten außerhalb, damit die Fläche zum Verschieben frei bleibt. */
  handlePoints(o) {
    if (!o || o.type === 'hint') return null;
    const a = this.toScreen(o.x, o.y + o.h / 2);
    const b = this.toScreen(o.x + o.w, o.y - o.h / 2);
    const my = (a.y + b.y) / 2;
    const mx = (a.x + b.x) / 2;
    const r = this.handlePx;
    const offY = b.y - a.y < 4 * r ? r + 3 : 0;
    const offX = b.x - a.x < 4 * r ? r + 3 : 0;
    return {
      l: { x: a.x - offX, y: my },
      r: { x: b.x + offX, y: my },
      t: { x: mx, y: a.y - offY },
      b: { x: mx, y: b.y + offY },
    };
  }

  /** Start-/Testmarker: derselbe Riftling wie im Spiel (Farbe der Startdimension). */
  marker(x, y, dim, alpha) {
    const pose = { ...IDLE_POSE, blend: dim === 'R' ? 1 : 0, alpha, glow: 0.7 };
    drawRiftling(this.ctx, x, y, pose, this.dpr * this.cam.z, 'original');
  }

  render(s) {
    const { ctx, cam, W, H, dpr } = this;
    const lvl = s.doc.level;
    const z = cam.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#04040c';
    ctx.fillRect(0, 0, W, H);
    // Welt-Transform: Punkte werden mit (x, -y) gezeichnet
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 + cam.y * z));
    const { y0, y1 } = this.visibleY();
    const top = Math.min(y1, lvl.height + 400);
    const bottom = Math.max(y0, -400);
    const px = 1 / z;

    // Spielfeld
    const fy0 = Math.max(y0, 0);
    const fy1 = Math.min(y1, lvl.height);
    ctx.fillStyle = '#0a0a1d';
    if (fy1 > fy0) ctx.fillRect(0, -fy1, this.arena.width, fy1 - fy0);
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    if (y1 > lvl.height) ctx.fillRect(0, -y1, this.arena.width, y1 - Math.max(lvl.height, y0));
    ctx.fillStyle = s.dimMode === 'R' ? COLORS.R.main : s.dimMode === 'B' ? COLORS.B.main : '#8b8bb0';
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-2 * px, -top, 2 * px, top - bottom);
    ctx.fillRect(this.arena.width, -top, 2 * px, top - bottom);
    ctx.globalAlpha = 1;

    // Spuren
    ctx.lineWidth = px;
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath();
    for (let i = 1; i < this.arena.lanes; i++) { ctx.moveTo(this.arena.inset+(i-.5)*this.arena.step, -top); ctx.lineTo(this.arena.inset+(i-.5)*this.arena.step, -bottom); }
    ctx.stroke();

    // Raster (horizontal und vertikal, sobald dicht genug sichtbar)
    if (s.grid.show) {
      const g = s.grid.size;
      if (g * z >= 6) {
        ctx.strokeStyle = 'rgba(160,170,255,0.07)';
        ctx.beginPath();
        for (let x = g; x < this.arena.width; x += g) { ctx.moveTo(x, -top); ctx.lineTo(x, -bottom); }
        const gy0 = Math.ceil(bottom / g) * g;
        for (let y = gy0; y <= top; y += g) { ctx.moveTo(0, -y); ctx.lineTo(this.arena.width, -y); }
        ctx.stroke();
      }
    }

    // Beat-Marker (ganze, halbe, Viertelbeats) – Abstand aus BPM und echter Steiggeschwindigkeit
    const upb = unitsPerBeat(lvl.bpm);
    const meter = lvl.beatsPerBar || 4;
    const beatLabels = [];
    if (s.beats) {
      const divs = [[1, 'rgba(47,214,255,0.22)'], [2, 'rgba(47,214,255,0.10)'], [4, 'rgba(255,255,255,0.05)']];
      for (const [div, col] of divs) {
        const step = upb / div;
        if (step * z < 7) continue;
        ctx.strokeStyle = col;
        ctx.beginPath();
        const b0 = Math.ceil(Math.max(0, bottom) / step);
        for (let k = b0; k * step <= top; k++) {
          if (div > 1 && k % div === 0) continue;
          if (div === 4 && k % 2 === 0) continue;
          ctx.moveTo(0, -k * step);
          ctx.lineTo(this.arena.width, -k * step);
          if (div === 1) beatLabels.push(k);
        }
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(47,214,255,0.45)';
      ctx.beginPath();
      for (let k = Math.ceil(Math.max(0, bottom) / (upb * meter)); k * upb * meter <= top; k++) {
        ctx.moveTo(0, -k * upb * meter);
        ctx.lineTo(this.arena.width, -k * upb * meter);
      }
      ctx.stroke();
    }

    // Abschnitte (aus der Leveldatei) und Hinweise wie im Spiel
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (lvl.sections) {
      ctx.font = '800 11px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (const sec of lvl.sections) {
        if (sec.y === 0 || sec.labelY < bottom || sec.labelY > top) continue;
        ctx.fillText(`${sec.id} · ${sec.name.toUpperCase()}`, this.arena.width / 2, -sec.labelY);
      }
    }

    // Ziel, Ende der spielbaren Höhe, Start
    drawFinish(ctx, this.arena.width, -lvl.finish.y, 'ZIEL · 100 %');
    ctx.strokeStyle = 'rgba(255,90,90,0.5)';
    ctx.setLineDash([6 * px, 6 * px]);
    ctx.beginPath();
    ctx.moveTo(0, -lvl.height);
    ctx.lineTo(this.arena.width, -lvl.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(26,255,178,0.6)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(this.arena.width, 0);
    ctx.stroke();
    const startDim = START_DIMENSIONS[lvl.start.dimension];
    this.marker(this.center(lvl.start.lane), 0, startDim, 1);
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.fillStyle = '#1affb2';
    ctx.fillText('START', this.center(lvl.start.lane), 26);

    // Objekte im sichtbaren Ausschnitt
    const vis = this.visibleObjects(s.doc, 30);
    s.stats.drawn = vis.length;
    for (const o of vis) {
      if (o.type === 'hint') {
        ctx.font = '800 14px system-ui, sans-serif';
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(o.text, this.arena.width / 2, -o.y);
        ctx.globalAlpha = 1;
        continue;
      }
      const hh = o.h / 2;
      if(isTrap(o)) {
        let runtime=this.trapCache.get(o.id);if(!runtime){runtime=makeTrap(o);this.trapCache.set(o.id,runtime);while(this.trapCache.size>128)this.trapCache.delete(this.trapCache.keys().next().value);}
        Object.assign(runtime,o);runtime.color=o.dimension==='red'?'R':'B';drawTrap(ctx,runtime,s.previewTime||0,-o.y,s.dimMode);
      } else if (o.type === 'seal') {
        if (s.sealOpen.has(o.id)) drawSealOpen(ctx, o.x, -o.y, o.w, hh, 1);
        else drawSealClosed(ctx, o.x, -o.y, o.w, hh, s.selection.has(o.id) && s.showReach, 0);
      } else {
        const col = objColor(o);
        const active = s.dimMode === 'both' || isDeadly(col, s.dimMode);
        drawBar(ctx, col, o.x, -o.y, o.w, hh, active, 0);
      }
    }

    // Kollisionsflächen (wie im Spiel: horizontal sichtbar, vertikal je 2 u kleiner)
    for (const o of vis) {
      if (o.type === 'hint') continue;
      if(isTrap(o))continue;
      if (!s.hitboxes && !s.selection.has(o.id)) continue;
      const { chh } = halfHeights(o.h);
      ctx.strokeStyle = o.type === 'seal' ? '#ff8800' : '#ffea00';
      ctx.lineWidth = px;
      ctx.setLineDash([3 * px, 3 * px]);
      ctx.strokeRect(o.x, -o.y - chh, o.w, chh * 2);
      ctx.setLineDash([]);
    }

    // Prüfungsergebnisse direkt am Objekt
    for (const o of vis) {
      const sev = s.issuesById.get(o.id);
      if (!sev) continue;
      const r = objRect(o,this.arena);
      ctx.strokeStyle = sev === 'error' ? '#ff4d6d' : '#ffb020';
      ctx.lineWidth = 2 * px;
      ctx.setLineDash(sev === 'error' ? [] : [4 * px, 3 * px]);
      ctx.strokeRect(r.x0 - 7 * px, -r.y1 - 7 * px, r.x1 - r.x0 + 14 * px, r.y1 - r.y0 + 14 * px);
      ctx.setLineDash([]);
    }

    // Pulse-Reichweite ausgewählter Siegel: Bereich, aus dem ein Tipp das Siegel öffnet
    if (s.showReach) {
      for (const id of s.selection) {
        const o = s.doc.get(id);
        if (o && o.type === 'seal') this.drawReach(o, px);
      }
    }

    // Testmarker (PLAY FROM HERE)
    if (s.testMarker) {
      const t = s.testMarker;
      ctx.strokeStyle = '#1affb2';
      ctx.lineWidth = 2 * px;
      ctx.setLineDash([8 * px, 5 * px]);
      ctx.beginPath();
      ctx.moveTo(0, -t.y);
      ctx.lineTo(this.arena.width, -t.y);
      ctx.stroke();
      ctx.setLineDash([]);
      this.marker(this.center(t.lane), -t.y, t.dim, 0.75);
      ctx.font = '800 10px system-ui, sans-serif';
      ctx.fillStyle = '#1affb2';
      ctx.textAlign = 'left';
      ctx.fillText('▶ PLAY FROM HERE', 4, -t.y - 10);
      ctx.textAlign = 'center';
    }

    // Hover und Auswahl
    const hov = s.hover && s.hover !== '__start' && s.hover !== '__finish' && s.hover !== '__test' ? s.doc.get(s.hover) : null;
    if (hov && !s.selection.has(hov.id)) {
      const r = objRect(hov,this.arena);
      ctx.strokeStyle = 'rgba(95,243,255,0.5)';
      ctx.lineWidth = px;
      ctx.strokeRect(r.x0 - 2 * px, -r.y1 - 2 * px, r.x1 - r.x0 + 4 * px, r.y1 - r.y0 + 4 * px);
    }
    const selObjs = [];
    for (const id of s.selection) {
      const o = s.doc.get(id);
      if (o) selObjs.push(o);
    }
    for (const o of selObjs) {
      const r = objRect(o,this.arena);
      ctx.strokeStyle = SEL;
      ctx.lineWidth = 2 * px;
      ctx.shadowColor = SEL;
      ctx.shadowBlur = 8;
      ctx.strokeRect(r.x0 - 3 * px, -r.y1 - 3 * px, r.x1 - r.x0 + 6 * px, r.y1 - r.y0 + 6 * px);
      ctx.shadowBlur = 0;
    }
    if (s.selection.has('__start') || s.hover === '__start') {
      ctx.strokeStyle = SEL;
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.arc(this.center(lvl.start.lane), 0, 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (s.selection.has('__finish') || s.hover === '__finish') {
      ctx.strokeStyle = SEL;
      ctx.lineWidth = 2 * px;
      ctx.strokeRect(-3 * px, -lvl.finish.y - 3 * px, this.arena.width + 6 * px, 6 + 6 * px);
    }
    if (s.selection.has('__test') || s.hover === '__test') {
      ctx.strokeStyle = SEL;
      ctx.lineWidth = 2 * px;
      ctx.strokeRect(-3 * px, -s.testMarker.y - 6 * px, this.arena.width + 6 * px, 12 * px);
    }

    // Platzierungsvorschau am Mauszeiger
    if (s.ghost) {
      const g = s.ghost;
      ctx.globalAlpha = 0.6;
      if (g.type === 'hint') {
        ctx.font = '800 14px system-ui, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(g.text, this.arena.width / 2, -g.y);
      } else if(isTrap(g)) {
        drawTrap(ctx,makeTrap(g),s.previewTime||0,-g.y,'both');
      } else if (g.type === 'seal') {
        drawSealClosed(ctx, g.x, -g.y, g.w, g.h / 2);
      } else if (g.type === 'obstacle') {
        drawBar(ctx, objColor(g), g.x, -g.y, g.w, g.h / 2, true);
      } else if (g.type === 'start' || g.type === 'test') {
        this.marker(this.center(g.lane), -g.y, g.dim || 'B', 1);
      } else if (g.type === 'finish') {
        drawFinish(ctx, this.arena.width, -g.y, '');
      }
      ctx.globalAlpha = 1;
      if (g.w) {
        ctx.strokeStyle = SEL;
        ctx.lineWidth = px;
        ctx.setLineDash([4 * px, 4 * px]);
        ctx.strokeRect(g.x, -g.y - g.h / 2, g.w, g.h);
        ctx.setLineDash([]);
      }
    }

    // Rhythmus-Vorschau: Spielerhöhe bei 260 u/s
    if (s.playhead !== null) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * px;
      ctx.beginPath();
      ctx.moveTo(-10 * px, -s.playhead);
      ctx.lineTo(this.arena.width + 10 * px, -s.playhead);
      ctx.stroke();
    }

    // --- Bildschirm-Ebene: Beat-Beschriftung, Maße, Griffe, Auswahlrahmen
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = '600 10px ui-monospace, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const fieldLeft = this.toScreen(0, 0).x;
    if (s.beats && upb * z >= 18) {
      // Ohne Platz links vom Spielfeld: Beschriftung innen, knapp über der Beatlinie
      const inside = fieldLeft < 70;
      if (inside) { ctx.textAlign = 'left'; ctx.textBaseline = 'bottom'; }
      for (const k of beatLabels) {
        const sy = this.toScreen(0, k * upb).y;
        ctx.fillStyle = k % meter === 0 ? 'rgba(47,214,255,0.85)' : 'rgba(160,200,255,0.45)';
        const t = (k * upb / CLIMB_SPEED).toFixed(2);
        if (inside) ctx.fillText(k % meter === 0 ? `${k} · ${t} s` : String(k), Math.max(2, fieldLeft) + 3, sy - 1);
        else ctx.fillText(`${k} · ${t} s`, fieldLeft - 8, sy);
      }
      ctx.textBaseline = 'middle';
    }
    if (selObjs.length === 1 && selObjs[0].type !== 'hint') {
      const o = selObjs[0];
      const a = this.toScreen(o.x, o.y + o.h / 2);
      const b = this.toScreen(o.x + o.w, o.y - o.h / 2);
      const pts = this.handlePoints(o);
      ctx.fillStyle = SEL;
      if (this.touch) {
        for (const p of Object.values(pts)) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.fillStyle = SEL;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#04040c';
          ctx.stroke();
        }
      } else {
        for (const p of Object.values(pts)) ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
      }
      ctx.font = '700 11px ui-monospace, monospace';
      ctx.textAlign = 'center';
      const label = `${fmt(o.w)} × ${fmt(o.h)} u  ·  x ${fmt(o.x)}  y ${fmt(o.y)}`;
      const tw = ctx.measureText(label).width + 12;
      const ly = pts.t.y - 16;
      ctx.fillStyle = 'rgba(4,4,12,0.85)';
      ctx.fillRect((a.x + b.x) / 2 - tw / 2, ly - 9, tw, 18);
      ctx.fillStyle = SEL;
      ctx.fillText(label, (a.x + b.x) / 2, ly);
    }
    if (s.marquee) {
      const m = s.marquee;
      ctx.fillStyle = 'rgba(95,243,255,0.08)';
      ctx.strokeStyle = SEL;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.fillRect(Math.min(m.x0, m.x1), Math.min(m.y0, m.y1), Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
      ctx.strokeRect(Math.min(m.x0, m.x1) + 0.5, Math.min(m.y0, m.y1) + 0.5, Math.abs(m.x1 - m.x0), Math.abs(m.y1 - m.y0));
      ctx.setLineDash([]);
    }
  }

  drawReach(o, px) {
    const { ctx } = this;
    const R = PULSE_RADIUS;
    const hh = o.h / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, -1e7, this.arena.width, 2e7);
    ctx.clip();
    ctx.beginPath();
    ctx.roundRect(o.x - R, -o.y - hh - R, o.w + 2 * R, o.h + 2 * R, R);
    ctx.fillStyle = 'rgba(255,194,61,0.05)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,194,61,0.55)';
    ctx.lineWidth = 1.5 * px;
    ctx.setLineDash([5 * px, 6 * px]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // Tipp-Zonen je Spur: unterhalb des Siegels, solange der Abstand zur sichtbaren Fläche ≤ Pulse-Radius ist
    ctx.lineWidth = 4 * px;
    for (let lane = 0; lane < this.arena.lanes; lane++) {
      const c = this.center(lane);
      const dx = Math.max(o.x - c, 0, c - (o.x + o.w));
      if (dx > R) continue;
      const reach = Math.sqrt(R * R - dx * dx);
      const yTop = o.y - hh - HIT_RADIUS;
      const yBottom = o.y - hh - reach;
      ctx.strokeStyle = 'rgba(255,194,61,0.8)';
      ctx.beginPath();
      ctx.moveTo(c, -yBottom);
      ctx.lineTo(c, -yTop);
      ctx.stroke();
    }
    ctx.lineWidth = px;
    ctx.font = '700 9px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,194,61,0.9)';
    ctx.textAlign = 'left';
    ctx.fillText(`PULSE-REICHWEITE ${R} u`, Math.max(2, o.x - R + 6), -o.y + hh + R - 8);
    ctx.textAlign = 'center';
  }
}

export function fmt(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
