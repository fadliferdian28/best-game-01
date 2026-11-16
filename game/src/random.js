// random.js — a small seeded RNG so the ?shot= scenes (and every run)
// can be replayed exactly. mulberry32: fast, tiny, good enough for a game.

export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class RNG {
  constructor(seed) {
    // Accept a number or a string; zero is a fine seed too.
    this.state = (typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0)) || 0x9e3779b9;
  }

  // Next float in [0, 1).
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Float in [min, max).
  range(min, max) {
    return min + (max - min) * this.next();
  }

  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }

  // True with probability p.
  chance(p) {
    return this.next() < p;
  }

  // One element of an array.
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }

  // A shuffled copy of an array (Fisher-Yates).
  shuffle(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }
}
