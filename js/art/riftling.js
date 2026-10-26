// Official CLASSIC BLOB. Transparent body texture + separate two-eye blink layer.
// WebP body and SVG eyes are loaded once, rasterized above the actual display
// resolution and cached. Every consumer uses this renderer; no per-frame tinting.
// Reine Darstellung: Kollision bleibt der Kreis HIT_RADIUS aus config.js. Austausch gegen PNG/WebP-Sprites:
// nur RIFTLING_SPRITE anpassen (Dateien, Rahmen, Anker), Spiellogik bleibt unberührt.
import { COLORS } from '../dimensions.js';
import {recolorRiftling,RIFTLING_SKINS} from './riftling-palette.js';

export const RIFTLING_SPRITE = Object.freeze({
  files: {
    B: new URL('../../assets/characters/riftling/body-blue.webp', import.meta.url).href,
    R: new URL('../../assets/characters/riftling/body-red.webp', import.meta.url).href,
    eye: new URL('../../assets/characters/riftling/eyes-blue.svg', import.meta.url).href,
    eyeR: new URL('../../assets/characters/riftling/eyes-red.svg', import.meta.url).href,
  },
  frame: { w: 64, h: 64 },
  anchor: { x: 38, y: 38 }, // main gel mass, not the bounding box of the tuft
  eyeCenter: { x: 44, y: 33.6 },
  unitsPerPx: 0.52, // complete frame 33.28 u; round body ~23 u; collision stays Ø16 u
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

  /** Loads four official layers. A two-eye gel fallback keeps the identity during loading. */
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
    this.promise = Promise.all([one('B', f.B), one('R', f.R), one('eye', f.eye),one('eyeR',f.eyeR)])
      .then(() => { this.ready = true; return true; })
      .catch((err) => { this.failed = true; console.warn(err.message); return false; });
    return this.promise;
  }

  /** Rasterisierte Ebenen für eine Auflösung (Pixel pro Asset-Einheit, auf 0,5 gerundet). */
  loadSkin(id) {
    if(!RIFTLING_SKINS.includes(id)||id==='original')return this.load();
    if(this.skinPromises.has(id))return this.skinPromises.get(id);
    const promise=this.load().then(ready=>{if(!ready)return false;for(const dim of ['B','R']){
      const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(this.images.B,0,0,512,512);const pixels=g.getImageData(0,0,512,512);recolorRiftling(pixels.data,id,dim);g.putImageData(pixels,0,0);this.images[id+'-'+dim]=c;
    }return true;});
    this.skinPromises.set(id,promise);return promise;
  }

  layers(pxPerAsset, skin='original') {
    if(!RIFTLING_SKINS.includes(skin))skin='original';
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
    set = { B: make(this.images[skin+'-B'] || this.images.B), R: make(this.images[skin+'-R'] || this.images.R), eye: make(this.images.eye),eyeR:make(this.images.eyeR), white };
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
    drawBlobFallback(ctx,x,y,p,alpha);
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
    const r = 23 * (0.9 + 0.1 * (p.glow || 1));
    const ga = alpha * Math.min(1.6, p.glow || 1) * 0.7;
    if(skin==='golden'){ctx.globalAlpha=ga*.55;ctx.drawImage(gs.G,-r,-r-2,r*2,r*2);}
    if (blend < 0.999) { ctx.globalAlpha = ga * (1 - blend); ctx.drawImage(gs.B, -r, -r - 2, r * 2, r * 2); }
    if (blend > 0.001) { ctx.globalAlpha = ga * blend; ctx.drawImage(gs.R, -r, -r - 2, r * 2, r * 2); }
  }

  ctx.rotate(p.tilt || 0);
  ctx.scale(p.sx || 1, p.sy || 1);
  // Secondary flowing tendrils, behind the unchanged body silhouette.
  if(p.flow){ctx.globalAlpha=alpha*.3;ctx.strokeStyle=blend>.5?COLORS.R.main:COLORS.B.main;ctx.lineWidth=.5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-3,8);ctx.bezierCurveTo(-5,11+p.flow,1,12+p.flow,3,14+p.flow);ctx.stroke();}
  // Gleiche Silhouette in beiden Dimensionen: Blau deckend, Rot darüber eingeblendet (kein Durchscheinen).
  if (blend < 0.999) { ctx.globalAlpha = alpha; ctx.drawImage(L.B, ox, oy, fw, fh); }
  if (blend > 0.001) { ctx.globalAlpha = alpha * blend; ctx.drawImage(L.R, ox, oy, fw, fh); }

  const eye = p.eye === undefined ? 1 : p.eye;
  if (eye > 0.02) {
    const ex = (S.eyeCenter.x - S.anchor.x) * u;
    const ey = (S.eyeCenter.y - S.anchor.y) * u;
    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(ex+(p.gazeX||0), ey+(p.gazeY||0));
    ctx.scale(1, Math.max(0.08, eye));
    if(blend<.999){ctx.globalAlpha=alpha;ctx.drawImage(L.eye, ox - ex, oy - ey, fw, fh);}
    if(blend>.001){ctx.globalAlpha=alpha*blend;ctx.drawImage(L.eyeR, ox - ex, oy - ey, fw, fh);}
    ctx.restore();
  }
  if ((p.flash || 0) > 0.01) {
    ctx.globalAlpha = alpha * Math.min(1, p.flash);
    ctx.drawImage(L.white, ox, oy, fw, fh);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Same two-eyed gel identity while the texture is loading / if an asset fails.
// No legacy one-eye ship is rendered. This path never touches a Player body.
function drawBlobFallback(ctx,x,y,p,alpha){
 ctx.save();ctx.translate(x,y+(p.bob||0));ctx.rotate(p.tilt||0);ctx.scale(p.sx||1,p.sy||1);ctx.globalAlpha=alpha;
 const color=p.blend>.5?COLORS.R.main:COLORS.B.main,g=ctx.createRadialGradient(-4,-6,1,0,0,15);g.addColorStop(0,'#e2ffff');g.addColorStop(.3,color);g.addColorStop(1,'#10377e');ctx.fillStyle=g;ctx.strokeStyle=color;ctx.lineWidth=.7;
 ctx.beginPath();ctx.moveTo(-9,-6);ctx.bezierCurveTo(-6,-13,2,-12,1,-17);ctx.bezierCurveTo(-3,-22,-5,-18,-5,-18);ctx.bezierCurveTo(-8,-23,8,-22,11,-10);ctx.bezierCurveTo(18,-3,11,12,8,12);ctx.bezierCurveTo(5,16,4,9,1,12);ctx.bezierCurveTo(-5,18,-5,8,-8,10);ctx.bezierCurveTo(-13,12,-11,5,-12,4);ctx.bezierCurveTo(-23,10,-23,-3,-13,-3);ctx.bezierCurveTo(-10,-4,-10,-5,-9,-6);ctx.fill();ctx.stroke();
 ctx.fillStyle='#020b28';ctx.beginPath();ctx.ellipse(3,-1,8.5,8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle=color;const blink=p.eye===undefined?1:p.eye;for(const [ex,rx]of [[0,1.5],[7,1.1]]){ctx.beginPath();ctx.ellipse(ex,-2,rx,2.7*Math.max(.05,blink),0,0,Math.PI*2);ctx.fill();}ctx.restore();
}

/** Farbe der Figur bei Mischung blend (für Partikel und Schweif). */
export function riftColor(blend) {
  return blend < 0.5 ? COLORS.B.main : COLORS.R.main;
}
