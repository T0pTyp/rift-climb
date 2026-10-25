import { Backdrop } from './backdrop.js';
import { drawBar, drawSealClosed } from '../shapes.js';
export const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbols={flight:'M12 33L24 10L36 33L24 28Z',half:'M10 25H38M24 11V38M15 17L24 9L33 17',victory:'M15 10H33V23Q33 34 24 36Q15 34 15 23ZM24 36V41M17 41H31M15 14H8V22L16 27M33 14H40V22L32 27',pulse:'M8 25H16L21 14L28 35L33 25H40',rhythm:'M12 16L23 9L36 19L28 25L37 34L24 40L12 30L21 24Z',core:'M24 8L38 16V32L24 40L10 32V16ZM24 16L31 24L24 32L17 24Z',ascent:'M9 34L18 21L24 28L33 12L40 34ZM12 39H37',persistent:'M35 17A15 15 0 1 0 38 31M35 8V18H25',skin:'M27 10Q43 31 30 39Q16 45 12 30Q11 21 27 10ZM19 27H30'};
export function icon(id='pulse'){return `<svg class="reward-icon" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 2L43 13V35L24 46L5 35V13Z" fill="currentColor" opacity=".08"/><path d="${symbols[id]||symbols.pulse}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;}
export function medal(rank,earned=false){return ['bronze','silver','gold'].includes(rank)?`<img class="medal ${earned?'medal-earned':''}" src="${new URL(`../../assets/medals/${rank}.svg`,import.meta.url).href}" alt="${rank==='gold'?'Gold':rank==='silver'?'Silber':'Bronze'}">`:'<span class="medal-empty" aria-label="Noch keine Medaille">◇</span>';}
export function levelPreview(data){
 const c=document.createElement('canvas');c.width=360;c.height=130;const g=c.getContext('2d'),b=new Backdrop();b.configure(360,130,1,data.theme);b.render(g,data.finish.y*.3,0,.5,0);
 const middle=data.finish.y*.55,obs=data.objects.filter(o=>o.type!=='hint'&&Math.abs(o.y-middle)<600),rows=[...new Set(obs.map(o=>o.y))].slice(0,3);
 g.save();g.translate(102,0);g.scale(.44,.44);
 for(const o of obs){const row=rows.indexOf(o.y);if(row<0)continue;const y=55+row*90;if(o.type==='seal')drawSealClosed(g,o.x,y,o.w,o.h/2);else drawBar(g,{both:'W',blue:'B',red:'R'}[o.dimension],o.x,y,o.w,o.h/2,true);}
 g.restore();return c.toDataURL();
}
