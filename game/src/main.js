// main.js — ROOTBOUND's spine: the game state, the loop, the seasons,
// the win/lose rules, and the wiring between input, roots, pests,
// soil, audio, and the renderer. Everything else is a module it calls.

import {
  W, H, SOIL_TOP, TOOLBAR_Y, SEED,
  SAP_START, SAP_MAX, POCKETS_TOTAL, BLOOM_MAX,
  DRINK_SAP, DRINK_SCORE, FLOWER_SCORE, SQUASH_SCORE, SEASON_SCORE,
  COMBO_WINDOW, COMBO_MAX, SEASON_LEN, SEASON_COUNT, SEASONS,
  DROUGHT_DRAIN, HEART_HP, ROOT_TYPES, BEST_KEY,
} from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { Soil } from './soil.js';
import { Roots } from './roots.js';
import { Pests } from './pests.js';
import { rollChoices, applyUpgrade, growthMultiplier } from './upgrades.js';
import { AudioSys } from './audio.js';
import { Renderer } from './render.js';
import { setupShot } from './shots.js';

const canvas = document.getElementById('game');
const input = new Input(canvas);
const audio = new AudioSys();
const renderer = new Renderer(canvas);
input.attach();

// -- the game state ----------------------------------------------------------
const g = {
  state: 'title',
  prevState: 'playing',
  season: 1,
  seasonTime: SEASON_LEN,
  banner: null,
  sap: SAP_START,
  sapMax: SAP_MAX,
  score: 0,
  best: loadBest(),
  combo: 1,
  comboTimer: 0,
  pocketsDrunk: 0,
  pocketsTotal: POCKETS_TOTAL,
  bloom: 0,
  bloomMax: BLOOM_MAX,
  grubsSquashed: 0,
  elapsed: 0,
  rootType: 'feeder',
  roots: new Roots(),
  soil: null,
  pests: null,
  rng: null,
  flags: { thorn: false, swift: false, secondSeed: false, secondSeedUsed: false, repellent: false },
  owned: new Set(),
  upgradeChoices: [],
  heartHp: HEART_HP,
  heartMax: HEART_HP,
  drawAnchor: null,
  hint: '',
  hintT: 0,
  stats: null,
  stars: 0,
  loseReason: '',
  ui: { buttons: [] },
  audio,
  shotMode: false,
  seed: 1,
};

function loadBest() {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (e) {
    return 0;
  }
}

function saveBest() {
  if (g.score > g.best) {
    g.best = g.score;
    try { localStorage.setItem(BEST_KEY, String(g.best)); } catch (e) {}
  }
}

function setHint(text, seconds = 2.5) {
  g.hint = text;
  g.hintT = seconds;
}

// -- run setup ---------------------------------------------------------------
function newRun(seed) {
  g.seed = seed;
  g.rng = new RNG(seed);
  g.soil = new Soil(seed);
  g.pests = new Pests(new RNG(seed + 77));
  g.roots = new Roots();
  g.season = 1;
  g.seasonTime = SEASON_LEN;
  g.sap = SAP_START;
  g.sapMax = SAP_MAX;
  g.score = 0;
  g.combo = 1;
  g.comboTimer = 0;
  g.pocketsDrunk = 0;
  g.bloom = 0;
  g.grubsSquashed = 0;
  g.elapsed = 0;
  g.rootType = 'feeder';
  g.flags = { thorn: false, swift: false, secondSeed: false, secondSeedUsed: false, repellent: false };
  g.owned = new Set();
  g.upgradeChoices = [];
  g.heartHp = HEART_HP;
  g.heartMax = HEART_HP;
  g.drawAnchor = null;
  g.hint = '';
  g.hintT = 0;
  g.stats = null;
  g.stars = 0;
  g.loseReason = '';
  g.banner = null;
  renderer.particles = [];
  renderer.floaters = [];
  renderer.shake = 0;
  audio.stopDrone();
}

function startGame() {
  newRun((Math.random() * 0xffffffff) >>> 0);
  g.state = 'playing';
  audio.ensure();
  audio.startPad();
  startSeason(1);
  setHint('Draw a root from the seed — drag down into the soil', 4);
}

function startSeason(n) {
  g.season = n;
  g.seasonTime = SEASON_LEN;
  const def = SEASONS[n - 1];
  g.banner = { text: `Season ${n} — ${def.name}`, sub: def.sub, t: 2.8 };
  g.pests.planSeason(def.grubs, g.flags.repellent);
  if (def.event === 'deep') {
    // The last pocket is guarded by two grubs.
    g.pests.placeGuard(g.soil.deepPocket);
    g.pests.placeGuard(g.soil.deepPocket);
  }
  if (def.event === 'drought') audio.startDrone();
  else audio.stopDrone();
}

