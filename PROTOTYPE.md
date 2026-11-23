> **Document status: HISTORICAL** (classified 2026-11-22, D-104). Kept for context; not a current requirement. The standalone prototype.html slice was superseded by the integrated prototype (D-085). Where it conflicts with `docs/decisions.md` or a current document in the [docs index](docs/README.md), those win.

# TypeL — apprenticeship vertical slice (development branch)

This branch is isolated from `main`. The prototype is a standalone playable page at `prototype.html` so it does not modify the existing Phaser game, menus, artwork, or production deployment.

## Run locally
```sh
npm ci
npm run dev
```
Open `http://localhost:5173/prototype.html`.

## Prototype features
- Guided introductory apprenticeship: Fundamentals → Pressure → Fire → First Examination.
- Typing words before they breach the ward; errors, streaks, accuracy, and score.
- A simple Fire spell, earned through typing highlighted scrolls, with a limited charge count.
- Normal and Hardcore pace presets.
- Endless unlocks after passing the examination, with wave speed and density tuning.
- The Endless modifier for Fire unlocks only after its campaign introduction.
- Progress saved in a separate localStorage namespace, leaving existing game saves untouched.
- Existing production art and game code remain unchanged.

## Deliberately out of scope
This is a mechanics-only vertical slice, not the full game implementation. It does not yet integrate the Phaser renderer, original artwork, voice announcer, Runes, lightning, grammar chains, or final campaign persistence. The live GitHub Pages deployment continues to publish `main`; this branch does not claim a public preview URL.
