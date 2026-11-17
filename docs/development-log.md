# Development Log

Newest entries at the top.

---

## 2026-11-16 — Chapter and boss backdrops; wizard plan

**Done** (D-033): eight backdrops derived from the reference; weather and
gloom that build level by level; a wizard selection plan
(`docs/plans/wizards-v1.md`) and wizard art options on the design canvas.

---

## 2026-11-16 — Gothic art direction built in

**Done** (D-031): backdrop from the reference art (640×360 at 2×) with live
elements removed; parchment word plaques; progress roll, score wheels and
combo on the typewriter; spell scroll rack; status bar; seal deterioration;
chapter colour grades; menus recoloured.

**Verified:** unit tests and typecheck pass (no simulation changes). Not yet
seen in a browser here; GitHub's build is the next check.

---

## 2026-11-16 — Renamed to Wizzy Type; difficulty and speed pass

**Done** (D-030): rename (title, package, save key with migration, docs);
one-line spell summaries in game; Fire introduced first; word length and
complexity grow with level; per-word speed variation with an in-level ramp.

**Verified:** 162 unit tests pass (new: complexity limits on level 1, length
and complexity never shrink across levels, speed variation range and mean,
speed ramp formula, Purge restores base speed). Bot runs: perfect typists
need ~110+ WPM of raw speed to clear level 20 (the game's own WPM readout
shows ~58, because words arrive more slowly than they can type them).

---

## 2026-11-16 — Milestone 7 (part 1): Gritty pixel art

**Done** (D-028)
- Art direction agreed on a design canvas, then built in: four chapter
  backdrops and a menu backdrop drawn as 16-bit pixel art (320×180, shown
  4×) by `tools/pixelart/`, spell icon strip, gritty palette.
- Falling words are stained parchment scrolls; the typing console is the
  paper in the wizard's alchemic typewriter; meters, score and spell slots
  sit in the riveted iron HUD plate; accuracy on the desk plaque.
- Menus re-themed: iron panels, pixel fonts (Pixelify Sans, VT323), hard
  shadows.

**Verified**
- 155 unit tests pass; typecheck clean (simulation untouched; the screen
  maps the same field onto the new layout).
- Layout checked against the art on paper and in the generated images.
  Not yet seen running in a browser here (no browser available in this
  workspace); GitHub's build is the next check, then a play-test.

---

## 2026-11-16 — Milestone 6 (part 2): Word banks and Options

**Done** (D-027)
- Removed all names from modern fiction (Tolkien, Harry Potter, Eragon,
  Witcher, Narnia, Discworld…). Kept public-domain legend names.
- Fantasy dictionary rebuilt and expanded: 870 → ~1,500 words (medieval
  life, creatures, magic, alchemy, legends); pruned obscure words and
  duplicate spellings.
- New Modern dictionary: ~1,450 everyday words, no brands.
- Options screen on the main menu with a switch for each dictionary (one
  must stay on). Saved in the browser. Duels keep the Fantasy list.

**Verified**
- 155 unit tests pass (new: list format, no modern-fiction names, banks
  combine without duplicates, at least one bank on, enough words per level
  for every combination, saved setting survives reload and tampering).
- Bot played all 20 levels with both dictionaries on: no errors.

---

## 2026-11-16 — Milestone 6 (part 1): Campaign v2 and Spell system v2

**Done** (D-025, D-026; designs in [`plans/`](plans/))
- Campaign: 20 levels in 4 chapters; levels 5/10/15/20 are survival bosses
  (60/75/90/120 s) whose pace ramps up over the timer. A run is about 20 min.
  Old level 10's pace is the new end point.
- Normal and Hardcore modes (mode choice screen). Hardcore carries
  instability through the run, heals 25% after each boss, has its own
  records. Save format v4 (v3 saves migrate).
- Boss reward: choose 1 of 3 unlocked spells (weighted by rarity) as a free
  charge; with a full pool, swap one out or skip.
- Spells: eight in power order (slow, ice, barrier, shock, alter, fire,
  wind, harvest), one shared pool of 8, drop weights, ×3 drops on a spell's
  intro level, and a pop-up before that level. Ice and Slow stack; Fire is
  a no-reward bailout; Wind halves in Hardcore; Barrier, Shock, Alter and
  Harvest are new. "Tomes" renamed to "scrolls".
