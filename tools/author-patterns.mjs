// One-time authoring aid. Runtime and future edits read the individual JSON files.
// This script deliberately refuses to overwrite an edited pattern collection.
import {existsSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createEmptyLevel,validateLevelData,serializeLevel} from '../js/level-data.js';
const dir='assets/endless/patterns';
if(existsSync(`${dir}/index.json`)&&!process.argv.includes('--reset-references'))throw Error('Reference patterns already exist; edit their JSON in LEVEL FORGE.');
mkdirSync(dir,{recursive:true});
const old=JSON.parse(readFileSync('assets/endless/director.json'));
const contract=exit=>({x:exit?[134.85,135.15]:[133.5,136.5],vx:exit?[-1,1]:[-12,12],target:1,dimension:'blue',lastDirs:[-1,0,1],impulses:['idle'],clearSec:exit?.45:.5,traps:exit?'clear':'local-zero'});
const fixtures=()=>[-1.5,0,1.5].flatMap(dx=>[-12,0,12].map(vx=>({id:`x${dx}v${vx}`,x:135+dx,vx,y:0,lane:1,dim:'B',lastDir:Math.sign(vx)})));
const designs=[
 ['Single Shift','FLOW',0,[1,-1],1.12,'Ein sichtbares blaues Tor: wechseln und in die Mitte zurückkehren.'],
 ['Side Step','FLOW',1,[-1,1],1.08,'Einem neutralen Mittelblock seitlich ausweichen.'],
 ['Double Shift','PHASE',1,[1,-1,-1,1],.94,'Zwei klar getrennte Farbwechsel, danach freier Rückweg.'],
 ['Pulse Opening','PULSE',2,[1,-1],1.02,'Ein breites Siegel mit einer Welle öffnen.'],
 ['Laser Gate','VOLTAGE',1,[1,-1],1.06,'Ein Wandlaser ohne neutrale Balken; die Dimension entscheidet.'],
 ['Laser Sweep','VOLTAGE',2,[-1,1,1,-1],.96,'Warnfächer lesen, Farbe wechseln und unter dem nächsten Fächer drehen.'],
 ['Double Laser','VOLTAGE',3,[1,-1,-1,1],.9,'Zwei Wandprojektoren feuern mit versetztem Rhythmus.'],
 ['Crossfire','VOLTAGE',4,[-1,1,1,-1],.86,'Zwei Strahlen kreuzen ihre Räume, zeitversetzte Farbfenster bleiben offen.'],
 ['Single Saw','SAW',2,[1,-1],1.04,'Eine pendelnde Säge blockiert die Mitte; am Rand vorbeifliegen.'],
 ['Twin Saws','SAW',3,[1,-1,-1,1],.92,'Zwei gleichzeitige Sägen begrenzen einen seitlichen Durchgang.'],
 ['Opposing Saws','SAW',4,[-1,1,1,-1],.88,'Gegenläufige Pendel: Außenweg nutzen und danach die Seite wechseln.'],
 ['Saw Gauntlet','PRECISION',5,[1,-1,-1,1,1,-1],.8,'Drei vertikal versetzte Sägen, drei unterschiedliche Ausweichrichtungen.'],
 ['Single Mine','VOLTAGE',2,[1,-1],1.12,'Eine ladende Mine hinter sich lassen; Warnkreis lesen.'],
 ['Mine Escape','VOLTAGE',3,[-1,1,1,-1],.92,'Aus einer aktivierten Sprengzone herausdrehen.'],
 ['Double Mines','VOLTAGE',4,[1,-1,-1,1],.9,'Zwei versetzte Minen, getrennte Fluchtfenster statt Vollsperre.'],
 ['Mine Chain','VOLTAGE',5,[-1,1,1,-1,-1,1],.82,'Drei zeitversetzte Ladungen mit einer erlernbaren Seitenfolge.'],
 ['Saw & Laser','COMBO',4,[1,-1,-1,1],.9,'Säge räumlich umgehen, Wandlaser über die Dimension passieren.'],
 ['Pulse Break','PULSE',4,[-1,1,1,-1],.88,'Ein Siegel und eine zerstörbare Säge verlangen getrennte Pulse.'],
 ['Voltage Trap','COMBO',5,[1,-1,-1,1,1,-1],.82,'Minenradius verlassen und den nächsten Laser farblich öffnen.'],
 ['Phase Chaos','PHASE',5,[-1,1,1,-1,-1,1],.76,'Sechs sichtbare Farbfenster mit einer neutralen Seitenentscheidung.'],
 ['Triple Saw','SAW',6,[1,-1,-1,1,1,-1],.76,'Drei gleichzeitig pendelnde Sägen, danach ein engerer Rückweg.'],
 ['Laser Maze','VOLTAGE',6,[-1,1,1,-1,-1,1],.78,'Drei koordinierte Projektoren und wechselnde Aktivierungsfenster.'],
 ['Rift Cascade','PULSE',6,[1,-1,-1,1,1,-1],.74,'Drei Siegel wechseln mit Farbfenstern und gezielten Wellen ab.'],
 ['Infinity Trial','COMBO',6,[-1,1,1,-1,-1,1,1,-1],.72,'Säge, Mine, Laser und Siegel in einer lesbaren Schlussphrase.'],
];
for(const [index,d] of designs.entries()){
 const [name,category,tier,dirs,interval,idea]=d,n=index+1,pid=`P${String(n).padStart(2,'0')}`,l=createEmptyLevel({id:`pattern-${pid.toLowerCase()}`,name,arenaStyle:'narrow'});
 let lane=1,dim='blue';const rows=dirs.map((direction,i)=>{const t=+(.65+i*interval).toFixed(3),oldDim=dim,oldX=45+lane*90;lane=Math.max(0,Math.min(2,lane+direction));dim=dim==='blue'?'red':'blue';return{t,dir:direction,x:45+lane*90,oldX,oldDim,dim};});
 if(lane!==1||dim!=='blue')throw Error(pid+' must settle in the common join');
 const objects=[],taps=rows.map(({t,dir})=>({t,dir}));let seq=0;
 const add=o=>objects.push({id:`${pid.toLowerCase()}-${++seq}`,...o});
 const phase=(i,delay=.4)=>{const r=rows[i];add({type:'obstacle',x:0,y:+((r.t+delay)*260).toFixed(2),w:270,h:12,dimension:r.oldDim});};
 const side=(i,gap=94)=>{const r=rows[i],y=(r.t+.43)*260,c=r.x;for(const [x,w] of [[0,c-gap/2],[c+gap/2,270-c-gap/2]])if(w>=8)add({type:'obstacle',x,y,w,h:12,dimension:'both'});};
 const seal=i=>{const r=rows[i];add({type:'seal',x:0,y:+((r.t+.24)*260).toFixed(2),w:270,h:16,openSec:.82});};
 const saw=(i,x,opts={})=>{const r=rows[i];add({type:'saw',x:x-18,y:+((r.t+.6)*260).toFixed(2),w:36,h:36,dimension:r.dim,axis:'x',amplitude:18,period:3.2,phase:0,spin:3.4,pulseBreakable:true,...opts});};
 const pair=(i,cross=false)=>{saw(i,90,{amplitude:cross?26:24,phase:0});saw(i,180,{amplitude:cross?26:24,phase:.5});};
 const mine=(i,x,opts={})=>{const r=rows[i];add({type:'mine',x:x-14,y:+((r.t+.36)*260).toFixed(2),w:28,h:28,dimension:r.oldDim,activationRadius:120,chargeSec:.75,blastRadius:72,blastSec:.2,...opts});};
 const laser=(i,right=false,sweep=0,delay=.43,opts={})=>{const r=rows[i],pass=r.t+delay,warnSec=.9,activeSec=.55,offSec=.8,cycle=warnSec+activeSec+offSec;
  add({type:'laser',x:right?244:0,y:+(pass*260).toFixed(2),w:26,h:26,dimension:r.oldDim,axis:'none',amplitude:0,period:4,phase:+(((warnSec+.2-pass)%cycle+cycle)%cycle/cycle).toFixed(6),startAngle:(right?180:0)-sweep,endAngle:right?180:sweep,sweepPeriod:3.4,length:244,beamWidth:tier>=5?8:7,warnSec,activeSec,offSec,disableSec:1.2,...opts});};
 switch(n){
 case 1:phase(0);break;
 case 2:side(0,118);break;
 case 3:phase(0);phase(1);side(2,112);break;
 case 4:seal(0);phase(1);break;
 case 5:laser(0);break;
 case 6:laser(0,true,22);phase(1);laser(2,false,18);break;
 case 7:laser(0);laser(1,true);phase(2);break;
 case 8:laser(0,false,14);laser(0,true,18,.58);laser(2,true,12);break;
 case 9:saw(0,135,{amplitude:50,dimension:'blue',phase:1-(rows[0].t+.6)/3.2});phase(1);break;
 case 10:pair(0);pair(2);phase(0);phase(1);break;
 case 11:pair(0,true);pair(2,true);objects.at(-1).dimension=rows[2].oldDim;phase(0);phase(1);phase(3);break;
 case 12:saw(0,135,{amplitude:58,phase:.1});saw(2,135,{amplitude:58,phase:.55});saw(4,135,{axis:'y',amplitude:35,phase:.2});side(3,74);phase(0);break;
 case 13:mine(0,135);phase(1);break;
 case 14:mine(0,135,{chargeSec:.6,blastRadius:82});phase(1);side(2,86);break;
 case 15:mine(0,135,{blastRadius:78});phase(1);mine(2,135,{chargeSec:.9});phase(3);break;
 case 16:mine(0,135,{chargeSec:.6});mine(2,135,{chargeSec:.7});mine(4,135,{chargeSec:.8});break;
 case 17:pair(0);laser(2,true,14);phase(1);break;
 case 18:seal(0);saw(2,rows[2].x,{y:(rows[2].t+.24)*260,amplitude:9});side(1,82);phase(3);break;
 case 19:mine(0,135,{blastRadius:78});phase(1);laser(2,false,18);mine(4,135,{chargeSec:.65});phase(3);break;
 case 20:for(let i=0;i<6;i++)phase(i,.38);side(2,74);break;
 case 21:pair(0,true);saw(0,135,{y:(rows[0].t+.6)*260+90,axis:'y',amplitude:16,phase:.3,dimension:rows[0].oldDim});side(2,68);phase(3);pair(4);break;
 case 22:laser(0,true,12);laser(2,false,18);laser(4,true,22);phase(1);phase(3);break;
 case 23:for(const i of [0,2,4])seal(i);for(const i of [1,3,5])phase(i,.4);break;
 case 24:saw(0,135,{amplitude:48});mine(2,135);laser(4,true,18);seal(6);phase(1);side(3,72);phase(5);phase(7);break;
 }
 // Shorter tasks retain a visible, independent return cue. No compulsory slit around traps.
 const end=+(rows.at(-1).t+1.1).toFixed(3);
 Object.assign(l,{description:idea,theme:tier>=4?'core':category==='VOLTAGE'?'voltage':category==='SAW'?'gears':'spire',music:'neon-ascent',height:end*260+260,finish:{y:end*260},objects,replay:{taps}});
 l.chunk={pattern:pid,patternVersion:1,category,tier,stage:tier,enabled:true,weight:tier>=5?.75:1,idea,opening:false,hazardFamily:category,actions:taps.length,requiredSwitches:taps.length,interactions:objects.filter(o=>o.type!=='obstacle').map(o=>({target:o.id,kind:o.type})),rhythm:{bpm:120,subdivision:'quarter'},challenge:tier>=5,entry:contract(false),exit:contract(true),fixtures:fixtures(),validation:{status:'unverified'}};
 const v=validateLevelData(l);if(!v.ok)throw Error(pid+JSON.stringify(v.issues));
 writeFileSync(`${dir}/${pid.toLowerCase()}.json`,serializeLevel(v.level)+'\n');
}
// Preserve the already proven opening and three deliberately simple recovery phrases.
const service=old.chunks.filter(c=>['infinity-opening','infinity-wide-arc','infinity-double-arc','infinity-echo'].includes(c.id));
writeFileSync(`${dir}/services.json`,JSON.stringify(service,null,2)+'\n');
writeFileSync(`${dir}/index.json`,JSON.stringify({schema:'rift-pattern-library',version:1,patterns:designs.map((d,i)=>({id:`P${String(i+1).padStart(2,'0')}`,file:`p${String(i+1).padStart(2,'0')}.json`}))},null,2)+'\n');
console.log('24 editable JSON sources + existing recovery phrases written');
