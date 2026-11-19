# Wizzy Type — Spellbound

A browser-based fantasy typing game. Capture falling words before they reach your ward, use limited spell charges tactically, and master increasingly demanding stages.

**[Play the current build](https://robbynpicard-gif.github.io/spellbound/)**

## Current game

- **Normal and Hardcore:** five stages per mode, twenty levels per stage. Levels 1–19 have word quotas; level 20 is a timed boss.
- **Controls:** type a word and press Enter to capture it. Backspace edits; Ctrl+Backspace or Delete clears the console; Esc pauses. Normal supports number-key spell casting using a customizable Spellbook; Hardcore uses typed spell names.
- **Spells:** Slow, Ice, Barrier, Shock, Alter, Fire, Wind, and Harvest. Charges share a pool, with capacity increasing through clean captures.
- **Progression:** stages unlock in order. Campaign runs can be saved and continued between levels; the game records stage results and practice bests.
- **Endless:** defeating a boss offers in-place continuation, retaining the live battlefield and active effects. Endless has an escalating difficulty floor and a repeating intensity wave. Separate Endless Practice is also available.
- **Scoring:** combo, Clean Streak, Volley, and contextual word/level bonuses reward accuracy, speed, and skill.
- **Multiplayer:** groundwork exists, but the online duel server is not publicly hosted.

For **exact current values, spell effects, bonuses, and controls**, use the in-game **Codex** and **Spellbook**, whose mechanics are sourced from the game implementation. The generated reference is [docs/mechanics.md](docs/mechanics.md); regenerate it when mechanics change.

## Local development

Requires Node.js 20.19+ and npm.

```bash
npm ci
npm run dev
npm run check
```

- `npm run dev`: local Vite development server.
- `npm run check`: TypeScript checks, Vitest tests, and production build.
- `npm run build`: typecheck and production build.
- `npm run server`: local multiplayer server (not publicly deployed).

Stack: TypeScript, Phaser 3, Vite, Vitest, and a separate WebSocket server.

## Documentation: what to trust

1. **Running code and tests** define implemented behaviour; the in-game Codex reflects current mechanics.
2. [docs/decisions.md](docs/decisions.md) is a **chronological decision history**. Later accepted decisions supersede earlier ones; old entries are intentionally retained for traceability.
3. [docs/development-log.md](docs/development-log.md) is historical, not a current feature specification.
4. [docs/GDD.md](docs/GDD.md) is the **original pre-development concept**, not an authoritative current specification. Historical plans in `docs/plans/` may be superseded.

New gameplay ideas, including medals, Triumphs, grammar-based feats, and elemental interactions, remain proposals until approved and implemented. Do not infer approval from old plans.

## Release safety

- `.github/workflows/dev-check.yml` validates pull requests and development branches without deploying.
- `.github/workflows/deploy.yml` runs `npm run check` and publishes GitHub Pages on pushes to `main`.
- **Do not merge changes into `main` or deploy without the project owner's approval.** Keep the existing playable release intact during development.
