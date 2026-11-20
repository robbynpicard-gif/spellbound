# Wordcraft-aware word selection — offline evaluation

Status: **retired / offline research archive** under accepted decision **D-058**. The standard word generator is used for all live gameplay, including development preview and duels. The experimental generator remains available only to offline simulations and tests. Any historical references below to preview opt-in controls or human-play comparisons describe earlier prototypes that have been removed from live application wiring.

## Baseline and candidate
- Baseline: real `WordGenerator`, seeded by trial, using the supplied campaign stage's length weights, complexity ceiling, and recent-word rules.
- Candidate: for each baseline word, a separate seeded random stream may attempt a replacement **only** when the preceding candidate word is a classified noun, adjective, or adverb, and only with probability 20%.
- Replacements must match the baseline word's exact length, pass the same complexity filter, avoid the candidate's recent word texts, and avoid recent initial-letter collisions. If none qualify, the baseline word remains.
- The candidate is an *offline counterfactual*, not a fully integrated generator. It does not perfectly reproduce the baseline's 12-attempt fallback or model multiplayer timing.
- Phrase counts are based on **spawn order**, not player capture order. The game awards phrases based on consecutive **captures**, so the estimate is an upper-level directional proxy rather than a live expected reward rate.

## Reproducible evaluation
Run `npm test -- src/gameplay/WordcraftSimulation.test.ts` and inspect `WORDCRAFT_STAGE_AUDIT` output. The test reports 20 seeded trials × 120 words for Normal campaign stages 1, 3 and 5, each at level 10.

Metrics: classified words, recognized grammatical pairs, average word complexity, recent duplicate text violations, recent initial-letter collisions, and exact word-length histogram equality. Results are descriptive; do not declare an improvement from a single seed or a small absolute increase.

## Capture-order sensitivity (offline proxy)
The same two spawned sequences now pass through four seeded capture scenarios:
- Single-word field, no misses, arrival-order capture
- Four-word field, 10% miss chance, oldest-target capture
- Four-word field, 10% miss chance, random-target capture
- Five-word field, 25% miss chance, random-target capture

The test logs `WORDCRAFT_CAPTURE_AUDIT` with captured, missed, classified and phrase counts for each stage and scenario. This models target choice and chain interruption but **not** actual movement, fall timing, user reaction speed, spell effects, or real gameplay events. The model processes one available word per spawn and flushes the remaining field at trial boundaries; it must not be presented as a measured player outcome.

## Real-engine baseline harness
`src/gameplay/WordcraftEngineSimulation.ts` now runs the actual `GameEngine` with deterministic synthetic typing commands. The bot selects the lowest (most urgent) falling word, pins it, and types one character every configurable number of ticks. It observes real `wordSpawned`, `wordCompleted`, and `wordMissed` events, tracks PhraseTracker awards, concurrent words and verifies replay from the engine command log.

`npm test -- src/gameplay/WordcraftEngineSimulation.test.ts` checks replay and repeatability and prints `WORDCRAFT_ENGINE_AUDIT` for two typing rates. The bot is intentionally simple, not a human model: no errors, no spell casts, no reaction-time variability, and no strategic target choice beyond urgency.

**Experimental A/B now available:** The engine has an explicit `experimentalWordGenerator` injection hook, unused by production callers. `ExperimentalWordcraftGenerator` retains the baseline seeded draw, optionally substitutes a same-length complexity-eligible word, and bases its decisions only on the prior spawned words. The engine test compares both generators with identical stage, seed, tick budget and synthetic typist, and checks each arm's replay fidelity. Inspect `WORDCRAFT_ENGINE_AB` logs for captures, misses, phrases, field concurrency and completion status.

**Important limitations:** The experiment is not enabled in production. Equal seeds and bot behavior do not imply equal spawned words, fall timing or number of spawns once the sequences diverge. The candidate's replacement policy uses a separate seeded stream and its own recent-word constraints; it is not yet an approved balance change. The bot remains an intentionally simplified synthetic typist.

## Multi-seed real-engine batch
`src/gameplay/WordcraftEngineBatchAudit.ts` aggregates real-engine A/B outcomes over a configurable matrix of campaign stages, seeds and synthetic typing speeds. Run `npm test -- src/gameplay/WordcraftEngineBatchAudit.test.ts` and inspect `WORDCRAFT_ENGINE_BATCH` logs.

The default regression matrix compares twelve seeds across early/fast, middle/standard and late/slow scenarios. It reports baseline/candidate phrase awards, captures, misses, spawns, average spawned-word length, recent duplicate words, recent initial-letter collisions and replay failures. Counts are **not normalized by completed captures**; different run durations or completion outcomes can alter totals. Compare per-capture phrase rates and per-spawn collision rates before deciding.

The test enforces replay integrity and basic metric consistency, **not** a preselected improvement. It must not fail merely because an experiment produces fewer phrases; that is an evaluation result, not a software defect.

## Acceptance screening (not rollout authorization)
The batch report now includes normalized rates per 100 captured words or spawned words. The preliminary gate is:
- **Insufficient data** if either arm has fewer than 100 captures.
- **Reject** if phrase rate does not improve, miss rate increases by more than 2 percentage points, initial-letter collision rate increases by more than 2 percentage points, or recent duplicate-word counts increase.
- **Review** only when none of those conditions apply. Review does **not** imply approval to ship; the thresholds are provisional and must be revisited with larger samples and human playtests.

