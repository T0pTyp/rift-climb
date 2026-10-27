// Shared display/storage conversion. One meter is ten simulation world units.
import {CLIMB_SPEED} from './config.js';
export const METERS_PER_UNIT=.1;
export const worldMeters=y=>Math.floor(y*METERS_PER_UNIT+1e-6);
// Infinity climb. Below 8000 m the speed is exactly CLIMB_SPEED (26 m/s).
// From the mark it rises continuously, and it is still 26 m/s at 8000 m:
//   v(h) = 26 m/s * (1 + max(0, h - 8000) / 80000)
// A module that starts at height h is stretched vertically by v(h)/26, so the
// seconds between traps stay the authored times and only the tempo increases.
export const INFINITY_SPEED_MARK_M=8000;
export const INFINITY_SPEED_RAMP_M=80000;
const MARK_Y=INFINITY_SPEED_MARK_M/METERS_PER_UNIT;
const RAMP_Y=INFINITY_SPEED_RAMP_M/METERS_PER_UNIT;
const MARK_T=MARK_Y/CLIMB_SPEED;
export function infinityClimbY(t) {
 if(t<=MARK_T)return t*CLIMB_SPEED;
 return MARK_Y+RAMP_Y*(Math.exp(CLIMB_SPEED*(t-MARK_T)/RAMP_Y)-1);
}
export function infinityClimbSpeed(y) {
 if(y<=MARK_Y)return CLIMB_SPEED;
 return CLIMB_SPEED*(1+(y-MARK_Y)/RAMP_Y);
}
export function infinitySpaceScale(y){return infinityClimbSpeed(y)/CLIMB_SPEED;}
export function infinityClimbTime(y) {
 if(y<=MARK_Y)return y/CLIMB_SPEED;
 return MARK_T+(RAMP_Y/CLIMB_SPEED)*Math.log(1+(y-MARK_Y)/RAMP_Y);
}