function endSeason() {
  if (g.season >= SEASON_COUNT) {
    // The year is over: bloom or wither.
    if (g.pocketsDrunk >= POCKETS_TOTAL && g.bloom >= BLOOM_MAX) winGame();
    else loseGame('The seasons ended before the bloom.');
    return;
  }
  g.score += SEASON_SCORE;
  renderer.float(W / 2, 300, `+${SEASON_SCORE} SEASON`, '#ffd94d');
  audio.stopDrone();
  g.upgradeChoices = rollChoices(g.rng, g.owned);
  g.state = 'upgrade';
}

function chooseUpgrade(index) {
  const u = g.upgradeChoices[index];
  if (!u) return;
  g.owned.add(u.id);
  const msg = applyUpgrade(u.id, g);
  audio.click();
  g.state = 'playing';
  startSeason(g.season + 1);
  setHint(msg, 3);
  checkWin();
}

// -- decorative title network ------------------------------------------------
// The title screen shows a grown root network so the game reads at a glance.
// Fixed paths (no RNG): the title always looks the same.
function buildTitleNetwork() {
  newRun(20261117);
  const paths = [
    [{ x: 640, y: 108 }, { x: 620, y: 180 }, { x: 560, y: 250 }, { x: 470, y: 300 }],
    [{ x: 640, y: 108 }, { x: 680, y: 190 }, { x: 760, y: 260 }, { x: 850, y: 300 }, { x: 900, y: 360 }],
    [{ x: 560, y: 250 }, { x: 500, y: 330 }, { x: 430, y: 400 }],
    [{ x: 760, y: 260 }, { x: 800, y: 350 }, { x: 860, y: 430 }],
    [{ x: 640, y: 108 }, { x: 640, y: 200 }, { x: 610, y: 300 }, { x: 640, y: 390 }],
  ];
  const types = ['feeder', 'taproot', 'feeder', 'bloomroot', 'taproot'];
  paths.forEach((path, i) => {
    const root = g.roots.addRoot(types[i], path);
    if (root) {
      root.grown = root.totalLen;
      root.done = true;
      if (types[i] === 'bloomroot') { root.flower = true; root.flowerDone = true; }
    }
  });
  // Two pockets already drunk on the title, for a lived-in look.
  g.soil.pockets[0].drunk = true;
  g.pocketsDrunk = 1;
  g.bloom = 1;
  g.sap = 86;
  g.score = 340;
}

// -- win / lose --------------------------------------------------------------
function checkWin() {
  if (g.state !== 'playing') return;
  if (g.pocketsDrunk >= POCKETS_TOTAL && g.bloom >= BLOOM_MAX) winGame();
}

function winGame() {
  g.state = 'win';
  saveBest();
  audio.stopDrone();
  audio.bloom();
  const t = g.elapsed;
  g.stars = g.score >= 2600 && t <= 320 ? 3 : g.score >= 1600 ? 2 : 1;
  g.stats = {
    score: g.score,
    pockets: g.pocketsDrunk,
    squashed: g.grubsSquashed,
    flowers: g.roots.flowerCount(),
    time: t,
    season: g.season,
  };
  // Petals rain over the blooming tree.
  for (let i = 0; i < 5; i++) {
    renderer.petals(480 + i * 80, 120 + (i % 2) * 40, 8);
  }
}

function loseGame(reason) {
  // The Second Seed gives one more chance.
  if (g.flags.secondSeed && !g.flags.secondSeedUsed) {
    g.flags.secondSeedUsed = true;
    g.sap = Math.max(g.sap, 50);
    g.heartHp = g.heartMax;
    g.banner = { text: 'The Second Seed sprouts!', sub: 'A second chance — spend it well', t: 2.8 };
    audio.bloom();
    renderer.petals(SEED.x, SEED.y, 20);
    return;
  }
  g.state = 'lose';
  g.loseReason = reason;
  saveBest();
  audio.stopDrone();
  audio.wither();
  g.stats = {
    score: g.score,
    pockets: g.pocketsDrunk,
    squashed: g.grubsSquashed,
    flowers: g.roots.flowerCount(),
    time: g.elapsed,
    season: g.season,
  };
}

