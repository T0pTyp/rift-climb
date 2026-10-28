import {RiftDirector,chunkFingerprint} from '../../js/rift-director.js';
import {EndlessWorld} from '../../js/endless.js';
import {buildLevelRuntime,validateLevelData} from '../../js/level-data.js';
import {makeTrap} from '../../js/traps.js';
import {glideConfig} from './config.js';

export const configMatches=c=>JSON.stringify(glideConfig(c))===JSON.stringify(glideConfig());
export function acceptsGlide(c,s){return c.dimension===s.dimension&&Math.abs(c.target-s.target)<.01&&['x','y','vx','vy'].every(k=>Number.isFinite(s[k])&&s[k]>=c[k][0]-1e-6&&s[k]<=c[k][1]+1e-6);}
export function glideCompatible(a,b){
  return !!a&&!!b&&a.exit.dimension===b.entry.dimension&&a.exit.target===b.entry.target&&['x','vx','vy'].every(k=>a.exit[k][0]>=b.entry[k][0]&&a.exit[k][1]<=b.entry[k][1])&&a.exit.y[0]-a.length>=b.entry.y[0]&&a.exit.y[1]-a.length<=b.entry.y[1];
}
export function validateGlideBook(book){
  if(book?.schema!=='rift-glide-chunks'||book.version!==1||!configMatches(book.config)||!Array.isArray(book.chunks)||book.chunks.length<8||book.chunks.length>12)throw Error('Ungültige Glide-Bibliothek');
  const ids=new Set();
  for(const c of book.chunks){
    if(ids.has(c.id)||!validateLevelData(c.level).ok||c.duration!==4||c.length!==c.level.finish.y||c.validation?.status!=='verified'||c.validation.hash!==chunkFingerprint(c.level)||!configMatches(c.validation.physics)||c.validation.fixtures!==c.fixtures.length||c.validation.results.length!==c.fixtures.length||c.taps.length!==8||!c.validation.results.every(s=>acceptsGlide(c.exit,s)))throw Error('Ungültiges / veraltetes Glide-Zertifikat: '+c.id);
    ids.add(c.id);
  }
  if(book.chunks.filter(c=>c.opening).length!==1||!book.chunks.some(c=>!c.opening&&c.category==='FLOW'))throw Error('Glide-Eröffnung / Fallback fehlt');
  for(const a of book.chunks)if(!book.chunks.some(b=>!b.opening&&glideCompatible(a,b)))throw Error('Kein Glide-Anschluss: '+a.id);
  return book;
}
/** Extends the existing seeded director, retaining its bounded history and RNG contract. */
export class GlideDirector extends RiftDirector {
  select(y){
    if(!this.history.length){const c=this.book.chunks.find(c=>c.opening);this.commit(c);return c;}
    const difficulty=Math.min(3,Math.max(0,(y-400)/1800)),recent=this.history.slice(-2);
    const eligible=this.book.chunks.filter(c=>{const ok=!c.opening&&glideCompatible(this.previous,c)&&c.tier<=Math.ceil(difficulty);if(!ok)this.rejected++;return ok;});
    let pool=eligible.filter(c=>!recent.some(h=>h.id===c.id)&&(this.sinceRecovery<3||c.category==='FLOW'));
    if(!pool.length){this.fallbacks++;pool=eligible.filter(c=>c.category==='FLOW');}
    if(!pool.length)throw Error('Kein geprüfter Glide-Fallback');
    const weights=pool.map(c=>1/(1+this.history.filter(h=>h.category===c.category).length)*(c.tier>difficulty?.25:1));
    let roll=this.random()*weights.reduce((a,b)=>a+b,0),selected=pool.at(-1);
    for(let i=0;i<pool.length;i++){roll-=weights[i];if(roll<0){selected=pool[i];break;}}
    this.commit(selected);return selected;
  }
  commit(c){this.previous=c;this.history.push({id:c.id,category:c.category});if(this.history.length>12)this.history.shift();this.sinceRecovery=c.category==='FLOW'?0:this.sinceRecovery+1;}
}
export class GlideWorld {
  constructor(book,seed=37){this.book=validateGlideBook(book);this.seed=seed>>>0;this.director=new GlideDirector(book,()=>this.random());this.reset();}
  random(){return EndlessWorld.prototype.random.call(this);}
  reset(){this.rng=this.seed||0x6d2b79f5;this.chunks=[];this.nextY=0;this.nextTime=0;this.generated=0;this.maxObjects=0;this.director.reset();this.ensure(0);}
  ensure(maxY){
    let changed=false;
    while(this.nextY<maxY+1300){
      const c=this.director.select(this.nextY),index=this.generated,origin=this.nextY,t0=this.nextTime;
      const l={...c.level,objects:c.level.objects.map(o=>({...o,id:'g'+index+'-'+o.id,y:origin+o.y})),finish:{y:origin+c.length}};
      const rt=buildLevelRuntime(l);rt.traps=rt.traps.map(o=>makeTrap(o,t0));
      this.chunks.push({id:c.id,index,category:c.category,tier:c.tier,origin,end:origin+c.length,t0,rt,taps:c.taps.map(p=>({...p,t:p.t+t0})),validation:c.validation});
      this.nextY+=c.length;this.nextTime+=c.duration;this.generated++;changed=true;
    }
    while(this.chunks.length&&this.chunks[0].end<maxY-700){this.chunks.shift();changed=true;}
    return changed;
  }
  apply(g){
    // Reuse production's object binding/culling-facing runtime, preserving trap state.
    EndlessWorld.prototype.apply.call(this,g);
    g.lines=[];g.level.sections=[];g.recording=null;
    g.level.finishY=Infinity;g.level.endless=true;
    if(g.audio.timeline){g.audio.timeline.endless=true;g.audio.timeline.director=this.chunks.map(c=>({start:c.t0,end:c.t0+4,tier:c.tier,category:c.category}));}
  }
  tapsAfter(t,last=-Infinity){return EndlessWorld.prototype.tapsAfter.call(this,t,last);}
}
