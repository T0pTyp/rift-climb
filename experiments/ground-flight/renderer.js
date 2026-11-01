import {drawRiftling,riftlingArt} from '../../js/art/riftling.js';
import {RiftlingAnimator} from '../../js/art/riftling-anim.js';
import {drawTrap} from '../../js/art/traps.js';
import {ParticlePool,PARTICLE_KIND} from '../../js/particles.js';
import {drawParticles} from '../../js/art/effects.js';
import {pulseRadius} from '../../js/rift.js';
import {COLORS} from '../../js/dimensions.js';

export class HybridRenderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.anim=new RiftlingAnimator();this.particles=new ParticlePool(180);this.trail=[];this.visualTime=0;this.lastMotion=-10;this.lastLanding=-10;this.debug=new URLSearchParams(location.search).has('debug');riftlingArt.load();}
  resize(w,h,dpr=devicePixelRatio||1){this.w=w;this.h=h;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';this.floor=h*.77;this.scale=Math.min(w/Math.max(420,Math.min(900,w)),Math.max(.35,(this.floor-90)/300));this.worldWidth=w/this.scale;}
  bind(sim){this.sim=sim;this.anim.reset(0,{rebuild:true});this.particles.clear();this.trail.length=0;this.lastMotion=this.lastLanding=-10;sim.onEvent(e=>this.event(e));}
  event(e) {
    const dim=e.dim==='B'?'#2fd6ff':'#ff2d8a';
    if(e.kind==='phase'){this.anim.onSwitch(1);this.anim.onPulse();}
    if(['jump','flap'].includes(e.kind)){this.lastMotion=this.visualTime;this.anim.onPrecise();}
    if(e.kind==='land')this.lastLanding=this.visualTime;
    if(e.kind==='death')this.anim.onDeath();
    const hit=['death','saw-break','mine-disarm','laser-disable','seal'].includes(e.kind),n=e.kind==='death'?26:hit?12:['jump','flap','land','portal','phase'].includes(e.kind)?8:0;
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2,v=hit?70:35;this.particles.spawn(e.x,e.y,Math.cos(a)*v,Math.sin(a)*v,.25+(i%3)*.1,hit?2.3:1.5,e.kind==='seal'||e.kind==='portal'?'#ffd680':dim,.96,hit?PARTICLE_KIND.SHARD:PARTICLE_KIND.SPARK,20);}
  }
  update(dt) {
    this.visualTime+=dt;this.particles.update(dt);const p=this.sim?.p;
    this.anim.update(dt,{vx:p?.mode==='flight'?p.vy:0,tilt:p?.mode==='flight'?Math.max(-.3,Math.min(.3,-p.vy*.001)):0,targetBlend:p?.dim==='R'?1:0,alive:this.sim?.state!=='dead'});
    if(this.sim?.state==='playing'&&dt>0){this.trail.push({x:p.x,y:p.y});if(this.trail.length>16)this.trail.shift();}
  }
  draw(dt=0) {
    const c=this.ctx,w=this.w,h=this.h,s=this.scale,sim=this.sim;if(!sim||['dead','complete'].includes(sim.state))this.update(dt);
    c.setTransform(this.dpr,0,0,this.dpr,0,0);
    const blend=sim?this.anim.blend:0,col=blend>.5?'#ff4b9d':'#44e3ff';
    const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#0b102c');bg.addColorStop(.55,blend>.5?'#291139':'#09283b');bg.addColorStop(1,'#050a19');c.fillStyle=bg;c.fillRect(0,0,w,h);
    const camera=sim?sim.p.x-80:Math.max(0,this.visualTime*15),floor=this.floor;
    // Deterministic, layered tower architecture, culled to the visible strip.
    for(const [parallax,spacing,alpha] of [[.12,148,.14],[.28,92,.24]]) {
      const off=((camera*parallax*s)%spacing+spacing)%spacing;c.strokeStyle=col;c.lineWidth=1;c.globalAlpha=alpha;
      for(let x=-spacing-off;x<w+spacing;x+=spacing){const height=180+(Math.floor((x+off+camera*parallax*s)/spacing)%3)*54;c.fillStyle='#101c36';c.fillRect(x,floor-height,spacing*.7,height);c.strokeRect(x+8,floor-height+8,spacing*.7-16,height-12);for(let y=floor-height+24;y<floor-20;y+=36){c.beginPath();c.moveTo(x+15,y);c.lineTo(x+spacing*.5,y);c.stroke();}}
    }
    c.globalAlpha=.18;c.strokeStyle=col;
    for(let i=0;i<12;i++){const x=((i*97-camera*.08*s)%w+w)%w,y=70+(i*71)%Math.max(100,floor-120);c.save();c.translate(x,y);c.rotate(this.visualTime*.07+i);c.strokeRect(-4,-4,8,8);c.restore();}
    c.globalAlpha=1;
    const horizon=c.createLinearGradient(0,floor-35,0,floor+65);horizon.addColorStop(0,'transparent');horizon.addColorStop(.36,blend>.5?'#8e245f':'#147987');horizon.addColorStop(1,'#070e20');c.fillStyle=horizon;c.fillRect(0,floor-35,w,h-floor+35);
    c.strokeStyle=sim?.p.mode==='flight'?'#ffb06c':col;c.lineWidth=2;c.beginPath();c.moveTo(0,floor);c.lineTo(w,floor);c.stroke();
    if(sim?.p.mode==='flight'){c.fillStyle='#ffb06c';c.font='700 9px system-ui';c.fillText('RIFT-GRENZE · WEITER FLAPPEN',18,floor+23);}
    c.globalAlpha=.25;for(let i=0;i<16;i++){const x=((i*48-camera*s)% (w+96)+w+96)%(w+96)-48;c.beginPath();c.moveTo(x,floor+8);c.lineTo(x+48,floor+70);c.stroke();}c.globalAlpha=1;
    if(!sim){const p=this.anim.pose;c.save();c.translate(w*.5,h*.25);c.scale(3,3);drawRiftling(c,0,0,p,3*this.dpr);c.restore();return;}
    c.save();c.translate(-camera*s,floor);c.scale(s,s);
    // Full, stationary play band: the camera never changes height at a portal.
    c.globalAlpha=.25;c.setLineDash([6,12]);c.strokeStyle=col;c.lineWidth=1;c.beginPath();c.moveTo(camera,-sim.config.ceiling);c.lineTo(camera+this.worldWidth,-sim.config.ceiling);c.stroke();c.setLineDash([]);c.globalAlpha=1;
    for(const o of sim.objects){if(o.x1<camera-25||o.x0>camera+this.worldWidth+25)continue;const open=o.type==='seal'&&sim.rift.isOpen(o,sim.t),active=o.color==='W'||o.color==='S'||o.color===sim.p.dim,color=COLORS[o.color].main,x=o.x0,y=-o.y-o.hh;
      c.save();c.globalAlpha=open?.32:active?1:.23;c.fillStyle=o.color==='S'?'#392c22':o.color==='W'?'#27384b':o.color==='B'?'#123e55':'#4e1b40';c.strokeStyle=color;c.lineWidth=1.6;c.fillRect(x,y,o.w,o.h);c.strokeRect(x,y,o.w,o.h);
      c.globalAlpha*=.8;c.lineWidth=.7;for(let i=7;i<o.h;i+=14){c.beginPath();c.moveTo(x+3,y+i);c.lineTo(x+o.w-3,y+i-5);c.stroke();}
      c.fillStyle=color;c.fillRect(x,y,Math.min(o.w,4),o.h);if(o.type==='seal'){c.globalAlpha=1;c.font='bold 9px system-ui';c.fillStyle='#ffe7a4';c.fillText(open?'OPEN':'PULSE',x-9,y-8);if(open){c.globalAlpha=.6;c.strokeRect(x-4,y-4,o.w+8,o.h+8);}}c.restore();
    }
    for(const o of sim.traps.traps){if(o.x+(o.length||o.w)+100<camera||o.x-100>camera+this.worldWidth)continue;drawTrap(c,o,sim.t,-o.y,sim.p.dim);}
    for(const o of sim.portals){if(o.x<camera-40||o.x>camera+this.worldWidth+40)continue;const flight=o.target==='flight',color=flight?'#ae8cff':'#ffd480',top=flight?260:240,mid=top/2;
      c.save();c.translate(o.x,-mid);for(const [width,a] of [[13,.08],[7,.16],[2,1]]){c.lineWidth=width;c.strokeStyle=color;c.globalAlpha=a;c.beginPath();c.ellipse(0,0,19,mid,0,0,Math.PI*2);c.stroke();}
      c.globalAlpha=.65;c.setLineDash([7,10]);c.lineDashOffset=-this.visualTime*18;c.strokeStyle='#ffffff';c.lineWidth=1;c.beginPath();c.ellipse(0,0,25,mid+7,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
      c.globalAlpha=1;c.font='700 10px system-ui';c.textAlign='center';c.fillStyle=color;c.fillText(flight?'FLIGHT':'GROUND',0,-mid-20);c.fillText(flight?'↑  ↑':'↓  ↓',0,-mid-5);
      for(let i=0;i<5;i++){const yy=-mid+((this.visualTime*40+i*51)%(top));c.fillStyle=color;c.globalAlpha=.6;c.fillRect(-5,yy,10,2);}c.restore();
    }
    if(!sim.endless&&sim.finishX<camera+this.worldWidth+30){c.save();c.translate(sim.finishX,0);c.strokeStyle='#ffdc8e';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(0,-180);c.stroke();c.fillStyle='#ffdc8e';c.font='bold 12px system-ui';c.textAlign='center';c.fillText('FINISH',0,-200);for(let i=0;i<6;i++){c.globalAlpha=.4;c.beginPath();c.ellipse(0,-90,12+i*3,80,0,0,Math.PI*2);c.stroke();}c.restore();}
    for(const p of sim.rift.pulses)if(p.live){const age=sim.t-p.t0,r=pulseRadius(age);c.save();c.globalAlpha=Math.max(0,1-age/.37)*.65;c.strokeStyle=p.color;c.lineWidth=2.5;c.beginPath();c.arc(p.x,-p.y,r,0,Math.PI*2);c.stroke();c.restore();}
    c.save();c.translate(0,-400);drawParticles(c,this.particles,0,400,10000);c.restore();
    const p=sim.p;
    c.strokeStyle=COLORS[p.dim].main;c.lineWidth=3;c.globalAlpha=.25;c.beginPath();this.trail.forEach((q,i)=>i?c.lineTo(q.x,-q.y):c.moveTo(q.x,-q.y));c.stroke();c.globalAlpha=1;
    const pose={...this.anim.pose};
    const boost=Math.max(0,1-(this.visualTime-this.lastMotion)/.18),land=Math.max(0,1-(this.visualTime-this.lastLanding)/.15);
    pose.sx*=1-boost*.13+land*.22;pose.sy*=1+boost*.18-land*.2;pose.bob=p.grounded?-1+Math.sin(this.visualTime*16)*.4:0;
    drawRiftling(c,p.x,-p.y,pose,s*this.dpr);
    if(this.debug){c.strokeStyle='#fff';c.lineWidth=.7;c.beginPath();c.arc(p.x,-p.y,p.hitRadius,0,Math.PI*2);c.stroke();}
    c.restore();
  }
}