// -- per-frame update --------------------------------------------------------
function update(dt) {
  g.elapsed += dt;
  g.seasonTime -= dt;
  if (g.banner) {
    g.banner.t -= dt;
    if (g.banner.t <= 0) g.banner = null;
  }
  if (g.hintT > 0) g.hintT -= dt;
  if (g.comboTimer > 0) {
    g.comboTimer -= dt;
    if (g.comboTimer <= 0) g.combo = 1;
  }

  const seasonDef = SEASONS[g.season - 1];
  // Drought drains sap over time.
  if (seasonDef.event === 'drought') {
    g.sap -= DROUGHT_DRAIN * dt;
  }

  // Grow roots, then handle what happened.
  const events = [];
  const mult = growthMultiplier(g, seasonDef.event);
  g.roots.update(dt, mult, g.soil, events);
  for (const ev of events) handleRootEvent(ev);

  // Move grubs, then handle bites.
  const pestEvents = [];
  g.pests.update(dt, g.roots, g.flags, pestEvents);
  for (const ev of pestEvents) handlePestEvent(ev);

  if (g.state !== 'playing') return;

  // Sap ran dry with nothing left growing that could drink.
  if (g.sap <= 0) {
    const growing = g.roots.list.some((r) => r.alive && !r.done && !r.blocked);
    if (!growing) {
      g.sap = 0;
      loseGame('The sap ran dry.');
      return;
    }
    g.sap = 0;
  }

  if (g.seasonTime <= 0) endSeason();
}

function handleRootEvent(ev) {
  if (ev.kind === 'drink') {
    const p = ev.pocket;
    p.drunk = true;
    const mult = ROOT_TYPES[ev.root.type].drink;
    g.pocketsDrunk++;
    g.bloom = Math.min(g.bloomMax, g.bloom + mult);
    g.sap = Math.min(g.sapMax, g.sap + DRINK_SAP * mult);
    const gain = DRINK_SCORE * g.combo;
    g.score += gain;
    g.combo = Math.min(COMBO_MAX, g.combo + 1);
    g.comboTimer = COMBO_WINDOW;
    audio.chime();
    renderer.burst(p.x, p.y, 22, '#7fd4ff', 110, 0.8, 3.5);
    renderer.burst(p.x, p.y, 10, '#b3e5fc', 60, 0.6, 2.5);
    renderer.float(p.x, p.y - 30, `+${gain}`, '#b3e5fc');
    checkWin();
  } else if (ev.kind === 'stone') {
    audio.crack();
    const tip = g.roots.tip(ev.root);
    renderer.burst(tip.x, tip.y, 16, '#a8947f', 100, 0.6, 3);
    renderer.float(tip.x, tip.y - 20, 'CRACK!', '#ffd94d');
    renderer.addShake(3);
  } else if (ev.kind === 'flower') {
    const tip = g.roots.tip(ev.root);
    const gain = FLOWER_SCORE * g.combo;
    g.score += gain;
    g.combo = Math.min(COMBO_MAX, g.combo + 1);
    g.comboTimer = COMBO_WINDOW;
    audio.flower();
    renderer.petals(tip.x, tip.y, 10);
    renderer.float(tip.x, tip.y - 24, `+${gain} FLOWER`, COLORS_PINK);
  } else if (ev.kind === 'rootDied') {
    const tip = g.roots.tip(ev.root);
    renderer.burst(tip.x, tip.y, 10, '#8a7a5a', 70, 0.5, 3);
  }
}

const COLORS_PINK = '#f2a7c3';

function handlePestEvent(ev) {
  if (ev.kind === 'bite') {
    audio.bite();
    renderer.addShake(5);
    renderer.burst(ev.grub.x, ev.grub.y, 6, '#8a7a5a', 60, 0.4, 2.5);
  } else if (ev.kind === 'heartBite') {
    g.heartHp--;
    audio.bite();
    renderer.addShake(9);
    renderer.burst(SEED.x, SEED.y, 12, '#ff8a7a', 90, 0.6, 3);
    renderer.float(SEED.x, SEED.y - 34, 'THE HEART IS BITTEN!', '#ff8a7a');
    if (g.heartHp <= 0) loseGame('The heart-root was eaten.');
  } else if (ev.kind === 'grubDied' && ev.why === 'thorn') {
    g.grubsSquashed++;
    g.score += SQUASH_SCORE;
    renderer.float(ev.grub.x, ev.grub.y - 20, `+${SQUASH_SCORE} THORNS`, '#b7ec6d');
  }
}

// -- input handling ----------------------------------------------------------
let prevDown = false;

function handleInput() {
  const { clicks, keys } = input.poll();

  for (const key of keys) handleKey(key);

  // Pointer press / release transitions (drawing).
  if (input.down && !prevDown) onPress();
  if (!input.down && prevDown) onRelease();
  prevDown = input.down;

  for (const c of clicks) handleClick(c.x, c.y);
}

