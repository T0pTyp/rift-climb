import { trapPose } from '../traps.js';
// Reuse the exact tooth geometry in game and Forge. Rotation remains dynamic.
// A bounded cache also handles continuous width edits without retaining paths.
const sawPaths=new Map();
function sawPath(r) {
 if(!globalThis.Path2D)return null;
 if(sawPaths.has(r))return sawPaths.get(r);
 const path=new Path2D();
 for(let i=0;i<48;i++){const a=i/48*Math.PI*2,rr=r*(i%4===0?1:i%4===1?.97:.76);i?path.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):path.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}
 path.closePath();if(sawPaths.size>=32)sawPaths.delete(sawPaths.keys().next().value);sawPaths.set(r,path);return path;
}
export function drawTrap(ctx,o,t,screenY,dim='both') {
 const p=trapPose(o,t,o.renderPose),active=dim==='both'||dim===o.color,col=o.color==='R'?'#ff4597':'#40dfff';
 const gone=o.state==='destroyed'||o.state==='disarmed',fade=gone?Math.max(0,1-(t-o.deadAt)/.25):1;
 if(fade<=0)return;
 ctx.save();ctx.lineCap='round';ctx.translate(p.x,screenY-(p.y-o.y));ctx.globalAlpha=(active?1:.25)*fade;
 if(o.type==='saw') {
  const r=o.w/2;ctx.rotate(-p.angle);ctx.strokeStyle=col;ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(0,0,r*.96,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#8a9eaf';const teeth=sawPath(r);
  if(teeth){ctx.fill(teeth);ctx.stroke(teeth);}
  else {ctx.beginPath();for(let i=0;i<48;i++){const a=i/48*Math.PI*2,rr=r*(i%4===0?1:i%4===1?.97:.76);i?ctx.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):ctx.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}ctx.closePath();ctx.fill();ctx.stroke();}
  ctx.strokeStyle='#e7f4ff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r*.66,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<6;i++){ctx.rotate(Math.PI/3);ctx.fillStyle='#15273e';ctx.fillRect(r*.34,-2,r*.25,4);}
  ctx.fillStyle='#091323';ctx.beginPath();ctx.arc(0,0,r*.32,0,Math.PI*2);ctx.fill();ctx.strokeStyle=col;ctx.stroke();ctx.fillStyle=col;ctx.fillRect(-3,-3,6,6);
 } else if(o.type==='mine') {
  if(o.state!=='spent') {
   ctx.strokeStyle=col;ctx.lineWidth=1;ctx.globalAlpha*=.35;ctx.setLineDash([3,6]);ctx.beginPath();ctx.arc(0,0,o.activationRadius,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=(active?1:.25)*fade;
   if(o.state==='charging'||o.state==='exploding') {
    ctx.lineWidth=o.state==='exploding'?3:1.5;ctx.strokeStyle=col;ctx.fillStyle=col;ctx.globalAlpha*=o.state==='exploding'?.16:.05;ctx.beginPath();ctx.arc(0,0,o.blastRadius,0,Math.PI*2);ctx.fill();ctx.globalAlpha=(active?1:.25)*fade;ctx.stroke();
    if(o.state==='charging'){const charge=Math.min(1,(t-o.chargeAt)/o.chargeSec);ctx.lineWidth=1+charge*2;ctx.globalAlpha=(active?1:.25)*(.35+.65*charge);ctx.beginPath();ctx.arc(0,0,o.blastRadius,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=(active?1:.25)*fade;ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,o.w*.8,-Math.PI/2,-Math.PI/2+Math.PI*2*charge);ctx.stroke();}
   }
  } else ctx.globalAlpha*=.22;
  const r=o.w/2;ctx.fillStyle='#18263c';ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(6,0);ctx.lineTo(0,7);ctx.lineTo(-6,0);ctx.fill();
 } else {
  const ex=Math.cos(p.angle)*o.length,ey=-Math.sin(p.angle)*o.length;
  ctx.strokeStyle=col;
  if(p.phase==='warning'){
   ctx.save();const dx=p.warnX-p.x,dy=-(p.warnY-p.y);
   if(Math.hypot(dx,dy)>1){ctx.globalAlpha=(active?1:.25)*.3;ctx.setLineDash([2,4]);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(dx,dy);ctx.stroke();ctx.setLineDash([]);}
   ctx.translate(dx,dy);
   ctx.globalAlpha=(active?1:.25)*.22;ctx.lineWidth=1;
   for(const angle of [o.startAngle,o.endAngle]){const a=angle*Math.PI/180;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*o.length,-Math.sin(a)*o.length);ctx.stroke();}
   ctx.globalAlpha=active?1:.25;ctx.setLineDash([7,5]);ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ex,ey);ctx.stroke();ctx.setLineDash([]);
   ctx.restore();
  }
  else if(p.phase==='active') {
   for(const [w,a] of [[o.beamWidth+8,.13],[o.beamWidth,.65],[Math.max(2,o.beamWidth*.3),1]]){ctx.lineWidth=w;ctx.globalAlpha=(active?1:.25)*a;ctx.strokeStyle=a===1?'#f2fbff':col;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(ex,ey);ctx.stroke();}ctx.globalAlpha=active?1:.25;
  }
  if(p.phase==='disabled'){ctx.strokeStyle='#ffd166';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,o.w*.8,-Math.PI/2,-Math.PI/2+Math.PI*2*Math.max(0,Math.min(1,(o.disabledUntil-t)/o.disableSec)));ctx.stroke();}
  ctx.rotate(-p.angle);ctx.fillStyle=p.phase==='disabled'?'#443843':'#172a41';ctx.strokeStyle=p.phase==='disabled'?'#ffd166':col;ctx.lineWidth=2;ctx.strokeRect(-o.w/2,-o.h/2,o.w,o.h);ctx.fillRect(-o.w/2,-o.h/2,o.w,o.h);ctx.fillStyle=ctx.strokeStyle;ctx.fillRect(2,-6,o.w/2,12);ctx.fillStyle='#fff';ctx.fillRect(5,-2,o.w/2,4);
 }
 ctx.restore();
}
