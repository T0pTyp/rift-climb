import {CLIMB_SPEED} from '../../js/config.js';

export const RIFT_GLIDE_TEST_CONFIG=Object.freeze({
  arenaWidth:270, horizontalTravelPerTap:75, relativeFlapImpulse:65,
  gravity:520, maxUpwardVelocity:320, maxFallVelocity:220,
  verticalDrag:0, flapCooldownMs:80, velocityHandling:'set',
  cameraDeadZone:45, cameraResponse:8, fallDistance:200,
});
export const testMusicSections=()=>['INTRO','BUILD','DROP','FINALE'].map((name,i)=>({time:i*10,name}));
// 65 describes the free ballistic rise, not a per-frame displacement.
// v²/(2g) = 65 at the defaults; v = 260 u/s matches the existing unit scale.
export function glideConfig(values={}) {
  const c={...RIFT_GLIDE_TEST_CONFIG,...values};
  const limits={horizontalTravelPerTap:[45,90],relativeFlapImpulse:[40,90],gravity:[350,750],maxUpwardVelocity:[220,400],maxFallVelocity:[150,300],flapCooldownMs:[45,160]};
  for(const [key,[lo,hi]] of Object.entries(limits))if(!Number.isFinite(c[key])||c[key]<lo||c[key]>hi)throw Error('Ungültiger Testparameter: '+key);
  c.arenaWidth=270;c.verticalDrag=0;c.velocityHandling='set';
  c.cameraDeadZone=45;c.cameraResponse=8;c.fallDistance=200;
  c.flapVelocity=Math.min(c.maxUpwardVelocity,Math.sqrt(2*c.gravity*c.relativeFlapImpulse));
  c.units='u, s; y increases upward';c.baselineClimbSpeed=CLIMB_SPEED;
  return Object.freeze(c);
}
