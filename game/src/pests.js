// pests.js — grubs, drought, and frost. Grubs crawl in from the soil's
// edges, find a root, and eat it toward the tip; when no root is left they
// go for the heart. Drought drains sap; frost halves growth.

import {
  W, SOIL_TOP, PLAY_BOTTOM, SEED,
  GRUB_SPEED, GRUB_BITE_PX, GRUB_BITE_TIME, GRUB_THORN_BITES,
} from './config.js';

export class Pests {
  constructor(rng) {
    this.rng = rng;
    this.grubs = [];
    this.spawnQueue = 0; // grubs still to send in this season
    this.spawnTimer = 0;
  }

  // Queue grubs for the new season (repellent halves the count).
  planSeason(count, repellent) {
    const n = repellent ? Math.ceil(count / 2) : count;
    this.spawnQueue = n;
    this.spawnTimer = 2.5; // first grub arrives a little after the banner
  }

  // A grub guarding a pocket: placed right beside it, already hungry.
  placeGuard(pocket) {
    const angle = this.rng.range(0, Math.PI * 2);
    const g = this._makeGrub(
      pocket.x + Math.cos(angle) * (pocket.r + 26),
      pocket.y + Math.sin(angle) * (pocket.r + 26),
    );
    g.guard = true;
    this.grubs.push(g);
    return g;
  }

  _makeGrub(x, y) {
    return {
      x, y,
      mode: 'seek', // seek -> eat -> heart
      root: null,
      along: 0, // distance along the root it is eating
      biteTimer: GRUB_BITE_TIME,
      bites: 0, // bites taken on a thorn-bark root
      speed: GRUB_SPEED * this.rng.range(0.85, 1.2),
      wiggle: this.rng.range(0, Math.PI * 2),
      squash: 0, // >0 while the squash animation plays
      guard: false,
    };
  }

  _spawnOne() {
    // Grubs crawl in from the left or right edge, mid-soil.
    const fromLeft = this.rng.chance(0.5);
    const g = this._makeGrub(
      fromLeft ? 14 : W - 14,
      this.rng.range(SOIL_TOP + 60, PLAY_BOTTOM - 60),
    );
    this.grubs.push(g);
  }

  // Click a grub to squash it. Returns the grub, or null.
  squashAt(x, y) {
    for (const g of this.grubs) {
      if (g.squash > 0) continue;
      if (Math.hypot(g.x - x, g.y - y) <= 20) {
        g.squash = 0.001; // starts the squash animation; removed below
        return g;
      }
    }
    return null;
  }

  // Update grubs for dt seconds. Events pushed:
  // {kind:'bite', grub, root} {kind:'heartBite', grub}
  // {kind:'grubDied', grub, why:'thorn'|'squash'} {kind:'grubGone', grub}
  update(dt, roots, flags, events) {
    // Trickle the season's grubs in, one every few seconds.
    if (this.spawnQueue > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this._spawnOne();
        this.spawnQueue--;
        this.spawnTimer = this.rng.range(3.5, 6.5);
      }
    }

    const speedMult = flags.repellent ? 0.7 : 1;
    for (const g of this.grubs) {
      if (g.squash > 0) {
        g.squash += dt;
        continue;
      }
      g.wiggle += dt * 6;

      if (g.mode === 'seek') {
        // Find the nearest living root and crawl to its closest point.
        let best = null;
        let bestD = Infinity;
        for (const root of roots.list) {
          if (!root.alive || root.grown < 10) continue;
          const poly = roots.grownPolyline(root);
          for (const pt of poly) {
            const d = Math.hypot(pt.x - g.x, pt.y - g.y);
            if (d < bestD) { bestD = d; best = { root, pt }; }
          }
        }
        if (!best) {
          // No roots to eat: go for the heart itself.
          g.mode = 'heart';
        } else if (bestD <= 10) {
          g.mode = 'eat';
          g.root = best.root;
          g.biteTimer = GRUB_BITE_TIME * 0.5;
        } else {
          const step = g.speed * speedMult * dt;
          const dx = best.pt.x - g.x;
          const dy = best.pt.y - g.y;
          const d = Math.hypot(dx, dy) || 1;
          g.x += (dx / d) * step;
          g.y += (dy / d) * step + Math.sin(g.wiggle) * 4 * dt;
        }
      } else if (g.mode === 'eat') {
        const root = g.root;
        if (!root || !root.alive) {
          g.mode = 'seek';
          g.root = null;
          continue;
        }
        // Sit on the root's tip and chew it back.
        const tip = roots.tip(root);
        g.x += (tip.x - g.x) * Math.min(1, dt * 6);
        g.y += (tip.y - g.y) * Math.min(1, dt * 6);
        g.biteTimer -= dt;
        if (g.biteTimer <= 0) {
          g.biteTimer = GRUB_BITE_TIME;
          const died = roots.eat(root, GRUB_BITE_PX, events);
          events.push({ kind: 'bite', grub: g, root });
          if (flags.thorn) {
            g.bites++;
            if (g.bites >= GRUB_THORN_BITES) {
              g.squash = 0.001;
              events.push({ kind: 'grubDied', grub: g, why: 'thorn' });
            }
          }
          if (died) {
            g.mode = 'seek';
            g.root = null;
          }
        }
      } else if (g.mode === 'heart') {
        const d = Math.hypot(SEED.x - g.x, SEED.y - g.y);
        if (d <= 16) {
          g.biteTimer -= dt;
          if (g.biteTimer <= 0) {
            g.biteTimer = GRUB_BITE_TIME;
            events.push({ kind: 'heartBite', grub: g });
          }
        } else {
          const step = g.speed * speedMult * dt;
          g.x += ((SEED.x - g.x) / d) * step;
          g.y += ((SEED.y - g.y) / d) * step;
        }
      }
    }

    // Drop finished squash animations.
    for (let i = this.grubs.length - 1; i >= 0; i--) {
      if (this.grubs[i].squash > 0.45) {
        this.grubs.splice(i, 1);
      }
    }
  }

  count() {
    return this.grubs.filter((g) => g.squash <= 0).length;
  }

  clear() {
    this.grubs = [];
    this.spawnQueue = 0;
  }
}
