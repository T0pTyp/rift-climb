// Initial authoring only. Never overwrite edited experiment data implicitly.
import {mkdirSync,existsSync,writeFileSync} from 'node:fs';
const root='experiments/ground-flight/data';
if(existsSync(root+'/library.json'))throw Error('Hybrid data already exists; edit JSON directly.');
mkdirSync(root+'/chunks',{recursive:true});
const speed=180,library=[];
const motion=t=>({t,action:'motion'}),phase=t=>({t,action:'phase'});
const flaps=()=>[0,1,2,3,4,5].map(motion);
const rect=(id,t,y,w,h,dimension='neutral')=>({id,type:'rect',x:t*speed,y,w,h,dimension});
const saw=(id,t,y,dimension='blue',extra={})=>({id,type:'saw',x:t*speed,y,w:36,h:36,dimension,axis:'y',amplitude:20,period:2.8,phase:0,spin:4,pulseBreakable:true,...extra});
const mine=(id,t,y)=>({id,type:'mine',x:t*speed,y,w:28,h:28,dimension:'blue',activationRadius:85,chargeSec:.8,blastRadius:40,blastSec:.2});
function laser(id,t,y=18,dimension='blue',extra={}) {
 const cycle=2.9,phase=((1.3-t)%cycle+cycle)%cycle/cycle;
 return {id,type:'laser',x:t*speed,y,w:26,h:26,dimension,axis:'none',amplitude:0,period:4,phase,startAngle:0,endAngle:0,sweepPeriod:3,length:56,beamWidth:6,warnSec:.9,activeSec:1.4,offSec:.6,disableSec:1.2,...extra};
}
const portal=(id,t,target)=>({id,type:'portal',x:t*speed,y:0,target});
function chunk(id,name,category,difficulty,duration,entry,exit,objects,inputs,idea) {
 const c={schema:'rift-hybrid-chunk',version:1,id,name,category,difficulty,length:duration*speed,entry,exit,idea,enabled:true,objects,replay:{version:1,inputs:inputs.sort((a,b)=>a.t-b.t)},validation:{status:'UNVERIFIED'}};
 library.push(c);return c;
}
chunk('G01','First Jump','Ground Basic',0,6,'ground','ground',[
 rect('hop-a',1.6,0,24,34),rect('hop-b',3.6,0,24,34)],
 [1.15,3.15].map(motion),'Zwei großzügige Einzelhürden; dazwischen vollständige Landung.');
chunk('G02','Double Hop','Ground Precision',1,6,'ground','ground',[
 rect('hop-a',1.5,0,28,44),rect('hop-b',3,0,28,44)],
 [1.05,2.55].map(motion),'Zwei kurze Sprungentscheidungen mit klar sichtbarer Zwischenzone.');
chunk('G03','Double Laser Hop','Ground Laser',1,7,'ground','ground',[
 laser('low-laser-a',2.1),laser('low-laser-b',3.6)],
 [1.8,3.3].map(motion),'Zwei niedrige aktive Laser, zwei echte Sprünge, keine Zusatzbalken.');
chunk('G04','First Phase','Ground Phase',1,6,'ground','ground',[
 rect('blue-wall',1.7,0,22,125,'blue'),rect('red-wall',3.8,0,22,125,'red')],
 [phase(1.05),phase(3.05)],'Hohe farbige Wände lassen sich durch bewusste Phasenwechsel passieren.');
chunk('G05','Pulse Break','Ground Phase',2,6,'ground','ground',[
 {id:'rift-seal',type:'seal',x:2*speed,y:0,w:16,h:80,dimension:'neutral',openSec:.85},
 saw('pulse-saw',4.9,28,'blue',{axis:'none',amplitude:0})],
 [phase(1.5),phase(4.4)],'Erst ein goldenes Siegel öffnen, dann eine passende Säge zerlegen.');
chunk('G06','Phase Laser Hop','Ground Laser',3,7,'ground','ground',[
 rect('neutral-hop',1.8,0,26,38),laser('phase-projector',3.8,24,'red'),rect('blue-wall',4.1,0,22,120,'blue')],
 [motion(1.35),motion(3.35),phase(3.55),phase(5.5)],'Sprung, Landung, Sprung plus Phase: der Pulse erreicht den Laserprojektor.');
