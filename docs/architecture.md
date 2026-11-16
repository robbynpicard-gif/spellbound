# Spellbound — Architecture

_Last updated: 2026-11-16 (Milestone 0)_

This document describes how the code is organised and the rules that keep it
maintainable. The Game Design Document (`docs/GDD.md`) says **what** the game
does. This file says **how** the code is laid out to do it.

## 1. Big picture: two layers

```
┌───────────────────────────────────────────────────────────────┐
│  PRESENTATION (browser only, uses Phaser + DOM)                │
│  scenes/  render/  ui/  styles/                                │
│  • draws words, effects, HUD, menus                            │
│  • turns keyboard/mouse into input commands                    │
└───────────────▲───────────────────────────────┬───────────────┘
                │ events (EventBus)             │ commands (typed chars, cast spell…)
┌───────────────┴───────────────────────────────▼───────────────┐
│  SIMULATION (pure TypeScript, NO Phaser, NO DOM)               │
│  core/  gameplay/  difficulty/  spells/  modifiers/  modes/    │
│  • word spawning, movement, targeting, scoring, instability    │
│  • seeded randomness, fixed time-step                          │
│  • runs in the browser, in unit tests, and on the server       │
└───────────────────────────────────────────────────────────────┘
```

**The single most important rule:** files in the simulation layer must never
import `phaser` or touch `window`/`document`. That lets the exact same rules
run:

- in the browser for single-player,
- in Vitest unit tests (fast, no browser needed),
- on the multiplayer server, which re-runs a match from its seed and the
  players' inputs to validate the result.

## 2. Folder layout

| Folder | Layer | Contents |
|---|---|---|
| `src/core/` | Simulation | Game-wide constants, `EventBus`, `SeededRandom`, later `GameState`/`GameEngine` |
| `src/gameplay/` | Simulation | Words, word generation, targeting, input rules, scoring, instability, spell/modifier managers |
| `src/difficulty/` | Simulation | `DifficultyConfig` type, level definitions, level manager |
| `src/spells/` | Simulation | One file per spell, plus the spell registry |
| `src/modifiers/` | Simulation | One file per word modifier, plus the modifier registry |
| `src/modes/` | Simulation | Campaign, Practice, Duel, Co-op rules (all consume `DifficultyConfig`) |
| `src/data/` | Data | Word lists, level tables, spell data (JSON) |
| `src/render/` | Presentation | Phaser display objects for words, effects, particles _(added vs. GDD — see decisions.md D-003)_ |
| `src/scenes/` | Presentation | Phaser scenes: Boot, MainMenu, Game, PracticeSetup, Results |
| `src/ui/` | Presentation | HUD, menus, panels |
| `src/multiplayer/` | Presentation/IO | WebSocket client, room and match sync |
| `src/storage/` | IO | Local save data and statistics (localStorage) |
| `src/styles/` | Presentation | CSS |
| `server/` | Server | Node.js WebSocket server (Milestone 5) |
| `tests/` | — | Vitest unit tests for simulation code |
| `public/assets/` | — | Original art, audio and fonts (served as-is) |
| `docs/` | — | Design, architecture, research, decisions, log |

Empty folders hold a `.gitkeep` file so Git tracks them; delete it once real
files arrive.

## 3. Key mechanisms

### 3.1 Fixed time-step simulation
The simulation advances in fixed ticks (`SIMULATION_HZ = 60` in
`core/GameConfig.ts`). The Phaser scene accumulates real frame time and calls
`engine.step()` as many times as needed. Rendering interpolates between ticks.
Because every tick is the same length, a replay of the same inputs on the same
seed gives the same result on any machine.

### 3.2 Seeded randomness
All gameplay randomness goes through `core/Random.ts` (`SeededRandom`).
`Math.random()` is only used to create a brand-new seed.

### 3.3 Events out, commands in
The simulation emits events (`wordSpawned`, `wordCompleted`, `wordMissed`,
`instabilityChanged`, `spellCast`, `gameOver`…) on a typed `EventBus`. The
presentation layer listens and animates. Input goes the other way as small
commands (`typeChar('e')`, `castSpell('fire')`, `selectTarget(id)`), each
stamped with the tick it happened on. In multiplayer only these commands are
sent — not raw keystrokes or rendered state.

### 3.4 Data-driven difficulty, spells and modifiers
- One `DifficultyConfig` per level; Campaign, Practice and multiplayer all read
  the same objects. Practice never applies its own multiplier.
- Spells and modifiers register themselves in central registries, so adding
  one means adding a file + data entry, not editing the engine.

### 3.5 Menus
The GDD lists both HTML/CSS and Phaser scenes for UI. Current proposal (to be
confirmed before Milestone 2 — see decisions.md D-008): the playing field and
in-game HUD are drawn in Phaser; full-screen menus that need text entry
(room codes, settings) may use DOM elements over the canvas.

## 4. Tooling

| Tool | Version | Why |
|---|---|---|
| Node.js | 24.x (needs ≥ 20.19) | Runs the dev tools and later the server |
| Phaser | 3.90.0 (exact) | 2D rendering, scenes, tweens, input |
| TypeScript | 5.9.3 (exact) | Type checking |
| Vite | 8.3.8 (exact) | Dev server and production build |
| Vitest | 5.1.0 (exact) | Unit tests; shares Vite's config |

Versions are pinned exactly in `package.json` (and locked in
`package-lock.json`) so every machine installs the same thing.

## 5. Build and deploy
- `npm run build` → static files in `dist/`.
- `vite.config.ts` uses `base: './'`, so `dist/` works from a GitHub Pages
  sub-path without changes.
- The multiplayer server will be deployed separately (Milestone 7).
