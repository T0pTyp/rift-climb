// Spatial tuning only. Classic constants remain the default for every legacy level.
import {WORLD_W,LANE_W,LANES,START_LANE,HIT_RADIUS} from './config.js';
export const ARENAS=Object.freeze({
 classic:Object.freeze({id:'classic',width:WORLD_W,step:LANE_W,lanes:LANES,inset:LANE_W/2,startLane:START_LANE}),
 // Two half-lane steps either side of center + a visible-body safety margin.
 compact:Object.freeze({id:'compact',width:4*(LANE_W/2)+2*18,step:LANE_W/2,lanes:5,inset:18,startLane:2}),
 // Same 90 u tap as Classic, one lane less: left target to right target is two impulses.
 narrow:Object.freeze({id:'narrow',label:'ZWEI TIPPS',width:3*LANE_W,step:LANE_W,lanes:3,inset:LANE_W/2,startLane:1}),
});
export const LAB_STYLES=Object.freeze(['classic','compact','narrow']);
export const LAB_FEEDBACK=Object.freeze(['classic','compact','narrow','equal']);
// Player-facing build. Classic and Compact stay loadable, but are not offered.
export const ACTIVE_ARENA='narrow';
export function arenaFor(value){const id=typeof value==='string'?value:value?.arenaStyle;return Object.hasOwn(ARENAS,id)?ARENAS[id]:ARENAS.classic;}
export function arenaCenter(lane,arena=ARENAS.classic){return arena.inset+lane*arena.step;}
export function arenaLane(x,arena=ARENAS.classic){return Math.max(0,Math.min(arena.lanes-1,Math.round((x-arena.inset)/arena.step)));}
export const ARENA_OPTIONS=Object.values(ARENAS).map(a=>[a.id,(a.label||a.id.toUpperCase())+' · '+a.width+' u']);
if(ARENAS.compact.inset<HIT_RADIUS||ARENAS.narrow.inset<HIT_RADIUS)throw Error('Arena margin must contain player hitbox');
