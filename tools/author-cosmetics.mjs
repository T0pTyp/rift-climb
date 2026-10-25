// Offline SVG artwork worksheet: same Riftling paths/anchor, only colors and interior engraving change.
import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
mkdirSync('assets/medals',{recursive:true});
for(const [rank,color,light,dark,symbol] of [
 ['bronze','#c48246','#ffe0ad','#583124','M30 24L39 32L34 42L25 42L22 32Z'],
 ['silver','#b9d6ec','#ffffff','#455d7f','M32 22L43 32L32 44L21 32ZM32 27V39M26 33H38'],
 ['gold','#ffc343','#fff6bb','#815020','M22 34L20 25L28 29L32 21L36 29L44 25L42 34ZM23 39H41']]) {
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 76"><defs><linearGradient id="metal" x2=".8" y2="1"><stop stop-color="${light}"/><stop offset=".35" stop-color="${color}"/><stop offset=".58" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient><radialGradient id="face"><stop stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></radialGradient></defs><path d="M19 43L12 71L25 64L31 74L35 45M33 45L39 74L46 64L59 70L46 41" fill="${dark}" stroke="${color}" stroke-width="1.5"/><path d="M32 3L45 10L57 28L53 45L32 57L11 45L7 28L19 10Z" fill="url(#metal)" stroke="${light}" stroke-width="1.4"/><path d="M32 9L44 16L50 29L46 41L32 50L18 41L14 29L20 16Z" fill="url(#face)" stroke="${dark}" stroke-width="2"/><path d="M17 37L14 32M18 42L14 38M23 46L18 44M47 37L50 32M46 42L50 38M41 46L46 44" stroke="${light}" stroke-width="2"/><path d="${symbol}" fill="none" stroke="${light}" stroke-width="2.3" stroke-linejoin="round"/><path d="M14 22L25 10M39 7L48 16" stroke="white" stroke-width="1.5" opacity=".8"/><path d="M54 5V13M50 9H58" stroke="${light}" stroke-linecap="round"/></svg>\n`;
 writeFileSync(`assets/medals/${rank}.svg`,svg);
}
const source=readFileSync('assets/riftling/body-blue.svg','utf8');
const palettes={
 azure:[['#d8fbff','#7bcfff','#208bd0','#103e79'],['#f1ebff','#c2a5ff','#6b63df','#312663']],
 crimson:[['#ffd9f1','#ee75b8','#a93289','#4d174e'],['#ffe4ed','#ff559a','#b51c58','#570b39']],
 golden:[['#fff5c9','#ffd166','#aa741f','#5b3b16'],['#fff2d2','#ffb66e','#a55c32','#502437']],
 void:[['#9cecff','#62609c','#292643','#100e25'],['#e2c5ff','#aa76c9','#3f264f','#190f29']],
};
for(const [id,pair] of Object.entries(palettes))for(const [i,dim] of ['B','R'].entries()) {
 const [shine,main,mid,deep]=pair[i];
 const map={'#b8f7ff':shine,'#8ff3ff':shine,'#0b78c4':mid,'#073a78':deep,'#d8fbff':shine,'#2fd6ff':main,'#0872b7':mid,'#0a5aa0':deep,'#5fe6ff':main,'#bff7ff':shine,'#dffcff':shine,'#e9fdff':shine,'#04101f':deep};
 let svg=source.replace(/#[a-fA-F0-9]{6}/g,color=>map[color.toLowerCase()]||color);
 const detail=id==='golden'?'<path d="M27 16L33 20L39 16M25 48L31 52L38 48" fill="none" stroke="#fff5c9" stroke-width="1.3"/><path d="M32 21L35 26L32 31L29 26Z" fill="#ffc343"/>':id==='void'?'<path d="M24 22L29 27L26 33M39 46L35 50L36 55" fill="none" stroke="'+main+'" stroke-width="1.5"/>':id==='azure'?'<path d="M28 18L31 23L27 28M40 49L37 53" fill="none" stroke="'+shine+'" stroke-width="1.5"/>':'<path d="M29 18L33 24L30 30M24 48L29 51" fill="none" stroke="'+shine+'" stroke-width="1.5"/>';
 svg=svg.replace('</svg>',detail+'</svg>');writeFileSync(`assets/riftling/${id}-${dim}.svg`,svg);
}
