// Parallax-Hintergrund: dezente Neon-Architektur (zwei vorgerenderte Ebenen) und schwebende Energiesplitter.
// Farbverlauf/Vignette sind ebenfalls gecacht; Architektur bleibt dunkel unter den klaren Hindernissen.
// Ebenen werden je Größe einmal gerastert (seeded, also bei jedem Start identisch) und nur per drawImage verschoben.

const LAYERS = [
  { speed: 0.12, alpha: 0.55, seed: 7, towers: 7, scale: 0.75 },
  { speed: 0.32, alpha: 0.7, seed: 19, towers: 5, scale: 1 },
];
const PALETTES = {
  spire: { top:'#061829', bottom:'#02050e', a:'#35d9ed', b:'#865cff', seed:0 },
  fracture: { top:'#160c2d', bottom:'#040711', a:'#699aff', b:'#ff3b97', seed:113 },
  core: { top:'#20091e', bottom:'#050612', a:'#fc43a8', b:'#35dcf4', seed:271 },
  gears:{top:'#101d2a',bottom:'#04070d',a:'#57cedd',b:'#d7a86d',seed:329},
  voltage:{top:'#0d1837',bottom:'#050713',a:'#5cddff',b:'#bd70ff',seed:441},
  singularity:{top:'#210e36',bottom:'#060410',a:'#ca65ff',b:'#ffcc68',seed:557},
};

function background(w,h,dpr,palette,red) {
  const c=document.createElement('canvas'); c.width=Math.round(w*dpr); c.height=Math.round(h*dpr);
  const g=c.getContext('2d'); g.scale(dpr,dpr);
  const gradient=g.createLinearGradient(0,0,0,h);
  gradient.addColorStop(0,red?'#240b24':palette.top); gradient.addColorStop(1,palette.bottom);
  g.fillStyle=gradient;g.fillRect(0,0,w,h);
  const halo=g.createRadialGradient(w*.5,h*.35,0,w*.5,h*.35,h*.72);
  halo.addColorStop(0,red?'rgba(222,40,129,.12)':'rgba(20,166,202,.10)');halo.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle=halo;g.fillRect(0,0,w,h);
  const vignette=g.createLinearGradient(0,0,w,0);
  vignette.addColorStop(0,'rgba(0,0,0,.55)');vignette.addColorStop(.28,'rgba(0,0,0,0)');
  vignette.addColorStop(.72,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.55)');
  g.fillStyle=vignette;g.fillRect(0,0,w,h);return c;
}

function gearSprite() {
 const c=document.createElement('canvas');c.width=c.height=192;const g=c.getContext('2d');g.translate(96,96);g.fillStyle='#192b40';g.strokeStyle='#7696ad';g.lineWidth=2;
 g.beginPath();for(let i=0;i<96;i++){const a=i*Math.PI/48,r=i%4<2?89:77;g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}g.closePath();g.fill();g.stroke();
 for(const r of [65,57,25]){g.beginPath();g.arc(0,0,r,0,Math.PI*2);g.stroke();}
 for(let i=0;i<8;i++){g.rotate(Math.PI/4);g.fillStyle='#050c18';g.fillRect(33,-7,18,14);g.fillStyle='#bb9f71';g.fillRect(68,-2,7,4);}
 return c;
}

