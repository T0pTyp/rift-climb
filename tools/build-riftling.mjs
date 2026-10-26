// Asset packaging, not image generation: resize the approved transparent master
// and derive the second dimension with exactly the same alpha channel.
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
const base=process.env.BASE_URL||'http://localhost:8080/',browser=await chromium.launch();
try{const p=await browser.newPage();await p.goto(base+'assets/characters/riftling/riftling-master.png');
 const result=await p.evaluate(async base=>{const {recolorRiftling}=await import(base+'js/art/riftling-palette.js');const img=new Image();img.src=base+'assets/characters/riftling/riftling-master.png';await img.decode();const out={};
 for(const dim of ['B','R']){const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0,512,512);if(dim==='R'){const data=g.getImageData(0,0,512,512);recolorRiftling(data.data,'original','R');g.putImageData(data,0,0);}out[dim]=c.toDataURL('image/webp',.96).split(',')[1];}return out;},base);
 for(const [dim,data]of Object.entries(result)){const path=`assets/characters/riftling/body-${dim==='B'?'blue':'red'}.webp`;writeFileSync(path,Buffer.from(data,'base64'));console.log(path,Buffer.from(data,'base64').length);}
}finally{await browser.close();}
