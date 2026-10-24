// LEVEL FORGE: Gestenerkennung für Touch (Pointer Events mit pointerType "touch"/"pen").
// Ein Finger: Tipp, langes Drücken oder Ziehen (ab SLOP_PX). Zwei Finger: Pinch-Zoom und Verschieben.
// Sobald ein zweiter Finger dazukommt, wird eine laufende Ein-Finger-Geste abgebrochen (nie beides zugleich),
// und bis alle Finger oben sind, löst nichts mehr einen Tipp aus – so platziert eine Zoomgeste nie versehentlich.

export const SLOP_PX = 8;
export const LONG_PRESS_MS = 480;

/**
 * handlers: { tap(p), longPress(p), dragStart(p0, p), drag(p), dragEnd(p), cancel(),
 *             pinchStart(mid), pinch({ mid, scale, mid0 }), pinchEnd() }
 * p = { x, y } in CSS-px relativ zur Canvas-Oberkante.
 */
export class TouchGestures {
  constructor(el, handlers) {
    this.el = el;
    this.h = handlers;
    this.pts = new Map();
    this.mode = 'idle';
    this.timer = 0;
    this.start = null;
    this.pinch0 = null;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e, false));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    // iOS Safari: eigene Pinch-/Doppeltipp-Zoomgesten auf der Arbeitsfläche unterdrücken
    for (const t of ['gesturestart', 'gesturechange', 'dblclick']) el.addEventListener(t, (e) => e.preventDefault());
  }

  static isTouch(e) {
    return e.pointerType === 'touch' || e.pointerType === 'pen';
  }

  local(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  clearTimer() {
    clearTimeout(this.timer);
    this.timer = 0;
  }

  down(e) {
    if (!TouchGestures.isTouch(e)) return;
    e.preventDefault();
    try { this.el.setPointerCapture(e.pointerId); } catch { /* Pointer bereits weg */ }
    const p = this.local(e);
    this.pts.set(e.pointerId, p);
    if (this.pts.size === 1) {
      this.mode = 'pending';
      this.start = { ...p, id: e.pointerId };
      this.timer = setTimeout(() => {
        this.timer = 0;
        if (this.mode !== 'pending') return;
        this.mode = 'held';
        this.h.longPress(this.start);
      }, LONG_PRESS_MS);
      return;
    }
    if (this.pts.size === 2) {
      this.clearTimer();
      if (this.mode === 'drag') this.h.cancel();
      this.mode = 'pinch';
      const [a, b] = [...this.pts.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.pinch0 = { mid, dist: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)) };
      this.h.pinchStart(mid);
      return;
    }
    // drei und mehr Finger: ignorieren, Pinch läuft mit den ersten beiden weiter
  }

  move(e) {
    if (!TouchGestures.isTouch(e) || !this.pts.has(e.pointerId)) return;
    e.preventDefault();
    const p = this.local(e);
    this.pts.set(e.pointerId, p);
    if (this.mode === 'pending' && e.pointerId === this.start.id) {
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) < SLOP_PX) return;
      this.clearTimer();
      this.mode = 'drag';
      this.h.dragStart(this.start, p);
      return;
    }
    if (this.mode === 'drag' && e.pointerId === this.start.id) {
      this.h.drag(p);
      return;
    }
    if (this.mode === 'pinch') {
      const [a, b] = [...this.pts.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.max(10, Math.hypot(a.x - b.x, a.y - b.y));
      this.h.pinch({ mid, scale: dist / this.pinch0.dist, mid0: this.pinch0.mid });
    }
  }

  up(e, cancelled) {
    if (!TouchGestures.isTouch(e) || !this.pts.has(e.pointerId)) return;
    const p = this.local(e);
    this.pts.delete(e.pointerId);
    try { this.el.releasePointerCapture(e.pointerId); } catch { /* bereits freigegeben */ }
    if (this.mode === 'pinch') {
      if (this.pts.size < 2) {
        this.h.pinchEnd();
        this.mode = this.pts.size ? 'tail' : 'idle';
      }
      return;
    }
    if (this.pts.size) return;
    this.clearTimer();
    const mode = this.mode;
    this.mode = 'idle';
    if (cancelled) {
      if (mode === 'drag') this.h.cancel();
      return;
    }
    if (mode === 'pending') this.h.tap(this.start);
    else if (mode === 'drag') this.h.dragEnd(p);
  }

  /** Von außen abbrechen (z. B. beim Öffnen eines Dialogs). */
  reset() {
    this.clearTimer();
    if (this.mode === 'drag') this.h.cancel();
    if (this.mode === 'pinch') this.h.pinchEnd();
    this.mode = 'idle';
    this.pts.clear();
  }
}
