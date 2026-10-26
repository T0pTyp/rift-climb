// Wiederverwendbares Animationssystem des Riftlings. Zustände: idle, flightLeft, flightRight, switch, death, respawn.
// Alles hängt nur von verstrichener Zeit ab (analytische Abklingkurven statt Frame-Zählern) und ist rein visuell:
// Hitbox, Position und Eingabe werden nie verändert oder blockiert.

const TAU = Math.PI * 2;
export const SWITCH_SEC = 0.22;
export const DEATH_ANIM_SEC = 0.42;
export const REBUILD_SEC = 0.36;
const FLIGHT_VX = 40;

export class RiftlingAnimator {
  constructor() {
    this.time = 0;
    this.reset(0);
  }

  /** blend: 0 = Blau, 1 = Rot. rebuild = Rekonstruktion (Respawn) abspielen. */
  reset(blend, { rebuild = false, duration = REBUILD_SEC } = {}) {
    this.state = rebuild ? 'respawn' : 'idle';
    this.switchAge = Infinity;
    this.switchDir = 0;
    this.deathAge = Infinity;
    this.rebuildAge = rebuild ? 0 : Infinity;
    this.rebuildSec = duration;
    this.boost = 0;
    this.pulseAge=Infinity;
    this.blinkIn = 1.5 + Math.random() * 2;
    this.blinkAge = Infinity;
    this.blend = blend;
    this.pose = { blend, tilt: 0, sx: 1, sy: 1, bob: 0, eye: 1, flash: 0, glow: 1, alpha: 1 };
  }

  /** Dimensionswechsel bzw. Richtungsimpuls (jeder Tipp). */
  onSwitch(dir) {
    this.switchAge = 0;
    this.switchDir = dir;
  }

  onDeath() {
    this.deathAge = 0;
  }
  onPulse(){this.pulseAge=0;}

  onRespawn(duration = REBUILD_SEC) {
    this.deathAge = Infinity;
    this.rebuildAge = 0;
    this.rebuildSec = duration;
  }

  /** Lichtimpuls bei präzisen Aktionen (z. B. durch ein gerade geöffnetes Siegel). */
  onPrecise() {
    this.boost = 1;
  }

  /**
   * dt in Sekunden (Echtzeit des Frames). s: { vx, tilt, targetBlend, alive }.
   * targetBlend folgt der aktiven Dimension; die Farbe blendet in ~0,1 s über.
   */
  update(dt, s) {
    this.time += dt;
    this.switchAge += dt;
    this.deathAge += dt;
    this.rebuildAge += dt;
    this.boost = Math.max(0, this.boost - dt * 3);
    this.pulseAge+=dt;
    this.blend += (s.targetBlend - this.blend) * (1 - Math.exp(-dt * 22));

    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkAge = 0;
      this.blinkIn = 2.4 + Math.random() * 2.6;
    }
    this.blinkAge += dt;

    const p = this.pose;
    const t = this.time;
    const speed = Math.min(1, Math.abs(s.vx) / 520);

    // Grundpose: Schweben und leichtes Pulsieren (Idle), Neigung und Dehnung nach Geschwindigkeit (Flug)
    const idleW = 1 - speed;
    const breath = Math.sin(t * TAU * 1.6) * 0.03 * (0.4 + 0.6 * idleW);
    let sx = 1 + breath - speed * 0.07;
    let sy = 1 - breath * 0.6 + speed * 0.13;
    let flash = 0;
    let alpha = 1;
    let glow = 1 + this.boost * 0.6 + speed * 0.25;
    const tilt = s.tilt;

    // Dimensionswechsel: Squash & Stretch als gedämpfte Schwingung + kurzer Energieimpuls
    if (this.switchAge < SWITCH_SEC * 2) {
      const a = this.switchAge;
      const k = Math.exp(-a * 15) * Math.cos(a * 34);
      sx += 0.2 * k;
      sy -= 0.17 * k;
      flash = Math.max(flash, Math.max(0, 1 - a / 0.09) * 0.3);
      glow += Math.max(0, 1 - a / SWITCH_SEC) * 0.8;
    }
    const pulse=Math.max(0,1-this.pulseAge/.25);glow+=pulse*.35;sx+=pulse*.035;sy+=pulse*.035;

    let state;
    if (!s.alive) {
      // Tod: Trefferblitz, dann Auflösung (Aufblähen + Ausblenden); Fragmente kommen aus dem Partikelsystem
      const a = Math.min(this.deathAge, 5);
      const f = Math.min(1, a / DEATH_ANIM_SEC);
      flash = a < 0.07 ? 1 : Math.max(0, 1 - (a - 0.07) / 0.12);
      sx = sy = 1 + f * 0.45;
      alpha = Math.max(0, 1 - f * f * 1.15);
      glow = 1.4 * (1 - f);
      state = 'death';
    } else if (this.rebuildAge < this.rebuildSec) {
      // Respawn: Rekonstruktion aus Energie – wächst elastisch, weiße Silhouette geht in die Dimensionsfarbe über
      const f = this.rebuildAge / this.rebuildSec;
      const e = 1 - Math.pow(1 - f, 3) * Math.cos(f * 7);
      sx *= 0.35 + 0.65 * e;
      sy *= 0.35 + 0.65 * e;
      flash = Math.max(flash, 1 - f);
      alpha = Math.min(1, 0.25 + f * 1.4);
      glow += (1 - f) * 0.8;
      state = 'respawn';
    } else if (this.switchAge < SWITCH_SEC) {
      state = 'switch';
    } else if (Math.abs(s.vx) > FLIGHT_VX) {
      state = s.vx < 0 ? 'flightLeft' : 'flightRight';
    } else {
      state = 'idle';
    }

    const blink = this.blinkAge < 0.13 ? Math.abs(this.blinkAge / 0.065 - 1) : 1;
    p.blend = this.blend;
    p.tilt = tilt;
    p.sx = sx;
    p.sy = sy;
    p.bob = s.alive ? Math.sin(t * TAU * 0.8) * 1.3 * (0.35 + 0.65 * idleW) : 0;
    p.eye = state === 'death' ? Math.max(0, 1 - this.deathAge * 6) : state === 'switch' ? Math.max(0.35, blink) : blink;
    p.flash = flash;
    p.glow = glow;
    p.alpha = alpha;
    p.pulse=pulse;p.flow=Math.sin(t*7)*speed*.9;p.gazeX=Math.tanh(s.vx/400)*.35;p.gazeY=-.1;
    this.state = state;
    this.speed = speed;
    return p;
  }
}