function onPress() {
  if (g.state !== 'playing') return;
  const { x, y } = input.mouse;
  if (y < SOIL_TOP || y > TOOLBAR_Y) return; // HUD or toolbar: not soil
  // Anchor the draw to the seed or to a grown root.
  if (Math.hypot(x - SEED.x, y - SEED.y) <= 46) {
    g.drawAnchor = { x: SEED.x, y: SEED.y + 4 };
    return;
  }
  const hit = g.roots.rootAt(x, y, 22);
  if (hit) {
    g.drawAnchor = Roots.pointAt(hit.root, hit.along);
    return;
  }
  g.drawAnchor = null;
  setHint('Draw from the seed or a grown root');
  audio.error();
}

function onRelease() {
  if (!g.drawAnchor) return;
  const anchor = g.drawAnchor;
  g.drawAnchor = null;
  if (g.state !== 'playing') return;
  const raw = input.currentPath();
  if (raw.length < 2) return;
  const path = [anchor, ...raw.slice(1)];
  const len = Roots.pathLength(path);
  if (len < 14) return; // a tap, not a draw
  const cost = Roots.costOf(g.rootType, len);
  if (cost > g.sap) {
    setHint('Not enough sap — drink from a pocket first');
    audio.error();
    return;
  }
  g.sap -= cost;
  const root = g.roots.addRoot(g.rootType, path);
  if (root) {
    audio.click();
    renderer.burst(anchor.x, anchor.y, 5, '#a5713a', 50, 0.4, 2.5);
  }
}

function handleClick(x, y) {
  // Buttons first (toolbar, menus, screens).
  for (const b of g.ui.buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      handleButton(b.id);
      return;
    }
  }
  if (g.state === 'title') {
    startGame();
    return;
  }
  if (g.state !== 'playing') return;
  // Squash a grub.
  const grub = g.pests.squashAt(x, y);
  if (grub) {
    g.grubsSquashed++;
    const gain = SQUASH_SCORE * g.combo;
    g.score += gain;
    audio.thud();
    renderer.burst(x, y, 12, '#f5e6c8', 90, 0.5, 3);
    renderer.float(x, y - 20, `+${gain}`, '#f5e6c8');
    renderer.addShake(2);
  }
}

function handleButton(id) {
  audio.ensure();
  if (id === 'begin') { startGame(); return; }
  if (id === 'again') { startGame(); return; }
  if (id === 'resume') { g.state = 'playing'; audio.click(); return; }
  if (id === 'restart') { startGame(); return; }
  if (id === 'howto') { g.prevState = g.state; g.state = 'howto'; audio.click(); return; }
  if (id === 'back') { g.state = g.prevState === 'howto' ? 'paused' : g.prevState; audio.click(); return; }
  if (id.startsWith('root-')) {
    g.rootType = id.slice(5);
    audio.click();
    return;
  }
  if (id.startsWith('upgrade-')) {
    chooseUpgrade(parseInt(id.slice(8), 10));
  }
}

function handleKey(key) {
  if (key === 'm') {
    audio.setMuted(!audio.muted);
    setHint(audio.muted ? 'Sound muted' : 'Sound on', 1.5);
    return;
  }
  if (g.state === 'title') {
    if (key === ' ' || key === 'enter') startGame();
    return;
  }
  if (g.state === 'win' || g.state === 'lose') {
    if (key === 'r') startGame();
    return;
  }
  if (g.state === 'howto') {
    if (key === 'escape' || key === ' ') g.state = g.prevState;
    return;
  }
  if (g.state === 'paused') {
    if (key === ' ' || key === 'escape') g.state = 'playing';
    else if (key === 'r') startGame();
    return;
  }
  if (g.state === 'upgrade') {
    if (key === '1' || key === '2' || key === '3') {
      chooseUpgrade(parseInt(key, 10) - 1);
    }
    return;
  }
  // Playing.
  if (key === '1') g.rootType = 'feeder';
  else if (key === '2') g.rootType = 'taproot';
  else if (key === '3') g.rootType = 'bloomroot';
  else if (key === ' ') { g.state = 'paused'; audio.click(); }
  else if (key === 'r') startGame();
  else if (key === 'escape') { g.state = 'paused'; audio.click(); }
}

// -- the loop ----------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  handleInput();
  if (g.state === 'playing') update(dt);
  renderer.render(g, input, dt);
  requestAnimationFrame(frame);
}

// -- boot --------------------------------------------------------------------
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  g.shotMode = true;
  const seed = parseInt(params.get('seed') || '7', 10) || 7;
  newRun(seed);
  setupShot(g, shot, seed, renderer, input);
  window.__shotReady = true;
} else {
  buildTitleNetwork();
  g.state = 'title';
}
window.__game = g;
requestAnimationFrame(frame);
