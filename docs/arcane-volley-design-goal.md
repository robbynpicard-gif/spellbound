# Arcane Volley — momentum, ignition, surge and mastery (design goal)

2026-11-20 · **Owner-approved design direction; balance values deliberately provisional.**

## Player fantasy and invariant goals

**Combo builds power; Volley ignites it.** Volley should feel like a Bejeweled Blitz-style hot streak: each timely, flawless capture visibly charges an arcane typewriter; the player senses an approaching eruption, earns a dramatic Surge, then fights to sustain and surpass it. Reward early success frequently, make the first payoff achievable in a good Normal run, and reserve sustained high multipliers for genuine typing mastery.

This document supersedes the *design target* of a fixed ×1.5/×2/×3 Volley ladder. It does **not** activate new gameplay, set final balance, or authorize production deployment. The solo development preview now contains an experimental fixed-tick capture-chain Volley; its timing and payoff remain playtest variables. Production retains its older implementation.

## Multiplier shape — targets, not fixed thresholds

1. **Kindle / two-word trigger (owner-confirmed):** the first clean capture only opens a timing window at ×1; a second clean capture **inside that window** earns ×1.2, followed by approximately ×1.4 → ×1.6 → ×1.8 on further timely captures. A late second word restarts the window rather than earning a multiplier. The initial capture should still visibly communicate that the window is open; it must not award Volley automatically.
2. **Ignition / first eruption:** approximately ×2 is a candidate dramatic Surge threshold, with sound, sparks and visible arcane discharge that do not obstruct typing. The exact ignition and payoff point remains open to playtesting.
3. **Sustained Surge:** keep increasing in approximately +0.2 steps through an extended energized phase. The owner specifically wants to explore ignition/Surge lasting across roughly ×2–×5; do **not** treat either bound as locked.
4. **Mastery / soft cap:** explore a soft cap **around ×5**, beyond which steps become **+0.1** (×5.1, ×5.2, ×5.3 …), and each step takes progressively more qualifying effort. This replaces the earlier suggested soft cap at ×3 and +0.2 increments beyond it. Soft cap means slower growth, **not** an absolute multiplier ceiling. Keep sane numeric/visual safeguards without arbitrarily denying exceptional play.
5. **Balance for emotion, not numerology:** the number of captures, charge costs, qualifying pace, initial Surge multiplier, soft-cap position and how hard post-cap advancement becomes are playtest variables. Preserve the intuitive ramp, eruption, maintenance, and rare mastery even if the specific numbers change.

## Qualification, decay, and fairness — still to design and test

- Volley must reward **fast, fluent, accurate typing**, not merely accumulating slow captures. Prefer an intuitive, visible capture-to-capture momentum chain over a hidden rolling average as the primary player-facing explanation.
- Qualifying windows should account for word length and genuine word availability; do not punish a player for waiting when no reasonable target is available. Normal should invite participation; Hardcore should demand greater pace, not offer different peak multipliers.
- A typo immediately breaks the precision Combo; design Volley error handling consistently with the agreed precision-first identity. Explore visible momentum decay/grace on **natural pauses** rather than arbitrary sudden collapse; do not finalize decay behavior until tested.
- Every qualifying capture must visibly feed the charge, and the typewriter itself should convey proximity to eruption and the intensity of the ongoing Surge. At high multipliers, prioritize readability over infinitely escalating visual clutter.
- Maintain the simple scoring identity: **(letters × 10) × Combo × Volley**. No separate hidden charge scoring currency or revived Clean Streak multiplier.
- Honor D-058: **never bias word generation, alter difficulty, or distort typing feel solely to trigger Volley or its visual rewards**. Preserve seeded deterministic fixed-tick gameplay and existing achievements/save compatibility.

## Proposed validation before gameplay rollout

Prototype and playtest at least two ignition/payoff timings and two decay/qualification models, with Normal and Hardcore runs; measure time to first reward, first Surge, share of runs reaching ×3/×5, sustain duration, and rare post-cap achievements. Test long words, pauses without available targets, errors/backspace, stage transitions, and multiplier/score determinism. Prefer the variant that feels legible, attainable early, thrilling at eruption, and legitimately demanding beyond the soft cap.

**Implementation status:** owner approved iterative experimentation in the isolated dev preview, including the two-word trigger. This does not authorize changing production main.
