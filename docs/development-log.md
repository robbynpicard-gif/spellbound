# Development Log

Newest entries at the top.

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
