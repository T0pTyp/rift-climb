// Cosmetic palette only. Input/output alpha and silhouette are never changed.
export const RIFTLING_SKINS=['original','azure','crimson','golden','void'];
export function recolorRiftling(pixels,skin='original',dimension='B') {
 const hues={original:[195,333],azure:[183,321],crimson:[318,344],golden:[46,26],void:[252,312]};
 const shift=(hues[skin]||hues.original)[dimension==='R'?1:0]-195;
 for(let i=0;i<pixels.length;i+=4){
  if(!pixels[i+3])continue;
  const r=pixels[i]/255,g=pixels[i+1]/255,b=pixels[i+2]/255,max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;
  let h=d===0?0:max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;h=((h*60+shift)%360+360)%360;
  let s=d===0?0:d/(1-Math.abs(2*l-1)),light=l;
  if(skin==='void'){light*=.5;s=Math.min(1,s*1.1);}if(skin==='golden')s=Math.min(1,s*1.08);
  const c=(1-Math.abs(2*light-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=light-c/2;
  let rr=0,gg=0,bb=0;
  if(h<60){rr=c;gg=x;}else if(h<120){rr=x;gg=c;}else if(h<180){gg=c;bb=x;}else if(h<240){gg=x;bb=c;}else if(h<300){rr=x;bb=c;}else{rr=c;bb=x;}
  pixels[i]=Math.round((rr+m)*255);pixels[i+1]=Math.round((gg+m)*255);pixels[i+2]=Math.round((bb+m)*255);
 }
 return pixels;
}
