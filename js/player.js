import { laneCenter } from './level.js';
import { STEER_OMEGA, TILT_PER_SPEED, TILT_MAX, TRAIL_LEN, TRAIL_SAMPLE_SEC, HIT_RADIUS } from './config.js';
import { clamp, springStep } from './physics.js';
import { otherDim } from './dimensions.js';
import {arenaFor,arenaCenter} from './arena.js';

export { IMPULSE_MS, HIT_RADIUS } from './config.js';

/**
 * Spielfigur. Seitliche Bewegung: kritisch gedämpfte Feder zur Zielspur
 * (stetige Geschwindigkeit, kein Überschwingen, exakt unabhängig von der Schrittweite).
 */
export class Player {
  constructor(arena='classic') {
    this.arena=arenaFor(typeof arena==='string'?arena:arena?.id);
    this.trailX = new Float32Array(TRAIL_LEN);
    this.trailY = new Float32Array(TRAIL_LEN);
    this.body = { x: 0, v: 0 };
    this.reset(this.arena.startLane, 'B', 0);
  }

  reset(lane, dim, worldY) {
    this.lane = lane;
    this.dim = dim;
    this.body.x = arenaCenter(lane,this.arena);
    this.body.v = 0;
    this.lastDir = 0;
    this.pop = 0;
    this.wallBump = 0;
    this.trailCount = 0;
    this.trailHead = 0;
    this.trailClock = 0;
    for (let i = 0; i < TRAIL_LEN; i++) {
      this.trailX[i] = this.body.x;
      this.trailY[i] = worldY || 0;
    }
  }

  get x() { return this.body.x; }
  get vx() { return this.body.v; }
  get hitRadius() { return HIT_RADIUS; }

  /** Noch unterwegs zur Zielspur (für Checkpoints). */
  get dashing() {
    return Math.abs(this.body.x - arenaCenter(this.lane,this.arena)) > 2 || Math.abs(this.body.v) > 30;
  }

  get tilt() {
    return clamp(this.body.v * TILT_PER_SPEED, -TILT_MAX, TILT_MAX);
  }

  /**
   * dir: +1 = nach rechts oben, -1 = nach links oben. Jeder Impuls wechselt die Dimension.
   * Rückgabe: true, wenn die Figur an der Wand steht (nur Dimensionswechsel).
   */
  impulse(dir) {
    const next = clamp(this.lane + dir, 0, this.arena.lanes - 1);
    const atWall = next === this.lane;
    this.lane = next;
    this.lastDir = dir;
    this.dim = otherDim(this.dim);
    this.pop = 1;
    if (atWall) this.wallBump = dir;
    return atWall;
  }

  update(dt, worldY) {
    springStep(this.body, arenaCenter(this.lane,this.arena), STEER_OMEGA, dt);
    if(this.arena.id==='compact'){
      // Reversals retain velocity. Bound pathological rapid alternation at the safe centers.
      const lo=this.arena.inset,hi=this.arena.width-lo;
      if(this.body.x<lo){this.body.x=lo;this.body.v=Math.max(0,this.body.v);}
      if(this.body.x>hi){this.body.x=hi;this.body.v=Math.min(0,this.body.v);}
    }
    this.pop = Math.max(0, this.pop - dt * 7);
    if (this.wallBump) {
      this.wallBump -= Math.sign(this.wallBump) * dt * 8;
      if (Math.abs(this.wallBump) < 0.05) this.wallBump = 0;
    }
    this.trailClock += dt;
    if (this.trailClock >= TRAIL_SAMPLE_SEC) {
      this.trailClock -= TRAIL_SAMPLE_SEC;
      this.trailHead = (this.trailHead + 1) % TRAIL_LEN;
      this.trailX[this.trailHead] = this.body.x;
      this.trailY[this.trailHead] = worldY;
      if (this.trailCount < TRAIL_LEN) this.trailCount++;
    }
  }
}
