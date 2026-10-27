import {blankLab,cleanLab,mergeLab,labStorage,reportLab,finishLab} from './lab-stats.js';
import {LAB_STYLES,LAB_FEEDBACK} from './arena.js';
import { ACHIEVEMENTS, SKINS, medalFor } from './rewards.js';
import { STORAGE_KEY, readJson } from './storage.js';
import {CLIMB_SPEED} from './config.js';
import {worldMeters,infinityClimbY} from './world-units.js';
export const ASCENSION_KEY='riftclimb.ascension.v2';
export const BACKUP_KEY=ASCENSION_KEY+'.backup';
const object=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const integer=(v,max=Number.MAX_SAFE_INTEGER)=>Number.isFinite(v)?Math.min(max,Math.max(0,Math.floor(v))):0;
const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))?v:null;
const safeId=id=>/^[a-z0-9][a-z0-9-]{0,39}$/.test(id);
const blank=()=>({schemaVersion:2,profile:{activePlaytimeMs:0,historyIncomplete:false},levels:{},achievements:{},cosmetics:{selectedSkinId:'original',unlockedSkinIds:['original']},endless:{bestHeight:0,attempts:0,lastHeight:0,recordAt:null,lastSeed:null},lab:blankLab()});
function cleanLevel(id,raw) {
 const r=object(raw),clears=integer(r.clears),completed=r.completed===true||clears>0||integer(r.best,100)===100;
 const best=completed?100:integer(r.best,99);
 return {id,best,attempts:integer(r.attempts),clears,deaths:integer(r.deaths),completed,medal:medalFor(best),firstCompletedAt:date(r.firstCompletedAt),lastPlayedAt:date(r.lastPlayedAt),historyIncomplete:!!r.historyIncomplete};
}
function normalize(raw) {
 const s=blank(),r=object(raw);s.lab=cleanLab(r.lab);s.profile.activePlaytimeMs=integer(r.profile?.activePlaytimeMs);s.profile.historyIncomplete=!!r.profile?.historyIncomplete;
 s.endless={bestHeight:integer(r.endless?.bestHeight),attempts:integer(r.endless?.attempts),lastHeight:integer(r.endless?.lastHeight),recordAt:date(r.endless?.recordAt),lastSeed:Number.isInteger(r.endless?.lastSeed)?r.endless.lastSeed>>>0:null};
 for(const [id,l] of Object.entries(object(r.levels)))if(safeId(id))s.levels[id]=cleanLevel(id,l);
 for(const a of ACHIEVEMENTS)if(r.achievements?.[a.id]?.unlocked===true)s.achievements[a.id]={unlocked:true,unlockedAt:date(r.achievements[a.id].unlockedAt)};
 const unlocked=r.cosmetics?.unlockedSkinIds;
 s.cosmetics.unlockedSkinIds=SKINS.filter(k=>k.id==='original'||Array.isArray(unlocked)&&unlocked.includes(k.id)).map(k=>k.id);
 if(s.cosmetics.unlockedSkinIds.includes(r.cosmetics?.selectedSkinId))s.cosmetics.selectedSkinId=r.cosmetics.selectedSkinId;
 return s;
}
/** Single authoritative save. The Game adapter reuses M7's stats interface. */
export class Progression {
 constructor({storage,isolated=false,now=()=>new Date().toISOString()}={}) {
  this.isolated=isolated;this.now=now;this.queue=[];this.adapters=new Map();this.warning='';this.durable=true;
  try{this.storage=storage===undefined?globalThis.localStorage:storage;}catch{this.storage=null;}
  this.data=blank();
  if(!isolated) {
   let raw=null,backup=null;
   try{raw=JSON.parse(this.storage?.getItem(ASCENSION_KEY)||'null');}catch{this.warning='Spielstand beschädigt. Verfügbare Sicherung und frühere Bestwerte werden wiederhergestellt.';}
   try{backup=JSON.parse(this.storage?.getItem(BACKUP_KEY)||'null');}catch{/* Sources recover independently. */}
   if(raw?.schemaVersion>2){this.readOnly=true;this.warning='Spielstand aus einer neueren Version. Neue Ergebnisse bleiben in dieser Sitzung.';}
   const source=raw?.schemaVersion===2?raw:backup?.schemaVersion===2?backup:null;
   if(source)this.data=normalize(source);
   // Recover monotonic evidence even when individual fields of the primary are damaged.
   if(backup?.schemaVersion===2) {
    const b=normalize(backup);mergeLab(this.data.lab,b.lab);
    for(const [id,old] of Object.entries(b.levels)) {
     const l=this.level(id);for(const k of ['best','attempts','clears','deaths'])l[k]=Math.max(l[k],old[k]);
     l.completed ||= old.completed;l.medal=medalFor(l.best);l.firstCompletedAt ||= old.firstCompletedAt;l.lastPlayedAt ||= old.lastPlayedAt;l.historyIncomplete ||= old.historyIncomplete;
    }
    this.data.profile.activePlaytimeMs=Math.max(this.data.profile.activePlaytimeMs,b.profile.activePlaytimeMs);
    this.data.profile.historyIncomplete ||= b.profile.historyIncomplete;
    for(const [id,a] of Object.entries(b.achievements))this.data.achievements[id] ||= a;
    this.data.cosmetics.unlockedSkinIds=[...new Set([...this.data.cosmetics.unlockedSkinIds,...b.cosmetics.unlockedSkinIds])];
    if(b.endless.bestHeight>this.data.endless.bestHeight){this.data.endless.bestHeight=b.endless.bestHeight;this.data.endless.recordAt=b.endless.recordAt;}
    this.data.endless.attempts=Math.max(this.data.endless.attempts,b.endless.attempts);
   }
   this.migrateLegacy();this.evaluate(true);this.persist();
  }
 }
 level(id){if(!Object.hasOwn(this.data.levels,id))this.data.levels[id]=cleanLevel(id,{});return this.data.levels[id];}
 migrateLegacy() {
  try {
   const keys=Array.from({length:this.storage?.length||0},(_,i)=>this.storage.key(i));
   for(const key of keys) {
    if(key!==STORAGE_KEY&&!key?.startsWith(STORAGE_KEY+'.'))continue;
    const id=key===STORAGE_KEY?'rift-main':key.slice(STORAGE_KEY.length+1);if(!safeId(id))continue;
    let raw;try{raw=JSON.parse(this.storage.getItem(key));}catch{continue;}
    if(!raw?.stats)continue;
    const old=cleanLevel(id,raw.stats),l=this.level(id),history=old.attempts>0||old.best>0||old.clears>0;
    l.best=Math.max(l.best,old.best);l.attempts=Math.max(l.attempts,old.attempts);l.clears=Math.max(l.clears,old.clears);l.completed ||= old.completed;l.medal=medalFor(l.best);
    if(history){l.historyIncomplete=true;this.data.profile.historyIncomplete=true;}
   }
  }catch{this.failStorage();}
 }
 evaluate(migrating=false,run=null) {
  const add=r=>{if(!migrating){this.queue.push(r);run?.rewards.push(r);}};
  for(const a of ACHIEVEMENTS)if(!this.data.achievements[a.id]&&a.test(this.data)) {
   this.data.achievements[a.id]={unlocked:true,unlockedAt:migrating?null:this.now()};add({type:'achievement',id:a.id,name:a.name,icon:a.icon});
  }
  for(const k of SKINS)if(!this.data.cosmetics.unlockedSkinIds.includes(k.id)&&k.test(this.data)) {
   this.data.cosmetics.unlockedSkinIds.push(k.id);add({type:'skin',id:k.id,name:k.name,icon:'skin'});
  }
 }
 begin(id,eligible) {
  const run={id,eligible:!!eligible&&!this.isolated,closed:false,lastT:0,rewards:[],startBest:this.level(id).best};
  if(run.eligible){const l=this.level(id);l.attempts++;l.lastPlayedAt=this.now();this.evaluate(false,run);this.persist();}return run;
 }
 medalReward(run,id) {
  const r={type:'medal',id,name:id.toUpperCase(),levelId:run.id};
  this.queue=this.queue.filter(v=>v.type!=='medal'||v.levelId!==run.id);
  run.rewards=run.rewards.filter(v=>v.type!=='medal');run.rewards.push(r);this.queue.push(r);
 }
 report(run,t,best,force=false) {
  if(run?.kind==='lab')return reportLab(this,run,t,best,force);
  if(run?.kind==='endless')return this.reportEndless(run,t,force);
  if(!run?.eligible||run.closed)return false;
  const l=this.level(run.id),old=l.best,oldMedal=l.medal;
  this.data.profile.activePlaytimeMs+=Math.max(0,t-run.lastT)*1000;run.lastT=Math.max(t,run.lastT);
  l.best=Math.max(l.best,integer(best,99));l.medal=medalFor(l.best);
  if(l.medal!==oldMedal)this.medalReward(run,l.medal);
  if(l.best!==old){this.evaluate(false,run);force=true;}
  if(force||t-(run.savedT||0)>=1){run.savedT=t;this.persist();}return l.best>old;
 }
 finish(run,t,best,outcome) {
  if(run?.kind==='lab')return finishLab(this,run,t,best,outcome);
  if(run?.kind==='endless'){if(run.closed||!run.eligible)return false;this.reportEndless(run,t,true);run.closed=true;this.persist();return true;}
  if(!run?.eligible||run.closed)return false;
  this.report(run,t,best);run.closed=true;const l=this.level(run.id);
  if(outcome==='death')l.deaths++;
  if(outcome==='win') {
   const first=!l.completed,old=l.medal;l.best=100;l.medal='gold';l.completed=true;l.clears++;
   if(first)l.firstCompletedAt=this.now();
   if(old!=='gold')this.medalReward(run,'gold');
  }
  this.evaluate(false,run);this.persist();return true;
 }
 equip(id){if(!this.data.cosmetics.unlockedSkinIds.includes(id))return false;this.data.cosmetics.selectedSkinId=id;this.persist();return true;}
 reportEndless(run,t,force=false) {
  if(!run.eligible||run.closed)return false;const e=this.data.endless,h=worldMeters(run.ramp?infinityClimbY(t):t*CLIMB_SPEED),record=h>e.bestHeight;
  e.lastHeight=h;if(record){e.bestHeight=h;run.record=true;}
  if(force||t-(run.savedT||0)>=1){if(run.record)e.recordAt=this.now();run.savedT=t;this.persist();}return record;
 }
 labStorage(style){return labStorage(this,style);}
 setLabStyle(style){if(!LAB_STYLES.includes(style))return false;this.data.lab.style=style;this.persist();return true;}
 setLabFeedback(value){if(!LAB_FEEDBACK.includes(value))return false;this.data.lab.feedback=value;this.persist();return true;}
 infinityStorage(seed) {
  const p=this,e=p.data.endless;
  return {progression:p,muted:false,stats:{get best(){return e.bestHeight;},get attempts(){return e.attempts;},clears:0},save(){p.persist();},
   beginRun(){const run={id:'rift-infinity',kind:'endless',eligible:!p.isolated,closed:false,rewards:[],record:false,savedT:0};if(run.eligible){e.attempts++;e.lastHeight=0;e.lastSeed=seed>>>0;p.persist();}return run;},
   report:(run,t,pct,force)=>p.report(run,t,pct,force),finish:(run,t,pct,outcome)=>p.finish(run,t,pct,outcome)};
 }
 summary() {
  const levels=Object.values(this.data.levels),sum=k=>levels.reduce((n,l)=>n+l[k],0);
  return {totalNormalAttempts:sum('attempts'),totalDeaths:sum('deaths'),totalCompletions:sum('clears'),completedLevels:levels.filter(l=>l.completed).length,goldMedals:levels.filter(l=>l.medal==='gold').length,achievements:Object.keys(this.data.achievements).length,skins:this.data.cosmetics.unlockedSkinIds.length,activePlaytimeMs:Math.floor(this.data.profile.activePlaytimeMs),historyIncomplete:this.data.profile.historyIncomplete};
 }
 failStorage(){this.durable=false;this.warning='Fortschritt kann gerade nicht dauerhaft gespeichert werden. Er bleibt für diese Sitzung erhalten.';}
 persist() {
  if(this.isolated||this.readOnly)return;
  try{if(!this.storage)throw new Error('No local storage');const value=JSON.stringify(this.data);this.storage.setItem(ASCENSION_KEY,value);this.storage.setItem(BACKUP_KEY,value);this.durable=true;}catch{this.failStorage();}
 }
 storageFor(id) {
  if(this.adapters.has(id))return this.adapters.get(id);
  const p=this,adapter={stats:this.level(id),muted:!!readJson(STORAGE_KEY)?.muted,progression:p,save(){p.persist();},beginRun(eligible,mode){return p.begin(id,eligible&&(mode===undefined||mode==='normal'));},report(run,t,pct,force){return p.report(run,t,pct,force);},finish(run,t,pct,outcome){return p.finish(run,t,pct,outcome);}};
  this.adapters.set(id,adapter);return adapter;
 }
}