**CI discovery correction:** The Vite test configuration previously discovered only `tests/**/*.test.ts`, excluding source-level Wordcraft tests. It now includes `src/**/*.test.ts`. Earlier green checks therefore did not establish that the Wordcraft source-level tests actually ran. Verify new CI runs before treating any A/B results as validated.

## Experimental policy revision
The offline candidate now uses a 45% starter-class nudge when no phrase follow-up is pending, and an 80% same-length follow-up nudge when a compatible grammatical starter was spawned. It samples only dictionary-eligible words within the stage's complexity limit. It also tries to avoid duplicate words and first-letter clashes in its own recent spawned-word history, without advancing the main generator's random stream. This is a **hypothesis under test**, not a guarantee of better capture-order phrases or an approved balance adjustment.

The expanded 12-seed A/B matrix should be reviewed against normalized phrase rates, capture and miss rates, target collisions, and reproducibility before any player-facing trial.

## Policy sweep and measured baseline (2026-11-20)
The validated 12-seed baseline-versus-current-policy audit reported **0 vs 0 phrases** in early/fast, **0 vs 44** in middle/standard, and **0 vs 61** in late/slow. Captures were equal in each pair (204, 204 and 180 respectively); no misses, recent duplicate words or first-letter collisions were recorded. These are deterministic synthetic-typist results, not human data. Early-stage vocabulary/length restrictions leave little opportunity for curated grammatical patterns.

The next experiment makes the two nudging probabilities configurable **only in the offline candidate**, validates them within [0,1], and sweeps conservative (25%/50%), current (45%/80%) and aggressive (65%/95%) policies over the same twelve seeds and three stage/speed scenarios. Run `npm test -- src/gameplay/WordcraftPolicySweep.test.ts` and inspect `WORDCRAFT_POLICY_SWEEP` output. **Do not pick a winner before checking actual CI results and player-facing feel.** Production and default generator behavior are unchanged.

## Development-preview opt-in trial
The 12-seed sweep returned **middle/late phrases**: conservative **13/23**, current **44/61**, aggressive **55/81**. The tested scenarios reported no misses, recent duplicate words, initial-letter collisions or replay failures for any policy. All three returned zero early-stage phrases. The **current 45%/80% policy** is selected for the initial human trial because it offers strong middle/late gains without using the most aggressive setting; this is a provisional qualitative choice, not evidence of a global optimum.

To try it on the development preview, open `/spellbound/preview/?wordcraft=1` (full URL: `https://robbynpicard-gif.github.io/spellbound/preview/?wordcraft=1`). The standard preview at `/spellbound/preview/` remains the baseline. When enabled, the game displays **WORDCRAFT LAB · EXPERIMENTAL** during play. The feature is activated only when the URL pathname contains a full `preview` segment and the query parameter is exactly `wordcraft=1`; Wizard Duels always use the baseline. The production path `/spellbound/` cannot activate it even if the parameter is supplied.

**Deployment caveat:** This link works only after the development-preview deployment includes the relevant commits. A committed feature or green CI does not by itself prove the preview has deployed. The toggle does not persist across URLs and makes no permanent save-setting changes; normal game statistics may still accrue during solo play.

## Preview Wordcraft Lab menu
The preview main menu now offers a **WORDCRAFT LAB · PREVIEW ONLY** panel with a **Try Experimental Wordcraft / Switch to Standard** control. It changes the preview URL query parameter using browser history without reloading and applies to the next solo game. This is a between-runs switch, not a mid-run generator mutation. Production paths do not show the panel and cannot activate the experiment; duels remain baseline.

For a fair hands-on comparison, play the same Campaign stage and level in each mode, noting phrases earned, missed words, accuracy and whether the word selection feels natural. Existing lifetime stats are **not separated by experimental mode**, so do not interpret Trophy Case totals as A/B evidence. A dedicated per-run results comparison remains future work.

## Human-play session comparison (preview)
The Wordcraft Lab panel now shows the **last 12 completed Campaign levels or ended Practice sessions** from the current browser-page session, separated into Standard and Experimental rows. Each row shows stage/level context, captured words, missed words, grammatical phrases, phrases per 100 captures, accuracy and WPM. Data is kept only in an App-owned in-memory ring buffer: no localStorage, telemetry, or new SaveManager fields. Reloading the page clears the lab history.

The comparison is **descriptive**, not a controlled trial: seeds, spell choices, run duration, and player skill can differ. For meaningful comparison use matching stage/level settings and similar play duration. The game still applies its pre-existing lifetime-stat and achievement behavior to these sessions; the *lab comparison records themselves* are separate and never added to lifetime totals. Do not interpret accumulated Trophy Case counts as A/B measurements.

## Go/no-go before a live feature
1. Confirm all CI checks pass and review the actual per-stage logs.
2. Expand samples and inspect early levels where 2–4 letter limits severely constrain grammatical coverage.
3. Extend the real-engine baseline harness to evaluate a seeded candidate generator without modifying production gameplay; add varied reaction times, mistakes and spell effects.
4. Preserve seeded deterministic fairness and server verification in Wizard Duels; do not use the player's capture history to influence live spawns.
5. Check the actual candidate generator's recent-word fairness and complexity distributions. If it causes any significant regression, reject it.
6. Obtain approval before changing the live word-selection policy. Keep it off by default until validated.
