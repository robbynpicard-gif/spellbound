> **Document status: HISTORICAL** (classified 2026-11-22, D-104). Kept for context; not a current requirement. Playtest notes for the legacy Endless. Where it conflicts with `docs/decisions.md` or a current document in the [docs index](../README.md), those win.

# TypeL — next gameplay playtest (unreleased)

Status: development branch only. No Pages deployment authorized.

## Batch: Endless pressure waves and scroll readability

- Preserve the existing boss victory and in-place Endless continuation.
- Preserve the permanent Endless escalation: +4% fall speed and arrival pressure per 25 captured words.
- Add a 60-second cycle: 0–20 s build, 20–32 s surge, 32–46 s relief, 46–60 s settle.
- During surge, spawn interval ×0.72 and maximum active words +2 (capped at 16). During relief, spawn interval ×1.30 and active-word allowance −2. Baseline pace remains unchanged between cycles.
- Prefer less crowded horizontal spawn lanes in the top 90 field pixels, using a separate seeded random stream to avoid changing word and spell drop probabilities. Do not remove words or reduce normal difficulty.
- Slow remains unchanged. Top-field accumulation and Harvest farming are recorded as balance observations, not bugs.

## Player acceptance checks once approved for deployment

1. Beat Stage 1 boss. Victory appears immediately at timer zero. Choose Endless; battlefield, combo, spells and ward carry over; victory overlay disappears.
2. Endless first 20 seconds: pressure builds gently. Next ~12 seconds: surge feels intense, with surge indicator. Next ~14 seconds: noticeably fewer incoming words. Final ~14 seconds: normal cadence at the current higher floor.
3. After several cycles, base difficulty rises with captured words; relief never resets that progression.
4. At Stage 1 late levels and in Endless, check whether newly appearing words overlap less near the top. Existing crowded words are not teleported or removed.
5. Stack Slow two or three times, then cast Harvest. Note whether the combo is excessively rewarding; do not rebalance without evidence.
6. Check Normal 1–8 quick-cast, Hardcore typed casting, Ice, pause/resume and existing spell-scroll drop rate.

## Next implementation debt after this batch

D01: Make test enforcement mandatory again after reconciling legacy expectations. The development branch has a build-and-test-only workflow; main remains unchanged until owner approval.
D07/D13: Save/reload and transition continuity tests (ward, spell charges, combo, active effects).
D14: Difficulty calibration across Normal/Hardcore stages and Endless cycles.
