import assert from 'node:assert/strict';
import {chromium,webkit,devices} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const BASE=process.env.BASE_URL||'http://localhost:8080/',out='test-results/m83/browser';mkdirSync(out,{recursive:true});
let checks=0;const report=[],check=(label,ok)=>{assert.ok(ok,label);checks++;console.log('PASS '+label);};
for(const [engine,device,label] of [[chromium,devices['Pixel 7'],'android'],[webkit,devices['iPhone 13'],'webkit'],[chromium,{...devices['iPhone SE'],viewport:{width:320,height:568}},'small'],[chromium,{viewport:{width:1280,height:800}},'desktop']]){
 const b=await engine.launch();try{
 const c=await b.newContext({...device,acceptDownloads:true}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(BASE+'assets/forge/');await p.waitForFunction(()=>document.body.dataset.ready==='1');
 const mobile=await p.locator('#m-menu').isVisible();
 async function library(){if(mobile){await p.click('#m-menu');await p.click('[data-click="#btn-patterns"]');}else await p.click('#btn-patterns');await p.waitForSelector('.pattern-card');}
 async function closeLibrary(){await p.locator('#modal-actions').getByRole('button',{name:'Schließen',exact:true}).click();}
 const card=id=>p.locator(`.pattern-card[data-pattern="${id}"]`);
 await library();check(label+' library has 24 real previews and valid status',await p.locator('.pattern-card').count()===24&&await p.locator('.pattern-status[data-status="VERIFIED"]').count()===24&&await p.locator('.pattern-preview').count()===24);
 check(label+' responsive library fits width and scrolls inside panel',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector('#modal-body').scrollHeight>document.querySelector('#modal-body').clientHeight&&document.querySelector('#modal-actions').getBoundingClientRect().bottom<=innerHeight));
 await p.screenshot({path:`${out}/${label}-library.png`});
 await p.getByRole('searchbox',{name:'Muster suchen'}).fill('P10');check(label+' search finds Twin Saws only',await p.locator('.pattern-card').count()===1&&await card('P10').isVisible());
 await card('P10').getByRole('button',{name:'Öffnen',exact:true}).click();check(label+' opens actual shared twin-saw document',await p.evaluate(()=>__FORGE.doc.level.chunk.pattern==='P10'&&__FORGE.doc.objects.filter(o=>o.type==='saw').length===4&&__FORGE.view.arena.width===270));
 await library();await card('P05').getByRole('button',{name:'Öffnen',exact:true}).click();
 if(mobile)await p.click('#dk-props');
 const weight=p.locator('[data-key="chunk-weight"]');await weight.fill('2');await weight.dispatchEvent('change');
 check(label+' weight editable without invalidating simulation proof',await p.evaluate(async()=>{const {patternStatus}=await import('../../js/pattern-library.js');return __FORGE.doc.level.chunk.weight===2&&patternStatus(__FORGE.doc.level)==='VERIFIED';}));
 check(label+' activation control visible in mobile property sheet',await p.locator('[data-key="chunk-enabled"]').isVisible());
 if(mobile)await p.click('#sheet-close');
 await p.click(mobile?'#m-save':'#btn-save');await p.waitForFunction(()=>__FORGE.S.sourceId==='pattern-p05'&&__FORGE.S.cleanJson===JSON.stringify(__FORGE.doc.level));
 await p.reload();await p.waitForFunction(()=>document.body.dataset.ready==='1');check(label+' reload retains local pattern and weight',await p.evaluate(()=>__FORGE.doc.level.id==='pattern-p05'&&__FORGE.doc.level.chunk.weight===2));
 await library();await card('P05').getByRole('checkbox').uncheck();await p.waitForFunction(async()=>{const r=await __FORGE.store.listLevels();return r.some(x=>x.id==='pattern-p05'&&x.level.chunk.enabled===false);});
 await closeLibrary();await library();check(label+' deactivation persisted without deleting reference',!await card('P05').getByRole('checkbox').isChecked());
 await card('P05').getByRole('button',{name:'Duplizieren',exact:true}).click();
 await p.waitForFunction(()=>__FORGE.doc.level.id!=='pattern-p05');const custom=await p.evaluate(()=>__FORGE.doc.level.id);check(label+' duplicate is independent, inactive and unverified',await p.evaluate(()=>__FORGE.doc.level.id!=='pattern-p05'&&__FORGE.doc.level.chunk.enabled===false&&__FORGE.doc.level.chunk.validation.status==='unverified'));
 const proof=await p.evaluate(()=>__FORGE.app.validateChunk());check(label+' duplicate verified through shared regular simulation',proof.ok&&proof.certificate.fixtures===9);
 await p.evaluate(()=>__FORGE.actions.saveLocal());await library();
 const customCard=p.locator(`.pattern-card[data-pattern="${custom}"]`);
 const downloading=p.waitForEvent('download');await customCard.getByRole('button',{name:'Export',exact:true}).click();const download=await downloading,exported=JSON.parse(readFileSync(await download.path(),'utf8'));
 check(label+' JSON export preserves traps, metadata and replay',exported.id===custom&&exported.objects[0].type==='laser'&&exported.replay.taps.length===2&&exported.chunk.validation.entries.length===9);
 await customCard.getByRole('button',{name:'Lokal entfernen',exact:true}).click();await p.getByRole('button',{name:'Abbrechen',exact:true}).click();await p.waitForSelector(`.pattern-card[data-pattern="${custom}"]`);check(label+' deleting local copy requires confirmation; cancel preserves it',await p.locator('.pattern-card').count()===25);
 await customCard.getByRole('button',{name:'Lokal entfernen',exact:true}).click();await p.getByRole('button',{name:'Bestätigen',exact:true}).click();await p.waitForFunction(()=>document.querySelectorAll('.pattern-card').length===24);check(label+' confirmed deletion only removes local copy',await p.locator('.pattern-card').count()===24);
 const imported={...exported,id:'pattern-imported',name:'Imported Laser',chunk:{...exported.chunk,pattern:'CUSTOM-IMPORT',enabled:false,validation:{status:'unverified'}}};
 await p.locator('.pattern-library input[type=file]').setInputFiles({name:'custom-pattern.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await p.waitForSelector('.pattern-card[data-pattern="CUSTOM-IMPORT"]');
 check(label+' valid JSON imports as editable custom pattern',await p.locator('.pattern-card').count()===25);
 await p.locator('.pattern-library input[type=file]').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"broken"}')});await p.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Import abgelehnt'));check(label+' malformed import rejected without losing library',await p.locator('.pattern-card').count()===25);
 // Test canonical reference with same Game, input handler, collisions, audio and renderer.
 await card('P05').getByRole('button',{name:'Playtest',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#pt-frame').contentWindow?.__RIFT?.state==='paused');
 let frame=await(await p.$('#pt-frame')).contentFrame();await frame.evaluate(()=>{__RIFT.debug.manual=true;__RIFT.audio.simulationOnly=true;});
 await frame.click('#btn-resume');await frame.evaluate(()=>advanceTime(900));await frame.locator('body').screenshot({path:`${out}/${label}-laser.png`});
 check(label+' standalone laser has visible projector/active beam without white barriers',await frame.evaluate(()=>__RIFT.traps.traps.length===1&&__RIFT.obstacles.length===0&&__RIFT.state==='playing'));
 await frame.evaluate(()=>advanceTime(3000));check(label+' actual laser collision ends run',await frame.evaluate(()=>__RIFT.state==='dead'||__RIFT.state==='dying'));
 await frame.click('#btn-death-restart');check(label+' instant retry restores blue / no phantom touch or old laser timer',await frame.evaluate(()=>__RIFT.t===0&&__RIFT.player.dim==='B'&&__RIFT.rift.emitted===0&&__RIFT.traps.traps[0].disabledUntil===-Infinity));
 await frame.evaluate(()=>{__RIFT.autoplayQueue=__RIFT.level.replay.taps.map(t=>({...t}));advanceTime(4000);});
 check(label+' actual recorded inputs complete pattern, collisions remain enabled',await frame.evaluate(()=>__RIFT.state==='won'&&__RIFT.rift.emitted===2&&__ASCENSION.isolated));
 await frame.locator('body').press('Escape');await p.waitForFunction(()=>document.querySelector('#playtest').hidden);check(label+' returns to same editor document',await p.evaluate(()=>__FORGE.doc.level.chunk.pattern==='P05'));
 await library();await card('P21').getByRole('button',{name:'Playtest',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#pt-frame').contentWindow?.__RIFT?.state==='paused');frame=await(await p.$('#pt-frame')).contentFrame();await frame.evaluate(()=>{__RIFT.debug.manual=true;__RIFT.audio.simulationOnly=true;});await frame.click('#btn-resume');await frame.evaluate(()=>advanceTime(500));await frame.locator('body').screenshot({path:`${out}/${label}-triple-saw.png`});
 check(label+' triple-saw pattern uses three simultaneous bodies and unchanged hitbox',await frame.evaluate(()=>__RIFT.traps.traps.filter(o=>o.y>=__RIFT.traps.traps[0].y&&o.y<=__RIFT.traps.traps[0].y+100).length===3&&__RIFT.player.hitRadius===8));
 await frame.locator('body').press('Escape');await p.waitForFunction(()=>document.querySelector('#playtest').hidden);
 // Saved collection preview uses certified overrides and has isolated records/Momentum.
 await library();await p.getByRole('button',{name:'Sammlung testen',exact:true}).click();await p.waitForFunction(()=>document.querySelector('#pt-frame').contentWindow?.__RIFT?.state==='paused');frame=await(await p.$('#pt-frame')).contentFrame();
 check(label+' collection excludes disabled/unverified patterns and official statistics',await frame.evaluate(()=>__RIFT.endless&&!__RIFT.endless.book.chunks.some(c=>['pattern-p05','pattern-imported'].includes(c.id))&&__ASCENSION.isolated&&__RIFT.endless.momentum.tier===0));
 await frame.evaluate(()=>{__RIFT.debug.manual=true;__RIFT.audio.simulationOnly=true;__RIFT.debug.autoplay=true;__RIFT.setupAutoplay();});await frame.click('#btn-resume');await frame.evaluate(()=>advanceTime(60000));check(label+' local collection survives actual 1500m replay',await frame.evaluate(()=>__RIFT.state==='playing'&&__RIFT.y>=15000));
 await p.click('#pt-restart');await p.waitForFunction(()=>document.querySelector('#pt-frame').contentWindow?.__RIFT?.state==='paused');frame=await(await p.$('#pt-frame')).contentFrame();check(label+' collection restart preserves book and resets timeline/inputs',await frame.evaluate(()=>__RIFT.endless.seed===37&&__RIFT.t===0&&__RIFT.rift.emitted===0));
 await frame.locator('body').press('Escape');await p.waitForFunction(()=>document.querySelector('#playtest').hidden);
 await library();await card('P05').getByRole('button',{name:'Lokal entfernen',exact:true}).click();await p.getByRole('button',{name:'Bestätigen',exact:true}).click();await p.waitForSelector('.pattern-card[data-pattern="P05"]');
 check(label+' removing local override restores immutable reference',await card('P05').getByRole('checkbox').isChecked()&&await card('P05').locator('.pattern-meta').textContent().then(t=>t.includes('Gewicht 1')));
 check(label+' no uncaught browser errors',errors.length===0);report.push({label,checks,errors});
 }finally{await b.close();}
}
writeFileSync(out+'/report.json',JSON.stringify({checks,report,physicalDevices:false},null,2));console.log(checks+' Pattern Forge browser checks passed');
