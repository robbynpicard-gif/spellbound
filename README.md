# Spellbound

A wizard-themed arcade typing game for the browser. Words fall toward your
tower; type them to cast counterspells before they land.

> **Status:** Milestone 4 — Campaign (a single run through 10 levels, four
> spells) and Endless Practice. Multiplayer comes in Milestone 5.

### Endless Practice

Pick any level you've reached in Campaign and play it at exactly that
level's difficulty, forever. Choose **Spell tomes** (as in Campaign) or
**Pure typing**. Press Esc → "End session" whenever you like; your personal
bests are kept per level, separately from Campaign.

## How to play

Choose **Campaign**. A run always starts at level 1 and continues level by
level until the wards fall or you clear all 10. Type the falling words before
they reach the glowing ward line. Fill the **Level Progress** bar to clear a
level; don't let **Ward Instability** reach 100%.

Everything you type appears in the **typing console** at the bottom. Type a
falling word and press **Enter** to destroy it. Capitals don't matter.

Words with a small coloured book are **spell tomes** — complete one to gain a
charge (up to 3 of each). Charges carry through the whole run. To cast, type
the spell's name and press **Enter**.

| Key | Action |
|---|---|
| Letters | Type into the console |
| Backspace | Delete one letter |
| Ctrl+Backspace or Delete | Clear the console |
| Enter | Destroy the word you typed, or cast the spell you typed. If it's unfinished or misspelled, that word speeds up instead |
| Mouse click | Aim at one specific word |
| Esc | Pause / resume |

| Type + Enter | Spell |
|---|---|
| `fire` | Incineration — burn every word on the field |
| `ice` | Frostbinding — freeze everything for 5 s |
| `slow` | Temporal Distortion — half speed for 8 s |
| `wind` | Arcane Purge — instability back to 0% |

A wrong letter makes the word you were typing fall faster and breaks your combo.

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

## Tech stack

TypeScript 5.9 · Phaser 3.90 · Vite 8 · Vitest 5. Exact versions are pinned in
`package.json`.
