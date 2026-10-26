// Eingabe: Touch/Maus über Pointer Events (eine Quelle -> keine Doppelauslösung),
// Fallback auf Touch Events nur für Browser ohne PointerEvent.
// Tipp links -> Impuls schräg rechts oben (+1), Tipp rechts -> schräg links oben (-1).
// Tastatur: A / Pfeil links -> nach links oben, D / Pfeil rechts -> nach rechts oben.
import { START_GRACE_MS, MIN_PRESS_INTERVAL_MS } from './config.js';
import { inputTime,withInputEvent,currentInputEventTime } from './input-time.js';

export class Input {
  /**
   * onPress(dir, timeStampMs) wird für jede gültige Spielfeld-Eingabe aufgerufen –
   * auch außerhalb des Spiels (z. B. Tipp zum Neustart); das Spiel entscheidet über die Bedeutung.
   */
  constructor(surface, { onPress, onPause, onConfirm }) {
    this.surface = surface;
    this.onPress = onPress;
    this.onPause = onPause;
    this.onConfirm = onConfirm;
    this.blockPointerUntil = 0;
    this.lastPress = -Infinity;
    this.lastTouchTs = -1;
    this.ignored = 0;
    this.activePointers = new Set();
    this.eventFloor = -Infinity;
    this.lastDecision = { accepted:false, reason:'no-input', eventTimeMs:0, dispatchDelayMs:0 };

    const press = (dir, ts) => {
      const now = performance.now();
      const time = inputTime(ts, now);
      const stale = time < this.eventFloor || now-time>1000;
      if (stale || time - this.lastPress < MIN_PRESS_INTERVAL_MS - .01) {
        this.ignored++;
        this.lastDecision={accepted:false,reason:stale?'previous-run-event':'minimum-interval',eventTimeMs:time,dispatchDelayMs:now-time};
        return;
      }
      this.lastPress = time;
      this.lastDecision={accepted:true,reason:'immediate',eventTimeMs:time,dispatchDelayMs:now-time};
      withInputEvent(time,()=>this.onPress(dir, time));
    };
    const pointerPress = (clientX, ts) => {
      const time=inputTime(ts),now=performance.now();
      if (now < this.blockPointerUntil || time < this.blockPointerUntil) {
        this.lastDecision={accepted:false,reason:'start-guard',eventTimeMs:time,dispatchDelayMs:now-time};return;
      }
      const rect = surface.getBoundingClientRect();
      const leftSide = clientX - rect.left < rect.width / 2;
      press(leftSide ? 1 : -1, ts);
    };

    if (window.PointerEvent) {
      surface.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button > 0) return;
        e.preventDefault();
        if(this.activePointers.has(e.pointerId)){this.ignored++;return;}
        this.activePointers.add(e.pointerId);
        pointerPress(e.clientX, e.timeStamp);
      }, { passive: false });
      const release=e=>this.activePointers.delete(e.pointerId);
      window.addEventListener('pointerup',release,true);
      window.addEventListener('pointercancel',release,true);
      window.addEventListener('blur',()=>this.activePointers.clear());
    } else {
      surface.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if(e.changedTouches.length)pointerPress(e.changedTouches[0].clientX, e.timeStamp);
        this.lastTouchTs = performance.now();
      }, { passive: false });
      surface.addEventListener('mousedown', (e) => {
        if (performance.now() - this.lastTouchTs < 800) return;
        pointerPress(e.clientX, e.timeStamp);
      });
    }

    // Kontextmenü / Long-Press-Lupe auf iOS unterdrücken
    surface.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e) => {
      const k = e.key;
      if(['Escape','p','P','Enter',' ','r','R'].includes(k)){
        const time=inputTime(e.timeStamp);
        if(time<this.eventFloor||performance.now()-time>1000){this.ignored++;e.preventDefault();return;}
      }
      if (k === 'Escape' || k === 'p' || k === 'P') {
        if(e.repeat){e.preventDefault();return;}
        withInputEvent(e.timeStamp,()=>this.onPause());
        e.preventDefault();
        return;
      }
      if (k === 'Enter' || k === ' ' || k === 'r' || k === 'R') {
        if(e.repeat){e.preventDefault();return;}
        if (withInputEvent(e.timeStamp,()=>this.onConfirm(k))) e.preventDefault();
        if (k === ' ') e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        press(-1, e.timeStamp);
        e.preventDefault();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        press(1, e.timeStamp);
        e.preventDefault();
      }
    });
  }

  /** Verhindert, dass der Tipp auf "Start" gleichzeitig als Spiel-Impuls zählt (nur Pointer). */
  guard(ms = START_GRACE_MS,useGesture=true) {
    // DOM timestamps may be quantized to whole milliseconds on mobile browsers.
    const now=Math.floor(performance.now());
    this.blockPointerUntil = now + ms;
    this.eventFloor = Math.floor(useGesture?(currentInputEventTime()??now):now);
    this.lastPress = -Infinity;
  }
}
