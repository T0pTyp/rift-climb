// Eingabe: Touch/Maus über Pointer Events (eine Quelle -> keine Doppelauslösung),
// Fallback auf Touch Events nur für Browser ohne PointerEvent.
// Tipp links -> Impuls schräg rechts oben (+1), Tipp rechts -> schräg links oben (-1).
// Tastatur: A / Pfeil links -> nach links oben, D / Pfeil rechts -> nach rechts oben.

export class Input {
  constructor(surface, { onImpulse, onPause, onConfirm }) {
    this.surface = surface;
    this.onImpulse = onImpulse;
    this.onPause = onPause;
    this.onConfirm = onConfirm;
    this.enabled = false;
    this.blockUntil = 0;
    this.lastTouchTs = -1;

    const press = (clientX, ts) => {
      if (!this.enabled || performance.now() < this.blockUntil) return;
      const rect = surface.getBoundingClientRect();
      const leftSide = clientX - rect.left < rect.width / 2;
      this.onImpulse(leftSide ? 1 : -1, ts);
    };

    if (window.PointerEvent) {
      surface.addEventListener('pointerdown', (e) => {
        if (e.button !== undefined && e.button > 0) return;
        e.preventDefault();
        press(e.clientX, e.timeStamp);
      }, { passive: false });
    } else {
      surface.addEventListener('touchstart', (e) => {
        e.preventDefault();
        for (const t of e.changedTouches) press(t.clientX, e.timeStamp);
        this.lastTouchTs = performance.now();
      }, { passive: false });
      surface.addEventListener('mousedown', (e) => {
        if (performance.now() - this.lastTouchTs < 800) return;
        press(e.clientX, e.timeStamp);
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
      if (e.repeat || !this.enabled) return;
      if (k === 'ArrowLeft' || k === 'a' || k === 'A') {
        this.onImpulse(-1, e.timeStamp);
        e.preventDefault();
      } else if (k === 'ArrowRight' || k === 'd' || k === 'D') {
        this.onImpulse(1, e.timeStamp);
        e.preventDefault();
      }
    });
  }

  /** Verhindert, dass der Tipp auf "Start" gleichzeitig als Spiel-Impuls zählt. */
  enable(graceMs = 200) {
    this.enabled = true;
    this.blockUntil = performance.now() + graceMs;
  }

  disable() {
    this.enabled = false;
  }
}
