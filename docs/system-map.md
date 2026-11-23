# TypeL — system map (where each mechanic lives)

_Design intent for each row: `production-bible.md` (D-106). Verified against `dev/apprenticeship-prototype-20261119` at `cb41e71` and `main`
at `81bedb5` on 2026-11-22, by reading source and tests and tracing imports
from `src/main.ts`. CI (`npm run check`) was green on both commits. Not
play-tested for this audit. Update the row you touch in the same change
(AGENTS.md §6)._

**Reach** says whether the dev preview's entry point (`src/main.ts` →
`src/typel/app.ts`) actually uses the code:
**Live** = reached by the preview · **Legacy** = used only by `main`'s game
(compiled and tested on dev, not reached by the preview) · **Offline** =
research/simulation, never reached by any game · **Orphan** = not reached
by anything.

## Two games, one engine

| | `main` (Pages root) | dev branch (Pages `/preview/`) |
|---|---|---|
| Entry | `src/main.ts` → `src/app/App.ts`, `src/scenes/GameScene.ts`, `src/ui/*` | `src/main.ts` → `src/typel/app.ts`, `src/typel/render/PlayScene.ts` |
| Structure | 2 modes × 5 stages × 20 levels (D-047), Practice | 9 continuous apprenticeships (D-085, D-102), Sandbox, Typing Trials |
| Shared core | `src/core/GameEngine.ts`, `src/gameplay/*`, `src/spells/*`, `src/data/*` (the dev copy has diverged; see below) | same files, extended |

`main` has a word-bank change that dev lacks (`81bedb5`, +44 words in
`src/data/words.json`). Dev is 49 commits ahead of `main` (merge base `f7af69c`).

## Systems on the dev branch

