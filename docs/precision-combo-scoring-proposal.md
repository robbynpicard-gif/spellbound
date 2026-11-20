# Precision Combo scoring proposal — owner clarification

2026-11-20. **Approved design direction:** Combo must be unambiguous: **one incorrect keystroke immediately breaks the precision Combo**, even if the player fixes it with Backspace. A corrected word may still be completed normally but does not restore the lost Combo. This is a change from the existing D-040 combo tolerance.

**Proposed, not yet approved for live gameplay:** a Combo multiplier of `1 + floor(consecutivePerfectWords / 10)`, a separate pace-based Volley multiplier, and the formula `(letters × 10) × Combo × Volley`. Retire Clean Streak as an independent scoring multiplier only after validating implications for mana-pool growth, Triumphs, Harvest, scoring bonuses, UI, campaign balance, and replay determinism. **Do not silently alter the live engine.**

The offline implementation in `src/gameplay/PrecisionComboPrototype.ts` captures the agreed typo-reset semantics and the proposed 10-word progression; tests check immediate reset, no restoration by correction, and the proposed equation. It is deliberately not imported by the live engine.

**Next step:** compare the proposed model with the existing scoring across fixed deterministic replays, explicitly define Volley thresholds (ideally character-normalized so long words are not penalized), and request approval for the complete scoring migration before touching GameEngine or UI. Protect the already-approved core experience under D-058.
