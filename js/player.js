import { LANES, laneCenter } from './level.js';
import { easeOutCubic, clamp } from './physics.js';
import { otherDim } from './dimensions.js';

export const IMPULSE_MS = 340;
export const HIT_RADIUS = 8;

export class Player {
  constructor() {
    this.reset(1, 'B');
  }

  reset(lane, dim) {
    this.lane = lane;
    this.dim = dim;
    this.x = laneCenter(lane);
    this.fromX = this.x;
    this.dashT = 1;
    this.dashDir = 0;
    this.trail = [];
  }

  get dashing() {
    return this.dashT < 1;
  }

  /** dir: +1 = nach rechts oben, -1 = nach links oben. Jeder Impuls wechselt die Dimension. */
  impulse(dir) {
    this.fromX = this.x;
    this.lane = clamp(this.lane + dir, 0, LANES - 1);
    this.dashT = 0;
    this.dashDir = dir;
    this.dim = otherDim(this.dim);
  }

  update(dt) {
    if (this.dashT < 1) {
      this.dashT = Math.min(1, this.dashT + (dt * 1000) / IMPULSE_MS);
      const target = laneCenter(this.lane);
      this.x = this.fromX + (target - this.fromX) * easeOutCubic(this.dashT);
    } else {
      this.x = laneCenter(this.lane);
    }
  }
}
