// Offline authoring worksheet, never loaded by game/Forge. Every gate, direction,
// phrase and beat is hand-authored below; the shipped JSON is the editable source.
import { writeFileSync } from 'node:fs';
import { validateLevelData, serializeLevel } from '../js/level-data.js';
import { runReplay } from '../js/playcheck.js';
const colors = { W: 'both', B: 'blue', R: 'red' };
const round = n => Math.round(n * 1e6) / 1e6;

function level({id, name, bpm, beats, theme, difficulty, sections, gates, hints = []}) {
  const seconds = beat => beat * 60 / bpm;
  const height = beat => round(seconds(beat) * 260);
  const objects = [], taps = [];
  // gate = [beat, four-lane pattern, input direction (+1/right, -1/left, 0/hold),
  //         optional lead in beats, optional height, optional seal duration]
  for (const [beat, pattern, dir, lead = .5, h = 18, openSec = .65] of gates) {
    if (dir) taps.push({ t: round(seconds(beat - lead)), dir });
    for (let i = 0; i < 4; i++) {
      const c = pattern[i];
      if (c === '.') continue;
      let j = i;
      while (j < 3 && pattern[j + 1] === c) j++;
      const inset = difficulty === 'hard' && beat >= beats*.2 ? 8 : 0;
      const left = c==='W' && pattern[i-1]==='.' ? inset : 0;
      const right = c==='W' && pattern[j+1]==='.' ? inset : 0;
      const o = { id: `gate-${String(beat).replace('.', '_')}-${i}`, type: c === 'S' ? 'seal' : 'obstacle',
        x: i * 90 + 3-left, y: height(beat), w: (j - i + 1) * 90 - 6+left+right, h };
      if (c === 'S') o.openSec = openSec; else o.dimension = colors[c];
      objects.push(o); i = j;
    }
  }
  hints.forEach(([beat,text],i)=>objects.push({id:`hint-${i}`,type:'hint',y:height(beat),text}));
  const raw = {schema:'rift-climb-level',version:1,id,name,
    description:`THE FIRST ASCENT · ${name}. Handgefertigter Parcours mit regulärem 240-Hz-Replay.`,
    bpm,beatsPerBar:4,height:height(beats)+260,start:{lane:1,dimension:'blue'},finish:{y:height(beats)},
    theme,music:id,difficulty,
    sections:sections.map(([b,n],i)=>({id:'ABCDE'[i],name:n,y:height(b),labelY:height(b)-35})),
    objects,replay:{taps}};
  const v = validateLevelData(raw);
  if (!v.ok) throw new Error(JSON.stringify(v.issues));
  const proof = runReplay(v.level,taps);
  console.log(id, JSON.stringify(proof));
  if (!proof.won) throw new Error('Regular replay failed');
  writeFileSync(new URL(`../assets/levels/${id}.json`,import.meta.url),serializeLevel(v.level));
}

const first = () => level({
  id:'first-pulse',name:'First Pulse',bpm:120,beats:80,theme:'spire',difficulty:'easy',
  sections:[[0,'AWAKENING'],[16,'COLORWAYS'],[36,'GOLDEN ECHO'],[56,'FIRST ASCENT']],
  hints:[[1,'LINKS TIPPEN ↗'],[9,'RECHTS TIPPEN ↖'],[18,'JEDER TIPP WECHSELT DIE FARBE'],[37,'GOLD LEUCHTET? TIPP = PULSE']],
  gates:[
    // A: broad two-lane spaces; two seconds between directional decisions.
    [4,'WW..',1],[8,'W..W',-1],[12,'..WW',-1],[16,'W..W',1],
    // B: only one colored membrane on the intended path. No new pulse rule yet.
    [20,'WWBW',1],[24,'WRWW',-1],[28,'WWBW',1],[32,'WRWW',-1],
    // C: broad gold gates, isolated from the next decision (1–2 s recovery).
    [40,'WWSS',1,.5,18,.8],[44,'WSSW',-1,.5,18,.8],
    [48,'SSWW',-1,.5,18,.8],[52,'WSSW',1,.5,18,.8],
    // D: familiar echo, outward climb then a final center cadence.
    [58,'WWBW',1],[60,'WWWS',1,.5,18,.75],[62,'WW.W',-1],
    [64,'WRWW',-1],[66,'SWWW',-1,.5,18,.75],[68,'W.WW',1],
    [70,'WWBW',1],[72,'WWWS',1,.5,18,.75],[74,'WW.W',-1],
    [76,'WSWW',-1,.5,18,.75],[78,'WWBW',1],
  ],
});

