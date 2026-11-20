# Wizzy Type — Decision Record

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

| Spell | Wizzy Type behaviour |
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
branding or code from it is copied into Wizzy Type. See
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

### D-027 — Two word banks (Fantasy, Modern), chosen in Options; no modern-fiction names
_2026-11-16 · Accepted (project owner) · supersedes D-021_

- `words-references.json` (names from Tolkien, Harry Potter, Eragon, The
  Witcher, Narnia, Discworld…) is **removed**: trademark/copyright risk.
- **Fantasy dictionary** (`words-fantasy.json`, ~1,500 words): medieval
  life, castles, creatures, wizardry, magic and alchemy, plus names from
  **public-domain** myth, folklore, Arthurian legend and Shakespeare
  (Merlin, Camelot, Odin, Athena, Oberon…). Obscure words, invented
  compounds and duplicate spellings (sabre/saber…) were pruned.
- **Modern dictionary** (`words-modern.json`, ~1,450 words): everyday
  words (home, school, food, sport, travel, nature). No brand names.
- **Options** screen (main menu): each dictionary is a switch; at least
  one stays on. Saved in `SaveData.settings.wordBanks` (added within v4).
  Default: Fantasy only. Campaign and Practice use the chosen banks.
- **Wizard Duels always use the Fantasy dictionary** (`WORDS`), because the
  server replays both players' games and must have the same list.
- Every bank alone has 800+ words for every level's length range (tested).

### D-028 — Gritty 16-bit pixel art, drawn in code
_2026-11-16 · Accepted (project owner)_

Design canvas: "Wizzy Type — pixel art direction" (claude.ai artifact).

- **Look:** old-school pixel art with an isometric (3/4) feel; gameplay
  stays 2D. Dark and gritty, in the spirit of late-'90s isometric RPGs
  (mood only — no borrowed interface or logos): desaturated soot, rust,
  olive and bone; heavy shadow and vignette; candlelight as the one warm
  light; grimy, noisy surfaces.
