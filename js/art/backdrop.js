// Parallax-Hintergrund: dezente Neon-Architektur (zwei vorgerenderte Ebenen) und schwebende Energiesplitter.
// Liegt über dem CSS-Farbverlauf und unter dem Spielfeld; Deckkraft gering, damit Hindernisse immer klar bleiben.
// Ebenen werden je Größe einmal gerastert (seeded, also bei jedem Start identisch) und nur per drawImage verschoben.

const LAYERS = [
  { speed: 0.12, alpha: 0.55, seed: 7, towers: 7, scale: 0.75 },
  { speed: 0.32, alpha: 0.7, seed: 19, towers: 5, scale: 1 },
];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Vertikal kachelbare Ebene aus Türmen mit Rippen, Kanten-Licht und Fensterpunkten. */
function paintLayer(w, h, dpr, def) {
  const c = document.createElement('canvas');
  const k = Math.min(dpr, 1.5) * def.scale;
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d');
  g.scale(k, k);
  const r = rng(def.seed);
  const near = def.speed > 0.2;
  const spans = [];
  for (let i = 0; i < def.towers; i++) {
    const tw = (near ? 26 : 16) + r() * (near ? 46 : 34);
    // Türme bevorzugt an den Rändern: die Mitte (Spielfeld) bleibt ruhig
    const side = r() < 0.5 ? r() * 0.32 : 0.68 + r() * 0.32;
    const tx = side * w - tw / 2;
    spans.push([Math.max(0, Math.floor(tx - 4)), Math.min(w, Math.ceil(tx + tw + 4))]);
    g.fillStyle = near ? 'rgba(120,130,220,0.06)' : 'rgba(110,120,210,0.045)';
    g.fillRect(tx, 0, tw, h);
    g.strokeStyle = near ? 'rgba(170,180,255,0.16)' : 'rgba(150,160,255,0.11)';
    g.lineWidth = 1;
    g.strokeRect(tx + 0.5, -2, tw - 1, h + 4);
    const step = (near ? 46 : 30) + r() * 40;
    const off = r() * step;
    for (let y = off; y < h; y += step) {
      g.fillStyle = near ? 'rgba(170,180,255,0.14)' : 'rgba(150,160,255,0.09)';
      g.fillRect(tx - 3, y, tw + 6, near ? 2 : 1.5);
      const wins = Math.floor(tw / 9);
      for (let j = 0; j < wins; j++) {
        if (r() < 0.55) continue;
        g.fillStyle = r() < 0.2 ? 'rgba(255,255,255,0.32)' : 'rgba(190,200,255,0.16)';
        g.fillRect(tx + 4 + j * 9, y + 7 + r() * (step - 16), 3, 2);
      }
    }
    g.fillStyle = near ? 'rgba(220,230,255,0.22)' : 'rgba(200,210,255,0.13)';
    g.fillRect(r() < 0.5 ? tx : tx + tw - 1.5, 0, 1.5, h);
  }
  // Nur die Turm-Streifen werden pro Frame kopiert: der leere Rest kostet sonst volle Bildschirm-Füllrate.
  spans.sort((a, b) => a[0] - b[0]);
  const strips = [];
  for (const s of spans) {
    const last = strips[strips.length - 1];
    if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
    else if (s[1] > s[0]) strips.push([s[0], s[1]]);
  }
  return { canvas: c, k, strips };
}

export class Backdrop {
  constructor() {
    this.layers = [];
    this.shards = [];
    this.level = -1;
    this.key = '';
  }

  /** level: 0 = aus, 1 = eine Ebene + Splitter, 2 = beide Ebenen + Splitter. */
  configure(cssW, cssH, dpr, level, shardCount) {
    if (typeof document === 'undefined') return;
    const key = `${Math.round(cssW)}x${Math.round(cssH)}@${dpr}:${level}:${shardCount}`;
    if (key === this.key) return;
    this.key = key;
    this.level = level;
    this.w = cssW;
    this.h = Math.max(cssH, 640);
    this.viewH = cssH;
    this.layers = [];
    if (level > 0) {
      const defs = level > 1 ? LAYERS : [LAYERS[1]];
      for (const def of defs) this.layers.push({ def, ...paintLayer(cssW, this.h, dpr, def) });
    }
    const r = rng(97);
    this.shards = Array.from({ length: shardCount }, () => ({
      x: r(), y: r(), z: 0.45 + r() * 0.5, size: 1.6 + r() * 3.2, rot: r() * 6.28, spin: (r() - 0.5) * 1.2, a: 0.22 + r() * 0.35, drift: (r() - 0.5) * 6,
    }));
  }

  /**
   * Zeichnet im Bildschirm-Transform (CSS-px). scroll = Kamerahöhe in CSS-px, blend 0 Blau … 1 Rot,
   * progress 0–1 (leichte Farbverschiebung mit der Höhe), time für Splitter-Drift.
   */
  render(ctx, scroll, blend, progress, time) {
    if (this.level <= 0) return;
    const H = this.h;
    const vh = Math.min(this.viewH, H);
    for (const { def, canvas, k, strips } of this.layers) {
      const off = ((scroll * def.speed) % H + H) % H;
      ctx.globalAlpha = def.alpha * (0.85 + 0.3 * progress);
      // Zwei Kacheln, jeweils nur der sichtbare Teil: oben [0, off) aus dem Kachelende, darunter [off, vh) vom Kachelanfang
      const topH = Math.min(off, vh);
      const botH = vh - topH;
      for (const [x0, x1] of strips) {
        const sw = x1 - x0;
        if (topH > 0.5) ctx.drawImage(canvas, x0 * k, (H - off) * k, sw * k, topH * k, x0, 0, sw, topH);
        if (botH > 0.5) ctx.drawImage(canvas, x0 * k, 0, sw * k, botH * k, x0, off, sw, botH);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = blend < 0.5 ? '#2fd6ff' : '#ff2d8a';
    for (const s of this.shards) {
      const y = ((s.y * H + scroll * s.z * 0.55 + time * s.drift) % H + H) % H;
      const x = s.x * this.w;
      const r = s.rot + time * s.spin;
      const sz = s.size * s.z;
      const c = Math.cos(r) * sz;
      const sn = Math.sin(r) * sz * 0.45;
      ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(time * 1.7 + s.x * 20));
      ctx.beginPath();
      ctx.moveTo(x - sn, y - c * 1.8);
      ctx.lineTo(x + c * 0.5, y);
      ctx.lineTo(x + sn, y + c * 1.8);
      ctx.lineTo(x - c * 0.5, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
