> **Document status: HISTORICAL** (classified 2026-11-22, D-104). Kept for context; not a current requirement. Milestone 4 architecture. Its core rules (D-003 to D-005) still hold; for current files see docs/system-map.md. Where it conflicts with `docs/decisions.md` or a current document in the [docs index](README.md), those win.

# TypeL — Architecture

_Last updated: 2026-11-16 (Milestone 4 — Endless Practice, see decisions D-023)_

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

### 3.5 Menus and app flow (Milestone 2)
The playing field and in-game HUD are drawn in Phaser. All menus are HTML
over the canvas (decisions.md D-008):

```
main.ts ─▶ App (src/app/App.ts) ─┬─▶ UIRoot shows one HTML Screen (src/ui/screens.ts)
                                 ├─▶ Phaser: BackdropScene (menus) or GameScene (play)
                                 └─▶ SaveManager ◀─ CampaignMode rules
GameScene ── hooks.onPauseChanged / hooks.onGameOver ──▶ App
```

Flow (Milestone 3, D-016): Main menu → Campaign run: Level 1 → "Level
Cleared" → Level 2 → … → Run over (New run / Main menu). The App holds the
`CampaignRun` (score and spell charges carried between levels) and passes
`initialSpells` / `scoreOffset` into each GameScene. Esc pauses; the pause
screen is HTML, but the scene owns the pause state.

### 3.7 Spells (Milestone 3, D-017)

```
data/spells.json ─▶ spells/SpellRegistry.ts (SPELLS: data + effect per id)
console "fire" + Enter ─▶ submit command ─▶ SPELLS[id].cast(SpellContext)
SpellContext = burnAllWords · freeze · slow · resetInstability · resetWordSpeeds
```

Spells only act through `SpellContext`, so adding a spell means a data entry,
an id in `gameplay/SpellManager.ts` and an effect in the registry — no engine
edits unless it needs a new kind of effect. `render/SpellEffects.ts` draws
them; `ui/GameHUD.ts` shows slots, progress and instability.

| File | Responsibility |
|---|---|
| `app/App.ts` | Screen flow; starts/stops scenes; records results |
| `ui/UIRoot.ts`, `ui/dom.ts`, `ui/screens.ts` | HTML layer, element helper, all menu screens |
| `styles/menu.css` | Menu styling (responsive, visible focus rings, reduced-motion aware) |
| `data/levels.json` | 10 campaign levels |
| `difficulty/LevelManager.ts` | Level lookup; `CAMPAIGN_LEVELS` in `LevelDefinitions.ts` |
| `modes/CampaignMode.ts` | Unlock and personal-best rules (pure) |
| `storage/SaveManager.ts` | Versioned localStorage save, tolerant loading |
| `scenes/BackdropScene.ts` | Animated sky behind menus |

### 3.6 What exists so far (Milestone 1)

```
GameScene (Phaser)                         GameEngine (pure TS)
 ├─ keyboard/mouse ── typeChar / abandon / selectTarget ──▶ records Command, applies rules
 ├─ update(): fixed-step loop ── step() ──▶ move words, detect misses, spawn
 ├─ WordView per word   ◀── wordSpawned / wordProgress / wordCompleted / wordMissed
 ├─ Effects, FieldBackground ◀── typingError / instabilityChanged
 ├─ GameHUD             ◀── stats() each frame, instabilityChanged
 └─ OverlayPanel        ◀── gameOver (and pause)
```

| File | Responsibility |
|---|---|
| `core/GameEngine.ts` | Orchestrates one player's game; command log; `replay()` |
| `core/GameState.ts` | Serialisable state shape and initial values |
| `core/GameEvents.ts` | Typed event list |
| `gameplay/Word.ts` | Word data shape |
| `gameplay/WordGenerator.ts` | Seeded word choice by length weights, avoids duplicate text / first letters |
| `gameplay/TargetManager.ts` | Auto-target rule |
| `gameplay/ScoringSystem.ts` | Points, combo bonus, accuracy, WPM, `GameStats` |
| `gameplay/InstabilityManager.ts` | 0–100 meter and visual stages |
| `difficulty/DifficultyConfig.ts`, `LevelDefinitions.ts` | Level parameters (one prototype level for now) |
| `data/words.json`, `wordList.ts` | The one dictionary (D-036); cast words are kept out |
| `render/WordView.ts`, `Effects.ts`, `FieldBackground.ts`, `layout.ts` | Drawing |
| `ui/GameHUD.ts`, `OverlayPanel.ts` | HUD, pause and end panels |

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