const fractured = () => level({
  id:'fractured-rhythm',name:'Fractured Rhythm',bpm:128,beats:120,theme:'fracture',difficulty:'medium',
  sections:[[0,'SHARDLINE'],[24,'CROSSCURRENT'],[54,'PULSE CASCADE'],[90,'REFRACTION']],
  gates:[
    // A: a sweeping two-bar call, answered on the opposite side.
    [4,'WW.W',1],[8,'WWW.',1],[12,'WW.W',-1],[16,'W.WW',-1],[20,'.WWW',-1],[24,'WRWW',1],
    // B: outward sweeps and reversals, color membranes alternate with solid corners.
    [26,'WWBW',1],[28,'WWWR',1],[30,'WW.W',-1],[32,'WRWW',-1],
    [34,'BWWW',-1],[36,'W.WW',1],[38,'WWBW',1],[40,'WRWW',-1],
    [42,'WWBW',1],[44,'WWWR',1],[46,'WW.W',-1],[48,'WRWW',-1],
    [50,'BWWW',-1],[52,'W.WW',1],[54,'WWBW',1],
    // C: gold call / colored answer. A new direction is needed between each seal.
    [58,'WWWS',1,.5,20,.6],[60,'WWBW',-1],[62,'WSWW',-1,.5,20,.6],
    [64,'BWWW',-1],[66,'WRWW',1],[68,'WWSW',1,.5,20,.6],
    [70,'WWWR',1],[72,'WWSW',-1,.5,20,.6],[74,'WRWW',-1],
    [76,'SWWW',-1,.5,20,.6],[78,'WRWW',1],[80,'WWSW',1,.5,20,.6],
    [82,'WWWR',1],[84,'WWBW',-1],[86,'WSWW',-1,.5,20,.6],
    [88,'WWBW',1],[90,'WWWS',1,.5,20,.6],
    // D: three-note runs with a breath after each; no new mechanic at the ending.
    [92,'WW.W',-1],[93,'WRWW',-1],[94,'.WWW',-1],
    [96,'WSWW',1,.5,20,.6],[98,'WWBW',1],
    [100,'WWW.',1],[101,'WWBW',-1],[102,'W.WW',-1],
    [104,'SWWW',-1,.5,20,.6],[106,'WRWW',1],[107,'WW.W',1],[108,'WWWR',1],
    [110,'WWSW',-1,.5,20,.6],[112,'WRWW',-1],[113,'.WWW',-1],
    [114,'WRWW',1],[116,'WWSW',1,.5,20,.6],[118,'WRWW',-1],
  ],
});

