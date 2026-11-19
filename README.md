# 🧙 Wizzy Type

A wizard-themed arcade typing game for the browser. Words fall toward your
tower; type them to cast counterspells before they land.

**▶ Play it:** https://robbynpicard-gif.github.io/spellbound/

The live site is published from `main`. The current development branch is
`design/nov-18-playtest-handoff`, published at
https://robbynpicard-gif.github.io/spellbound/preview/ when deployment succeeds.

**Current approved gameplay:** [docs/current-game-model.md](docs/current-game-model.md).
Older GDD and decision entries preserve design history; the current-game-model
file identifies which later decisions supersede prototype descriptions.

### Campaign

Normal and Hardcore each have five stages of twenty levels. Levels 1–19 are
quota levels; level 20 is a timed boss. Survive the boss to choose whether to
continue the exact frozen battlefield into escalating Endless mode.
Normal supports spell quick-cast with number keys 1–8; Hardcore requires typed
spell names. Spell charges, score and relevant run state carry forward.

### Practice and multiplayer

Practice lets you train on unlocked levels. The multiplayer server code exists,
but public online duels are not hosted yet.

## How to play

Type the falling words before they reach the glowing ward line. Fill the
**Level Progress** bar to clear a level (or, on a boss, last until the timer
runs out); don't let **Ward Instability** reach 100%.

Everything you type appears in the **typing console** at the bottom. Type a
falling word and press **Enter** to destroy it. Capitals don't matter.

Words with a small coloured marker are **spell scrolls** — type one to gain a
charge of that spell. All spells share **one pool of 8 charges**; rarer,
stronger spells drop less often. Charges carry through the whole run. To
cast, type the spell's word and press **Enter**. New spells are introduced
one at a time, with a pop-up the first level they can appear.

| Key | Action |
|---|---|
| Letters | Type into the console |
| Backspace | Delete one letter |
| Ctrl+Backspace or Delete | Clear the console |
| Enter | Destroy the word you typed, or cast the spell you typed. If it's unfinished or misspelled, that word speeds up instead |
| Mouse click | Aim at one specific word |
| Esc | Pause / resume |

| Type + Enter | Spell | Unlocked | What it does |
|---|---|---|---|
| `slow` | Temporal Distortion | Level 3 | Words fall at ×0.6 for 8 s. Casts stack: each has its own timer and makes words slower still |
| `ice` | Frostbinding | Level 6 | Freezes everything and stops new words for 5 s; each extra cast adds 5 s |
| `barrier` | Arcane Shield | Level 8 | The next 2 words that reach the ward line do no harm (+2 per cast) |
| `shock` | Chain Lightning | Level 11 | Destroys the lowest word and the 3 nearest it — they score and count |
| `alter` | Transmutation | Level 13 | Every word of 6+ letters becomes a short 3–4 letter word |
| `fire` | Incineration | Level 1 | Last resort: burns every word, for no points and no progress |
| `wind` | Arcane Purge | Level 16 | Instability back to 0% (Hardcore: halved); removes mistake speed-ups |
| `harvest` | Harvest | Level 18 | Claims every word on the field toward the level, at half points |

A wrong letter makes the word you were typing fall faster and breaks your combo.

## Art

Gritty 16-bit pixel art, drawn in code: `tools/pixelart/` (Python + Pillow)
generates the backdrops and icons in `public/assets/`. After changing it, run
`python3 tools/pixelart/build.py` and commit the PNGs. See decisions.md D-028.

## What you need

- **Node.js 20.19 or newer** (developed with Node 24). Check with `node --version`.
- **npm** (comes with Node).
- **Git**.

## First-time setup

From the project folder, install the packages listed in `package.json`:

```bash
npm install
```

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Starts a local server at http://localhost:5173 that reloads when you save a file. Press `Ctrl+C` to stop it. |
| `npm run typecheck` | Checks the TypeScript code for type errors without running it. |
| `npm test` | Runs the automated tests once. |
| `npm run test:watch` | Re-runs tests every time you save. |
| `npm run build` | Typechecks, then builds the optimised game into `dist/`. |
| `npm run preview` | Serves the built `dist/` folder to test the production build. |
| `npm run check` | Typecheck + tests + build in one go. Run before every commit. |

## Project layout (short version)

```
src/core/       game-wide constants, events, seeded randomness
src/gameplay/   falling words, typing, scoring, instability   (Milestone 1)
src/difficulty/ level configurations                           (Milestone 2)
src/spells/     Fire, Ice, Slow, Wind, …                       (Milestone 3)
src/scenes/     Phaser screens (boot, menu, game, results)
src/render/     Phaser drawing code for words and effects
server/         multiplayer server                             (Milestone 5)
tests/          automated tests
docs/           design and technical documents
```

Full details: [`docs/architecture.md`](docs/architecture.md).

## Documentation

- [`docs/GDD.md`](docs/GDD.md) — Game Design Document (the source of truth for features)
- [`docs/architecture.md`](docs/architecture.md) — how the code is organised
- [`docs/decisions.md`](docs/decisions.md) — why things are built the way they are
- [`docs/original-game-research.md`](docs/original-game-research.md) — notes on the original game's mechanics
- [`docs/development-log.md`](docs/development-log.md) — what was done, when
- [`docs/plans/`](docs/plans/) — draft plans for upcoming work (not yet built)

## Tech stack

TypeScript 5.9 · Phaser 3.90 · Vite 8 · Vitest 5. Exact versions are pinned in
`package.json`.
