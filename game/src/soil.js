// soil.js — the ground the game is played in: strata bands, water pockets,
// soft-stone layers, and the speckles that make the soil feel like soil.
// Everything is placed by the seeded RNG, so a run replays exactly.

import { W, SOIL_TOP, PLAY_BOTTOM, SEED, SEASONS } from './config.js';
import { RNG } from './random.js';

const STRATA_COUNT = 7;

export class Soil {
  constructor(seed) {
    this.rng = new RNG(seed);
    this.strata = this._makeStrata();
    this.speckles = this._makeSpeckles();
    this.pebbles = this._makePebbles();
    this.pockets = this._makePockets();
    this.stones = this._makeStones();
    this.deepPocket = this.pockets[this.pockets.length - 1];
  }

  // Seven horizontal bands from the grass line to the bottom of the pit.
  _makeStrata() {
    const bands = [];
    const depth = PLAY_BOTTOM - SOIL_TOP;
    for (let i = 0; i < STRATA_COUNT; i++) {
      const y0 = SOIL_TOP + (depth * i) / STRATA_COUNT;
      const y1 = SOIL_TOP + (depth * (i + 1)) / STRATA_COUNT;
      // A gentle wobble so the bands read as geology, not wallpaper.
      const wobble = this.rng.range(-6, 6);
      bands.push({ y0: y0 + wobble, y1: y1 + wobble, index: i });
    }
    return bands;
  }

  _makeSpeckles() {
    const dots = [];
    for (let i = 0; i < 420; i++) {
      dots.push({
        x: this.rng.range(0, W),
        y: this.rng.range(SOIL_TOP + 4, PLAY_BOTTOM - 4),
        r: this.rng.range(0.7, 2.2),
        light: this.rng.chance(0.35),
      });
    }
    return dots;
  }

  _makePebbles() {
    const rocks = [];
    for (let i = 0; i < 26; i++) {
      rocks.push({
        x: this.rng.range(20, W - 20),
        y: this.rng.range(SOIL_TOP + 14, PLAY_BOTTOM - 14),
        rx: this.rng.range(4, 11),
        ry: this.rng.range(3, 7),
        rot: this.rng.range(0, Math.PI),
      });
    }
    return rocks;
  }

  // One pocket per season after the first (which has two): seven in all,
  // each deeper than the last, so the game pulls the player downward.
  _makePockets() {
    const pockets = [];
    let n = 0;
    for (let s = 0; s < SEASONS.length; s++) {
      const count = SEASONS[s].pockets;
      for (let k = 0; k < count; k++) {
        const deep = s === SEASONS.length - 1;
        const bandTop = SOIL_TOP + 60 + s * 62;
        const bandBot = Math.min(bandTop + 70, PLAY_BOTTOM - 40);
        // Alternate sides so no two pockets sit on the same vertical.
        const side = (n % 2 === 0 ? -1 : 1) * this.rng.range(0.15, 0.42);
        const x = SEED.x + side * W + this.rng.range(-40, 40);
        pockets.push({
          id: n,
          season: s + 1,
          x: Math.max(90, Math.min(W - 90, x)),
          y: this.rng.range(bandTop, bandBot),
          r: deep ? 30 : this.rng.range(19, 25),
          drunk: false,
          deep,
          pulse: this.rng.range(0, Math.PI * 2),
        });
        n++;
      }
    }
    return pockets;
  }

  // Soft-stone shelves appear from season 4: only a taproot breaks them.
  _makeStones() {
    const stones = [];
    const rows = [
      { y: 330, count: 2 },
      { y: 430, count: 3 },
      { y: 530, count: 2 },
    ];
    for (const row of rows) {
      const slots = this.rng.shuffle([0, 1, 2, 3]);
      for (let i = 0; i < row.count; i++) {
        const slot = slots[i];
        stones.push({
          x: 110 + slot * 280 + this.rng.range(-20, 20),
          y: row.y + this.rng.range(-12, 12),
          w: this.rng.range(150, 210),
          h: this.rng.range(22, 30),
          broken: false,
          crack: this.rng.range(0, Math.PI),
        });
      }
    }
    return stones;
  }

  // The pocket whose water a point is touching (within its radius), if any.
  pocketAt(x, y, extra = 0) {
    for (const p of this.pockets) {
      if (p.drunk) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d <= p.r + extra) return p;
    }
    return null;
  }

  // The unbroken stone containing a point, if any.
  stoneAt(x, y) {
    for (const s of this.stones) {
      if (s.broken) continue;
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
    }
    return null;
  }

  // How many pockets remain undrunk.
  remaining() {
    return this.pockets.filter((p) => !p.drunk).length;
  }
}
