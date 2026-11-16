// upgrades.js — the three choices offered between seasons.
// Each upgrade is a small permanent change to the run's flags.

import { UPGRADES } from './config.js';

// Pick 3 distinct upgrades the player does not own yet (or fewer, if the
// pool runs dry — Second Seed and Golden Bloom can repeat).
export function rollChoices(rng, owned) {
  const pool = UPGRADES.filter((u) => {
    if (u.id === 'golden') return true; // Golden Bloom may repeat
    return !owned.has(u.id);
  });
  const shuffled = rng.shuffle(pool);
  return shuffled.slice(0, 3);
}

// Apply an upgrade to the game state object `g` (see main.js).
// Returns a one-line description of what changed, for the banner.
export function applyUpgrade(id, g) {
  switch (id) {
    case 'thorn':
      g.flags.thorn = true;
      return 'Thorn Bark: grubs die after 2 bites.';
    case 'deepSap': {
      g.sapMax = g.sapMax + 25;
      g.sap = Math.min(g.sapMax, g.sap + 25);
      return 'Deep Sap: +25 capacity, +25 sap now.';
    }
    case 'swift':
      g.flags.swift = true;
      return 'Swift Growth: roots grow 30% faster.';
    case 'secondSeed':
      g.flags.secondSeed = true;
      g.flags.secondSeedUsed = false;
      return 'Second Seed: one more chance at death.';
    case 'repellent':
      g.flags.repellent = true;
      return 'Grub Repellent: fewer, slower grubs.';
    case 'golden':
      g.bloom = Math.min(g.bloomMax, g.bloom + 1);
      g.score += 200;
      return 'Golden Bloom: +1 bloom, +200 score.';
    default:
      return '';
  }
}

// Growth speed multiplier from the player's upgrades and the season.
export function growthMultiplier(g, seasonEvent) {
  let m = 1;
  if (g.flags.swift) m *= 1.3;
  if (seasonEvent === 'frost') m *= 0.5;
  return m;
}
