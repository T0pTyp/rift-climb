// Eingabe: Touch/Maus über Pointer Events (eine Quelle -> keine Doppelauslösung),
// Fallback auf Touch Events nur für Browser ohne PointerEvent.
// Tipp links -> Impuls schräg rechts oben (+1), Tipp rechts -> schräg links oben (-1).
// Tastatur: A / Pfeil links -> nach links oben, D / Pfeil rechts -> nach rechts oben.
import { START_GRACE_MS, MIN_PRESS_INTERVAL_MS } from './config.js';

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

    const press = (dir, ts) => {
      const now = performance.now();
      if (now - this.lastPress < MIN_PRESS_INTERVAL_MS) {
        this.ignored++;
        return;
      }
      this.lastPress = now;
      this.onPress(dir, ts);
    };
    const pointerPress = (clientX, ts) => {
      if (performance.now() < this.blockPointerUntil) return;
      const rect = surface.getBoundingClientRect();
      const leftSide = clientX - rect.left < rect.width / 2;
      press(leftSide ? 1 : -1, ts);
    };

    if (window.PointerEvent) {
      surface.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button > 0) return;
        e.preventDefault();
        pointerPress(e.clientX, e.timeStamp);
      }, { passive: false });
    } else {
      surface.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) pointerPress(t.clientX, e.timeStamp);
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
      if (k === 'Escape' || k === 'p' || k === 'P') {
        this.onPause();
        e.preventDefault();
        return;
      }
      if (k === 'Enter' || k === ' ' || k === 'r' || k === 'R') {
        if (this.onConfirm(k)) e.preventDefault();
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
  guard(ms = START_GRACE_MS) {
    this.blockPointerUntil = performance.now() + ms;
  }
}
