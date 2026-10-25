import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/';
let checks=0;const check=(n,ok,detail='')=>{assert.ok(ok,n+' '+detail);checks++;console.log('PASS '+n);};
mkdirSync('test-results/expansion/browser',{recursive:true});
for(const [engine,device,label] of [[chromium,devices['Pixel 7'],'touch'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{viewport:{width:1280,height:900}},'desktop']]){
 const b=await engine.launch(),c=await b.newContext(device),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 const click=s=>device.isMobile?p.tap(s):p.click(s);const cdp=engine===chromium&&device.isMobile?await c.newCDPSession(p):null;
 const at=([x,y])=>p.evaluate(([x,y])=>{const f=__FORGE,r=f.view.canvas.getBoundingClientRect(),s=f.view.toScreen(x,y);return{x:r.x+s.x,y:r.y+s.y};},[x,y]);
 async function drag(a,b){
  if(cdp){const send=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(q=>({...q,id:0,radiusX:4,radiusY:4,force:1}))});await send('touchStart',[a]);for(let i=1;i<=10;i++){await send('touchMove',[{x:a.x+(b.x-a.x)*i/10,y:a.y+(b.y-a.y)*i/10}]);await p.waitForTimeout(20);}await p.waitForTimeout(120);await send('touchEnd',[]);}
  else {await p.mouse.move(a.x,a.y);await p.mouse.down();await p.waitForTimeout(40);for(let i=1;i<=12;i++){await p.mouse.move(a.x+(b.x-a.x)*i/12,a.y+(b.y-a.y)*i/12);await p.waitForTimeout(20);}await p.mouse.up();}await p.waitForTimeout(180);
 }
 await p.goto(BASE+'assets/forge/');await p.waitForFunction(()=>document.body.dataset.ready==='1');
 for(const [i,type] of ['saw','mine','laser'].entries()){
  await p.evaluate(async()=>{const {createEmptyLevel}=await import('../../js/level-data.js');__FORGE.actions.loadDocument(createEmptyLevel({id:'trap-test',name:'Trap Test'}));const f=__FORGE;f.view.cam.y=520;f.view.cam.z=f.view.fitZoom();f.actions.requestRender();});
  await click(`.pal[data-kind="${type}"]`);const pos=await at([135,520]);if(device.isMobile)await p.touchscreen.tap(pos.x,pos.y);else await p.mouse.click(pos.x,pos.y);
  const initial=await p.evaluate(()=>structuredClone(__FORGE.doc.get([...__FORGE.S.selection][0])));
  check(label+' '+type+' palette places real shared-schema trap',initial?.type===type&&initial.w===initial.h);
  await p.evaluate(()=>__FORGE.actions.setTool('select'));
  const start=await at([initial.x+initial.w/2,initial.y]),end=await at([initial.x+initial.w/2+80,initial.y+130]);
  await drag(start,end);const moved=await p.evaluate(id=>structuredClone(__FORGE.doc.get(id)),initial.id);
  check(label+' '+type+' drag moves body and motion envelope',moved.x!==initial.x&&moved.y!==initial.y);
  const handle=await p.evaluate(id=>{const f=__FORGE,q=f.view.handlePoints(f.doc.get(id)).r,r=f.view.canvas.getBoundingClientRect();return{x:q.x+r.x,y:q.y+r.y};},initial.id);
  await drag(handle,{x:handle.x+25,y:handle.y});
  check(label+' '+type+' resize keeps square collision body',await p.evaluate(({id,w})=>{const o=__FORGE.doc.get(id);return o.w!==w&&o.w===o.h&&o.w>=16&&o.w<=80;},{id:initial.id,w:moved.w}),JSON.stringify(await p.evaluate(id=>__FORGE.doc.get(id),initial.id)));
  if(device.isMobile)await click('#dk-props');
  const key={saw:'spin',mine:'chargeSec',laser:'warnSec'}[type],value=[5,.9,.9][i];
  await p.locator(`#props-body [data-key="${key}"]`).fill(String(value));await p.locator(`#props-body [data-key="${key}"]`).press('Enter');
  await p.locator('#props-body [data-key="dimension"]').selectOption('red');
  check(label+' '+type+' parameters and dimension editable',await p.evaluate(({id,key,value})=>__FORGE.doc.get(id)[key]===value&&__FORGE.doc.get(id).dimension==='red',{id:initial.id,key,value}));
  if(device.isMobile)await click('#sheet-close');
  const json=await p.evaluate(()=>__FORGE.actions.exportText().text);
  check(label+' '+type+' new parameters serialize and import losslessly',await p.evaluate(async json=>{const {parseLevelText,serializeLevel}=await import('../../js/level-data.js');const r=parseLevelText(json);return r.ok&&serializeLevel(r.level)===json;},json));
  await p.screenshot({path:`test-results/expansion/browser/${label}-forge-${type}.png`});
 }
 check(label+' no Forge page errors',errors.length===0);await b.close();
}
writeFileSync('test-results/expansion/browser/traps-forge.json',JSON.stringify({checks},null,2));console.log(`${checks} Trap Forge checks passed`);
