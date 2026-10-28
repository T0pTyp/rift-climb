import {writeFileSync} from 'node:fs';
import {effectiveDifficultyHeight as f} from '../js/momentum.js';
const colors=['#9fb2c9','#39dcff','#ff68ba'],width=960,height=740;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Normale und beschleunigte Schwierigkeit für sechs nachgewiesene Höhen"><rect width="960" height="740" fill="#071221"/><g font-family="system-ui" fill="#dcf5ff"><text x="34" y="34" font-size="22" font-weight="700">RIFT MOMENTUM · Actual → Effective</text><text x="34" y="58" font-size="13">Graue Linie: Normal · Cyan: Momentum 1 · Magenta: Momentum 2. Keine freien Höhenmeter.</text>`;
for(const [i,p] of [500,900,1200,1800,2800,4000].entries()){
 const ox=55+(i%3)*310,oy=100+Math.floor(i/3)*300,w=250,h=215,max=p*1.15;
 svg+=`<text x="${ox}" y="${oy}" font-size="15">provenHeight ${p} m</text><path d="M${ox},${oy+15}V${oy+h}H${ox+w}" fill="none" stroke="#52718a"/>`;
 for(const tier of [0,1,2]){const path=Array.from({length:241},(_,n)=>{const x=n/240*max,y=f(x,{version:1,tier,provenHeight:p});return `${n?'L':'M'}${(ox+x/max*w).toFixed(2)},${(oy+h-y/max*(h-20)).toFixed(2)}`;}).join(' ');svg+=`<path d="${path}" fill="none" stroke="${colors[tier]}" stroke-width="2.2"/>`;}
 const px=ox+p/max*w;svg+=`<path d="M${px},${oy+20}V${oy+h}" stroke="#f2c767" stroke-dasharray="3 5" opacity=".7"/><text x="${ox}" y="${oy+h+20}" font-size="11">0 m</text><text x="${px-34}" y="${oy+h+20}" font-size="11">${p} m</text><text x="${ox+w-70}" y="${oy+h+40}" font-size="11">Actual height →</text>`;
}
svg+='</g></svg>';writeFileSync('docs/M8.1-MOMENTUM-CURVES.svg',svg+'\n');console.log('Momentum curves generated from the production function');
