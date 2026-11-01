// Experiment-only units: world x right, y up, floor y=0. Never mutate public config.
export const HYBRID_DEFAULTS = Object.freeze({
  speed:180, gravity:980, jumpImpulse:420, flightGravity:480,
  flapImpulse:240, maxUp:440, maxFall:360, flapCooldown:.065,
  phaseCooldown:.10, actionSplit:.70, portalLift:320, ceiling:300,
});
export const PARAMS = {
  speed:[120,240,5,'Vorwärts · u/s'], gravity:[700,1300,10,'Ground-Schwerkraft · u/s²'],
  jumpImpulse:[340,480,5,'Sprungimpuls · u/s'], flightGravity:[320,680,10,'Flight-Schwerkraft · u/s²'],
  flapImpulse:[180,320,5,'Flap-Impuls · u/s'], maxUp:[320,520,5,'Max. Aufstieg · u/s'],
  maxFall:[240,480,5,'Max. Sinken · u/s'], phaseCooldown:[.06,.3,.01,'Phase-Cooldown · s'],
  actionSplit:[.55,.85,.05,'Jump/Flap-Anteil'],
};
export function hybridConfig(values={}) {
  const c={...HYBRID_DEFAULTS};
  for(const [key,value] of Object.entries(values)) {
    if(!Object.hasOwn(PARAMS,key))throw Error('Unbekannter Parameter: '+key);
    const [lo,hi]=PARAMS[key];if(!Number.isFinite(value)||value<lo||value>hi)throw Error(key+': '+lo+'–'+hi);
    c[key]=value;
  }
  if(c.jumpImpulse>c.maxUp)throw Error('Sprungimpuls überschreitet Max. Aufstieg.');
  return Object.freeze(c);
}
export const defaultPhysics = c => Object.keys(HYBRID_DEFAULTS).every(k=>c[k]===HYBRID_DEFAULTS[k]);
export function jumpMetrics(c) {
  const height=c.jumpImpulse**2/(2*c.gravity),terminalDistance=c.maxFall**2/(2*c.gravity);
  const descent=height<=terminalDistance?Math.sqrt(2*height/c.gravity):c.maxFall/c.gravity+(height-terminalDistance)/c.maxFall;
  const airtime=c.jumpImpulse/c.gravity+descent;return {height,airtime,range:c.speed*airtime};
}
