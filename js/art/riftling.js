// RIFTLING – Darstellung der Spielfigur aus den SVG-Assets in assets/riftling/.
// Die Assets werden einmal geladen und je Zoomstufe in Offscreen-Canvas gerastert (drawImage statt SVG pro Frame).
// Reine Darstellung: Kollision bleibt der Kreis HIT_RADIUS aus config.js. Austausch gegen PNG/WebP-Sprites:
// nur RIFTLING_SPRITE anpassen (Dateien, Rahmen, Anker), Spiellogik bleibt unberührt.
import { COLORS } from '../dimensions.js';
import { drawShip } from '../shapes.js';

export const RIFTLING_SPRITE = Object.freeze({
  files: {
    B: new URL('../../assets/riftling/body-blue.svg', import.meta.url).href,
    R: new URL('../../assets/riftling/body-red.svg', import.meta.url).href,
    eye: new URL('../../assets/riftling/eye.svg', import.meta.url).href,
  },
  frame: { w: 64, h: 72 }, // gemeinsamer Rahmen aller Ebenen (Asset-Einheiten)
  anchor: { x: 32, y: 40 }, // Kollisionsmitte im Rahmen
  eyeCenter: { x: 33, y: 34.6 },
  unitsPerPx: 0.56, // 1 Asset-Einheit = 0,56 u: Rahmen 36 × 40 u, sichtbarer Körper ~21 × 32 u (Hitbox Ø 16 u)
});

const MAX_CACHE = 12;

class RiftlingArt {
  constructor() {
    this.images = {};
    this.ready = false;
    this.failed = false;
    this.cache = new Map();
    this.glow = null;
    this.promise = null;
    this.skinPromises = new Map();
  }