- **Scale:** everything is drawn at 320×180 and shown at 4× with
  nearest-neighbour filtering (`ART_SCALE`). `tools/pixelart/` (Python +
  Pillow) generates the PNGs in `public/assets/`: one backdrop per chapter
  (scene, ward line, the wizard's study, the iron HUD plate), a menu
  backdrop and the spell icon strip. Run `python3 tools/pixelart/build.py`.
- **Layout:** the study fills the bottom: the wizard at an alchemic
  typewriter between shelves of scrolls. The **typewriter's paper is the
  typing console**; accuracy/WPM sit on the desk plaque. Meters and spell
  slots live in the iron plate at the top. The simulation keeps its field
  height (560); the screen maps it onto the shorter field above the ward
  line (`LAYOUT.fieldScale`, `screenY`), so difficulty is unchanged.
- **Words are scrolls:** stained, torn, singed parchment drawn in code in
  art pixels (`WordView`), ink letters, typed letters in rust, a rust frame
  on the target, a coloured ribbon and wax seal on spell scrolls.
- **Fonts:** Pixelify Sans (scroll words, typewriter, menu text) and VT323
  (readouts, banners), from Google Fonts, both SIL Open Font License. Boot
  waits up to 3 s for them, then falls back to system fonts.
- Not done yet: boss creatures, animation (wizard, typewriter keys,
  flasks), audio.

### D-029 — Legible fonts; louder spell scrolls
_2026-11-16 · Accepted (project owner) · amends D-028_

- Fonts: **Atkinson Hyperlegible** (bold) for scroll words, the typewriter
  and menu text; **Pixelify Sans** for HUD readouts and banners. VT323 is
  dropped (hard to read at small sizes). Both are SIL Open Font License.
- Spell scrolls: a pulsing border and glow in the spell's colour, tinted
  paper, ribbons at both ends, a wax seal, and the spell's pixel icon at
  the left of the scroll.

### D-030 — Renamed to Wizzy Type; difficulty by word complexity and varied speeds; Fire first
_2026-11-16 · Accepted (project owner)_

- **Name:** the game is **Wizzy Type** (was the working title "Spellbound").
  The save moved to `wizzytype.save`; an old `spellbound.save` is read once
  and carried over. The GitHub repository and its Pages address keep the
  old name until the owner renames the repository.
- **Spells in game are one line** (`summary` in spells.json, ≤ 8 words);
  the longer `description` is kept for the future spellbook.
- **Intro order:** Fire at level 1, then Slow 3, Ice 6, Barrier 8, Shock 11,
  Alter 13, Wind 16, Harvest 18.
- **Word difficulty:** lengths start at 3–5 letters (level 1) and grow to
  6–12 (levels 18–20), with weights centred on longer words as levels rise.
  `wordComplexity` scores rare letters, consonant clusters and capitalised
  names; `maxComplexity` keeps early levels to plain words (0.5 at level 1,
  rising to no limit from level 16).
- **Fall speeds vary:** each word falls at ±25% of the level pace
  (`speedVariance`), and on quota levels the average rises from ×0.85 at the
  start to ×1.15 at the quota (`speedRamp`). Uses its own random stream, so
  the word sequence (and duels) are unaffected. Practice ramps over the
  Campaign level's word count (`rampWords`) so speeds still match exactly.
  Arcane Purge returns each word to its own starting speed (`baseSpeed`).

### D-031 — Gothic art direction built in (640×360 at 2×)
_2026-11-16 · Accepted (project owner) · supersedes the look in D-028_

Spec: [`art-direction.md`](art-direction.md); reference: `mockups/gothic-reference.png`.

- **Backdrop:** the owner's reference image, scaled to 640×360 and shown
  at 2×, with everything the game draws live removed
  (`tools/pixelart/gothic_backdrop.py`): sample words patched with nearby
  sky; the spell rack, progress roll, score wheels, combo plate and
  status-bar panels cleared. One library for all chapters, with a light
  colour grade per chapter.
- **Live elements, drawn in the same style:** parchment word plaques with
  brass studs (magenta glow on the target; spell words coloured all over
  with their icon); the progress roll on the typewriter (segments + exact
  count + the typing line); brass score wheels with a gold flash and the
  combo plate; a vertical rack of fully coloured spell scrolls (desaturated
  when empty); a status bar with level, words, score/accuracy and ward
  health (exact numbers + bars); the runic seal dims, flickers, reddens and
  cracks as the ward weakens.
- **Field:** words fall through the window area (screen x 24–1084, ward
  line at y 418); the simulation is unchanged and is mapped onto it.
- **Colours** (art-direction §2/§8): magenta arcane, teal secondary, amber
  light; spells slow magenta, ice teal, barrier silver-blue, shock gold,
  alter rose, fire burnt orange, wind green, harvest aged gold.
- The earlier code-drawn chapter backdrops are retired; `tools/pixelart`
  still builds the spell icon strip.

### D-032 — Lore: scrolls of knowledge, powered scrolls hold mana
_2026-11-16 · Accepted (project owner)_

Story and terms in [`lore.md`](lore.md); text in `src/data/lore.json`.
Words are scrolls of knowledge captured by the wizard's typewriter; spell
scrolls are powered scrolls that store mana; the shared pool is the
wizard's mana capacity. The premise and a chapter story appear on the
pop-up at the start of each chapter; run-over screens close the story.
No rule changes. A roguelite expansion (wizards with different mana
capacities and unique spells, boons between levels, a persistent Library)
is proposed in lore.md, not built.

### D-033 — A backdrop per chapter and per boss; weather builds with difficulty
_2026-11-16 · Accepted (project owner) · amends D-031_

- `tools/pixelart/gothic_chapters.py` derives eight backdrops from the
  cleaned reference (`gothic.png`): chapter 1 moonlit tower / blood-moon
  boss; 2 drowned teal library with light shafts and bubbles / a vast shape
  passing the windows; 3 furnace-lit vault with smoke and embers / inferno;
  4 storm with rain and lightning / full storm.
- In game, each level within a chapter deepens the night over the windows
  and adds more weather (motes, bubbles, embers, or rain with lightning
  that strikes more often); boss levels use the boss backdrop at full
  intensity. Practice and duels use the same scene as the level they play.

### D-034 — The lore is implied, never told
_2026-11-16 · Accepted (project owner) · amends D-032_

Chapter story cards, the premise, the menu tagline and the victory/defeat
lines are removed. `docs/lore.md` stays as an internal world bible that
guides art and naming. Game-rule words (mana, ward, spell) stay because
they describe how to play.

### D-035 — Art v4: one study, a view per chapter; the wizard faces the player; longer fall
_2026-11-16 · Accepted (project owner) · replaces D-031's fixed backdrop and D-033's derived backdrops_

- All art is generated by `tools/pixelart/v4/build.py` into `public/assets/art/`
  (640×360, shown 2×). The reference image sets mood and detail, not layout:
  gothic arches, crowded shelves, candles, a magenta rune seal, brass, gems.
- The study is the same room every chapter; through its two arched windows
  each chapter and boss shows its own world (moonlit spires, drowned archive,
  forge, storm; antlered king, deep eye, iron colossus, eclipse). Light and a
  desk prop change with the world. Darker, grittier grade over everything.
- The wizard sits behind the typewriter facing the player (keys face the
  wizard), like Typing Maniac; three layers: backdrop, wizard, typewriter.
- Scrolls fall further: the ward line moves from screen y 418 to 470 (+13%).
  The simulation is unchanged, so each word takes the same time to fall.
- Menus use their own scenes (a tower on a sea cliff; a candlelit library
  for wizard select later).

### D-036 — One dictionary; more scrolls on screen at the same difficulty
_2026-11-16 · Accepted (project owner) · replaces D-027's word banks_

- The fantasy and modern banks merge into `src/data/words.json` (2,910 words,
  plus new medieval, nature and everyday words). The Options screen (which
  only held the word-bank switches) is removed; old saved settings are ignored.
  Spell cast words stay out of the dictionary.
- The fall is longer: `FIELD.height` 560 → 760 at the same fall speeds and
  spawn rates, so each word stays ~36% longer and more are on screen;
  `maxActiveWords` rises ×1.5 on every level. The typing speed needed (spawn
  rate) and its scaling are unchanged.

### D-037 — Zoomed-out study in the reference's arrangement, realistic light
_2026-11-16 · Accepted (project owner) · amends D-035_

- Art from `tools/pixelart/v5/build.py`: albedo × light from every candle,
  the seal, glowing glass and the moon, with bloom, texture and no outlines;
  the wizard is shaded from a height field (rounded, rim-lit, face in shadow).
- Layout (screen px): scrolls fall from y 20 to the sill at 506 across
  x 150–1076; the wizard sits at lower left; the typewriter faces the player
  at bottom centre with the paper roll on top and the counter beside it;
  the seal glows behind the typewriter; rack and status bar unchanged.

### D-038 — Music and sound effects, synthesised, on separate switches
_2026-11-16 · Accepted (project owner)_

- `src/audio/Audio.ts` makes all sound with the Web Audio API (no audio
  files): a slow, dark D-minor soundtrack (pad, drone, plucked arpeggio, low
  bells, stone-room reverb) whose arpeggio quickens in boss fights, and sound
  effects for typing, captures (rising with the combo), errors, misses,
  barrier blocks, spell pickups, each spell's cast, level cleared and defeat.
- Music and sound effects are separate buses, each on/off in Options (back on
  the main menu) and in the pause menu; saved in `settings: { music, sfx }`.
- Sound starts after the first click or key press (browser rule).

### D-039 — Shorter rounds; Alter opens a window of easy words
_2026-11-16 · Accepted (project owner)_

- Every level needs 5 fewer words (level 1: 15 → 10 … level 19: 35 → 30;
  bosses are timed and unchanged). Spell drop chance ×1.25 so about as many
  spell scrolls fall per level.
- Alter: long words on screen become short ones for good, and for 8 s every
  new word is short and easy (3–5 letters, complexity ≤ 0.5). Then new words
  return to the level's difficulty. The window pauses while frozen.

### D-040 — Combo multiplier tiers, bonuses, and an over-the-top finale
_2026-11-17 · Accepted (project owner)_

- Points: 10 per letter × (1 + bonus rates) × multiplier, plus flat bonuses ×
  multiplier. Multiplier tiers by combo: ×1, ×2 at 5, ×3 at 12, ×5 at 25,
  ×10 at 45. In a Campaign run the combo carries from level to level.
- Mistakes: a typo fixed before Enter keeps the combo (the word loses
  Perfect); Enter on a wrong word drops one tier; a miss resets the combo.
- Word bonuses: Perfect, Quick (top 30% of the fall), Clutch (last 15%),
  Arcane word (complexity), Long word (9+), Name-Caller, Volley (3+ in 2 s),
  Alliteration (same first letter chain), Librarian (alphabetical chain),
  Metronome (even rhythm), Clean Sweep (screen emptied after 3+).
- Level bonuses on a win: Flawless (no misses, +25% of the level's points),
  Under Par (+15%), Comeback (ward reached critical, +20%).
- Tone: the world is serious; the celebrations are absurdly grand (Latin
  banners, choir, organ, confetti, deadpan quips) — "serious, but becomes silly".

### D-041 — Sound rebuild: dynamic score and themed effects
_2026-11-17 · Accepted (project owner asked for it; details open to review)_

- Score: eleven synced layers (bed, arpeggio, heartbeat, tick, dissonance,
  wind, bells, choir, fever, ostinato, drums). Two dials move their volumes:
  stress (ward stage) darkens, heat (multiplier tier) brightens. Changes wait
  for the next bar line and glide over it; rising stress lands with a swell,
  recovery with a release chime. Menu / level / boss change tempo on a bar.
- Effects are tuned to D minor pentatonic. Captures climb the scale with the
  combo; bonuses add quicker, higher ticks. Typo = wooden knock, wrong word =
  crumpled paper, miss = stone crack and boom. Each spell sounds like its
  element. Level start = carriage return; level won = bell, then choir,
  organ, timpani over the ducked score.
- Code: src/audio/synth.ts (voices), Music.ts (score), Audio.ts (effects and API).

### D-042 — Wizards with sigil-scroll powers; score roll-up; lifetime stats
_2026-11-17 · Accepted (project owner chose: wizard selection, score roll-up + stats, sigil scrolls)_

- Campaign → Normal/Hardcore → **Choose your wizard** (six; the last pick is
  remembered). Each has a passive and a signature power (src/gameplay/Wizards.ts):
  Apprentice (Second Wind), Archivist (Recall; long words fall slower),
  Chronomancer (Rewind; a miss drops a tier instead of resetting), Pyromancer
  (Kindle; +20% points, +20% ward damage), Hedge Witch (Overgrowth; more spell
  scrolls), Warden (Bastion; starts each level with one Barrier block).
- Powers fire when you type a **sigil scroll**: a rare word in the wizard's
  colour with a diamond rune (7% per word after 4 captures, one at a time, never
  while a power runs). Sigils use their own random stream, so the word sequence
  is the same for every wizard. Practice and duels have no wizard.
- The score counter rolls up with a ticking sound that climbs as it goes.
- Lifetime stats (src/storage/LifetimeStats.ts) in the save file, shown on a new
  Stats screen: totals, records, bonuses, spells and per-wizard results.

### D-043 — Roster change; per-wizard cosmetic unlock tracks; brief finale
_2026-11-17 · Accepted (project owner)_

- The Hedge Witch and Warden are retired. New: the **Cartographer** (words fall
  in 5 lanes; Compass Rose: for 6 s a capture takes its whole lane) and the
  **Lexicant** (typos are free; Malapropism: every word becomes the same short
  word, and one Enter takes them all).
- Each wizard has their own unlock track (src/gameplay/Cosmetics.ts), Peggle 2
  style: mastery XP = points scored with that wizard; 10 mastery levels, one
  unlock each, plus three feats (Flawless level, ×10 multiplier, clear the
  Campaign). Slots: outfit (3 sprite looks), familiar (2 companions who react to
  play), capture flourish, sigil rune, ink colour, title. Cosmetic only.
  Wizard select → Wardrobe to equip; results show mastery gained and unlocks.
- Level-end finale is now ~2 s (boss ~2.4 s) and the level score counts up.
- Fixed: the game froze at the end of a won level. The finale's camera zoom used
  the short ease name 'Sine.Out', which cameras don't accept; the scene stopped
  updating, so the results never appeared. A browser-timer backup now guarantees
  the results screen.

### D-044 — The journey: the wizard's domain, then into the darkness
_2026-11-17 · Accepted (project owner); art is placeholder until the art style is chosen_

- Chapter 1 is played in the chosen wizard's domain (The Kiln, The Map Room…),
  with its own level names and a study lit in the wizard's colours. Chapters 2–4
  are the shared road outward: The Drowned Archive → The Ember Depths → The
  Storm's Edge. Results show the journey strip.
- Domain backdrops are recolours of the tower study for now; real domain art
  waits for the art-style decision.

### D-045 — Roster shelved; weighty spells; rounder sound, brassy typewriter
_2026-11-17 · Accepted (project owner)_

- The wizard roster, sigil powers and wardrobes are shelved (switched off by
  `WIZARD_ROSTER` in App.ts; code kept). Campaign starts straight away. The
  direction instead: one wizard that belongs to the player and grows with them
  (plan to be agreed).
- Every cast is a moment: 140 ms hit-stop, the spell's name slams in, a
  shockwave rolls out from the seal, the camera kicks, the score ducks under a
  sub-bass drop. Each spell has its own big effect: a wall of flame
  (Incineration), ice crystals and snow (Frostbinding), a flash and thunder
  (Chain Lightning), a great clock turning back (Temporal Distortion), a rising
  wall of light (Arcane Shield), ink ripples (Transmutation), a gust and ward
  glow (Arcane Purge), a golden crescent sweep (Harvest).
- Sound: all effects pass through a gentle low-pass with extra low end; square
  waves and bright noise replaced with rounder voices. The typewriter key is now
  a wooden thunk, a brass typebar ring and a mechanical clunk.

### D-046 — Clean Streak: a third scoring layer for mastery
_2026-11-17 · Accepted (owner + design review); multipliers provisional_

- Word score = (10 × letters × (1 + bonus %) + flat bonuses) × combo multiplier
  × Clean Streak multiplier, rounded once.
- Clean Streak counts words captured with no typo. Milestones (configurable in
  `STREAK_MILESTONES`, src/gameplay/ScoringSystem.ts): 0 ×1.00 · 5 ×1.20 ·
  15 ×1.40 · 25 ×1.65 · 50 ×2.00 · 100 ×2.75 · 200 ×3.50. The capture that
  reaches a milestone already scores at it.
- A typo (even one fixed with Backspace) steps back to the start of the
  milestone below the one reached (50 → 25; 21 → 5; 3 → 0); one slip = one step.
  The combo is untouched. A wrong Enter resets the streak to 0 (combo still drops
  a tier). A miss resets streak and combo. Words taken by spells, or stopped by
  Barrier, leave the streak alone.
- Carried between levels of the same chapter (a stage = 4 levels + boss), reset
  at each new chapter and at a new run. Practice keeps it for the session.
- HUD: status panel 3 shows the count, multiplier and a bar to the next
  milestone (accuracy and WPM moved under the level name). Milestones get an
  illuminated proclamation and chord, grander each tier; typos an ink blot and
  "×a → ×b"; a wrong Enter "STREAK LOST"; a miss "STREAK BROKEN".

### D-047 — Stage campaign: 2 modes × 5 stages × 20 levels (supersedes D-016 chapters, D-044 journey chapters)

**Decision (owner, 2026-11-17):** The campaign is two modes, Normal and Hardcore.
Each mode has 5 stages that get progressively harder. A stage is one run of 20
levels: levels 1–19 are standard and level 20 is the stage's only boss. Ten
stages, ten bosses in all. Chapters are removed. Two spells are introduced per
stage: one at level 10, one by beating the boss.

**Implementation choices (Claude's recommendations, built because the build
question went unanswered; open to change):**
- A run is one stage. Falling restarts the stage from level 1.
- Stages unlock in order, per mode (clear stage N to open N+1).
- The run is saved between levels: "Continue" on the stage screen, "Save and
  quit" in the pause menu.
- Difficulty is generated from WPM targets (src/difficulty/Stages.ts), not hand
  tables. Normal: 12 → 18/22/26/30/35. Hardcore: 18 → 25/30/35/40/45. Each
  stage starts where the previous stage's target was, reaches 95% by level 19,
  and the boss ramps from 90% to 112% of target.
- Spells: S1 Slow at L10, Ice from boss · S2 Barrier, Shock · S3 Alter, Fire ·
  S4 Wind, Harvest · S5 none. The boss spell is first playable next stage,
  which starts with 1 charge of it. The pick-1-of-3 boss reward is removed.
- Clean Streak carries across all 20 levels of a stage.
- Hardcore heals 25% after levels 5, 10 and 15; each stage starts with a full ward.
- Stage names: The Apprentice's Tower, The Forgotten Stacks, The Alchemist's
  Vault, The Storm Spire, The Unwritten. Bosses: The Bell Tower, The Last Index,
  The Crucible, Eye of the Storm, The Last Word.
- Save v5: old campaign and practice records are cleared with a one-time notice;
  profile, settings, lifetime stats and wardrobe are kept.
- Practice picks mode, stage and level. Duels use the 100 Normal levels in order.

**Calibration (bot-measured, not yet rebalanced):** see
docs/calibration-2026-11-17.md. Measured WPM matches the plan within ±2. A
steady typist at exactly the target speed, casting no spells, loses the bosses
of Normal stages 4–5 and Hardcore stage 5.

### D-048 — Livelier pacing, Fire first, spells that matter, one Apprentice (2026-11-17)

**Owner decisions:**
- Spell pool stays one shared pool of 8 charges.
- Claiming a scroll with a full pool: the scroll fizzles to grey smoke where it
  was claimed, the spell rack flashes red and shakes, a dull clunk plays, and
  the player gets **Overflow** points: 50 × the combo multiplier.
- A starter spell at Stage 1 level 2: **Fire**. The rest of the schedule moves
  up one: S1 Fire (L2), Slow (L10), Ice (boss) · S2 Barrier, Shock · S3 Alter,
  Wind · S4 Harvest (L10), no boss spell · S5 none.
- Scoring stays uncapped (combo × Clean Streak can reach ×35) unless it
  becomes a problem.
- Best scores are per stage. The main menu shows stages cleared per mode.
- Difficulty floor raised by a third, same shape. Normal 16 → 24/29/35/40/47
  WPM; Hardcore 24 → 33/40/47/53/60.
- Early game must be more engaged: more words to choose from (shorter words,
  slower fall, more of them), more scrolls (20% of words), ~15-minute stages.
- Spells should feel useful by level 6–7 and be necessary at the boss.
- The six-wizard roster, sigil powers, familiars and the wardrobe/mastery track
  are removed. One plain Apprentice. An ability layer may come back once the
  core loop is solid.
- Art is parked; gameplay feel first.

**Implementation:**
- Each level opens with 4 words (Hardcore 5) already falling, spread down the
  top of the field.
- Surges: short bursts where words come 1/0.6× as often (and 3 more may be on
  screen). Levels 6–12: one 5 s surge mid-level. Levels 13–19: two 4.5 s
  surges. Boss: three 6 s surges. Hardcore surges last 1 s longer. Endless
  Practice repeats a level's surges every quota's worth of words.
- Levels last about 37 s at their own pace; bosses 60/70/80/90/100 s.
- Calibration: docs/calibration-2026-11-17.md (v0.20.0 section).

### D-049 — Spell rebalance, quick-cast in Normal, Spellbook (2026-11-17)

**Owner decisions (with ChatGPT's design handoff):**
- **Fire:** destroys every word for its full base points (10 per letter), with
  no combo or Clean Streak, and does not count toward the quota. A bailout.
- **Harvest:** claims every word for half base points × the combo and Clean
  Streak multipliers at the moment of casting; counts toward the quota; does
  not change combo or streak.
- **Wind:** restores a flat 50% of the ward (never above full), same in both
  modes, and still removes the extra speed mistakes gave words.
- **Ice:** freezes for 8 s. Casting again while frozen adds 70% of the previous
  cast's time (8, 5.6, 3.9, 2.7 … at most ~27 s); after a thaw it's 8 s again.
- **Slow:** unchanged (do not nerf).
- **Barrier:** unchanged; blocking a word already protects combo and streak.
- **Casting:** Normal casts with number keys 1–8 *or* by typing the name +
  Enter. Hardcore is typing only.
- **Spellbook:** main-menu screen to choose which spell is on each key. One
  layout for both modes. Default = discovery order: 1 Fire, 2 Slow, 3 Ice,
  4 Barrier, 5 Shock, 6 Alter, 7 Wind, 8 Harvest.
- **Word list:** no falling word may equal a spell name (kept stricter: words
  that start with a spell name are also left out, so typing a spell never
  half-matches a word).
- Future, not approved: boss "spell scramble", Triumphs, medals, shop.

### D-050 — Difficulty +20% via spawn rate only (2026-11-17)

**Owner:** raise the whole difficulty floor by about 20%, only by making words
arrive more often. Fall speed and word lengths unchanged; levels keep their
length in time (so quotas grow by ~20%).
- Normal: 19 → 29/35/42/48/56 WPM (was 16 → 24/29/35/40/47).
- Hardcore: 29 → 40/48/56/64/72 WPM (was 24 → 33/40/47/53/60).
- More words on screen at once (up to ~12–15 early); the word generator still
  avoids shared first letters where it can.

### D-051 — In-level intensity, fewer scrolls, the announcer (2026-11-17)

**Owner:** the stage curve feels right; individual levels should build to the
end. By the back half of a stage the player should feel pressure; by the last
quarter they should be relieved to reach the break between levels.
- Each quota level speeds up from start to end, in fall speed and in how often
  words arrive. Levels 1–9: fall ±15%, spawn ±10%. Levels 10–14: ±22% / ±20%.
  Levels 15–19: ±30% / ±30% (start calm, end fierce; average pace unchanged,
  so stage targets and stage length hold).
- Spell scrolls: 10% fewer (18% of words, was 20%).
- **Announcer:** calls out per-word bonuses (Perfect, Quick, Clutch, Arcane,
  Long word, Name-caller, Volley, Alliteration, Librarian, Metronome, Clean
  Sweep) in a deep, showy, slightly sarcastic arena-announcer style (tone
  inspired by Halo / Knightsquad, no copied lines). Built on the browser's
  speech voice, pitched down. Only the best bonus on a word is called, common
  ones only sometimes, at most one call every 1.4 s. Off when sound effects are
  off. A recorded voice could replace it later.
- Owner likes the music ("feels very RuneScape"): keep its direction.

### D-052 — Announcer removed for now (2026-11-17)

The browser speech voice sounded too robotic. The owner wants a real person's
voice. The announcer comes back only with recorded voice lines.

### D-053 — Audio channels: music, sound effects, announcer (2026-11-17)

Options has three channels, each with an on/off switch and a 0–100% volume
slider: Music, Sound effects, and Announcer (its own channel, ready for
recorded voice lines; none yet). Settings are saved. The pause menu keeps the
quick music/sound switches. Plan for the announcer: the owner records basic
lines; Claude processes them offline (pitch, EQ, compression, saturation,
arena reverb) into a deep, showy announcer voice.

### D-054 — Fewer scrolls, steeper levels, stage music, menu theme, open Campaign (2026-11-17)

- Spell scrolls 20% rarer: 14.4% of words (was 18%).
- Each Campaign quota level gets an extra +30% fall speed by its end (start
  unchanged): about 15% harder overall, all of it in the back of each level.
  Bosses unchanged.
- Stage music "drive": the music speeds up (up to +28% tempo) and adds ticking,
  an ostinato and drums as the stage goes on and as each level nears its end.
- A separate menu theme: a warm, slower F-major loop, distinct from the stage
  music.
- Testing build: every Campaign stage is open, and a run can start at any of a
  stage's 20 levels (with 1 charge of each spell known there).
  `CAMPAIGN_UNLOCK_ALL` in src/app/flags.ts — set false for release.

### D-055 — Endless after the boss, words carry between levels, Campaign test toggles (2026-11-17)

- After beating a stage's boss, the results offer **Endless mode**: endless play
  at that stage's level-19 pace (the stage's peak), recorded as Practice.
- **Words stay on the field between levels** of a stage: the next level begins
  with the words where they were (instead of an opening cluster). Not kept when
  a saved run is continued later.
- Campaign screen testing controls: **Testing: all unlocked / real progress**
  (all stages and level picking vs. normal unlocking; remembered) and **Reset
  campaign** (clears Campaign progress and the saved run, switches to real
  progress for a fresh-run test).

### D-056 — Codex: how the mechanics work (2026-11-18)

Main menu → **Codex** (not reachable during a run): tabs for The basics, Stages
and pace, Spells, Scoring, Mistakes and Bonuses. Built from the game's own
numbers (src/ui/codex.ts), so it stays accurate; the same source exports
docs/mechanics.md.

### D-057 — Playtest pass: busy opening, intake readout, growing mana, endless (2026-11-18)

**Owner decisions after play-testing:**
- **Spell order:** Slow at Stage 1 level 2, Fire at level 10, Ice from the boss.
  The rest of the schedule is unchanged.
- **Boss wind-down:** when the timer ends no new words come; the stage ends once
  the field is clear. The win is already secured, so a late miss cannot end the
  run. Normal levels keep ending on their quota (words carry to the next level,
  so a level already feels like a continuation).
- **Endless mode** is offered after beating a stage's boss: it opens at the
  stage's finishing pace and keeps climbing (+4% speed and arrival every 25
  words), with a best score kept per stage.
- **Word library doubled:** 2,910 → 6,780 words, weighted to short ones
  (2–4 letters: ~620 → 2,070). Two-letter words added.
- **Capture readout moved off the field:** a captured word is swept to the desk
  in the left margin, where its points and bonuses are read out. Spell effects
  and the capture burst stay on the field.
- **Level summary no longer hides the field:** the dim behind it is light, so
  the words still falling stay visible.
- **Mana pool grows with accuracy:** 8 charges, then 9/10/11/12 at 25/50/100/200
  clean captures. A missed word or wrong Enter drops it back to 8 and anything
  that no longer fits is lost. A corrected typo costs nothing (option C).
- **Fire** only burns words below the top fifth of the field, so freshly spawned
  words are not wasted.
- **Alter** now turns the field into 2–3 letter words.
- **Busy from level 1:** stage 1 opens at the rhythm of the later stages (a word
  about every 1.3 s, falling in ~15 s) with 2–4 letter words. Arrival stays
  roughly flat (1.2–1.4 s) across all stages; difficulty grows through word
  length and fall speed. Normal starts at 23 WPM, Hardcore at 35.

**Open:** whether Clean Streak should count words or letters, now that early
words are tiny (the milestones are unchanged for now).

### D-058 — Core gameplay integrity takes precedence over optional rewards
_2026-11-20 · Accepted (project owner)_

**Design invariant:** Typal must not change its established core gameplay merely to make a Rune, Triumph, grammar combination, medal, or other optional reward easier or more common to obtain. Rarity, including exceptionally rare rewards, is acceptable; reward frequency is not itself a reason to alter the word generator, typing feel, difficulty progression, targeting, or player agency.

- The default word generator remains the authority for normal play. Grammatical patterns may be **observed from actual captures** and rewarded, but must not bias spawning to manufacture those patterns.
- Elemental spells and other intentionally gameplay-changing mechanics are distinct: their effects must be intuitive, visible and consistent with their agreed design. This principle does not prohibit intentional core mechanics approved by the owner.
- Experimental implementations may remain in offline tests and documentation. They are **not** approved for live preview or production simply because a synthetic benchmark reports more rewards.
- Before implementing any recommendation that significantly changes agreed design, the assistant or contributor must identify the design conflict, expected player-facing impact, and alternatives, then obtain explicit owner approval. Default to preserving the existing behavior.
- Do not treat low Rune/Triumph acquisition rates as a defect by themselves. Evaluate fairness, clarity, and player experience separately from reward frequency.

**Application:** The grammar-biased Wordcraft generator and its preview opt-in are retired from active gameplay. Offline research and replay tests may remain for historical analysis; the existing capture-order PhraseTracker and optional awards remain.

### D-059 — Arcane Volley: immediate buildup, ignition, extended Surge, soft-cap mastery
_2026-11-20 · Accepted design direction; numeric balance and live implementation not approved_

Volley should reward a chain of timely, flawless captures with **immediate visible multiplier progression** (candidate ×1.2, ×1.4, ×1.6, ×1.8), then an **earned arcane eruption** (candidate near ×2), followed by a sustained, escalating Surge. Explore a long Surge arc through approximately ×5, then a **soft cap** where increments become +0.1 (×5.1, ×5.2, ×5.3…) and require progressively more exceptional sustained play. No arbitrary hard ceiling. This replaces the earlier *design target* of a fixed ×1.5/×2/×3 Volley ladder; it does not change the currently deployed prototype.

The emotional sequence—**build → anticipate → erupt → sustain → rare mastery**—is accepted. The exact ignition threshold, stage boundaries, timing, qualification, decay, progression costs and soft-cap position remain intentionally tunable through playtesting. Normal should be accessible; Hardcore should demand more, without changing the reward ceiling. Preserve clear word-length-aware capture rhythm, fair target availability, typing readability, the simple score formula, and D-058's ban on manipulating word generation to accommodate rewards.

**Implementation status:** documentation only. See `docs/arcane-volley-design-goal.md`. Prototype and owner review are required before activating a new Volley mechanic in preview; production stays unchanged.


### D-060 — Volley Flow Preservation and two-word activation (2026-11-20)
_2026-11-20 · Accepted design (project owner); dev implementation committed; deployment unverified_

**Design:** Flow Preservation is part of Arcane Volley itself, not a separate power, bonus or optional reward. A first flawless capture arms Volley; a second timely flawless capture activates the initial ×1.2 multiplier. No multiplier is earned from a single capture or from waiting. When there are no actionable words, Volley's capture clock pauses without altering spawn pacing, enemy movement, difficulty, or other gameplay clocks. Once an actionable target returns, restore the preserved window with a one-time, capped 0.4-second re-engagement grace. Mistakes and misses follow existing chain-break rules. Protect the one-word buildup as well as an active Volley. This is consistent with D-058 (do not manipulate word generation) and extends D-059 (Arcane Volley progression).

**Implementation:** Commit `01fce963` on `dev/apprenticeship-prototype-20261119` introduces a Volley-only virtual clock and empty-field grace in `src/core/GameEngine.ts`, using existing `src/gameplay/ArcaneVolley.ts`. Treat it as a prototype pending verification of actionable-target semantics, timing cap, transitions and regression tests; commit alone does not establish full specification compliance.

**Deployment:** Main's Pages workflow builds production from `main` and preview from `dev/apprenticeship-prototype-20261119` into `/spellbound/preview/`. Workflow refresh commit `63ca72c` was pushed to `main` to trigger rebuilding. Whether that run succeeded and what exact commit is live must be confirmed from GitHub Actions and the preview build stamp; do not infer deployed status from a push.

**Tracking convention:** Every future change should explicitly distinguish (1) design status (proposed/accepted/superseded), (2) implementation status (not started/in progress/committed/tested), and (3) deployment status (not deployed/preview verified/production verified), with branch and commit when known. Append superseding decisions instead of rewriting historical entries.


### D-061 — Level-cleared ledger reflects the active scoring model (2026-11-20)
_2026-11-20 · Owner-requested; implementation committed to dev preview; build/deployment verification pending_

The between-level results ledger must show scoring rules actually used for that level. For experimental Arcane scoring, display the formula `round(letters × 10 × Combo × Volley)`, peak/end precision Combo and peak/end Arcane Volley, words captured, accuracy, WPM, errors, misses, and capture timing. Explain two-word Volley ignition and Flow Preservation. Remove legacy `3 words in 2 seconds` Volley and Clean Streak scoring claims from the Arcane results panel. Preserve legacy results presentation when the legacy engine is in use. Runes and other systems still using historical peak Volley statistics are not redefined by this UI change; audit their criteria separately before purging underlying mechanics. Implementation: `src/ui/screens.ts`, `src/core/GameEngine.ts`, `src/gameplay/ScoringSystem.ts` (dev commit `699406f` and preceding commits). Production remains unchanged; verify the Pages workflow before marking deployed.


### D-062 — Scoring knowledge in menu Codex; preserve mystery during play (2026-11-20)
_2026-11-20 · Accepted design (project owner); dev UI committed; deployment verification pending_

Inspired by Balatro's strategic legibility without score prediction: players can inspect the accurate underlying scoring rules in the **main-menu Codex** and develop their own high-score strategies, but gameplay and the level-cleared ledger should not turn into a scoring tutorial or display projected future scores. Keep the ledger celebratory and performance-oriented (actual earned score, Combo/Volley peaks, accuracy and other run facts), remove the verbatim scoring formula and explanatory paragraphs from the between-level screen. The Codex may give exact calculation mechanics alongside evocative strategy descriptions; avoid implying that future outcomes are guaranteed. Replace legacy Combo/Clean Streak/Volley descriptions in the Codex for the current solo Arcane scoring model. No scoring mathematics are changed by this decision. Dev implementation: `src/ui/screens.ts`, `src/ui/codex.ts`.


### D-063 — Strategic predictability, mechanical transparency, emergent uncertainty (2026-11-20)
_2026-11-20 · Accepted design principle (project owner); documentation only_

**The outcome can be uncertain; the rules should not be.** A player who understands the mechanics must be able to formulate a sound scoring or combat strategy, execute it consistently, and expect the intended result whenever the necessary RNG conditions and player execution occur. Randomness may change opportunities, constraints, risk and timing, but must not secretly override a valid strategy or create unexplained exceptions. Mechanics, interactions, thresholds and scoring calculations must be deterministic and inspectable, with player-visible feedback sufficient to understand success or failure. The main-menu Codex may explicitly disclose the full score formula and relevant rules so players can calculate hypothetical outcomes and plan strategically.

**Preserve wonder in the moment:** Avoid in-run score projections, prescribed optimal strategies, constant formula explanations or other interfaces that turn play into bookkeeping. Surprise should arise from encounter composition, timing, combinations, presentation, sound, and player decisions—not hidden arithmetic or deceptive rules. A strategy is not guaranteed to succeed in every random run, but when its conditions are met it should behave predictably. Apply this principle to future mechanics, elemental interactions, Volley, Runes and Triumphs, and evaluate proposed RNG against it before implementation. This clarifies and extends D-058 and D-062; it does not itself authorize changes to gameplay code or production.


### D-064 — Lightweight level-clear performance snapshot (2026-11-20)
_2026-11-20 · Accepted owner direction; dev UI committed; deployment unverified_

The between-level screen should communicate overall performance at a glance and return the player to the action. Show cumulative stage score prominently and just four level indicators: level score, accuracy, WPM and peak Arcane Volley (legacy scoring may show best combo instead). Remove the dense stat grid, routine Rune award grid, scoring tutorial and journey strip from the between-level screen; preserve meaningful newly unlocked Triumph announcements, Hardcore ward carry information, held mana and next-level navigation. The end-of-stage screen is the preferred home for a more detailed performance review; expanding that screen requires separate implementation and accurate stage-level aggregates. This refines D-061/D-062 without changing scoring or Rune eligibility.


### D-065 — End-of-stage performance review prototype (2026-11-20)
_2026-11-20 · Owner authorized prototype; implementation committed to dev; build and preview verification pending_

Keep between-level results minimal (D-064), and offer a richer review at stage completion or run end. The run-over screen now displays final score and best-run status with stage-level accuracy, WPM, words captured/missed, typing errors, best precision chain, levels cleared, elapsed time and, when recorded under Arcane scoring, peak Arcane Volley multiplier. Add optional aggregate fields to CampaignRun totals and RunSummary so older saves remain readable; aggregate peak Volley from actual level stats and avoid invented metrics. No scoring mechanics, level pacing, or production gameplay changed. Future iteration may add stage score progression and more nuanced precision consistency, but requires genuine tracked data. Files: `src/modes/CampaignMode.ts`, `src/ui/screens.ts`.


### D-066 — Foundation-first risk retirement roadmap (2026-11-20)
_2026-11-20 · Owner-requested roadmap; proposed prioritization; implementation not started_

Before expanding systems, prioritize Arcane Volley timing correctness (including monotonic clock and bounded Flow Preservation grace), scoring/Codex/Rune consistency, deterministic regression coverage, campaign continuity, save/replay correctness, and preview/production isolation. Adopt small independently testable preview slices; implement accepted, sufficiently specified fixes without additional design meetings; escalate underspecified player-facing rules to the owner before implementation. Keep production unchanged until explicitly approved. See `docs/foundation-roadmap.md` for phases, acceptance gates, and severity classifications.


### D-067 — Monotonic Arcane Volley Flow Preservation prototype (2026-11-20)
_2026-11-20 · Implements accepted D-060/D-063; dev implementation committed; CI and preview playtest pending_

Fix the known virtual-clock rewind bug: never decrement `volleyFlowTick`. Freeze it while no actionable words exist, and grant at most 0.4 seconds of additional frozen Volley time on the first field refill after a successful capture. Consume this allowance once per capture so repeated empty/refill cycles cannot accumulate grace. A new capture resets the allowance; incorrect captures do not earn it. Ice pauses Volley time without changing spawn rules. This is a scoped correctness prototype; verify with CI and focused manual playtesting, especially empty-field Volley ignition and repeated empty/refill cycles. Engine commit `7680c9c`; no production gameplay change.


### D-068 — Restore live typewriter preview and ease Volley timing (2026-11-20)
_2026-11-20 · Owner-directed prototype; dev implementation committed; CI and deployment pending_

Restore a compact always-visible live transcription of the current console input on the physical typewriter. The desk scenery's higher render depth could cover the pre-existing HUD console. Show typed characters and a caret above the desk, with muted placeholder when empty and a gentle error tint for invalid prefixes; the authoritative input remains GameEngine state and no input controls change. Slightly widen the Arcane Volley timing allowance: Normal from 42 + 12 ticks/letter to 52 + 13, Hardcore from 28 + 9 to 34 + 10, preserving the two-capture ignition and Hardcore pressure. Test and tune on preview; do not change production gameplay. Files: `src/scenes/GameScene.ts`, `src/gameplay/ArcaneVolley.ts`, `src/gameplay/ArcaneVolley.test.ts`.


### D-069 — Physical sandbox spell contracts and Temporal Flow (2026-11-20)
_2026-11-20 · Owner-approved direction; Temporal Flow preview implemented; broader contracts provisional_

Treat Time and the physical identities of all eight spells as coherent sandbox properties. Separate player input, world motion, Volley opportunity, spell duration and spawning clocks. Preserve existing spell mechanics unless an interaction is intentionally prototyped. Implement the first testable interaction: while Slow is active, the monotonic Volley clock runs at 80% normal rate (a 25% longer real-time capture opportunity); Slow stacks do not compound the Volley benefit. Player typing remains fully responsive, and Slow does not award a multiplier directly. See `docs/sandbox-interactions.md` for the full spell-by-spell default interaction contracts, current implementations and explicitly unimplemented future possibilities. Engine implementation `3318003` on dev; preview CI and manual validation pending.


### D-070 — Deterministic Temporal Flow regression suite (2026-11-20)
_2026-11-20 · Dev implementation committed; CI and preview validation pending_

Isolate the Volley-only fractional clock in `src/gameplay/TemporalFlow.ts` and test Slow's 80% clock rate, pauses for Ice/empty field, fractional remainder across expiry, two-word Volley ignition and deterministic stepping. Keep world movement, player typing, spawning and spell durations unchanged. `GameEngine` now consumes the shared clock helper rather than maintaining a separate Slow remainder. Tests are in `src/gameplay/TemporalFlow.test.ts`; end-to-end engine overlap and manual preview playtesting remain necessary before calling this fully verified.


### D-071 — Spell action preserves Volley; separate level and stage best streaks (2026-11-20)
_2026-11-20 · Preview implementation; CI and manual testing pending_

Successful spell casts while an active Arcane Volley multiplier is above ×1 grant a bounded 1.5-second pause of the Volley opportunity clock. This is a deliberate tactical window to cast Slow or another spell and re-engage; it does not automatically add a capture or multiplier, and repeated casts while the pause is active do not bank additional time. Failed casts do not qualify. The Level Cleared screen displays only the highest number of consecutive successful Volley captures in that level; the stage-end screen displays the best such streak across the entire stage. Stage aggregation is max, not sum. Historical saved runs may lack this new statistic and display zero until played under the new build. Production unchanged pending approval.


### D-072 — Spell rhythm refresh and Hardcore typed-spell rewards (2026-11-20)
_2026-11-20 · User-approved prototype; CI and gameplay verification pending_

Replace the 1.5-second spell pause with an immediate Volley-window refresh when a charged spell is successfully cast during an active (greater than ×1) Volley. A spell does not add a Volley capture or raise its multiplier. Allow at most one refresh between successful word captures, preventing spell chains from sustaining Volley indefinitely. In Hardcore, a correctly typed and submitted spell name also advances the regular precision combo and earns length-based points using the existing precision-combo formula, without counting as a captured enemy, granting Volley multiplier, or advancing level quotas. Direct cast commands and corrected spell entries do not receive this typed-precision reward. Normal spells do not earn these points. Scope remains preview-only pending validation.
