# TypeL — Foundation-First Roadmap
_2026-11-20 · Proposed prioritization under D-066_

## Goal
Retire fundamental correctness and player-trust risks before adding major systems. Maintain D-058 gameplay integrity, D-060 Flow Preservation, D-062 menu Codex, D-063 deterministic strategy, and D-064 lightweight level clear.

## Execution protocol
1. Use existing accepted design decisions as authorization for scoped bug fixes, regression tests and reversible preview prototypes; ask the owner before inventing new mechanics, economies, or balance rules.
2. Define observable acceptance tests, make a small dev-branch change, add automated tests, run `npm run check`, deploy to isolated preview, then playtest.
3. Track design / implementation / CI / deployed preview / manually verified / production status separately. Do not promote gameplay changes to production without owner approval.
4. Preserve deterministic seeds, replayability and normal word generation. Record regressions and commit IDs in the decision bible.

## Phase 0 — P0 foundation
**0A Volley timing correctness.** Replace the current `volleyFlowTick` rewind on re-engagement with monotonic virtual time and a bounded one-time grace. Test two-word ignition, sustained chains, empty-field protection, grace expiry, repeated empty fields, mistakes, missed words, Ice and Hardcore. Do not change spawn pacing. This is the first implementation candidate.

**0B Scoring and rewards consistency.** Audit GameEngine, Codex, HUD, between-level results, stage results and Rune/Triumph conditions against current Arcane rules. Historical `peakVolley` and Clean Streak Rune criteria need an explicit design decision before changing award eligibility. Do not claim legacy rewards are current multipliers.

**0C Release confidence.** Establish a deterministic smoke suite covering boot, capture, typo, spell, level clear, carried score/combo/charges/words, stage victory, save/reload, and Endless. CI green verifies tests and build, not real-world playability or visual presentation.

## Phase 1 — P1 core-loop continuity
Test Campaign/Hardcore boundaries, boss/endless transitions, instability, saves, pause/restart, accessibility, targeting, input feedback and difficulty fairness. Provide subtle, readable explanations of mistakes and chain breaks without in-run score predictions.

## Phase 2 — P1 content and balancing
Use reproducible seeded playtests across early, middle and late game. Assess whether multiple deliberate strategies work under reasonable RNG; ensure elemental reactions and spell effects match documented behaviour. Propose rather than silently implement unspecified interactions.

## Phase 3 — P2 expansion
Prototype elemental interactions, grammar/word-category Triumphs, then a deployable scroll bank **one at a time**. Require explicit rules for costs, stacking, progression and reward effects before implementing new economies. Do not manipulate ordinary word generation to make achievements easier.

## Severity and release gates
- **P0:** incorrect scoring, invalid chain breaks, nondeterministic replay, corrupted progression, softlocks, production contamination.
- **P1:** misleading documentation, unfair mechanics, inconsistent spells, serious input or accessibility problems.
- **P2:** polish, optional analytics, achievements, new content.
- For each item record: repro/seed, expected/actual, decision status, dev commit, automated-test result, preview deploy verification, owner playtest result, production approval.

**Next recommended slice:** 0A monotonic Volley Flow Preservation, regression tests, preview deployment and a focused owner playtest.
