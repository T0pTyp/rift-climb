import assert from 'node:assert/strict';
import {chromium,devices} from 'playwright';
import {writeFileSync,mkdirSync} from 'node:fs';
const browser=await chromium.launch();let checks=0;
try{
 const page=await browser.newPage(devices['Pixel 7']);await page.goto((process.env.BASE_URL||'http://localhost:8080/')+'?manual=1');await page.waitForFunction(()=>window.__RIFT);
 const result=await page.evaluate(async()=>{
  const {Backdrop}=await import('./js/art/backdrop.js'),results=[];
  const canvas=()=>{const c=document.createElement('canvas');c.width=270;c.height=600;return c;};
  for(const theme of ['spire','fracture','gears','voltage','core','singularity']){
   const a=new Backdrop(),b=new Backdrop(),ca=canvas(),cb=canvas();a.configure(270,600,1,theme);const jobs=b.configure(270,600,1,theme,true);for(const job of jobs)job();a.render(ca.getContext('2d'),17,.4,.5,13);b.render(cb.getContext('2d'),17,.4,.5,13);
   const x=ca.getContext('2d').getImageData(0,0,270,600).data,y=cb.getContext('2d').getImageData(0,0,270,600).data;results.push({name:theme+' deferred artwork pixel-identical',ok:x.every((v,i)=>v===y[i])});
  }
  const b=new Backdrop(),c=canvas(),ctx=c.getContext('2d');b.configure(270,600,1,'infinity');b.render(ctx,0,0,13,13);const began=!!b.pendingVariant&&b.variants.size===1;
  await new Promise(r=>setTimeout(r,100));results.push({name:'next zone prepared in bounded tasks without partial rendering',ok:began&&!b.pendingVariant&&b.variants.size===2});
  b.configure(271,600,1,'infinity');b.render(ctx,0,0,13,13);b.configure(270,600,1,'spire');await new Promise(r=>setTimeout(r,100));results.push({name:'theme switch cancels stale background jobs',ok:!b.pendingVariant&&b.variants.size===0});return results;
 });
 for(const r of result){assert.ok(r.ok,r.name);checks++;console.log('PASS '+r.name);}mkdirSync('test-results/m79',{recursive:true});writeFileSync('test-results/m79/backdrop.json',JSON.stringify({checks,result},null,2));console.log(checks+' backdrop cache checks passed');
}finally{await browser.close();}
