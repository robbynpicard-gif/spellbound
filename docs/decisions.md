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

### D-016 — Campaign is a single run (supersedes the level-select part of D-015)
_2026-11-16 · Accepted (project owner)_

- Campaign always starts at level 1 and plays straight through; there is no
  level select in Campaign. Choosing a level is only for Endless Practice.
- Score and spell charges carry from level to level. **Instability resets to
  0% at the start of each level** (Claude's default — easy to change if the
  owner prefers it to carry over).
- Between levels a "Level N Cleared" screen shows level stats, the run score
  and carried spells; Enter continues.
- The run ends when the wards fall or the last level is cleared. Records kept:
  best run (score, levels cleared, accuracy, WPM…), furthest level reached
  (this will decide which levels Practice offers), runs started/completed.
- Pause offers Resume, Restart run, Abandon run. Abandoned runs aren't recorded.
- Save format v2; v1 saves migrate (their highest unlocked level becomes the
  furthest level reached).

### D-017 — Original spells: how they're found, cast and what they do
_2026-11-16 · Accepted as adaptation (sources are fan guides, not the game file)_

Research (original-game-research.md #9–13): fan guides say the four books
were used by typing FIRE / ICE / SLOW / WIND; Fire "burns all words", Ice
"freezes all words", Slow slows them, Wind "renews your life", resets the
danger bar to 0% and erases mistyped words.

| Spell | Spellbound behaviour |
|---|---|
| Fire — Incineration | Destroys every word on the field. Each scores base points (no combo bonus, combo kept), counts toward the level quota, and any tome it carried is collected. |
| Ice — Frostbinding | 5 s: no word moves and no new word appears. Typing still works. |
| Slow — Temporal Distortion | 8 s: words fall at 50% speed. |
| Wind — Arcane Purge | Instability → 0% and every word loses the extra speed mistakes gave it (our version of "erases mistyped words"). |

- **Finding spells:** some falling words are *tomes* (book marker, coloured
  text). Completing or burning one adds a charge. Each level lists which
  tomes can appear (`availableSpells`) and how often (`spellDropChance`):
  Fire from level 1, Ice from 2, Slow from 3, Wind from 4.
- **Casting:** keys **1–4**. *Changed from the original's "type the spell
  word"*: typing letters would collide with auto-targeting (typing "f" would
  target a word starting with f).
- Max 3 charges per spell; a tome for a full spell still scores but is lost.
  Casting with no charges is refused with a red shake on that slot.
- Re-casting Ice/Slow while active extends to the longer remaining time.
- Timings and text live in `src/data/spells.json`; effects in
  `src/spells/SpellRegistry.ts`. Casts are commands, so replays and future
  multiplayer validation include them.

### D-018 — HUD bottom panel and field height
_2026-11-16 · Accepted (project owner asked for a progress bar)_

The bottom panel holds Level Progress (gold, left), the four spell slots
(centre) and Ward Instability (right). To fit it, the fall distance
shrank from 600 to 560 px, so every level is about 7% quicker to fall
through at the same speed. Spell casts use a soft colour wash
(≤25% opacity) instead of a full-screen flash, for comfort and
photosensitivity.

### D-019 — Higher difficulty floor
_2026-11-16 · Accepted (project owner)_

Level N now uses the old level N+2's parameters (level 1 = old level 3:
45 px/s, a word every 2.2 s, 5 on screen, 3–7 letters). Levels 9–10 continue
the same per-level steps (+9 px/s, −100 ms spawn, +1 max word every other
level, +2 error acceleration), up to 108 px/s and a word per second. Word
quotas (25→70), spell availability and tome rates stay per level number.
Instability still resets every level (D-016, confirmed by the owner).

### D-020 — Typing console (supersedes the targeting/controls parts of D-010 and D-011)
_2026-11-16 · Accepted (project owner)_

- The player types into a visible console (bottom centre) and can edit it:
  letters add, Backspace deletes one character (holding it repeats),
  Ctrl+Backspace or Delete clears it.
- The console text is matched against falling words, **ignoring case**. The
  most urgent matching word is highlighted with the matched letters in gold.
  If the text stops matching, the extra letters show red in the console.