- Cast words reserved: removed fir/fireball/firebolt/firebrand/firestorm;
  `WORDS` filters any clash; a test guards it.
- HUD: one slot per unlocked spell with a count, pool total, shield
  counter, boss timer on the progress bar. New visuals for shield, lightning,
  transmutation and harvest.
- Practice and duels play boss levels as endless at their starting pace.

**Verified**
- 151 unit tests pass (new: pool, drop weights, cast-word clashes, every
  spell incl. the Slow-stack example, stacking Ice, Slow paused by Ice,
  Transmutation leaving the spawn sequence unchanged, replay with all eight
  spells, survival win and ramp, Hardcore carry and boss heal, boss
  rewards, save v4 migration). Typecheck clean.
- Bots played all 20 levels with the real word list: no errors; a perfect
  fast typist clears the run in ~16 min; slower bots fall around levels
  12–15.
- Tested in a cloud workspace where packages couldn't be installed: tests
  ran on Node's built-in TypeScript support with a small stand-in for
  Vitest, and the type check used stand-in Phaser types. The GitHub build
  (real Vitest, real build) is the final check. Not yet play-tested in a
  browser by a human.

**Next:** play-test and tune; then special word types (Volatile, Cursed,
Shielded, Conduit, Illusion).

---

## 2026-11-16 — Milestone 4: Endless Practice

**Done** (D-023)
- `modes/PracticeMode.ts`: practice config from a campaign level, level
  availability, specials filter, records and which ones improved.
- Save v3 with practice records + last choice; v2 migration.
- Screens: Endless Practice enabled on the main menu; setup screen (specials
  filter + level cards with pace and best); practice results with all GDD §14
  stats and per-stat "New best!"; pause menu made configurable per mode.
- App: practice flow, End session from pause, results over the backdrop.
- HUD shows "ENDLESS PRACTICE · N WORDS" in place of the progress bar; intro
  says "survive as long as you can".

**Verified**
- Typecheck and build clean; 107 unit tests (new: exact difficulty match for
  every level and filter, identical seeded game, endless never wins,
  level availability, records/improvements, short-session rule, separate
  storage + reload, v2 migration, malformed data).
- In the browser (pane hidden, so the game was driven directly and frames
  stepped manually): setup showed levels 1–5 open / 6–10 sealed for the
  owner's save; level 3 practice ran 90 s and 48 words (past the campaign
  quota of 35) without ending; Pause → End session → results with all stats
  and "First session" note; saved under "3:original"; Practise again → wards
  fell → "The Wards Have Fallen", no false "new best", sessions = 2; Campaign
  records untouched. No console errors; owner's save restored.

**Next:** Milestone 5 — multiplayer (server, rooms, Wizard Duel).

---

## 2026-11-16 — Milestone 3.2: Words need Enter

Owner chose Enter-to-destroy (D-022). Engine: Enter destroys an exact match
first, then casts spells, then treats the text as a missed submission; the
highlight prefers an exact match. The console turns gold with "↵ Enter" when
a word is ready. 85 unit tests (new: a word that starts another word).
Browser: "cask" stayed after typing, showed "↵ Enter", and was destroyed on
Enter with no errors; save backed up and restored; no console errors.

---

## 2026-11-16 — Milestone 3.1: Typing console, harder start, bigger word pool

**Owner requests:** instability resets every level (already so — confirmed);
raise the level-1 floor keeping per-level steps; widen themed words incl.
fantasy references; an editable typing console where Enter on an incomplete
word affects the intended word; spells cast by typing their names; not case
sensitive.

**Done**
- Levels shifted up two steps and extended (D-019).
- Words: 875 core + 148 reference names; case kept for display only (D-021).
  Spell words reserved.
- Engine typing model rewritten around a console (D-020): char / backspace /
  clear / submit / select commands, live matching against all words,
  Enter = spell or guessed missed submission, one penalty per slip.
- `TargetManager`: most-urgent match, edit distance, intended-word guess.
- UI: `ui/TypingConsole.ts` (valid text, red wrong part, caret, placeholder,
  "↵ cast" / "no charges" hint, flashes); spell slots in the top bar
  labelled with the word to type; accuracy/WPM under the console.
- Spell number keys removed.