| System | Files | Reach | Status | Tests | Decisions / docs |
|---|---|---|---|---|---|
| Simulation core: fixed 60 Hz tick, command log, replay | `src/core/GameEngine.ts`, `GameState.ts`, `GameEvents.ts`, `EventBus.ts`, `Random.ts` | Live | Implemented, Verified | `tests/GameEngine.test.ts`, `tests/Random.test.ts`, `tests/EventBus.test.ts` | D-003–D-005, D-013 |
| Typing console and targeting (Enter submits; typing is the only input, no clicking, D-108/D-111; old `select` commands still replay) | `GameEngine.ts` (`typeChar`, `submit`, `selectTarget`), `src/gameplay/TargetManager.ts`; keys in `src/typel/render/PlayScene.ts` `bindInput` | Live | Implemented, Verified | `tests/GameEngine.test.ts`, `tests/gameplay.test.ts`, `tests/typel-typing-only.test.ts` | D-020, D-022 |
| Spell casting: typed name + Enter, the only way to cast (D-111); engine `quickCast` remains only as a test/legacy hook | `GameEngine.ts` `applySubmit`, `quickCast`, `castSpell`; `PlayScene.ts` `bindInput` | Live | Implemented, Verified | `tests/spells.test.ts` (Hardcore `quickCast` returns false) | D-049, D-072. GAME-001, D-107, **D-111 (number keys removed from TypeL input)** |
| Hardcore typed-spell precision points | `GameEngine.ts` `castSpell` (`hardcore && cleanTyped`) | Live | Implemented; **no dedicated test found** | — | D-072 |
| Spell names reserved in the word bank | `src/data/wordList.ts` `clashesWithCastWord` | Live | Implemented, Verified | `tests/spells.test.ts` | D-049 |
| Word generation (seeded, never reacts to play) | `src/gameplay/WordGenerator.ts`, `src/data/words.json` | Live | Implemented, Verified | `tests/gameplay.test.ts` | D-036, D-058 |
| Difficulty Director (length × speed, pressure events, Endless levers) | `src/difficulty/DifficultyDirector.ts`; per-checkpoint levers from `src/difficulty/Stages.ts` | Live | Implemented, Experimental values | `tests/continuous-run.test.ts` | D-097, D-101, D-102 · `continuous-apprenticeship-2026-11-22.md` |
| Continuous apprenticeship run (Learn → Master → Boss, 12 hidden checkpoints, Endless) | `src/typel/apprenticeship.ts`, `GameEngine.ts` `RunPlan` | Live | Implemented, Experimental | `tests/continuous-run.test.ts` | D-085, D-102, D-103 |
| Checkpoint save and resume (seed + command-log replay) | `src/typel/runSave.ts` (`typel.activeRun.v1`) | Live | Implemented, Verified | `tests/continuous-run.test.ts` | D-102 |
| Progress, records, Runes, settings storage | `src/typel/prefs.ts` (`typel.progress.v1`), `src/storage/legacyKeys.ts` | Live | Implemented | `tests/legacyKeys.test.ts` | D-099 |
| Scoring: letters × 10 × Combo × Rush (× All-In) | `src/gameplay/ScoringSystem.ts` (`arcaneScore`), `GameEngine.ts` (`experimentalScoring`) | Live | Implemented, Verified | `tests/PreviewScoring.test.ts` | D-059, D-061, D-084 |
| Arcane Rush (player text renamed in D-111; code identifiers still say Volley until M1b) | `src/gameplay/ArcaneVolley.ts`, `src/gameplay/TemporalFlow.ts` | Live | Implemented, Experimental thresholds | `src/gameplay/ArcaneVolley.test.ts`, `src/gameplay/TemporalFlow.test.ts` | D-059, D-060, D-067–D-072, D-086 |
| Shared charge pool (8 → 12 with clean captures) | `src/gameplay/SpellManager.ts`, `GameEngine.ts` `shrinkPool` | Live | Implemented, Verified | `tests/spells.test.ts` | D-048, D-057 |
| Spell effects | `src/spells/SpellRegistry.ts`, rule text in `src/data/spells.json` | Live | Implemented; Fire/Shock chains Experimental | `tests/spells.test.ts`, `tests/typel-prototype.test.ts` | D-077, D-079, D-080, D-085 |
| Fire Combustion Chain, Shock seeded chain | `src/gameplay/SpellChains.ts` | Live | Implemented, Experimental | `tests/typel-prototype.test.ts` | D-079, D-080, D-085 |
| Ward, Wind scars, All-In wager | `src/gameplay/WardScar.ts`, `src/gameplay/InstabilityManager.ts` | Live | Implemented, Experimental values | `tests/wind-apprenticeship.test.ts` | D-083, D-084 |
| Catch loop (wrong submission plunges one word) | `GameEngine.ts` `applySubmit` / `penalize` | Live | Implemented, Verified | `tests/typel-prototype.test.ts` | D-086, D-092 |
| Runes, Flawless, Participation Runes | `src/gameplay/runes/RuneCatalogue.ts`, `RuneTracker.ts`, `src/typel/render/medal.ts` | Live | Implemented, Experimental | `tests/typel-prototype.test.ts` | D-085, D-089, D-090, D-098 |
| Triumphs (TypeL) | `src/typel/triumphs.ts` | Live | Implemented | — | D-085 |
| Elemental status and reactions | `src/gameplay/ElementalStatus.ts`, `ElementalReactions.ts` | Live (one workshop status only) | Implemented in part; no per-scroll elements | `tests/typel-elemental-*.test.ts`, `tests/elementalReactions.test.ts` | D-058 gate: `scroll-elemental-design-gate.md` |
| Typing Trials | `src/typel/typingTrial.ts` | Live | Implemented | — | D-085 |
| Rendering (key-art scene, typewriter Ward, HUD) | `src/typel/render/PlayScene.ts`, `keyart.ts`, `paint.ts`, `study.ts` | Live | Implemented, art placeholder | — | D-093–D-096, D-098 · `typel-keyart-reconstruction-2026-11-21.md` |
| Audio (synthesized score and effects; volume groups music/sfx/voice) | `src/typel/audio.ts` | Live | Implemented, placeholder. AUD-001 (Approved) replaces danger-driven music with performance-responsive layers and six mix groups; AUDIO-EXP-001 approved experiment | — | D-085, D-092, D-106 · `assets/AUDIO_BIBLE.md` |
| Grand Wizard voice (babble placeholder, recording hooks) | `src/typel/voice.ts`, `voiceLines.ts`, `src/data/voice-manifest.json` | Live | Implemented, placeholder | — | D-090 · `grand-wizard-voice-script.md` |
| Spell-free Opening Trial (Academy start) | `src/typel/apprenticeship.ts` (`OPENING`, `OPENING_TUNING`, `openingRun`), `src/typel/app.ts` (`beginOpening`, `launchOpening`, `openingEnded`), `src/typel/prefs.ts` (`opening`) | Live | Implemented, Verified; tuning Experimental | `tests/opening-trial.test.ts` | GAME-002, D-107, D-112 |
| Chronomancer `SLOW` lesson, Temporal Trial, teacher examinations, Grandmaster, graduation | `src/typel/apprenticeship.ts` | Live | Names implemented (D-111); examinations, graduation and the spell-free opening **not implemented** | — | D-103, D-106, D-111 |
| Spatial spawn behaviours (six) and Suspended Scattered Spawning | Default placement only (≈ Even Distribution): `src/core/GameEngine.ts` spawn placement | Live (default only) | Approved direction (D-109), **not implemented**; for Arcane Trials (D-107) | — | D-109 |
| Arcade & Practice; Arcane Trials; relics | Partial precursors: Sandbox/Endless, `src/typel/typingTrial.ts` | — | Approved scope (SCOPE-001, SCOPE-002); relics Deferred (RELIC-001); **not implemented** | — | D-106 |
| Desktop build (Tauri 2) | — (`index.html` loads fonts from Google's servers, which blocks offline desktop use) | — | Approved objective (TECH-001); Tauri Recommended — not approved (TECH-002) | — | D-106 |
| Old wizard figure and hands | `src/typel/render/Wizard.ts`, `Hands.ts` | Orphan | Superseded by D-093 | — | D-087, D-089 |
| Legacy campaign, Practice, menus, HUD, Codex, Spellbook | `src/app/App.ts`, `src/modes/*`, `src/scenes/*`, `src/ui/*`, `src/render/*`, `src/audio/*`, `src/storage/SaveManager.ts`, `LifetimeStats.ts` | Legacy | Implemented on `main` | `tests/campaign.test.ts`, `practice.test.ts`, `lifetime.test.ts`, `cleanStreak.test.ts`, `balance-audit.test.ts` | D-047–D-057 |
| Wind Master lesson slice (pre-D-085) | `src/app/Apprenticeship.ts`, `src/ui/apprenticeshipScreens.ts` | Legacy | Superseded by D-085 | `tests/wind-apprenticeship.test.ts` | D-084 |
| Clean Streak | `ScoringSystem.ts`, `src/render/StreakFeedback.ts` | Legacy | Retire as a player-facing multiplier (approved direction) | `tests/cleanStreak.test.ts` | D-046; `TYPEL-CURRENT-DESIGN-AND-CLAUDE-BRIDGE.md` |
| Grammar phrase tracking | `src/gameplay/PhraseTracker.ts` | Legacy | Implemented; not reached by the preview | `src/gameplay/PhraseTracker.test.ts` | D-058 |
| Wizard Duels (multiplayer) | `server/*`, `src/multiplayer/*`, `src/app/MultiplayerFlow.ts`, `src/ui/multiplayerScreens.ts` | Orphan on both branches (no menu path reaches `MultiplayerFlow`) | Implemented, not hosted, not reachable from the menus | `tests/server.test.ts` | D-024 (entry missing from the log) |
| Offline research (Wordcraft, Arcane Gambit, scoring comparison) | `src/gameplay/Wordcraft*.ts`, `ExperimentalWordcraftGenerator.ts`, `ArcaneGambitPrototype.ts`, `ScoringComparison.ts`, `PrecisionComboPrototype.ts`, `SustainedVolley.ts` | Offline (the last two are imported by the engine for helper functions) | Experimental; not live-approved | matching `*.test.ts` in `src/gameplay/` | D-058 |
| Standalone `prototype.html` slice | `prototype.html` | Separate page | Superseded by D-085 | — | `PROTOTYPE.md` |

## Build, test, deploy

| What | Where | Verified |
|---|---|---|
| Checks | `npm run check` (typecheck, Vitest, Vite build) | CI green on `cb41e71` (dev) and `81bedb5` (main), 2026-11-23 UTC |
| Doc consistency | `npm run docs:check` → `tools/check-docs.mjs`; CI `.github/workflows/docs-check.yml` | Added with this map |
| Deploy | `.github/workflows/deploy.yml` (runs on `main`): builds `main` at the root and the dev branch into `/preview/`, stamps the preview with the dev commit | Last run succeeded 2026-11-23 00:38 UTC; live content not inspected for this audit |
| Validate branches | `.github/workflows/dev-check.yml`, `dev-validate.yml` | Green |
| Repository | `robbynpicard-gif/spellbound`, Pages `https://robbynpicard-gif.github.io/spellbound/` (the GitHub API reports this name as of 2026-11-22; D-099's rename to `TypeL` has not happened on GitHub) | Verified via API |
