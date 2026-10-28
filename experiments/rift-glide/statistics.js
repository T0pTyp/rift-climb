export const EXPERIMENT_KEY='riftclimb.experiment.glide.v1';
export class ExperimentStats {
  constructor(storage){
    if(arguments.length===0)try{storage=globalThis.localStorage;}catch{storage=null;}
    this.storage=storage;this.warning='';this.data={version:1,runs:[]};
    try{const d=JSON.parse(storage?.getItem(EXPERIMENT_KEY)||'null');if(d?.version===1&&Array.isArray(d.runs))this.data.runs=d.runs.filter(r=>r&&typeof r.id==='string'&&['auto','glide','endless'].includes(r.kind)&&Number.isFinite(r.duration)&&Number.isFinite(r.maxHeight)).slice(-100);else if(d)this.warning='Unbekannte Testdaten wurden nicht geladen.';}catch{this.warning='Testdaten konnten nicht geladen werden.';}
  }
  save(){try{this.storage?.setItem(EXPERIMENT_KEY,JSON.stringify(this.data));if(!this.storage)throw Error();}catch{this.warning='Testdaten bleiben nur für diese Sitzung erhalten.';}}
  add(run){
    if(this.data.runs.some(r=>r.id===run.id))return false;
    this.data.runs.push(structuredClone(run));this.data.runs=this.data.runs.slice(-100);
    // Keep summaries for 100 runs, full input sequences only for the latest three.
    for(const r of this.data.runs.slice(0,-3))if(r.inputs){delete r.inputs;r.inputsRetained=false;}
    this.save();return true;
  }
  rate(id,ratings){const r=this.data.runs.find(r=>r.id===id);if(!r)return false;if(!['control','fun','fairness'].every(k=>Number.isInteger(ratings[k])&&ratings[k]>=1&&ratings[k]<=5))return false;r.ratings={...ratings};this.save();return true;}
  groups(kind){return [...new Set(this.data.runs.filter(r=>r.kind===kind&&r.source==='interactive'&&['death','complete'].includes(r.outcome)).map(r=>JSON.stringify(r.parameters)))];}
  summary(kind,parameters=null){
    const rows=this.data.runs.filter(r=>r.kind===kind&&r.source==='interactive'&&['death','complete'].includes(r.outcome)&&(parameters===null||JSON.stringify(r.parameters)===parameters)),n=rows.length;
    const mean=k=>n?rows.reduce((a,r)=>a+r[k],0)/n:null,deaths={};
    for(const r of rows)if(r.deathCause)deaths[r.deathCause]=(deaths[r.deathCause]||0)+1;
    const seconds=rows.reduce((a,r)=>a+r.duration,0),touches=rows.reduce((a,r)=>a+r.touches,0);
    const ratings={};for(const k of ['control','fun','fairness']){const rated=rows.filter(r=>r.ratings?.[k]>=1&&r.ratings[k]<=5);ratings[k]=rated.length?rated.reduce((n,r)=>n+r.ratings[k],0)/rated.length:null;}
    return {runs:n,meanDuration:mean('duration'),meanHeight:mean('maxHeight'),touchesPerMinute:seconds?touches*60/seconds:null,completionRate:n?rows.filter(r=>r.completed).length/n:null,deaths,ratings};
  }
}