**Verified**
- Typecheck and build clean; 84 unit tests (new: console editing, case
  insensitivity, spell-prefix validity, clear, click-aim, word falling while
  typed, Enter on partial / typo / gibberish / empty, single penalty per
  slip, guess function, word-list rules, replay with all command types).
- In the browser with exact key events: level 1 at 45 px/s; "LAZq" showed
  the q in red; Backspace + "uli" destroyed "lazuli"; "ar"+Enter sped up
  "Arya"; "mdgard"+Enter sped up "Midgard"; "Fire"+Enter burned all 4 words;
  "slow" with no charges showed "no Slow charges". Fixed during testing: a
  word sharing a spell's first letter stayed highlighted while typing the
  spell. No console errors; the owner's save was backed up and restored.

**Note for testers:** the browser automation tool sometimes sends a key
twice in quick sequences; real keyboards don't. Use dispatched key events
for precise checks.

---

## 2026-11-16 — Milestone 3: Original spells (+ campaign as a run, progress bar)

**Owner requests this milestone:** campaign must be a run from level 1 with
no level select (level choice only in Practice); add a progress bar like
the instability bar.

**Done**
- Campaign rebuilt as a run (D-016): `CampaignMode` run state, level-cleared
  and run-over screens, best-run record on the main menu, save v2 with v1
  migration. Level select removed.
- Spell system (D-017): `gameplay/SpellManager.ts` (ids, 3-charge cap),
  `spells/BaseSpell.ts` + `SpellRegistry.ts` (central registry; data in
  `data/spells.json`), engine support (tome words, `castSpell` command,
  freeze/slow timers, burn, wind), events for collect/cast/fizzle/end.
- Levels gain `availableSpells` and `spellDropChance`.
- HUD bottom panel (D-018): Level Progress bar, four spell slots with charge
  pips and key numbers, Ward Instability bar. Field height 600 → 560.
- Visuals: tome book marker + coloured word, frost rims while frozen, ice and
  temporal overlays, fire bursts, wind sweep, spell-name banner, gentle
  colour wash instead of full-screen flashes.

**Verified**
- Typecheck and build clean; 68 unit tests (new: inventory cap, tomes
  spawn/collect/waste, fizzle, each spell's effect and duration, Fire
  finishing a level, replay with casts, run progression, best run, save
  migration).
- In the browser: run starts at level 1; tomes appear and fill slots; Fire
  burned 4 words (+140) and collected a tome; Ice froze words (frost rims,
  tint) and released them; Slow set 50% for 8 s; Wind took instability 20% →
  0% and reset speeds; empty slot refused a cast; level 1 → "Level 1
  Cleared" → Fire carried into level 2 → losing shows "The Wards Have
  Fallen" with the run recorded. No console errors. The owner's save was
  backed up before testing and restored after.

**Temporary / placeholder**
- Spell art is particles and shapes; no audio.
- Spell numbers (durations, drop rates) are first-pass and unverified
  against the original.

**Next:** Milestone 4 — Endless Practice with level choice (levels offered
up to the furthest reached in Campaign).

---

## 2026-11-16 — Milestone 2: Campaign and difficulty

**Decision:** project owner chose HTML menus (D-008 → accepted).

**Done**
- 10 campaign levels in `data/levels.json` with validation (D-014):
  fall speed 35→90 px/s, spawn 2.6→1.2 s, 4→9 words on screen, words
  3–5 → 6–12 letters, quota 25→70, misses allowed 10→7, wrong-key
  acceleration 10→20.
- `availableSpells` added to `DifficultyConfig` (empty until Milestone 3).
- Campaign rules (`CampaignMode`) and versioned browser save (`SaveManager`), D-015.
- HTML menu layer: main menu (unbuilt modes shown disabled with "Coming
  soon"), level select (locked/cleared/best score), pause, results (score,
  accuracy, WPM, words, missed, best combo, time, personal best, unlocks),
  credits. Keyboard friendly: primary button auto-focused, Enter activates,
  Esc goes back.
- `App` controller for screen flow; GameScene reports via hooks and shows a
  level-intro banner; `BackdropScene` replaces the Phaser title scene.
- HUD columns now start after the level name (fixed an overlap with long names).

**Verified**
- Typecheck and build clean; 50 unit tests pass (new: level validation,
  progressive-difficulty check, unlock rules, personal bests, save/reload,
  corrupt/blocked storage).
