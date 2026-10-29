// Release balancing: heights are meters (10 world units), never a physics clock.
export const INFINITY_BALANCE=Object.freeze({
  zones:[0,75,200,450,800,1200,1750],
  labels:['SEHR EINFACH','EINFACH','MITTEL','FORTGESCHRITTEN','SCHWER','SEHR SCHWER','EXTREM'],
  ceiling:2200,recoveryEvery:4,recentPatterns:3,maxHazardGapSec:1.65,
});
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function difficultyAt(meters){
  const z=INFINITY_BALANCE.zones;
  for(let i=0;i<z.length-1;i++)if(meters<z[i+1])return i+smooth((meters-z[i])/(z[i+1]-z[i]));
  return 6+smooth((meters-z[6])/(INFINITY_BALANCE.ceiling-z[6]));
}
// A new family starts at weight zero on its boundary and enters gradually.
export function difficultyWeight(tier,meters){
  const d=difficultyAt(meters);
  if(tier===0)return .55*Math.max(.12,1-d*.16);
  return smooth(d-tier)*Math.max(.12,1-Math.max(0,d-tier-1)*.23);
}
