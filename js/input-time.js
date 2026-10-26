/** One monotonic time domain for DOM input and the simulation clock.
 * Older WebKit may supply epoch timestamps. Future/invalid stamps use receipt time;
 * valid old stamps stay old so Input can reject events from a previous run.
 */
export function inputTime(stamp, now = performance.now(), origin = performance.timeOrigin) {
  const time = stamp > 1e12 ? stamp - origin : stamp;
  return Number.isFinite(time) && time >= 0 && time <= now + .01 ? Math.min(time, now) : now;
}

let currentEvent = null;
/** Synchronous dispatch scope; never stores a pending input or an async callback. */
export function withInputEvent(stamp, action) {
  const previous=currentEvent;currentEvent=inputTime(stamp);
  try{return action();}finally{currentEvent=previous;}
}
export const currentInputEventTime=()=>currentEvent;