- In the browser: menu → level select (only level 1 open) → intro banner →
  auto-typed clear of level 1 → results with "Level 2 unsealed" → page
  reload → level 1 shows best score, level 2 unlocked. Pause menu freezes the
  game and resumes. Losing level 2 shows the failure results and records an
  attempt without unlocking. No console errors. Test save data was erased
  afterwards.

**Temporary / placeholder**
- No rewards beyond unlocking yet (spell rewards come with Milestone 3).
- Level tuning is a first pass; needs human play-testing, especially 7–10.

**Next:** Milestone 3 — the four original spells. Research the original's
Fire/Ice/Slow/Wind behaviour first (research #9–13).

---

## 2026-11-16 — Milestone 1: Core gameplay prototype

**Done**
- Simulation (no Phaser): `GameEngine`, `GameState`, `GameEvents`,
  `WordGenerator`, `TargetManager`, `ScoringSystem`, `InstabilityManager`,
  `DifficultyConfig` + one `PROTOTYPE_LEVEL`, 427-word list.
- Presentation: `GameScene` (fixed-step loop with smooth interpolation),
  `WordView` (gold typed letters, target plate, red error flash + shake),
  `Effects` (spark bursts, floating points), `FieldBackground` (ward line and
  danger glow that change with instability stage), `GameHUD` (score, combo,
  words/quota, accuracy, WPM, instability meter), `OverlayPanel` (pause and
  end-of-game summary).
- Title screen now starts the game (Enter or click).
- Decisions D-010 to D-013 recorded.

**Verified**
- Typecheck, production build: clean.
- 35 unit tests pass, including: completion, auto-target choice, wrong-key
  acceleration, stray keys, Backspace, click targeting, combo scoring, miss →
  instability, loss at 100%, win at quota, max-words cap, and exact replay
  from the command log.
- In the browser: words spawn and fall; typing highlights letters and destroys
  words with effects; wrong keys flash red and speed the word up; Backspace
  and click targeting work; Esc pauses (simulation frozen); 10 misses end the
  game with the summary panel; Enter restarts. No console errors.
- Fixed during testing: small gap between typed and untyped letters (text
  outline width).

**Temporary / placeholder**
- Art is drawn with shapes; no audio yet.
- End-of-game panel stands in for the Milestone 2 Results screen.
- Scoring values are provisional (D-012).

**Not yet verified against the original:** wrong-key acceleration amount
and scope (research #4–5).

**Next:** Milestone 2 — campaign levels and difficulty. Needs decision D-008.

---

## 2026-11-16 — Milestone 0: Project foundation

**Environment found**
- Windows 11 Pro, Node.js 24.21.0, npm 11.19.0, Git 2.55.0, VS Code installed.
- Started from an empty folder; no existing files or Git repository.

**Done**
- Created `package.json` with dev/build/test scripts.
- Installed (exact versions): `phaser@3.90.0`; dev: `vite@8.3.8`,
  `typescript@5.9.3`, `vitest@5.1.0`.
- Added `tsconfig.json` (strict mode), `vite.config.ts` (GitHub Pages-friendly
  `base: './'`, Vitest config), `index.html`, `.gitignore`, `.gitattributes`.
- Created the folder structure from the GDD, plus `src/render/` and `tests/`
  (see decisions.md D-003).
- Wrote first simulation-layer modules: `core/GameConfig.ts`,
  `core/EventBus.ts` (typed events), `core/Random.ts` (seeded RNG).
- Wrote `BootScene` and a temporary `MainMenuScene` title screen to prove
  Phaser boots and animates.
- Unit tests for `SeededRandom` and `EventBus` (10 tests).
- Docs: README, GDD (copied from the brief), architecture, decisions, research
  plan, this log.

**Verified**
- `npm run typecheck` — no errors.
- `npm test` — 10/10 passing.
- `npm run build` — succeeds.
- `npm run dev` — page loads, Phaser 3.90.0 renders the title screen,
  no console errors.

**Temporary / placeholder**
- `MainMenuScene` is a title card only; real menu comes later.
- No art, audio or fonts yet; system fonts are used.

**Open questions**
- D-008: menus in Phaser or HTML/CSS? (Needed before Milestone 2.)

**Next:** Milestone 1 — core gameplay prototype.
