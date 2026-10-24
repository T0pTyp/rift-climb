// Rift Pulse und Rift-Siegel: Impulserzeugung und Siegel-Zustände.
// Läuft im festen Simulationsschritt des Spiels (Spielzeit t), dadurch unabhängig von der Bildrate.
import {
  PULSE_RADIUS, PULSE_GROW_SEC, PULSE_FADE_SEC, PULSE_POOL, SEAL_OPEN_SEC, BAR_INSET_X, BAR_THICKNESS,
} from './config.js';

const SEAL_HALF_VIS = BAR_THICKNESS / 2;

/** Radius einer Welle nach `age` Sekunden (easeOutQuad); Logik und Darstellung nutzen dieselbe Kurve. */
export function pulseRadius(age) {
  if (age <= 0) return 0;
  const u = Math.min(1, age / PULSE_GROW_SEC);
  return PULSE_RADIUS * (1 - (1 - u) * (1 - u));
}

/** Abstand eines Punkts zum sichtbaren Rechteck eines Siegels. */
export function distToSeal(x, y, s) {
  const dx = Math.max(s.x0 + BAR_INSET_X - x, 0, x - (s.x1 - BAR_INSET_X));
  const dy = Math.max(s.y - SEAL_HALF_VIS - y, 0, y - (s.y + SEAL_HALF_VIS));
  return Math.hypot(dx, dy);
}

export class RiftField {
  /** seals: Hindernisse mit color 'S', aufsteigend nach y sortiert. */
  constructor(seals) {
    this.seals = seals;
    this.pulses = [];
    for (let i = 0; i < PULSE_POOL; i++) this.pulses.push({ live: false, growing: false, x: 0, y: 0, t0: 0, id: 0, color: '#fff' });
    this.nextId = 1;
    this.emitted = 0;
    this.reset();
  }

  /** Alle Siegel geschlossen, keine Wellen (Neustart, Respawn am Checkpoint). */
  reset() {
    for (const s of this.seals) {
      s.openUntil = -Infinity;
      s.openedAt = -Infinity;
      s.pulseId = 0;
      s.timesOpened = 0;
    }
    for (const p of this.pulses) { p.live = false; p.growing = false; }
  }

  /** Genau eine Welle pro gültigem Impuls; Ursprung = Spielerposition zum Tippzeitpunkt. */
  emit(x, y, t, color) {
    let slot = this.pulses[0];
    for (const p of this.pulses) {
      if (!p.live) { slot = p; break; }
      if (p.t0 < slot.t0) slot = p;
    }
    slot.live = true;
    slot.growing = true;
    slot.x = x;
    slot.y = y;
    slot.t0 = t;
    slot.id = this.nextId++;
    slot.color = color;
    this.emitted++;
    return slot;
  }

  /** Ein Simulationsschritt: wachsende Wellen öffnen jedes Siegel, das sie berühren (ein Treffer pro Welle und Siegel). */
  step(t, onOpen) {
    for (const p of this.pulses) {
      if (!p.live) continue;
      const age = t - p.t0;
      if (p.growing) {
        const r = pulseRadius(age);
        for (const s of this.seals) {
          if (s.y + SEAL_HALF_VIS < p.y - PULSE_RADIUS) continue;
          if (s.y - SEAL_HALF_VIS > p.y + PULSE_RADIUS) break;
          if (s.pulseId === p.id || distToSeal(p.x, p.y, s) > r) continue;
          const wasOpen = this.isOpen(s, t);
          s.pulseId = p.id;
          s.openUntil = t + SEAL_OPEN_SEC;
          if (!wasOpen) s.openedAt = t;
          s.timesOpened++;
          if (onOpen) onOpen(s, wasOpen);
        }
        if (age >= PULSE_GROW_SEC) p.growing = false;
      }
      if (age >= PULSE_GROW_SEC + PULSE_FADE_SEC) p.live = false;
    }
  }

  isOpen(s, t) {
    return t < s.openUntil;
  }

  remaining(s, t) {
    return Math.max(0, s.openUntil - t);
  }

  /** Würde ein Impuls genau jetzt dieses (geschlossene, voraus liegende) Siegel öffnen? Für den Annäherungshinweis. */
  inReach(s, x, y) {
    return s.y > y && distToSeal(x, y, s) <= PULSE_RADIUS;
  }

  get activePulses() {
    let n = 0;
    for (const p of this.pulses) if (p.growing) n++;
    return n;
  }
}
