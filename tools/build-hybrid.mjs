import {readFileSync,writeFileSync} from 'node:fs';
import {certifyChunk,composeCourse} from '../experiments/ground-flight/director.js';
import {HybridSimulation} from '../experiments/ground-flight/simulation.js';
const root='experiments/ground-flight/data',manifest=JSON.parse(readFileSync(root+'/library.json')),chunks=[];
let failed=false;
for(const file of manifest.chunks) {
 const c=JSON.parse(readFileSync(root+'/'+file));c.validation=certifyChunk(c);chunks.push(c);
 if(c.validation.status!=='VERIFIED'){console.error(c.id,JSON.stringify(c.validation));failed=true;}
 else console.log('VERIFIED',c.id,c.validation.fixtures.length,'entries');
 writeFileSync(root+'/'+file,JSON.stringify(c,null,2)+'\n');
}
if(failed)process.exit(1);
const course=JSON.parse(readFileSync(root+'/first-run.json')),track=composeCourse(chunks,course),sim=new HybridSimulation({pieces:track.pieces,source:'automated'});
for(const a of track.inputs)sim.input(a.action,a.t);sim.advance(100);
if(sim.state!=='complete')throw Error('First Run failed: '+JSON.stringify(sim.death));
writeFileSync(root+'/book.json',JSON.stringify({schema:'rift-hybrid-book',version:1,chunks},null,2)+'\n');
console.log('FIRST RUN',sim.t,sim.counts,sim.state);
