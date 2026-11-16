// roots.js — the root network: growth along drawn paths, drinking,
// stone-breaking, branching, and being eaten. A root is a drawn polyline
// with a grown length that advances along it; grubs eat that length back.

import { ROOT_TYPES } from './config.js';

let nextId = 1;

export class Roots {
  constructor() {
    this.list = [];
  }

  // Sap cost of a path of this length for a root type.
  static costOf(type, lengthPx) {
    return ROOT_TYPES[type].cost * lengthPx;
  }

  // Length of a polyline in pixels.
  static pathLength(path) {
    let sum = 0;
    for (let i = 1; i < path.length; i++) {
      sum += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    }
    return sum;
  }

  // Add a root that will grow along `path` (array of {x,y}, first = origin).
  // Returns the root, or null when the path is too short to be a root.
  addRoot(type, path, parentId = null) {
    const totalLen = Roots.pathLength(path);
    if (path.length < 2 || totalLen < 12) return null;
    const cumLen = [0];
    for (let i = 1; i < path.length; i++) {
      cumLen.push(cumLen[i - 1] + Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y));
    }
    const root = {
      id: nextId++,
      type,
      points: path.map((p) => ({ x: p.x, y: p.y })),
      cumLen,
      totalLen,
      grown: 0,
      done: false,
      blocked: false,
      flower: false,
      flowerT: 0,
      flowerDone: false,
      alive: true,
      parentId,
      drunkPockets: new Set(),
      wobble: Math.random() * Math.PI * 2,
    };
    this.list.push(root);
    return root;
  }

  // Position at a distance `d` along the root's path (0 <= d <= totalLen).
  static pointAt(root, d) {
    const pts = root.points;
    const cum = root.cumLen;
    if (d <= 0) return { x: pts[0].x, y: pts[0].y };
    if (d >= root.totalLen) return { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y };
    let lo = 0;
    let hi = cum.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid; else hi = mid;
    }
    const segLen = cum[lo + 1] - cum[lo] || 1;
    const t = (d - cum[lo]) / segLen;
    return {
      x: pts[lo].x + (pts[lo + 1].x - pts[lo].x) * t,
      y: pts[lo].y + (pts[lo + 1].y - pts[lo].y) * t,
    };
  }

  // The growing tip of a root.
  tip(root) {
    return Roots.pointAt(root, root.grown);
  }

  // The grown part of the root as a polyline (for drawing and for grubs).
  grownPolyline(root) {
    const pts = [];
    const cum = root.cumLen;
    for (let i = 0; i < root.points.length; i++) {
      if (cum[i] <= root.grown) pts.push(root.points[i]);
      else break;
    }
    const last = this.tip(root);
    if (pts.length === 0 || Math.hypot(last.x - pts[pts.length - 1].x, last.y - pts[pts.length - 1].y) > 0.5) {
      pts.push(last);
    }
    return pts;
  }

  // Find a living root whose grown part passes near (x, y).
  // Returns {root, along} (along = distance along the path) or null.
  rootAt(x, y, radius) {
    let best = null;
    let bestDist = radius;
    for (const root of this.list) {
      if (!root.alive || root.grown < 6) continue;
      const poly = this.grownPolyline(root);
      let along = 0;
      for (let i = 1; i < poly.length; i++) {
        const d = distToSegment(x, y, poly[i - 1], poly[i]);
        if (d < bestDist) {
          bestDist = d;
          best = { root, along: along + d.along };
        }
        along += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
      }
    }
    return best;
  }

  // Grow every root for dt seconds. Pushes events into `events`:
  // {kind:'drink', pocket, root} {kind:'stone', stone, root}
  // {kind:'flower', root} {kind:'grown', root}
  update(dt, growthMult, soil, events) {
    for (const root of this.list) {
      if (!root.alive || root.done) continue;
      if (root.blocked) continue;
      const speed = ROOT_TYPES[root.type].speed * growthMult;
      root.grown = Math.min(root.totalLen, root.grown + speed * dt);
      const tip = this.tip(root);

      // Stone in the way: taproots smash through, others stop cold.
      const stone = soil.stoneAt(tip.x, tip.y);
      if (stone) {
        if (ROOT_TYPES[root.type].breaksStone) {
          stone.broken = true;
          events.push({ kind: 'stone', stone, root });
        } else {
          root.blocked = true;
          root.grown = Math.max(0, root.grown - speed * dt);
          continue;
        }
      }

      // Drinking: the tip touches a water pocket.
      const pocket = soil.pocketAt(tip.x, tip.y, 4);
      if (pocket && !root.drunkPockets.has(pocket.id)) {
        root.drunkPockets.add(pocket.id);
        events.push({ kind: 'drink', pocket, root });
      }

      if (root.grown >= root.totalLen) {
        root.done = true;
        events.push({ kind: 'grown', root });
      }
    }

    // Bloomroot flowers open once the root finishes growing.
    for (const root of this.list) {
      if (!root.alive || root.type !== 'bloomroot' || !root.done || root.flowerDone) continue;
      root.flowerT += dt / 0.7;
      if (root.flowerT >= 1) {
        root.flower = true;
        root.flowerDone = true;
        events.push({ kind: 'flower', root });
      }
    }
  }

  // A grub eats `px` off the root's grown length. Returns true if it died.
  eat(root, px, events) {
    if (!root.alive) return false;
    root.grown = Math.max(0, root.grown - px);
    root.done = false;
    root.blocked = false;
    if (root.flower) {
      root.flower = false;
      root.flowerDone = false;
      root.flowerT = 0;
    }
    if (root.grown <= 0.5) {
      root.alive = false;
      if (events) events.push({ kind: 'rootDied', root });
      return true;
    }
    return false;
  }

  aliveCount() {
    return this.list.filter((r) => r.alive).length;
  }

  flowerCount() {
    return this.list.filter((r) => r.alive && r.flower).length;
  }

  // Does a drawn path cross an unbroken stone? (For the draw preview.)
  static pathCrossesStone(path, soil) {
    for (let i = 1; i < path.length; i++) {
      const steps = Math.ceil(Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y) / 6) || 1;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const x = path[i - 1].x + (path[i].x - path[i - 1].x) * t;
        const y = path[i - 1].y + (path[i].y - path[i - 1].y) * t;
        if (soil.stoneAt(x, y)) return true;
      }
    }
    return false;
  }
}

// Distance from a point to a segment, plus how far along the segment
// the nearest point sits. Returns {d, along}.
function distToSegment(px, py, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
  const cx = a.x + dx * t;
  const cy = a.y + dy * t;
  return { d: Math.hypot(px - cx, py - cy), along: t * Math.sqrt(len2) };
}
