# Wordcraft-aware word selection — offline evaluation

Status: **experiment only**. The live `WordGenerator` and `GameEngine` are unchanged. No production or multiplayer selection changes are approved.

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

**Important limitation:** This real-engine harness currently evaluates the *existing baseline generator only*. The experimental Wordcraft-aware candidate is not wired into GameEngine, so the earlier proxy candidate comparisons must not be presented as real-engine head-to-head results.

## Go/no-go before a live feature
1. Confirm all CI checks pass and review the actual per-stage logs.
2. Expand samples and inspect early levels where 2–4 letter limits severely constrain grammatical coverage.
3. Extend the real-engine baseline harness to evaluate a seeded candidate generator without modifying production gameplay; add varied reaction times, mistakes and spell effects.
4. Preserve seeded deterministic fairness and server verification in Wizard Duels; do not use the player's capture history to influence live spawns.
5. Check the actual candidate generator's recent-word fairness and complexity distributions. If it causes any significant regression, reject it.
6. Obtain approval before changing the live word-selection policy. Keep it off by default until validated.
