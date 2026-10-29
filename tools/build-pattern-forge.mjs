// Build from editable JSON; never regenerate/replace authored geometry.
import {readFileSync,writeFileSync} from 'node:fs';
import {parsePattern,certifyPattern} from '../js/pattern-library.js';
import {chunkFingerprint} from '../js/rift-director.js';
import {runReplay} from '../js/playcheck.js';
import {validateChunkBook} from '../js/endless.js';
const root='assets/endless/patterns/',idx=JSON.parse(readFileSync(root+'index.json'));
if(idx.schema!=='rift-pattern-library'||idx.version!==1)throw Error('Pattern index invalid');
const sources=idx.patterns.map(p=>({file:root+p.file,level:parsePattern(JSON.parse(readFileSync(root+p.file)))}));
const services=JSON.parse(readFileSync(root+'services.json'));
const book={schema:'rift-infinity-chunks',version:2,arenaStyle:'narrow',metersPerUnit:.1,revision:'pattern-forge-1',balance:'infinity-first',patternForge:1,serviceIds:services.map(c=>c.id),chunks:services};
const report=[];
for(const {file,level} of sources){
 const {level:l,result}=certifyPattern(level);let timing=0;
 if(result.ok)for(let i=0;i<l.replay.taps.length;i++)for(const dt of [-.04,.04]){
  const r=runReplay(l,l.replay.taps.map((tap,j)=>({...tap,t:tap.t+(i===j?dt:0)})));
  if(!r.won)throw Error(l.id+' timing '+i+'/'+dt+': '+JSON.stringify(r));timing++;
 }
 if(result.ok){l.chunk.validation.timing={perInputMs:[-40,40],runs:timing};l.chunk.validation.hash=chunkFingerprint(l);}
 // A failed proof remains editable but cannot enter the published generator.
 if(!result.ok)l.chunk.enabled=false;
 writeFileSync(file,JSON.stringify(l,null,2)+'\n');
 if(l.chunk.enabled!==false&&(l.chunk.weight??1)>0&&result.ok)book.chunks.push({id:l.id,length:l.finish.y,level:l});
 report.push({id:l.chunk.pattern,name:l.name,status:result.ok?'VERIFIED':'UNVERIFIED',enabled:l.chunk.enabled,fixtures:l.chunk.fixtures.length,timing,reason:result.ok?null:result.message});
 console.log(l.chunk.pattern,report.at(-1).status,result.message);
}
validateChunkBook(book);
writeFileSync('assets/endless/director.json',JSON.stringify(book,null,2)+'\n');
console.log(JSON.stringify({patterns:report.length,active:report.filter(p=>p.enabled).length,variants:book.chunks.length,report},null,2));
