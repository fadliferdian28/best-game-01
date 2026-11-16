# ROOTBOUND — grow the last Worldroot

You are the Worldroot's last seed. Draw roots through a warm soil
cross-section with the mouse, drink from 7 water pockets, and bloom —
while grubs eat your roots, drought drains your sap, and frost slows
your growth. Survive 7 seasons, or wither.

Three root types (keys 1/2/3): a fast cheap Feeder, a slow deep Taproot
that drinks double and breaks soft stone, and a Bloomroot that grows a
flower and raises your combo. Click a grown root to fork a branch from
it; click a grub to squash it. Between seasons, pick 1 of 3 upgrades.

Plain JavaScript ES modules, 2D canvas, no engine, no libraries, no
network, no assets — every pixel drawn in code, every sound synthesized
with WebAudio.

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/fadliferdian28/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/fadliferdian28/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

## Play

Serve the `game/` folder and open `index.html` in a desktop browser:

```
cd game && python3 -m http.server 8080
```

Mouse draws roots, clicks grubs and buttons. `1/2/3` root type,
`Space` pause, `R` restart, `M` mute, `Esc` menu.

## Screenshots

Deterministic scenes for the four screenshots, driven by URL parameters
(seedable, no wall clock):

```
?shot=start&seed=7   title screen (cover)
?shot=play&seed=7    mid-game
?shot=win&seed=7     victory
?shot=lose&seed=7    defeat
```

## Layout

- `game/index.html` — the shell (1280×720 canvas)
- `game/src/main.js` — loop, states, seasons, win/lose
- `game/src/config.js` — balance numbers
- `game/src/random.js` — seeded RNG
- `game/src/input.js` — mouse and keys
- `game/src/soil.js` — strata, pockets, stones
- `game/src/roots.js` — growth, types, branching
- `game/src/pests.js` — grubs, drought, frost
- `game/src/upgrades.js` — season choices
- `game/src/audio.js` — WebAudio synth
- `game/src/render.js` — soil, glow, particles, HUD, screens
- `game/src/shots.js` — deterministic screenshot scenes
- `main.ts` — the entry program (copies `game/` + `screenshots/`,
  writes `dossier.json` via `vendor/makefun-game.ts`)

## License

MIT.
