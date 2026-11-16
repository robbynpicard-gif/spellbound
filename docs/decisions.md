# Spellbound — Decision Record

Each entry records a technical or design decision, why it was made, and its
status. New decisions go at the bottom. Change a decision by adding a new entry
that supersedes the old one; don't rewrite history.

Status values: **Accepted**, **Proposed** (awaiting project owner), **Superseded**.

---

### D-001 — Phaser 3.90.0 rather than Phaser 4
_2026-11-16 · Accepted_

Phaser 4 is now the newest major version, but the GDD specifies Phaser 3.
3.90.0 is the final, stable Phaser 3 release with the largest body of
documentation, examples and community answers, which matters for a project
owner who is not a full-time programmer. Revisit only if a Phaser 4 feature
becomes necessary.

### D-002 — TypeScript 5.9, Vite 8, Vitest 5, exact version pins
_2026-11-16 · Accepted_

TypeScript 7 (the new native compiler) exists but is very new; 5.9.3 is the
mature, widely supported line. Vite 8 has been stable since March 2026.
Vitest is added for automated tests (GDD Rule 8) and reuses Vite's config, so
it adds no extra build setup. Versions are pinned exactly for reproducibility.

### D-003 — Split simulation from presentation; add `src/render/`
_2026-11-16 · Accepted_

Change from the GDD's proposed tree: a new `src/render/` folder holds Phaser
display code, and `core/ gameplay/ difficulty/ spells/ modifiers/ modes/` must
not import Phaser or the DOM.

Why: GDD §6 requires that the server validate word generation, scoring and
spell use. The cleanest way is for the server to run the very same rule code.
That is only possible if the rules don't depend on a browser. It also makes
the rules unit-testable in milliseconds.

### D-004 — Fixed 60 Hz simulation tick
_2026-11-16 · Accepted_

Gameplay advances in fixed steps independent of screen refresh rate. Needed
for deterministic replays and multiplayer validation; also makes fall speeds
consistent on 60 Hz and 144 Hz monitors.

### D-005 — Seeded random number generator (Mulberry32)
_2026-11-16 · Accepted_

`src/core/Random.ts`. Small, fast, good enough statistical quality for a game,
and its whole state is a single 32-bit number, which is easy to send over the
network or save.

### D-006 — `base: './'` in Vite config
_2026-11-16 · Accepted_

Makes the production build work from any sub-path (GitHub Pages serves
project sites from `/<repo-name>/`).

### D-007 — No server dependencies until Milestone 5
_2026-11-16 · Accepted_

`server/` exists but has no code or packages yet. The WebSocket library choice
(likely `ws`) will be made and justified at the start of Milestone 5, along
with how the server shares code from `src/` (likely an npm workspace).

### D-008 — Where menus live (Phaser vs. HTML/CSS)
_2026-11-16 · Proposed — needs owner input before Milestone 2_

Option A: everything in Phaser (one rendering system, consistent look; text
fields like room codes are more work).
Option B: playing field + HUD in Phaser, menus and settings as HTML/CSS
overlays (easier forms and accessibility; two styling systems).
Recommendation: **B**. Not needed for Milestone 1, which only has a playing
field and HUD.

### D-009 — Original game is a mechanics reference only
_2026-11-16 · Accepted_

Research into the archived Typing Maniac SWF is limited to understanding
gameplay rules (speeds, penalties, spell effects). No art, audio, text,
branding or code from it is copied into Spellbound. See
`docs/original-game-research.md`.
