export const STATS_KEY='riftclimb.experiment.hybrid.v1';
export class HybridStats {
  constructor(storage){this.data={schemaVersion:1,runs:[]};this.warning='';if(arguments.length===0)try{storage=globalThis.localStorage;}catch{}this.storage=storage;
    try{const d=JSON.parse(storage?.getItem(STATS_KEY)||'null');if(d?.schemaVersion===1&&Array.isArray(d.runs))this.data.runs=d.runs.filter(r=>r&&typeof r.id==='string'&&['course','endless','auto'].includes(r.kind)&&Number.isFinite(r.duration)&&r.duration>=0&&Number.isFinite(r.distance)&&r.distance>=0).slice(-100);else if(d){this.warning='Unbekannte Testdaten: nur Sitzungsspeicherung.';this.readOnly=true;}}catch{this.warning='Beschädigte Testdaten: neue Ergebnisse bleiben vorerst in dieser Sitzung.';this.readOnly=true;}
  }
  save(){try{if(!this.storage||this.readOnly)throw Error();this.storage.setItem(STATS_KEY,JSON.stringify(this.data));}catch{this.warning='Testdaten können nicht dauerhaft gespeichert werden.';}}
  add(run){if(this.data.runs.some(r=>r.id===run.id))return false;this.data.runs.push(structuredClone(run));this.data.runs=this.data.runs.slice(-100);for(const r of this.data.runs.slice(0,-3))delete r.inputs;this.save();return true;}
  rate(id,ratings){const r=this.data.runs.find(r=>r.id===id);if(!r||r.source!=='interactive'||!['control','fun','fairness','retry'].every(k=>Number.isInteger(ratings[k])&&ratings[k]>=1&&ratings[k]<=5))return false;r.ratings={...ratings};this.save();return true;}
  groups(kind){return [...new Set(this.data.runs.filter(r=>r.kind===kind&&r.source==='interactive').map(r=>JSON.stringify(r.parameters)))];}
  summary(kind,parameters=null){
    const rows=this.data.runs.filter(r=>r.kind===kind&&r.source==='interactive'&&['death','complete'].includes(r.outcome)&&(parameters===null||JSON.stringify(r.parameters)===parameters));
    const n=rows.length,mean=k=>n?rows.reduce((s,r)=>s+r[k],0)/n:null,ratings={};
    for(const k of ['control','fun','fairness','retry']){const rated=rows.filter(r=>r.ratings?.[k]);ratings[k]=rated.length?rated.reduce((s,r)=>s+r.ratings[k],0)/rated.length:null;}
    const deaths={};for(const r of rows)if(r.death)deaths[r.death.type]=(deaths[r.death.type]||0)+1;
    return {runs:n,duration:mean('duration'),distance:mean('distance'),completionRate:n?rows.filter(r=>r.completed).length/n:null,ratings,deaths};
  }
}