- **Every word needs Enter** (owner's choice, D-022). Enter checks, in order:
  1. the text is exactly a falling word → destroy it (the most urgent if
  several); 2. the text is a spell name (`fire`, `ice`, `slow`, `wind`) → cast
  it; 3. otherwise it's an incomplete or misspelled submission — the game guesses
  the intended word (closest by edit distance to the start of each word, ties
  to the longer shared prefix, then the most urgent word; no guess for
  unrelated text) and that word speeds up. The console then clears.
- Errors: the keystroke that breaks the match is one error and speeds up the
  word being attempted. Further letters typed after it aren't extra errors.
  Enter on the same word in the same entry doesn't add a second speed-up.
- Spell names are always valid console text (typing "s-l" won't count as a
  mistake even if no word starts with "sl"), and the four spell words never
  fall as words. If a falling word shares the start ("firebolt"), Enter on
  "fire" casts the spell.
- Clicking a word aims the console only at that word until it's done or
  cleared.
- The spell slots moved to the top bar and show the word to type.
  Accuracy/WPM sit under the console.

### D-021 — Wider word pool, including fantasy references
_2026-11-16 · Accepted (project owner)_

`words.json`: 875 themed words (was 427). `words-references.json`: 148 names
from fantasy fiction and mythology (Frodo, Gandalf, Eragon, Saphira, Hogwarts,
Merlin, Odin, Medusa…), shown with their capitals but typed in any case.
Some of these names are trademarks of their owners (e.g. the Tolkien Estate,
Warner Bros./Harry Potter, Christopher Paolini/Eragon). That's fine for a
personal or hobby game; before any commercial release, set
`INCLUDE_REFERENCES = false` in `src/data/wordList.ts` (one switch) or review
the list.

### D-022 — Words need Enter
_2026-11-16 · Accepted (project owner; supersedes "destroyed as soon as typed" in D-020)_

A fully typed word stays on the field until Enter. While the console holds an
exact word it turns gold and shows "↵ Enter". When the text exactly matches a
word that is also the start of a longer one ("star" / "starlight"), the exact
word is highlighted and Enter destroys it.

### D-023 — Endless Practice
_2026-11-16 · Accepted_

- **Levels offered:** every level reached in Campaign (furthest level reached,
  D-016). Locked ones show "Reach it in Campaign". Campaign itself has no level
  select (owner, D-016).
- **Exact difficulty:** `practiceConfig()` copies the campaign level object and
  changes only `requiredWords` (→ endless) and the specials below. A test checks
  every difficulty field for every level, and that a practice game with the
  same seed produces identical words, positions, speeds and tomes.
- **Specials (GDD "modifier selection"):** "Spell tomes" = the original
  power-ups as in Campaign; "Pure typing" = no tomes or modifiers; "All
  specials" = tomes + alchemical modifiers, shown but disabled until Milestone 6.
- **Ending:** the wards fall, or Pause → "End session and see results". Pause
  also offers Restart session / Change level (those discard the session).
  Spell charges start at 0 each session.
- **Records:** per level *and* specials setting (`"3:original"`), stored in
  `save.practice`, never touching Campaign. Tracked: best score, most words,
  longest time, best WPM, best combo, best accuracy and fastest average time
  per word (the last two need ≥ 10 words in the session). Results mark each
  stat that set a new best. The last level/specials used are pre-selected.
- Save format v3; v2 saves migrate with empty practice records.

### D-009 — Original game is a mechanics reference only
_2026-11-16 · Accepted_

Research into the archived Typing Maniac SWF is limited to understanding
gameplay rules (speeds, penalties, spell effects). No art, audio, text,
branding or code from it is copied into Spellbound. See
`docs/original-game-research.md`.

### D-025 — Campaign v2: 20 levels, 4 chapters, survival bosses, Normal/Hardcore
_2026-11-16 · Accepted (project owner) · supersedes the 10-level list in D-014 and the instability rule in D-016_

Full design: [`plans/campaign-v2.md`](plans/campaign-v2.md).

- 20 levels in 4 chapters (`chapter` in levels.json). Levels 5, 10, 15 and 20
  are **survival bosses**: `survivalMs` (60/75/90/120 s) instead of a word
  quota. A boss starts at the previous level's pace and moves smoothly to its
  `ramp` values by the end of the timer (`GameEngine.pace`).
- The run is still one go from level 1, and losing ends it. A full run is
  about 20 minutes. Today's old level 10 pace is the new level 19/20.
- **Normal**: instability resets every level. **Hardcore**: instability
  carries through the run (`EngineOptions.initialInstability`); surviving a
  boss heals 25%; Arcane Purge only halves it. Hardcore has its own records
  (save v4, `SaveData.hardcore`); Practice unlocks follow the furthest level
  in either mode.
- **Boss reward:** surviving a boss offers 3 different unlocked spells,
  picked by drop weight; the player takes one charge (with a full pool they
  give one up, or skip). Uses `Math.random` — it's a menu choice, not
  simulation, so replays are unaffected.
- **New-spell pop-up:** a level with `introducesSpell` waits for an HTML
  pop-up (cast word, what it does, how scrolls work) before it starts.
- Practice and Wizard Duels play boss levels as endless at their starting
  pace (no timer, no ramp).

### D-026 — Spell system v2: eight spells, one shared pool, drop weights
_2026-11-16 · Accepted (project owner) · supersedes D-017_

Full design: [`plans/spells-v2.md`](plans/spells-v2.md).

- Eight spells, in power order (also the order the Campaign introduces
  them): `slow`, `ice`, `barrier`, `shock`, `alter`, `fire`, `wind`,
  `harvest`. The id is the cast word.
- One **shared pool of 8 charges**, no per-spell cap. Rarity comes only from
  `dropWeight` in spells.json (5 / 4 / 4 / 3 / 3 / 2 / 1.5 / 1). The spell a
  level introduces drops ×3 as often there.
- "Tomes" are now **scrolls**: a falling word with the spell's colour and
  marker; type it to collect a charge.
- Changes to the original four: **Fire** is a bailout (clears the board,
  no points, no progress, scrolls lost). **Ice** stacks (+5 s per cast).
  **Slow** stacks: each cast is its own 8 s timer and the factor (×0.6) is
  applied once per active stack; stacks pause while frozen. **Wind** halves
  instability in Hardcore.
- New: **Barrier** (Arcane Shield) blocks the next 2 misses, +2 per cast,
  until the level ends. **Shock** (Chain Lightning) destroys the most urgent
  word and the 3 nearest, scoring them. **Alter** (Transmutation) turns 6+
  letter words into 3–4 letter words in place — it uses its own random
  stream so the spawn sequence (and duels) stay identical. **Harvest**
  claims every word toward the quota at half points.
- **Cast words are reserved:** no falling word may equal a cast word, start
  with one, or be the start of one (`clashesWithCastWord`, checked by a test
  and filtered in `WORDS`). Removed from words.json for this: fir, fireball,
  firebolt, firebrand, firestorm.
- Meteor was considered and removed for now; Alchemical Cleansing waits for
  Cursed words; Rejuvenation was dropped (overlaps Wind).
