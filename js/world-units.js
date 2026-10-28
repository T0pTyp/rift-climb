// Preserve the existing meter and every recorded height. No speed escalation.
import {CLIMB_SPEED} from './config.js';
export const METERS_PER_UNIT=.1;
export const worldMeters=y=>Math.floor(y*METERS_PER_UNIT+1e-6);
// Retained exports for existing tools; Infinity now has a fixed speed ceiling.
export const INFINITY_SPEED_MARK_M=Infinity;
export const INFINITY_SPEED_RAMP_M=Infinity;
export const infinityClimbY=t=>t*CLIMB_SPEED;
export const infinityClimbSpeed=()=>CLIMB_SPEED;
export const infinitySpaceScale=()=>1;
export const infinityClimbTime=y=>y/CLIMB_SPEED;
