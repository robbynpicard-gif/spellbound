# Scoring comparison — offline experiment, not live balance

**Status:** Synthetic deterministic comparison and automated tests; **no change to GameEngine, preview scoring, or production**. D-058 remains in force.

## What was tested

The source `src/gameplay/ScoringComparison.ts` applies the **existing scoring formula** (base, Combo, Clean Streak) and the **proposed** `(letters × 10) × precision Combo × Volley` to identical synthetic capture streams. The existing score is modeled **without optional bonuses** unless supplied, and with corrected-typo handling, so this is not a full campaign score prediction. It is not a replay of actual player inputs or real word spawn events.

Scenarios covered by `ScoringComparison.test.ts`:
- Twenty five-letter words at 45 WPM (ordinary pace).
- Thirty six-letter words at 110 WPM (expert flow), compared with identical words at 45 WPM.
- Twenty-five six-letter words at 85 WPM with a corrected typo on the twentieth capture; the old Combo continues, the proposed precision Combo resets.
- Boundary tests for character-normalized Volley thresholds, invalid inputs, determinism, and input immutability.

## Provisional Volley thresholds for experimentation

| Recent character-normalized typing pace | Hypothetical Volley |
| --- | --- |
| Below 65 WPM | ×1 |
| 65–84.9 WPM | ×1.5 |
| 85–109.9 WPM | ×2 |
| 110+ WPM | ×3 |

**These thresholds are NOT approved.** A real Volley must use a rolling pace window, require sustained clean captures, avoid awarding full Volley from a single fast word, and expire promptly when flow breaks. The present simulator takes pace as an input rather than pretending it already measures sustained flow. A typo suppresses Volley on the affected capture in the experiment.

## Important migration risks

1. **Combo reset:** The owner explicitly wants an incorrect keystroke to break Combo immediately, even if corrected. The existing D-040 behavior is more forgiving. This is a player-facing change and must be deliberate.
2. **Clean Streak:** Its existing scoring multiplier overlaps Combo, but the same clean-capture count also governs **mana pool growth** (D-057), and its historical counters drive **Precision Rune** and **Unbroken Quill Triumph**. Do not delete the tracking variable or achievements while removing only the multiplier.
3. **Bonuses:** Current Quick, Clutch, Perfect, Alliteration, Librarian, Metronome, Clean Sweep, and level-end bonuses affect score. A strict new formula needs an explicit disposition for these; do not silently discard them.
4. **Spell scoring:** Harvest uses Combo × Clean Streak; Fire and overflow have their own scoring rules. Migrating the formula without reconciling these changes spell balance.
5. **Campaign carry-over and UI:** Combo and Clean Streak persist across Campaign levels; displays, stats, tutorial and difficulty need updates if the formula is accepted.
6. **Balance:** A linear, uncapped Combo could eventually exceed the current capped multiplier. A meaningful Volley needs enough payoff to feel exceptional without trivializing level scores.

## Recommendation

**Next implement a genuine sustained-flow Volley detector as an isolated, fixed-tick module** using captured character counts and recent capture timing, with tests for mixed word lengths, pauses, mistakes and short bursts. Then compare *full* deterministic gameplay replays, including bonuses and spells, before proposing a live migration. If the proposed model damages gameplay clarity or balance, adjust the proposal rather than altering word spawning.

**CI tests are the verification mechanism** for this offline module. Passing tests prove the model is internally consistent, not that it feels good in play.