chunk('M01','First Flight','Mixed Transition',0,5,'ground','flight',[
 portal('flight-portal',1.5,'flight')],
 [2,3,4].map(motion),'Das Portal erzeugt einen reproduzierbaren Startbogen; danach drei Flaps.');
chunk('F01','Air Current','Flight Basic',0,6,'flight','flight',[
 rect('low-island',2.3,0,50,55),rect('high-island',4.3,215,50,85)],flaps(),
 'Freier Ein-Sekunden-Rhythmus zwischen zwei weit auseinanderliegenden Energieinseln.');
chunk('F02','Altitude Windows','Flight Precision',2,6,'flight','flight',[
 rect('low-a',1.45,0,35,90),rect('high-a',1.45,192,35,108),
 rect('low-b',3.95,0,35,85),rect('high-b',3.95,185,35,115)],flaps(),
 'Zwei unterschiedlich hohe Durchflugfenster mit sichtbaren Ober- und Unterkanten.');
chunk('F03','Phase Flight','Flight Phase',2,6,'flight','flight',[
 rect('blue-wall',1.6,0,20,300,'blue'),rect('red-wall',4.1,0,20,300,'red')],
 [...flaps(),phase(1.05),phase(3.5)],'Flughöhe und Dimension sind unabhängige Entscheidungen.');
chunk('F04','Twin Saws','Flight Saw',3,6,'flight','flight',[
 saw('lower-saw',2.3,65),saw('upper-saw',2.8,235,'blue',{phase:.5}),mine('low-mine',4,42)],flaps(),
 'Zwei gegenphasige Sägen begrenzen einen Flugkorridor; eine tiefe Mine warnt sichtbar.');
chunk('F05','Voltage Wing','Flight Precision',3,6,'flight','flight',[
 laser('upright-laser',3,40,'blue',{startAngle:90,endAngle:90,length:48}),mine('mine',4.2,35)],flaps(),
 'Über einen kurzen freistehenden Laser hinwegfliegen und die tiefe Minenzone meiden.');
chunk('M02','Return to Ground','Mixed Transition',1,5,'flight','ground',[
 portal('ground-portal',2,'ground'),rect('landing-hop',3.7,0,25,38)],
 [motion(0),motion(1),motion(3.25)],'Ein breiter Landebereich führt aus Flight zurück in einen normalen Sprung.');
chunk('M03','Hybrid Finale','Mixed Combo',4,8,'ground','ground',[
 rect('first-hop',1.3,0,26,42),portal('flight-portal',2,'flight'),
 saw('flight-saw',4,55,'blue',{axis:'y',amplitude:16}),portal('ground-portal',5.5,'ground'),
 laser('final-laser',6.85,18,'blue'),
 {id:'final-seal',type:'seal',x:7.05*speed,y:0,w:14,h:110,dimension:'neutral',openSec:1.05}],
 [motion(.85),motion(2.5),motion(3.5),motion(4.5),motion(6.4),phase(6.5),phase(7.5)],
 'Springen, transformieren, fliegen, landen und ein Siegel im letzten Sprung öffnen.');
for(const c of library)writeFileSync(`${root}/chunks/${c.id.toLowerCase()}.json`,JSON.stringify(c,null,2)+'\n');
writeFileSync(root+'/library.json',JSON.stringify({schema:'rift-hybrid-library',version:1,chunks:library.map(c=>'chunks/'+c.id.toLowerCase()+'.json')},null,2)+'\n');
writeFileSync(root+'/first-run.json',JSON.stringify({schema:'rift-hybrid-course',version:1,id:'hybrid-first-run',name:'RIFT HYBRID – FIRST RUN',route:['G01','G02','G03','G04','G05','M01','F01','F02','F03','F04','M02','G06','M03'],sections:[{at:0,name:'FIRST JUMP'},{at:6,name:'DOUBLE HOP'},{at:12,name:'DOUBLE LASER HOP'},{at:19,name:'FIRST PHASE'},{at:31,name:'FIRST FLIGHT'},{at:36,name:'FLIGHT PRECISION'},{at:48,name:'PHASE FLIGHT'},{at:54,name:'TWIN SAWS'},{at:60,name:'RETURN TO GROUND'},{at:65,name:'HYBRID FINALE'}]},null,2)+'\n');
console.log('Authored '+library.length+' experiment chunks.');
