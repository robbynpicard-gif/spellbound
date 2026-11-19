# Typel gameplay implementation plan (approved 2026-11-18)

Status: design decisions approved; code implementation and testing pending. Do not merge without passing tests and playtesting.

## Core constraints
- Preserve responsive, legible, skill-based typing; no difficulty assistance or dark patterns.
- Keep simulation independent of Phaser/DOM, deterministic with seeded randomness, and reusable across modes.
- Existing art is placeholder. Future wizard/typewriter/central-ward/falling-scroll layout is a flexible direction, not a blocker for gameplay work.
- Do not replace working features: compare against current code before editing.

## Campaign Endless
- Keep standalone Endless Practice in main menu.
- After each campaign stage boss, stage is marked complete. Offer Advance or Continue Endless.
- Campaign Endless ramps difficulty within safe bounds and tracks a separate score.
- Player can leave Endless and advance at any time; death in Endless must not revoke stage completion.
- Test saving, resuming, transitions, scoring and failure.

## Ice
- Fixed 6 seconds per cast; additional casts add 6 seconds to remaining freeze.
- Freeze active words, suspend spawns, and pause boss timer during freeze.
- Typing can still clear words. Prevent spending an Ice charge on an empty field.
- Check interactions with Slow and other effects; add timer and stacking tests.

## Slow
- Preserve existing implementation: each cast has its own timer and multiplicative speed reduction during overlap; each expires independently.
- Regression-test stacking, expiry and interaction with Ice. No redesign.

## Encounter variety
- Preserve recognizable stage identity and structured progression, with seeded variation in word choice, spawn timing and positioning.
- Add telegraphed Swarm events (bursts of short words) and Dangerous Word events (visually distinct, higher ward threat).
- Scale by stage difficulty; cap simultaneous threats and respect active word counts.
- Test deterministic replay, spawn caps, difficulty bounds and readability.

## Clean Streak
- Count completed words, not letters. Verify milestones against the existing handoff before changing UI.

## Implementation sequence
1. Inspect current code, tests, existing game modes and decisions; record confirmed gaps.
2. Implement Campaign Endless and tests.
3. Adjust Ice and regression-test Slow.
4. Add seeded encounter variants and tests.
5. Run npm run check, inspect CI, perform manual playtest.
6. Separate later visual overhaul; preserve readability and typing responsiveness.

No gameplay behavior has been changed by this planning file.
