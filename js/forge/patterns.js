import {parsePattern,patternStatus,duplicatePattern,mergePatterns,certifyPattern} from '../pattern-library.js';
import {drawTrap} from '../art/traps.js';
import {makeTrap} from '../traps.js';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,action,cls='')=>{const b=el('button',text,'btn '+cls);b.type='button';b.addEventListener('click',action);return b;};
const labels=['Sehr einfach','Einfach','Mittel','Fortgeschritten','Schwer','Sehr schwer','Extrem'];
/** Small library panel inside the existing Forge modal / mobile sheet architecture. */
export class PatternLibrary{
 constructor(app){this.app=app;this.references=null;this.records=[];}
 async load(){
  if(!this.references){const index=await this.app.fetch('../endless/patterns/index.json');this.references=await Promise.all(index.patterns.map(async p=>parsePattern(await this.app.fetch('../endless/patterns/'+p.file))));}
  this.records=this.app.store.available?await this.app.store.listLevels():[];
  return mergePatterns(this.references,this.records);
 }
 async open(){
  const a=this.app;let patterns;
  a.onOpen?.();
  try{patterns=await this.load();}catch(e){a.toast('Pattern Library: '+e.message,'error');return;}
  const body=el('div',null,'pattern-library'),intro=el('p','24 Referenzmuster · lokale Änderungen bleiben auf diesem Gerät. Für das öffentliche Spiel: JSON exportieren, im Repository ersetzen und neu prüfen.','pattern-intro');body.append(intro);
  const tools=el('div',null,'pattern-tools'),search=el('input');search.type='search';search.placeholder='Muster, Kategorie oder ID suchen';search.setAttribute('aria-label','Muster suchen');tools.append(search);
  const file=el('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
  tools.append(button('JSON importieren',()=>file.click()),button('Sammlung testen',async()=>{try{close();await a.testBook(patterns);}catch(e){a.toast(e.message,'error');}}),file);body.append(tools);
  const grid=el('div',null,'pattern-grid');body.append(grid);
  const close=()=>document.querySelector('#modal').close(null);
  const openLevel=async(l)=>{close();if(!await a.confirmDiscard())return false;a.open(structuredClone(l));return true;};
  const refresh=async()=>{try{patterns=await this.load();render();}catch(e){a.toast('Speichern fehlgeschlagen: '+e.message,'error');}};
  const save=async l=>{if(!a.store.available)throw Error('Browser-Speicher nicht verfügbar – JSON exportieren.');await a.store.saveLevel(l);await refresh();};
  const render=()=>{
   grid.replaceChildren();const q=search.value.toLowerCase();
   for(const l of patterns){const m=l.chunk;if(!`${l.name} ${m.pattern} ${m.category}`.toLowerCase().includes(q))continue;
    const card=el('article',null,'pattern-card');card.dataset.pattern=m.pattern;
    const title=el('h3',`${m.pattern} · ${l.name}`),meta=el('p',`${m.category} · ${labels[m.tier]} · Gewicht ${m.weight??1}`,'pattern-meta'),status=patternStatus(l),badge=el('span',status,'pattern-status');badge.dataset.status=status;
    const head=el('div',null,'pattern-heading');head.append(title,meta,badge);card.append(this.preview(l),head,el('p',m.idea||l.description,'pattern-idea'));
    const actions=el('div',null,'pattern-actions');
    actions.append(button('Öffnen',()=>openLevel(l),'primary'),button('Playtest',async()=>{if(await openLevel(l))a.play();}));
    const enabled=el('label',null,'pattern-enabled'),check=el('input');check.type='checkbox';check.checked=m.enabled!==false;check.setAttribute('aria-label',`${m.pattern} aktivieren`);
    check.addEventListener('change',async()=>{try{const edited=structuredClone(l);edited.chunk.enabled=check.checked;await save(edited);}catch(e){check.checked=!check.checked;a.toast(e.message,'error');}});enabled.append(check,el('span',check.checked?'Aktiviert':'Deaktiviert'));actions.append(enabled);
    actions.append(button('Duplizieren',async()=>{try{const id=`pattern-${Date.now().toString(36)}`;const copy=duplicatePattern(l,id);await save(copy);await openLevel(copy);}catch(e){a.toast(e.message,'error');}}));
    actions.append(button('Export',()=>a.download(l.id+'.json',JSON.stringify(l,null,2))));
    if(this.records.some(r=>r.id===l.id))actions.append(button('Lokal entfernen',async()=>{
     close();
     const reference=this.references.some(r=>r.id===l.id),confirm=await a.confirm(`„${l.name}“ lokal entfernen? ${reference?'Das Referenzmuster wird wiederhergestellt.':'Diese lokale Kopie wird gelöscht. Bitte vorher exportieren, wenn du sie behalten möchtest.'}`);
     if(confirm)try{await a.store.deleteLevel(l.id);}catch(e){a.toast(e.message,'error');}
     await this.open();
    }));
    card.append(actions);grid.append(card);
   }
   if(!grid.children.length)grid.append(el('p','Keine passenden Muster.'));
  };
  search.addEventListener('input',render);
  file.addEventListener('change',async()=>{const f=file.files[0];file.value='';if(!f)return;let reopen=false;try{const l=parsePattern(JSON.parse(await f.text()));if(patterns.some(p=>p.id===l.id)){close();reopen=true;if(!await a.confirm('Vorhandenes lokales Muster ersetzen? Die Repository-Referenz bleibt erhalten.')){await this.open();return;}}await save(l);a.toast('Muster lokal importiert.','ok');}catch(e){a.toast('Import abgelehnt: '+e.message,'error');}if(reopen)await this.open();});
  render();const pending=a.modal('RIFT PATTERN LIBRARY',body,[['Schließen',null,'primary']]);document.querySelector('#modal').classList.add('pattern-modal');
  await pending;document.querySelector('#modal').classList.remove('pattern-modal');
 }
 preview(l){
  const canvas=el('canvas',null,'pattern-preview');canvas.width=156;canvas.height=216;canvas.setAttribute('aria-label','Musterübersicht von unten nach oben');
  if(patternStatus(l)==='INVALID'){const c=canvas.getContext('2d');c.fillStyle='#251223';c.fillRect(0,0,156,216);c.fillStyle='#ff9ab8';c.font='16px sans-serif';c.fillText('Daten prüfen',18,108);return canvas;}
  const c=canvas.getContext('2d'),s=Math.min(140/270,198/l.finish.y),left=(156-270*s)/2;
  c.fillStyle='#050c1b';c.fillRect(0,0,156,216);c.save();c.translate(left,207);c.scale(s,s);
  c.fillStyle='#0b192b';c.fillRect(0,-l.finish.y,270,l.finish.y);c.strokeStyle='#2ba4be';c.lineWidth=2/s;c.strokeRect(0,-l.finish.y,270,l.finish.y);
  for(const o of l.objects){if(o.type==='hint')continue;if(['saw','mine','laser'].includes(o.type)){const t=makeTrap(o);drawTrap(c,t,0,-o.y,'both');}else{c.fillStyle=o.type==='seal'?'#ffd166':o.dimension==='blue'?'#40dfff':o.dimension==='red'?'#ff4597':'#d7e8ef';c.fillRect(o.x,-o.y-o.h/2,o.w,o.h);}}
  c.fillStyle='#80f5ff';c.beginPath();c.arc(135,0,7/s,0,Math.PI*2);c.fill();c.restore();return canvas;
 }
 validate(){
  const a=this.app;try{const {level,result}=certifyPattern(a.current());a.edit('Muster prüfen',tx=>Object.assign(tx.touchMeta().chunk,level.chunk));a.toast(result.message,result.ok?'ok':'warn');return result;}catch(e){a.toast(e.message,'error');return {ok:false,message:e.message};}
 }
 async review(){
  const a=this.app,l=a.current();if(!['VERIFIED','REVIEWED'].includes(patternStatus(l))){a.toast('Zuerst einen erfolgreichen Replay-Nachweis prüfen.','warn');return;}
  if(!await a.confirm('Hast du dieses Muster selbst auf Lesbarkeit und Fairness geprüft? REVIEWED ergänzt den Simulationsnachweis um deine manuelle Prüfung.'))return;
  a.edit('Manuell geprüft',tx=>{const v=tx.touchMeta().chunk.validation;v.review={hash:v.hash,at:new Date().toISOString(),method:'manual-local-review'};});
 }
}
