# Precision Combo scoring proposal — owner clarification

2026-11-20. **Approved design direction:** Combo must be unambiguous: **one incorrect keystroke immediately breaks the precision Combo**, even if the player fixes it with Backspace. A corrected word may still be completed normally but does not restore the lost Combo. This is a change from the existing D-040 combo tolerance.

**Proposed, not yet approved for live gameplay:** a Combo multiplier of `1 + floor(consecutivePerfectWords / 10)`, a separate pace-based Volley multiplier, and the formula `(letters × 10) × Combo × Volley`. Retire Clean Streak as an independent scoring multiplier only after validating implications for mana-pool growth, Triumphs, Harvest, scoring bonuses, UI, campaign balance, and replay determinism. **Do not silently alter the live engine.**

The offline implementation in `src/gameplay/PrecisionComboPrototype.ts` captures the agreed typo-reset semantics and the proposed 10-word progression; tests check immediate reset, no restoration by correction, and the proposed equation. It is deliberately not imported by the live engine.

**Next step:** compare the proposed model with the existing scoring across fixed deterministic replays, explicitly define Volley thresholds (ideally character-normalized so long words are not penalized), and request approval for the complete scoring migration before touching GameEngine or UI. Protect the already-approved core experience under D-058.

## Owner-approved consolidation and fantasy

The owner explicitly approves consolidating **Clean Streak** under **Combo** and **Volley** wherever necessary, rather than preserving Clean Streak as a distinct gameplay concept. Combo is the single precision chain: one incorrect keystroke resets it immediately, even if corrected. Its proposed +1 multiplier every ten perfect captures builds escalating energy. Volley is the temporary speed/flow multiplier, more accessible on Normal than Hardcore. The score direction is `(letters × 10) × Combo × Volley`.

**Fantasy:** Combo builds never-ending arcane energy through precise typing; Volley tempts the player to accelerate and ride that energy into a crackling arcane typewriter overcharge. High Combo makes Volley exciting, but speeding up risks a typo and losing Combo. Feedback should amplify typewriter and score, never obstruct falling words.

**Migration guidance:** remove Clean Streak as a separate multiplier and visible mechanic. Rehome spell-pool growth thresholds and existing historical achievements into the precision Combo system, preserving earned awards and existing stored statistics where required for backwards compatibility. Do not erase saved lifetime achievements. Avoid redundant duplicate counters in the new engine. Mode-specific Volley thresholds should use sustained character-normalized pace and fixed-tick deterministic behavior. No word spawn manipulation.

**Next implementation:** integrate scoring and clean-streak consolidation on the dev branch with regression coverage for typos, campaign transitions, spell-pool progression, saved achievement migration, mode-specific Volley, and spell scoring. Keep production untouched pending verification.
