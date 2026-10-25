// Spatial tuning only. Classic constants remain the default for every legacy level.
import {WORLD_W,LANE_W,LANES,START_LANE,HIT_RADIUS} from './config.js';
export const ARENAS=Object.freeze({
 classic:Object.freeze({id:'classic',width:WORLD_W,step:LANE_W,lanes:LANES,inset:LANE_W/2,startLane:START_LANE}),
 // Two half-lane steps either side of center + a visible-body safety margin.
 compact:Object.freeze({id:'compact',width:4*(LANE_W/2)+2*18,step:LANE_W/2,lanes:5,inset:18,startLane:2}),
});
export function arenaFor(value){const id=typeof value==='string'?value:value?.arenaStyle;return Object.hasOwn(ARENAS,id)?ARENAS[id]:ARENAS.classic;}
export function arenaCenter(lane,arena=ARENAS.classic){return arena.inset+lane*arena.step;}
export function arenaLane(x,arena=ARENAS.classic){return Math.max(0,Math.min(arena.lanes-1,Math.round((x-arena.inset)/arena.step)));}
export const ARENA_OPTIONS=Object.values(ARENAS).map(a=>[a.id,a.id.toUpperCase()+' · '+a.width+' u']);
if(ARENAS.compact.inset<HIT_RADIUS)throw Error('Arena margin must contain player hitbox');
