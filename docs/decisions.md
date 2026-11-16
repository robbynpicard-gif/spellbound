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
_2026-11-16 · **Accepted: Option B** (project owner, before Milestone 2)_

Implemented in Milestone 2: `src/ui/UIRoot.ts` + `src/ui/screens.ts` render
the main menu, level select, pause, results and credits as HTML over the
canvas; `src/app/App.ts` switches between them and the Phaser scenes. The
Phaser `MainMenuScene` was replaced by `BackdropScene` (animated sky only).

Option A: everything in Phaser (one rendering system, consistent look; text
fields like room codes are more work).
Option B: playing field + HUD in Phaser, menus and settings as HTML/CSS
overlays (easier forms and accessibility; two styling systems).
Recommendation: **B**. Not needed for Milestone 1, which only has a playing
field and HUD.

### D-010 — Targeting rules
_2026-11-16 · Accepted_

- No target: the first letter typed picks the word starting with that letter
  that is closest to the ward line (ties → oldest word).
- Once chosen, the target is locked. Keys that don't match it are errors;
  they never switch to another word (GDD §7: "avoid accidental target
  switching").
- Clicking a word targets it explicitly; the previous target's progress resets.
- To make the first keystroke unambiguous, the word generator avoids spawning
  a word whose first letter is already used on the field, falling back only
  when it can't find one.

### D-011 — Error handling and controls
_2026-11-16 · Accepted (wrong-key acceleration pending verification)_

| Situation (GDD §7) | Consequence |
|---|---|
| Wrong key on the target | Counts as an error, breaks the combo, target falls faster by `errorAcceleration` (based on reports of the original; not yet verified) |
| Key that matches no word | Counts as an error, breaks the combo, nothing else |
| Abandoned word (Backspace) | Progress on that word resets; no other penalty |
| Incorrect word submission | Not applicable: words complete automatically on their last correct letter; there is no Enter-to-submit |
| Missed word | Instability `+instabilityPerMiss`, combo breaks |

Controls: letters type, Backspace drops the current word, Esc pauses (and the
game auto-pauses when the window loses focus), mouse click targets a word.
Holding a key doesn't repeat it.

### D-012 — Provisional scoring
_2026-11-16 · Proposed — to be revisited after research #8_

10 points per letter × combo bonus (+5% per consecutive clean word, max
+100%). The combo resets on any error or miss.

### D-013 — Command log and replay
_2026-11-16 · Accepted_

Every player action is recorded as a small command stamped with its tick
(`char`, `abandon`, `select`). `GameEngine.replay(seed, config, commands)`
reproduces the exact game; a unit test checks this. This is what the
multiplayer server will use to validate results (GDD §6), and is all that
needs to travel over the network.

### D-014 — Campaign levels as validated JSON
_2026-11-16 · Accepted_

Levels live in `src/data/levels.json` (GDD §6: configuration files, not
hard-coded). `validateLevels()` checks every field at start-up and lists all
problems at once. A unit test enforces progressive difficulty: every level
must be faster, spawn more often, need more words and produce at least as
long words as the one before.

### D-015 — Campaign progression and saving
_2026-11-16 · Accepted_

- Winning level N unlocks N+1. Losing unlocks nothing but counts as an attempt.
- Personal bests (score, WPM, accuracy, combo) only come from completed runs,
  so a long losing run can't outrank a real clear.
- Progress is stored in the browser (`localStorage`, one key
  `spellbound.save`, versioned). Corrupt or tampered data falls back to a
  fresh save; if storage is blocked the game still runs and the main menu
  says progress can't be saved.

### D-009 — Original game is a mechanics reference only
_2026-11-16 · Accepted_

Research into the archived Typing Maniac SWF is limited to understanding
gameplay rules (speeds, penalties, spell effects). No art, audio, text,
branding or code from it is copied into Spellbound. See
`docs/original-game-research.md`.
