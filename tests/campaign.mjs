import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { Game } from '../js/game.js';
import { runReplay, checkPlayability } from '../js/playcheck.js';
import { serializeLevel, validateLevelData, buildLevelRuntime } from '../js/level-data.js';
import { CLIMB_SPEED, SIM_DT, MIN_PRESS_INTERVAL_MS } from '../js/config.js';
import { scoreStep, ARRANGEMENTS, frequency } from '../js/pulse/score.js';
import { BeatTimeline } from '../js/pulse/timeline.js';
import { loadLevel } from './lib/levels.mjs';
const noop=()=>{};
let count=0;
const check=(name,fn)=>{fn();count++;console.log('PASS '+name);};
const reports=[];
const ids=['first-pulse','fractured-rhythm','overload'];
function game(level, mode='normal', muted=false) {
  const audio={seek:noop,sfx:noop,update:noop,stop:noop,suspend:noop,resume:noop,muted};
  const g=new Game({canvas:{getContext:()=>null},ui:{show:noop,updateHud:noop,showWin:noop,showDeath:noop,toast:noop,updateMenu:noop},
    audio,input:{guard:noop},storage:{stats:{best:0,attempts:0,clears:0},save:noop},debug:{autoplay:true,trace:true},level});
  g.start(mode);return g;
}
for(const [i,id] of ids.entries()) {
  const l=loadLevel(id), duration=l.finish.y/CLIMB_SPEED, rep=l.replay.taps;
  check(id+' JSON/export/editor identity roundtrip',()=>{
    assert.equal(validateLevelData(l).ok,true);
    assert.deepEqual(validateLevelData(JSON.parse(serializeLevel(l))).level,l);
    assert.equal(buildLevelRuntime(l).music,id);
    assert.ok(l.objects.some(o=>o.type==='seal'));assert.ok(l.objects.some(o=>o.dimension==='blue'));assert.ok(l.objects.some(o=>o.dimension==='red'));
  });
  check(id+' starts at 0%, lane 1/blue, no checkpoints in normal run',()=>{const g=game(l);assert.equal(g.t,0);assert.equal(g.progress,0);assert.equal(g.player.lane,1);assert.equal(g.player.dim,'B');});
  check(id+' real physics replay, legal inputs, 100% finish',()=>{
    assert.ok(rep.every((t,n)=>!n||t.t-rep[n-1].t>=MIN_PRESS_INTERVAL_MS/1000));
    const proof=runReplay(l,rep);assert.equal(proof.won,true);assert.equal(proof.progress,100);assert.equal(proof.tapsUsed,rep.length);
    assert.ok(Math.abs(proof.t-duration)<=SIM_DT);assert.equal(checkPlayability(l).method,'replay');
  });
  let reference;
  for(const [label,frames] of [['5',[.2]],['10',[.1]],['30',[1/30]],['60',[1/60]],['144',[1/144]],['jitter',[.006,.04,.012,.09,.017]]]) {
    check(id+' identical completion/trace audio on/off at '+label+' FPS',()=>{
      for(const muted of [false,true]) {
        const g=game(l,'normal',muted);let n=0;
        while(g.state==='playing')g.update(frames[n++%frames.length]);
        assert.equal(g.state,'won');assert.equal(g.storage.stats.best,100);assert.equal(g.storage.stats.clears,1);assert.equal(g.storage.stats.attempts,1);
        assert.equal(g.recording.length,rep.length);
        if(!reference)reference=g.trace;else assert.deepEqual(g.trace,reference);
        assert.equal(g.checkpoint.t,0);
      }
    });
  }
  check(id+' death, restart and collision remain active',()=>{
    const g=game(l);g.debug.autoplay=false;g.autoplayQueue=[];
    while(g.state==='playing')g.update(1/60);
    assert.equal(g.state,'dying');assert.ok(g.killer);g.update(.3);assert.equal(g.state,'dead');
    assert.ok(g.storage.stats.best>0 && g.storage.stats.best<100);
    g.restart();assert.equal(g.t,0);assert.equal(g.player.dim,'B');assert.equal(g.storage.stats.attempts,2);assert.ok(g.seals.every(s=>s.openUntil<0));
  });
  check(id+' immediate retry and quit preserve normal best; practice never writes it',()=>{
    const g=game(l);g.autoplayQueue=[];while(g.state==='playing')g.update(1/60);
    const pct=g.progress;g.deathAge=.23;g.quickRestart();assert.equal(g.storage.stats.best,pct);
    g.debug.autoplay=true;g.setupAutoplay();while(g.t<duration*.3)g.update(1/60);g.pause();g.toMenu();assert.ok(g.storage.stats.best>=29);
  });
  check(id+' practice snapshots restore exact player, seals, waves and complete without normal stats',()=>{
    const g=game(l,'practice');let cp=0,respawns=0,n=0;
    while(g.state!=='won' && n++<60000) {
      g.update(1/60);
      if(g.state==='playing' && g.checkpoint.t>cp) {
        cp=g.checkpoint.t;const snapshot=g.checkpoint;
        g.update(.08);g.respawn();respawns++;
        assert.equal(g.t,snapshot.t);assert.equal(g.player.x,snapshot.x);assert.equal(g.player.vx,snapshot.vx);assert.equal(g.player.dim,snapshot.dim);
        assert.deepEqual(g.rift.snapshot(),snapshot.rift);
      }
    }
    assert.equal(g.state,'won');assert.ok(respawns>=5);assert.equal(g.storage.stats.best,0);assert.equal(g.storage.stats.attempts,0);assert.equal(g.storage.stats.clears,0);
  });
  check(id+' pause/resume preserves simulation and open windows',()=>{const g=game(l);while(g.t<duration*.55)g.update(1/60);g.pause();const t=g.t,s=g.rift.snapshot();g.update(1);assert.equal(g.t,t);assert.deepEqual(g.rift.snapshot(),s);g.resume();assert.equal(g.t,t);});
  check(id+' each authored section and obstacle maps to musical quarter-beat',()=>{
    for(const o of l.objects.filter(o=>o.type!=='hint')){const beat=o.y/260*l.bpm/60;assert.ok(Math.abs(beat*4-Math.round(beat*4))<1e-5);}
    const tl=new BeatTimeline({bpm:l.bpm,duration,sections:l.sections.map(s=>({name:s.name,time:s.y/260}))});
    l.sections.forEach((s,j)=>assert.equal(tl.at(s.y/260).section,j));
  });
  check(id+' composition has melody, drums, pad and both synchronized layers',()=>{
    const tl=new BeatTimeline({bpm:l.bpm,duration});tl.music=id;const types=new Set(),layers=new Set();let notes=0;
    for(let s=0;s<duration/tl.stepSec;s++)scoreStep(s,tl,(type,f,v,len,layer)=>{
      types.add(type);layers.add(layer);notes++;assert.ok(v<=.55);
      if(type==='lead') {
        const chord=ARRANGEMENTS[id].chords[Math.floor(Math.floor(s/(tl.beatsPerBar*4))/2)%4];
        assert.ok([...chord,chord[0]+12].map(frequency).includes(f),'Lead follows the actual major/minor harmony');
      }
    });
    for(const t of ['kick','snare','hat','bass','lead','pad'])assert.ok(types.has(t));
    assert.deepEqual([...layers].sort(),['base','blue','red']);assert.ok(notes>300);assert.ok(ARRANGEMENTS[id]);
  });
  // Perturb ONE input at a time; the rest of the real replay stays unchanged.
  // A bound of 5 ms is measurement resolution, not a human playtest claim.
  let minEarly=200,minLate=200,worstEarly=-1,worstLate=-1;
  for(let tap=0;tap<rep.length;tap++) {
    for(const sign of [-1,1]) {
      let tolerance=0;
      for(let ms=5;ms<=200;ms+=5){const changed=rep.map((t,j)=>j===tap?{...t,t:t.t+sign*ms/1000}:t);if(!runReplay(l,changed).won)break;tolerance=ms;}
      if(sign<0&&tolerance<minEarly){minEarly=tolerance;worstEarly=tap;}
      if(sign>0&&tolerance<minLate){minLate=tolerance;worstLate=tap;}
    }
  }
  check(id+' no frame-perfect action (per-input sweep)',()=>{assert.ok(minEarly>=10);assert.ok(minLate>=10);});
  const report={id,duration,taps:rep.length,obstacles:l.objects.filter(o=>o.type!=='hint').length,seals:l.objects.filter(o=>o.type==='seal').length,
    minInputGap:Math.min(...rep.slice(1).map((t,j)=>t.t-rep[j].t)),minEarlyMs:minEarly,minLateMs:minLate,worstEarlyTap:worstEarly,worstLateTap:worstLate};
  reports.push(report);console.log(JSON.stringify(report));
}
check('No selectable, device-dependent or automatic visual profile remains',()=>{
  assert.equal(existsSync(new URL('../js/art/quality.js',import.meta.url)),false);
  for(const file of ['js/main.js','js/game.js','js/ui.js','index.html'])assert.doesNotMatch(readFileSync(new URL('../'+file,import.meta.url),'utf8'),/btn-gfx|setQuality|qualityOf|hardwareConcurrency|deviceMemory|watchFrameRate|onGfxToggle/);
});
check('Illegal faster-than-touch replay is rejected',()=>assert.equal(runReplay(loadLevel(ids[0]),[{t:1,dir:1},{t:1.001,dir:-1}]).won,false));
mkdirSync('test-results/m7',{recursive:true});writeFileSync('test-results/m7/campaign.json',JSON.stringify({checks:count,levels:reports},null,2));
console.log(`${count} campaign checks passed`);