  /** Lädt die Ebenen (nur im Browser). Bis dahin zeichnet drawRiftling die einfache Ersatzfigur. */
  load() {
    if (this.promise) return this.promise;
    if (typeof Image === 'undefined' || typeof document === 'undefined') {
      this.promise = Promise.resolve(false);
      return this.promise;
    }
    const one = (key, src) => new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { this.images[key] = img; resolve(); };
      img.onerror = () => reject(new Error(`Riftling-Asset nicht ladbar: ${src}`));
      img.src = src;
    });
    const f = RIFTLING_SPRITE.files;
    this.promise = Promise.all([one('B', f.B), one('R', f.R), one('eye', f.eye)])
      .then(() => { this.ready = true; return true; })
      .catch((err) => { this.failed = true; console.warn(err.message); return false; });
    return this.promise;
  }

  /** Rasterisierte Ebenen für eine Auflösung (Pixel pro Asset-Einheit, auf 0,5 gerundet). */
  loadSkin(id) {
    if(!['azure','crimson','golden','void'].includes(id))return this.load();
    if(this.skinPromises.has(id))return this.skinPromises.get(id);
    const promise=this.load().then(()=>Promise.all(['B','R'].map(dim=>new Promise(resolve=>{
      const img=new Image();img.onload=()=>{this.images[id+'-'+dim]=img;resolve(true);};img.onerror=()=>resolve(false);
      img.src=new URL(`../../assets/riftling/${id}-${dim}.svg`,import.meta.url).href;
    }))));
    this.skinPromises.set(id,promise);return promise;
  }

  layers(pxPerAsset, skin='original') {
    const resolution = Math.max(1, Math.ceil(pxPerAsset * 2) / 2);
    if(skin!=='original'&&(!this.images[skin+'-B']||!this.images[skin+'-R'])){this.loadSkin(skin);skin='original';}
    const key = skin+':'+resolution;
    let set = this.cache.get(key);
    if (set) return set;
    const { w, h } = RIFTLING_SPRITE.frame;
    const cw = Math.ceil(w * resolution);
    const ch = Math.ceil(h * resolution);
    const make = (img) => {
      const c = document.createElement('canvas');
      c.width = cw;
      c.height = ch;
      c.getContext('2d').drawImage(img, 0, 0, cw, ch);
      return c;
    };
    const white = make(this.images.B);
    const wctx = white.getContext('2d');
    wctx.globalCompositeOperation = 'source-in';
    wctx.fillStyle = '#ffffff';
    wctx.fillRect(0, 0, cw, ch);
    set = { B: make(this.images[skin+'-B'] || this.images.B), R: make(this.images[skin+'-R'] || this.images.R), eye: make(this.images.eye), white };
    this.cache.set(key, set);
    if (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value);
    return set;
  }

  /** Weiche Aura je Dimension (64 px Radialverlauf, wird skaliert). */
  glowSprites() {
    if (this.glow || typeof document === 'undefined') return this.glow;
    const mk = (rgb) => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, `rgba(${rgb},0.55)`);
      grad.addColorStop(0.45, `rgba(${rgb},0.22)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
      return c;
    };
    this.glow = { B: mk('47,214,255'), R: mk('255,45,138'), W: mk('255,255,255'), G:mk('255,195,67') };
    return this.glow;
  }
}

export const riftlingArt = new RiftlingArt();

/** Ruhepose (Editor, Vorschauen). */
export const IDLE_POSE = Object.freeze({ blend: 0, tilt: 0, sx: 1, sy: 1, bob: 0, eye: 1, flash: 0, glow: 1, alpha: 1 });

/**
 * Zeichnet den Riftling mit Mittelpunkt (x, y) im aktuellen Welt-Transform.
 * ppu = Gerätepixel pro Welteinheit (für die Rasterauflösung).
 * pose: blend 0 = Blau … 1 = Rot, tilt (rad), sx/sy (Squash & Stretch), bob (u), eye 0–1, flash 0–1 (weiß), glow, alpha.
 */
export function drawRiftling(ctx, x, y, pose, ppu, skin='original') {
  const p = pose || IDLE_POSE;
  const alpha = p.alpha === undefined ? 1 : p.alpha;
  if (alpha <= 0.002) return;
  if (!riftlingArt.ready) {
    riftlingArt.load();
    drawShip(ctx, x, y, p.blend > 0.5 ? 'R' : 'B', p.tilt || 0, p.flash || 0, alpha);
    return;
  }
  const S = RIFTLING_SPRITE;
  const u = S.unitsPerPx;
  const stretch = Math.max(p.sx || 1, p.sy || 1);
  const L = riftlingArt.layers(ppu * u * stretch, skin);
  const fw = S.frame.w * u;
  const fh = S.frame.h * u;
  const ox = -S.anchor.x * u;
  const oy = -S.anchor.y * u;
  const blend = Math.min(1, Math.max(0, p.blend || 0));

  ctx.save();
  ctx.translate(x, y + (p.bob || 0));

  if ((p.glow || 0) > 0) {
    const gs = riftlingArt.glowSprites();
    const r = 30 * (0.9 + 0.1 * (p.glow || 1));
    const ga = alpha * Math.min(1.6, p.glow || 1) * 0.95;
    if(skin==='golden'){ctx.globalAlpha=ga*.55;ctx.drawImage(gs.G,-r,-r-2,r*2,r*2);}
    if (blend < 0.999) { ctx.globalAlpha = ga * (1 - blend); ctx.drawImage(gs.B, -r, -r - 2, r * 2, r * 2); }
    if (blend > 0.001) { ctx.globalAlpha = ga * blend; ctx.drawImage(gs.R, -r, -r - 2, r * 2, r * 2); }
  }

  ctx.rotate(p.tilt || 0);
  ctx.scale(p.sx || 1, p.sy || 1);
  // Gleiche Silhouette in beiden Dimensionen: Blau deckend, Rot darüber eingeblendet (kein Durchscheinen).
  if (blend < 0.999) { ctx.globalAlpha = alpha; ctx.drawImage(L.B, ox, oy, fw, fh); }
  if (blend > 0.001) { ctx.globalAlpha = alpha * blend; ctx.drawImage(L.R, ox, oy, fw, fh); }

  const eye = p.eye === undefined ? 1 : p.eye;
  if (eye > 0.02) {
    const ex = (S.eyeCenter.x - S.anchor.x) * u;
    const ey = (S.eyeCenter.y - S.anchor.y) * u;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(1, Math.max(0.08, eye));
    ctx.drawImage(L.eye, ox - ex, oy - ey, fw, fh);
    ctx.restore();
  }
  if ((p.flash || 0) > 0.01) {
    ctx.globalAlpha = alpha * Math.min(1, p.flash);
    ctx.drawImage(L.white, ox, oy, fw, fh);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Farbe der Figur bei Mischung blend (für Partikel und Schweif). */
export function riftColor(blend) {
  return blend < 0.5 ? COLORS.B.main : COLORS.R.main;
}
