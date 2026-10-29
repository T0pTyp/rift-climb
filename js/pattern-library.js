// Pattern documents ARE existing level/chunk documents, with optional author metadata.
import {validateLevelData,serializeLevel} from './level-data.js';
import {chunkFingerprint} from './rift-director.js';
import {checkChunkPlayability} from './playcheck.js';
export const PATTERN_STATUSES=['INVALID','UNVERIFIED','VERIFIED','REVIEWED'];
export function patternStatus(level){
 if(!validateLevelData(level).ok||!level?.chunk)return 'INVALID';
 const v=level.chunk.validation;
 if(v?.status==='invalid')return 'INVALID';
 if(v?.status!=='verified'||v.hash!==chunkFingerprint(level))return 'UNVERIFIED';
 return v.review?.hash===v.hash&&v.review?.at?'REVIEWED':'VERIFIED';
}
export function parsePattern(raw){
 const v=validateLevelData(raw);
 if(!v.ok||!v.level.chunk)throw Error(v.issues.find(i=>i.severity==='error')?.message||'Datei enthält kein Director-Muster.');
 const l=JSON.parse(serializeLevel(v.level));
 if(typeof l.chunk.pattern!=='string'||!l.chunk.pattern||l.chunk.pattern.length>40)throw Error('Stabile Muster-ID fehlt (maximal 40 Zeichen).');
 return l;
}
export function certifyPattern(raw){
 const level=parsePattern(raw),m=level.chunk;
 const review=m.validation?.review;
 m.actions=level.replay?.taps.length||0;m.requiredSwitches=m.actions;
 const result=checkChunkPlayability(level);
 if(result.ok){m.validation=result.certificate;if(review?.hash===m.validation.hash)m.validation.review=review;}
 else m.validation={status:'unverified',message:result.message};
 return {level,result};
}
export function duplicatePattern(raw,id){
 const l=parsePattern(raw);l.id=id;l.name=(l.name+' · Kopie').slice(0,40);
 l.chunk.pattern=id;l.chunk.patternVersion=1;l.chunk.enabled=false;l.chunk.validation={status:'unverified'};
 return l;
}
/** Local library overrides do not mutate immutable repository references. */
export function mergePatterns(references,records){
 const map=new Map(references.map(l=>[l.id,structuredClone(l)]));
 for(const r of records)if(r.level?.chunk?.pattern&&typeof r.level.id==='string'&&Array.isArray(r.level.objects))map.set(r.level.id,structuredClone(r.level));
 return [...map.values()];
}
/** Existing locally saved service chunks replace their ID instead of duplicating it. */
export function localPatternBook(base,patterns){
 const chunks=new Map(base.chunks.filter(c=>base.serviceIds?.includes(c.id)).map(c=>[c.id,structuredClone(c)]));
 for(const level of patterns){
  if(level.chunk.enabled===false||(level.chunk.weight??1)<=0||!['VERIFIED','REVIEWED'].includes(patternStatus(level))){chunks.delete(level.id);continue;}
  chunks.set(level.id,{id:level.id,length:level.finish.y,level:structuredClone(level)});
 }
 return {...base,chunks:[...chunks.values()]};
}