const overload = () => level({
  id:'overload',name:'Overload',bpm:144,beats:160,theme:'core',difficulty:'hard',
  sections:[[0,'IGNITION'],[32,'POLARITY'],[72,'GOLD CIRCUIT'],[112,'OVERLOAD SEQUENCE'],[144,'CORE RELEASE']],
  gates:[
    // A: immediate rhythmic sweeps, the same visual grammar as the earlier levels.
    [2,'WW.W',1],[4,'WWW.',1],[6,'WWBW',-1],[8,'W.WW',-1],
    [10,'BWWW',-1],[12,'WRWW',1],[14,'WW.W',1],[16,'WWWR',1],
    [18,'WWBW',-1],[20,'WRWW',-1],[22,'.WWW',-1],[24,'WRWW',1],
    [26,'WWBW',1],[28,'W.WW',-1],[30,'WW.W',1],[32,'WWW.',1],
    // B: dotted-beat turns; two wall taps explicitly change polarity without moving.
    [34,'WWBW',-1],[35.5,'WRWW',-1],[37,'BWWW',-1],[38.5,'RWWW',-1],
    [40,'WBWW',1],[42,'WWRW',1],[43.5,'WWWB',1],[45,'WWWR',1],
    [46.5,'WWBW',-1],[48,'WRWW',-1],[50,'BWWW',-1],[51.5,'WRWW',1],
    [53,'WWBW',1],[54.5,'WWWR',1],[56,'WWBW',-1],[58,'W.WW',-1],
    [59.5,'WW.W',1],[61,'WRWW',-1],[62.5,'BWWW',-1],[64,'WRWW',1],
    [66,'WWBW',1],[67.5,'WWWR',1],[69,'WWBW',-1],[70.5,'W.WW',-1],[72,'WWBW',1],
    // C: seal chains across the arena, interleaved with polarity decisions.
    [74,'WWWS',1,.5,18,.5],[76,'WWBW',-1],[77.5,'WSWW',-1,.5,18,.5],
    [79,'BWWW',-1],[80.5,'WRWW',1],[82,'WWSW',1,.5,18,.5],
    [83.5,'WWWR',1],[85,'WWSW',-1,.5,18,.5],[86.5,'WRWW',-1],
    [88,'SWWW',-1,.5,18,.5],[89.5,'WRWW',1],[91,'WWSW',1,.5,18,.5],
    [92.5,'WWWR',1],[94,'WWBW',-1],[95.5,'WSWW',-1,.5,18,.5],
    [97,'BWWW',-1],[98.5,'WSWW',1,.5,18,.5],[100,'WWBW',1],
    [101.5,'WWWS',1,.5,18,.5],[103,'WWBW',-1],[104.5,'WSWW',-1,.5,18,.5],
    [106,'BWWW',-1],[107.5,'WRWW',1],[109,'WWSW',1,.5,18,.5],
    [110.5,'WWWR',1],[112,'WWSW',-1,.5,18,.5],
    // D: four-note 3/16 displacement against 4/4. Each cluster repeats an earlier sweep.
    // 0.75 beat = 312.5 ms; no quarter-beat input or physics changes required.
    [114,'W.WW',-1,.5,14],[114.75,'.WWW',-1,.5,14],[115.5,'W.WW',1,.5,14],[116.25,'WW.W',1,.5,14],
    [118,'WWWS',1,.5,14,.5],[118.75,'WW.W',-1,.5,14],[119.5,'W.WW',-1,.5,14],[120.25,'.WWW',-1,.5,14],
    [122,'WSWW',1,.5,14,.5],[122.75,'WW.W',1,.5,14],[123.5,'WWW.',1,.5,14],[124.25,'WW.W',-1,.5,14],
    [126,'W.WW',-1,.5,14],[126.75,'.WWW',-1,.5,14],[127.5,'W.WW',1,.5,14],[128.25,'WW.W',1,.5,14],
    [130,'WWWS',1,.5,14,.5],[130.75,'WW.W',-1,.5,14],[131.5,'W.WW',-1,.5,14],[132.25,'.WWW',-1,.5,14],
    [134,'WSWW',1,.5,14,.5],[134.75,'WW.W',1,.5,14],[135.5,'WWW.',1,.5,14],[136.25,'WW.W',-1,.5,14],
    [138,'W.WW',-1,.5,14],[138.75,'.WWW',-1,.5,14],[139.5,'W.WW',1,.5,14],[140.25,'WW.W',1,.5,14],
    [142,'WWWS',1,.5,14,.5],[142.75,'WW.W',-1,.5,14],[143.5,'W.WW',-1,.5,14],
    // E: no new rules: last sweep, a golden answer, then two beats to resolve.
    [145,'SWWW',-1,.5,18,.5],[147,'WRWW',1],[148.5,'WWBW',1],
    [150,'WWWS',1,.5,18,.5],[151.5,'WWBW',-1],[153,'WRWW',-1],
    [154.5,'SWWW',-1,.5,18,.5],[156,'WRWW',1],[158,'WWSW',1,.5,18,.5],
  ],
});

const requested = process.argv[2] || 'first-pulse';
if (requested === 'first-pulse') first();
else if (requested === 'fractured-rhythm') fractured();
else if (requested === 'overload') overload();
else throw new Error(`Unknown worksheet: ${requested}`);
