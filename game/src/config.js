// config.js — every balance number for ROOTBOUND in one place.
// Tuning lives here so the rest of the game reads like rules, not magic numbers.

export const W = 1280;
export const H = 720;

// The soil cross-section starts below the sky strip; the toolbar sits at the bottom.
export const SOIL_TOP = 96;
export const TOOLBAR_Y = 648;
export const PLAY_BOTTOM = 648;

// The Worldroot's last seed: every root starts here (or branches from a grown root).
export const SEED = { x: 640, y: 108 };

// --- Sap -------------------------------------------------------------------
export const SAP_START = 100;
export const SAP_MAX = 100;
export const SAP_DEEP_MAX = 125; // with the Deep Sap upgrade

// --- Root types ------------------------------------------------------------
export const ROOT_TYPES = {
  feeder: {
    id: 'feeder', name: 'Feeder', key: '1',
    cost: 0.030, // sap per pixel of drawn path
    speed: 155, // pixels of growth per second
    drink: 1, // bloom points per pocket drunk
    width: 7,
    core: '#b7ec6d', edge: '#5da33a', glow: 'rgba(150, 220, 90, 0.35)',
    desc: 'Fast and cheap.',
  },
  taproot: {
    id: 'taproot', name: 'Taproot', key: '2',
    cost: 0.055,
    speed: 78,
    drink: 2,
    width: 11,
    core: '#ffd94d', edge: '#9a7b1e', glow: 'rgba(255, 210, 80, 0.35)',
    breaksStone: true,
    desc: 'Drinks double, breaks stone.',
  },
  bloomroot: {
    id: 'bloomroot', name: 'Bloomroot', key: '3',
    cost: 0.085,
    speed: 108,
    drink: 1,
    width: 8,
    core: '#f2a7c3', edge: '#b84a7d', glow: 'rgba(240, 150, 190, 0.35)',
    flower: true,
    desc: 'Grows a flower: +1 combo.',
  },
};
export const ROOT_ORDER = ['feeder', 'taproot', 'bloomroot'];

// --- Water & bloom ---------------------------------------------------------
export const POCKETS_TOTAL = 7;
export const BLOOM_MAX = 7;
export const DRINK_SAP = 30; // sap regained per drink (x root drink multiplier)
export const DRINK_SCORE = 100;
export const FLOWER_SCORE = 50;
export const SQUASH_SCORE = 25;
export const SEASON_SCORE = 150;
export const COMBO_WINDOW = 8; // seconds to keep a combo alive
export const COMBO_MAX = 5;

// --- Seasons ---------------------------------------------------------------
export const SEASON_LEN = 45; // seconds each
export const SEASON_COUNT = 7;
export const SEASONS = [
  { name: 'First Rain', sub: 'The seed wakes', event: 'calm', grubs: 0, pockets: 2 },
  { name: 'Grub Wake', sub: 'Something stirs in the soil', event: 'grubs', grubs: 2, pockets: 1 },
  { name: 'Long Drought', sub: 'The sky gives nothing', event: 'drought', grubs: 1, pockets: 1 },
  { name: 'Stone Deep', sub: 'The earth hardens', event: 'stones', grubs: 3, pockets: 1 },
  { name: 'First Frost', sub: 'Growth slows in the cold', event: 'frost', grubs: 2, pockets: 1 },
  { name: 'Dry Grubs', sub: 'Thirsty and hungry', event: 'drought', grubs: 4, pockets: 1 },
  { name: 'Deep Water', sub: 'The last pocket, guarded', event: 'deep', grubs: 4, pockets: 1 },
];
export const DROUGHT_DRAIN = 1.0; // sap per second during a drought season
export const FROST_MULT = 0.5; // growth speed multiplier during frost

// --- Grubs -----------------------------------------------------------------
export const GRUB_SPEED = 26;
export const GRUB_BITE_PX = 7; // root length eaten per bite
export const GRUB_BITE_TIME = 0.9; // seconds between bites
export const GRUB_THORN_BITES = 2; // bites before thorn bark kills a grub
export const HEART_HP = 5; // bites the heart-root survives

// --- Upgrades (pick 1 of 3 between seasons) -------------------------------
export const UPGRADES = [
  { id: 'thorn', name: 'Thorn Bark', glyph: '✦',
    desc: 'Grubs die after 2 bites on your roots.' },
  { id: 'deepSap', name: 'Deep Sap', glyph: '◆',
    desc: '+25 sap capacity, and refill 25 sap now.' },
  { id: 'swift', name: 'Swift Growth', glyph: '➤',
    desc: 'Roots grow 30% faster, forever.' },
  { id: 'secondSeed', name: 'Second Seed', glyph: '♡',
    desc: 'Once: survive sap 0 or a eaten heart.' },
  { id: 'repellent', name: 'Grub Repellent', glyph: '✚',
    desc: 'Half as many grubs, and they crawl slower.' },
  { id: 'golden', name: 'Golden Bloom', glyph: '✿',
    desc: '+1 bloom point and +200 score, at once.' },
];

// --- Look ------------------------------------------------------------------
export const COLORS = {
  skyTop: '#ffe9c4', skyBot: '#ffd9a0',
  sun: '#ffd76a', sunGlow: 'rgba(255, 210, 90, 0.45)',
  grass: '#7fae4c', grassDark: '#5d8a38',
  strata: ['#6b4423', '#7d5027', '#8a5a2e', '#96682f', '#a5713a', '#7a4a26', '#5e3a20'],
  speckleDark: 'rgba(60, 35, 15, 0.35)', speckleLight: 'rgba(255, 220, 160, 0.18)',
  stone: '#8d7b68', stoneDark: '#6d5f4f', stoneLight: '#a8947f',
  water: '#4fc3f7', waterDeep: '#1e88c7', waterLight: '#b3e5fc',
  grub: '#f5e6c8', grubDark: '#d9c49a', grubEye: '#3a2a1a',
  hud: 'rgba(43, 26, 12, 0.85)', hudLine: 'rgba(255, 220, 160, 0.25)',
  text: '#fff3d6', textDim: '#e8cf9e', textDark: '#4a2f14',
  gold: '#ffd94d', pink: '#f2a7c3', green: '#9ed65a',
};

// Floating score text lives this long; particles fade over their own life.
export const FLOAT_TIME = 1.1;
export const SHAKE_DECAY = 26;

// localStorage key for the best score.
export const BEST_KEY = 'rootbound-best';
