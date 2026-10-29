// Pure performance evidence and difficulty transform. No physics or storage access.
export const MOMENTUM_CONFIG=Object.freeze({
  version:1,historySize:6,minHeight:400,bestRatio:.65,comparableRatio:.8,
  tier1Runs:2,tier2Runs:3,earlyRatio:.3,earlyFloor:120,earlyDeathsToReduce:2,
  warmupMeters:Object.freeze([0,75,65]),strength:Object.freeze([0,1.1,2.4]),
});
export const MOMENTUM_VERSION=1;
const integer=v=>Number.isSafeInteger(v)&&v>=0?v:0;
const height=v=>Number.isFinite(v)&&v>=0?Math.min(Number.MAX_SAFE_INTEGER,Math.floor(v)):0;
export const blankMomentum=()=>({version:1,tier:0,provenHeight:0,recentRuns:[],proof:{bestHeight:0,heights:[]},consecutiveEarlyDeaths:0,promotionAfterId:0,sequence:0});
const median=values=>{const a=[...values].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
/** Highest-count comparable cohort; ties prefer recent evidence, then lower median. */
export function qualifyingRuns(runs,bestHeight,afterId=0){
 const c=MOMENTUM_CONFIG,a=runs.filter(r=>r.id>afterId&&r.height>=c.minHeight&&r.height>=bestHeight*c.bestRatio).sort((a,b)=>a.height-b.height||a.id-b.id);
 let best=[];
 for(let i=0;i<a.length;i++)for(let j=i;j<a.length;j++){
  const group=a.slice(i,j+1);if(group[0].height<group.at(-1).height*c.comparableRatio)continue;
  const newer=Math.max(...group.map(r=>r.id))>Math.max(0,...best.map(r=>r.id));
  if(group.length>best.length||group.length===best.length&&(newer||Math.max(...group.map(r=>r.id))===Math.max(0,...best.map(r=>r.id))&&median(group.map(r=>r.height))<median(best.map(r=>r.height))))best=group;
 }
 return best;
}
export function validMomentumSnapshot(v){return v?.version===MOMENTUM_VERSION&&Number.isInteger(v.tier)&&v.tier>=0&&v.tier<=2&&Number.isFinite(v.provenHeight)&&v.provenHeight>=0&&v.provenHeight<=Number.MAX_SAFE_INTEGER&&(v.tier===0||v.provenHeight>=MOMENTUM_CONFIG.minHeight);}
export function momentumSnapshot(state){
 const snapshot={version:MOMENTUM_VERSION,tier:state?.tier??0,provenHeight:state?.provenHeight??0};
 if(!validMomentumSnapshot(snapshot))throw Error('Ungültige Momentum-Momentaufnahme');
 return Object.freeze(snapshot);
}
export function cleanMomentum(raw,bestHeight){
 const s=blankMomentum();if(raw?.version!==MOMENTUM_VERSION)return s;
 const seen=new Set();
 for(const r of (Array.isArray(raw.recentRuns)?raw.recentRuns:[]).slice(-MOMENTUM_CONFIG.historySize)){
  if(!r||!Number.isSafeInteger(r.id)||r.id<1||seen.has(r.id)||!Number.isFinite(r.height)||r.height<0||r.height>bestHeight||!['death','retry','quit'].includes(r.outcome)||!validMomentumSnapshot(r.momentum)||r.momentum.provenHeight>bestHeight)continue;
  seen.add(r.id);s.recentRuns.push({id:r.id,height:height(r.height),outcome:r.outcome,seed:integer(r.seed)>>>0,momentum:{...momentumSnapshot(r.momentum)}});
 }
 s.recentRuns.sort((a,b)=>a.id-b.id);s.sequence=Math.max(integer(raw.sequence),...s.recentRuns.map(r=>r.id),0);
 s.promotionAfterId=Math.min(s.sequence,integer(raw.promotionAfterId));
 const pb=raw.proof?.bestHeight,heights=raw.proof?.heights;
 if(Number.isSafeInteger(pb)&&pb>=MOMENTUM_CONFIG.minHeight&&pb<=bestHeight&&Array.isArray(heights)&&heights.length>=2&&heights.length<=6&&heights.every(h=>Number.isSafeInteger(h)&&h>=MOMENTUM_CONFIG.minHeight&&h<=pb&&h>=pb*MOMENTUM_CONFIG.bestRatio)&&Math.min(...heights)>=Math.max(...heights)*MOMENTUM_CONFIG.comparableRatio){
  s.proof={bestHeight:pb,heights:[...heights]};s.provenHeight=Math.min(bestHeight,median(heights));s.tier=[0,1,2].includes(raw.tier)?Math.min(heights.length-1,raw.tier):0;
 }
 s.consecutiveEarlyDeaths=s.tier?Math.min(MOMENTUM_CONFIG.earlyDeathsToReduce-1,integer(raw.consecutiveEarlyDeaths)):0;
 return s;
}
/** A completed eligible run is observed exactly once by Progression.finish(). */
export function observeMomentum(state,record,bestHeight){
 const s=cleanMomentum(state,bestHeight),c=MOMENTUM_CONFIG;
 if(!Number.isSafeInteger(record.id)||record.id<1||record.id<=(s.recentRuns.at(-1)?.id||0)||!Number.isSafeInteger(record.height)||record.height<0||record.height>bestHeight||!['death','retry','quit'].includes(record.outcome)||!validMomentumSnapshot(record.momentum))return s;
 s.sequence=Math.max(s.sequence,record.id);
 s.recentRuns.push({...record,momentum:{...momentumSnapshot(record.momentum)}});s.recentRuns=s.recentRuns.slice(-c.historySize);
 const early=s.tier>0&&record.outcome==='death'&&record.height<Math.max(c.earlyFloor,s.provenHeight*c.earlyRatio);
 s.consecutiveEarlyDeaths=early?s.consecutiveEarlyDeaths+1:0;
 if(s.consecutiveEarlyDeaths>=c.earlyDeathsToReduce){s.tier--;s.consecutiveEarlyDeaths=0;s.promotionAfterId=record.id;return s;}
 const group=qualifyingRuns(s.recentRuns,bestHeight,s.promotionAfterId),candidate=group.length>=c.tier2Runs?2:group.length>=c.tier1Runs?1:0;
 if(candidate>0&&candidate>=s.tier){s.tier=candidate;s.proof={bestHeight,heights:group.map(r=>r.height)};s.provenHeight=Math.min(bestHeight,median(s.proof.heights));}
 return s;
}
/** M8.3: half the former bonus, protected warmup, bounded by measured proof. */
export function effectiveDifficultyHeight(actualHeight,snapshot){
 const x=Number.isFinite(actualHeight)?Math.max(0,actualHeight):0,tier=snapshot?.tier||0,p=snapshot?.provenHeight||0;
 if(![1,2].includes(tier)||!Number.isFinite(p)||p<MOMENTUM_CONFIG.minHeight||x>=p)return x;
 const w=Math.min(p,MOMENTUM_CONFIG.warmupMeters[tier]);if(x<=w||p<=w)return x;
 const u=(x-w)/(p-w),bonus=MOMENTUM_CONFIG.strength[tier]*(p-w)*u*u*(1-u)*(1-u);
 return Math.max(x,Math.min(p,x+bonus));
}
