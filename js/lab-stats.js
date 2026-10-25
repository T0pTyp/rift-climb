// Optional domain of the existing Ascension save, never a campaign level/reward.
const count=v=>Number.isFinite(v)?Math.max(0,Math.min(Number.MAX_SAFE_INTEGER,Math.floor(v))):0;
export const blankLab=()=>({style:'classic',feedback:null,stats:{classic:{attempts:0,best:0,clears:0,deaths:0,sumProgress:0},compact:{attempts:0,best:0,clears:0,deaths:0,sumProgress:0}}});
export function cleanLab(raw){
 const l=blankLab();if(['classic','compact'].includes(raw?.style))l.style=raw.style;
 if(['classic','compact','equal'].includes(raw?.feedback))l.feedback=raw.feedback;
 for(const id of ['classic','compact']){const r=raw?.stats?.[id],attempts=count(r?.attempts);l.stats[id]={attempts,best:count(r?.best)>100?100:count(r?.best),clears:Math.min(attempts,count(r?.clears)),deaths:Math.min(attempts,count(r?.deaths)),sumProgress:Math.min(attempts*100,count(r?.sumProgress))};}
 return l;
}
export function mergeLab(l,b){for(const id of ['classic','compact'])for(const k of ['attempts','best','clears','deaths','sumProgress'])l.stats[id][k]=Math.max(l.stats[id][k],b.stats[id][k]);}
export function reportLab(p,run,t,best,force=false){
 if(!run?.eligible||run.closed||run.kind!=='lab')return false;
 const s=p.data.lab.stats[run.style],pct=Math.max(run.best,Math.min(100,count(best))),changed=pct>s.best;
 s.sumProgress+=pct-run.best;run.best=pct;s.best=Math.max(s.best,pct);
 if(force||t-run.savedT>=1){run.savedT=t;p.persist();}return changed;
}
export function labStorage(p,style){
 const s=p.data.lab.stats[style];if(!s)throw Error('Unknown Arena Lab style');
 return {progression:p,muted:false,stats:s,save(){p.persist();},
  beginRun(eligible=true,mode){const r={kind:'lab',style,best:0,savedT:0,eligible:!p.isolated&&eligible&&(mode===undefined||mode==='lab'),closed:false,rewards:[]};if(r.eligible){s.attempts++;p.persist();}return r;},
  report:(r,t,best,force)=>p.report(r,t,best,force),finish:(r,t,best,outcome)=>p.finish(r,t,best,outcome),
 };
}
export function finishLab(p,r,t,best,outcome){if(!r?.eligible||r.closed)return false;reportLab(p,r,t,outcome==='win'?100:best,true);r.closed=true;const s=p.data.lab.stats[r.style];if(outcome==='death')s.deaths++;if(outcome==='win')s.clears++;p.persist();return true;}