// Detailed architecture is painted once into the existing parallax tiles.
// Neutral, low-luminance colors keep decorative structures distinct from hazards.
function architecture(g,w,h,theme,near,r) {
  const pal=PALETTES[theme]||PALETTES.spire;
  g.lineWidth=near?1.2:.8;
  for(let i=0;i<7;i++) {
    const y=i*h/6, side=i%2?1:-1, edge=side>0?w*.97:w*.03;
    g.strokeStyle=i%2?pal.a:pal.b;g.globalAlpha=near?.18:.10;
    if(theme==='spire') {
      // Buttresses, inset panels, stepped cantilevers and engraved light slots.
      const reach=w*(.14+r()*.08);
      g.beginPath();g.moveTo(edge,y-80);g.lineTo(edge-side*reach,y-42);
      g.lineTo(edge-side*reach,y+42);g.lineTo(edge,y+80);g.stroke();
      for(let j=0;j<3;j++)g.strokeRect(edge-side*(reach-8-j*5),y-28,side*(reach-18-j*5),56);
      g.globalAlpha=.27;g.fillStyle=pal.a;g.fillRect(edge-side*reach,y-12,2,24);
    } else if(theme==='fracture') {
      const x=edge-side*w*(.06+r()*.2),s=22+r()*42;
      g.fillStyle='#383452';g.beginPath();g.moveTo(x,y-s);g.lineTo(x+side*s*.6,y-s*.6);
      g.lineTo(x+side*s*.9,y+s*.4);g.lineTo(x-side*s*.2,y+s);g.closePath();g.fill();g.stroke();
      g.beginPath();g.moveTo(x,y-s);g.lineTo(x+side*6,y);g.lineTo(x+side*s*.9,y+s*.4);g.stroke();
      g.globalAlpha=.2;g.setLineDash([3,8]);g.beginPath();g.moveTo(edge,y-70);g.lineTo(x,y);g.stroke();g.setLineDash([]);
    } else if(theme==='gears') {
      const x=edge-side*w*.11;
      g.fillStyle='#263348';g.fillRect(x-20,y-65,40,130);g.strokeRect(x-20,y-65,40,130);
      for(let j=0;j<7;j++){g.beginPath();g.moveTo(x-22,y-51+j*17);g.lineTo(x+22,y-45+j*17);g.stroke();}
      g.strokeRect(x-side*35,y-31,side*35,62);
    } else if(theme==='voltage') {
      const x=edge-side*w*.12;
      for(let j=0;j<4;j++){g.strokeRect(x-20,y-45+j*25,40,13);g.beginPath();g.moveTo(x-27,y-38+j*25);g.lineTo(x+27,y-38+j*25);g.stroke();}
      g.beginPath();g.moveTo(edge,y-75);g.lineTo(x,y-60);g.lineTo(x,y+65);g.lineTo(edge,y+78);g.stroke();
    } else {
      // Reactor sockets and sixfold containment chambers.
      const x=edge-side*w*.08, radius=32+r()*24;
      for(let ring=0;ring<3;ring++) {
        const rad=radius+ring*7;g.beginPath();
        for(let j=0;j<=6;j++){const a=j*Math.PI/3;const px=x+Math.cos(a)*rad,py=y+Math.sin(a)*rad;j?g.lineTo(px,py):g.moveTo(px,py);}g.stroke();
      }
      g.fillStyle=pal.a;g.globalAlpha=.18;g.fillRect(x-3,y-16,6,32);
      g.strokeStyle='#ad9363';g.beginPath();g.moveTo(x-12,y-24);g.lineTo(x+12,y-24);g.stroke();
    }
  }
  g.globalAlpha=1;
}

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
function paintLayer(w, h, dpr, def, theme) {
  const c = document.createElement('canvas');
  const k = Math.min(dpr, 1.5) * def.scale;
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  const g = c.getContext('2d');
  g.scale(k, k);
  const r = rng(def.seed + (PALETTES[theme]?.seed || 0));
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
  architecture(g,w,h,theme,near,r);
  // Include architectural wings while keeping the gameplay center calm.
  spans.push([0,w*.32],[w*.68,w]);
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
    this.theme = 'spire';
    this.key = '';
  }

  /** Eine feste Darstellung: beide Architektur-Ebenen und 26 Energiefragmente. */
  configure(cssW, cssH, dpr, theme = 'spire') {
    if (typeof document === 'undefined') return;
    const key = `${Math.round(cssW)}x${Math.round(cssH)}@${dpr}:${theme}`;
    if (key === this.key) return;
    this.key = key;
    this.theme = theme;
    this.w = cssW;
    this.h = Math.max(cssH, 640);
    this.viewH = cssH;
    if(theme==='infinity'){this.variants=new Map();this.variantSize={cssW,cssH,dpr};return;}
    const palette=PALETTES[theme]||PALETTES.spire;
    this.backgrounds=[background(cssW,cssH,dpr,palette,false),background(cssW,cssH,dpr,palette,true)];
    if(theme==='gears')this.gear=gearSprite();
    this.layers = [];
    {
      for (const def of LAYERS) this.layers.push({ def, ...paintLayer(cssW, this.h, dpr, def, theme) });
    }
    const r = rng(97);
    this.shards = Array.from({ length: 26 }, () => ({
      x: r(), y: r(), z: 0.45 + r() * 0.5, size: 1.6 + r() * 3.2, rot: r() * 6.28, spin: (r() - 0.5) * 1.2, a: 0.22 + r() * 0.35, drift: (r() - 0.5) * 6,
    }));
  }

  /**
   * Zeichnet im Bildschirm-Transform (CSS-px). scroll = Kamerahöhe in CSS-px, blend 0 Blau … 1 Rot,
   * progress 0–1 (leichte Farbverschiebung mit der Höhe), time für Splitter-Drift.
   */
  render(ctx, scroll, blend, progress, time, opacity=1) {
    if(this.theme==='infinity') {
      const names=['spire','fracture','gears','voltage','core','singularity'],zone=Math.floor(progress/32),phase=progress%32,index=zone%6,next=(index+1)%6;
      const variant=i=>{if(!this.variants.has(i)){const b=new Backdrop(),v=this.variantSize;b.configure(v.cssW,v.cssH,v.dpr,names[i]);this.variants.set(i,b);while(this.variants.size>2)this.variants.delete(this.variants.keys().next().value);}return this.variants.get(i);};
      variant(index).render(ctx,scroll,blend,.5,time);
      if(phase>24)variant(next);if(phase>28)variant(next).render(ctx,scroll,blend,.5,time,(phase-28)/4);
      return;
    }
    ctx.globalAlpha=opacity;ctx.drawImage(this.backgrounds[0],0,0,this.w,this.viewH);
    if(blend>.001){ctx.globalAlpha=blend*opacity;ctx.drawImage(this.backgrounds[1],0,0,this.w,this.viewH);}
    ctx.globalAlpha=1;
    const H = this.h;
    const vh = Math.min(this.viewH, H);
    for (const { def, canvas, k, strips } of this.layers) {
      const off = ((scroll * def.speed) % H + H) % H;
      ctx.globalAlpha = def.alpha * (0.85 + 0.3 * progress)*opacity;
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
    if(this.theme==='gears')for(let i=0;i<4;i++){
      const x=i%2?this.w*.92:this.w*.08,y=((i*this.h/3+scroll*.23)%this.h+this.h)%this.h;
      ctx.save();ctx.translate(x,y);ctx.rotate(time*(i%2?.17:-.17));ctx.globalAlpha=.24*opacity;ctx.drawImage(this.gear,-90,-90,180,180);ctx.restore();
    }
    ctx.fillStyle = blend < 0.5 ? '#2fd6ff' : '#ff2d8a';
    for (const s of this.shards) {
      const y = ((s.y * H + scroll * s.z * 0.55 + time * s.drift) % H + H) % H;
      const x = s.x * this.w;
      const r = s.rot + time * s.spin;
      const sz = s.size * s.z;
      const c = Math.cos(r) * sz;
      const sn = Math.sin(r) * sz * 0.45;
      ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(time * 1.7 + s.x * 20))*opacity;
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
