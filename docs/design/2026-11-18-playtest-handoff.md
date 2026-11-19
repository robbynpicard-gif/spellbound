# Wizzy Type — Playtest and Design Handoff (2026-11-18)

> **Status:** Design specification and backlog only. No gameplay code is changed by this document. This branch is separate from `main` and should not deploy to GitHub Pages unless explicitly configured to do so.
>
> **For Claude / other coding agents:** Inspect the actual code and existing tests before implementing. Never treat an experimental idea or example value as an approved rule. Implement approved changes in small, independently testable commits. Preserve current behavior except where explicitly changed here. Ask before resolving material ambiguities.

## 1. Product principles and current context

Wizzy Type is a fantasy wizard typing arcade game inspired by Typing Maniac. The aesthetic is playful **Alchemical Renaissance**: manuscripts, brass instruments, magical apparatus, eccentric wizards, tactile scoring, and legible in-world feedback. Typing remains the primary interaction.

Existing structure reported from design notes (verify against code): Normal and Hardcore, five stages each, 20 levels per stage (levels 1–19 word quotas, level 20 timed boss), followed by Endless. Falling word-scrolls persist across level boundaries. Score, Combo, and Clean Streak persist through a stage. Eight shared spell-charge slots support Fire, Slow, Ice, Barrier, Shock, Alter, Wind, and Harvest. Naturally occurring colored spell scrolls are important.

**Protect this discovered fun interaction:** Under pressure with few charges, the player scans upward for a colored spell scroll, types it to recover a charge, then uses that spell tactically. Do not replace or trivialize it.

## 2. Approved playtest fixes and changes (not necessarily implemented)

### 2.1 Between-level dialog rendering
- Scrolls currently vanish visually during the level-completion dialog, including scrolls outside the dialog, then reappear in their original positions.
- Keep the actual battlefield rendered and **frozen** behind the dialog, with all existing scrolls visible.
- Preserve scroll identity, position, state, and continuity. Do not regenerate them.
- Inspect conditional rendering/mounting, opacity, overlay, and pause state. Root cause is not confirmed.

### 2.2 Boss -> Endless continuity
- After completing level 20, transition **directly into Endless as an extension of the boss encounter**, not back to level 19.
- Preserve current battlefield, positions, ward, score, charges, Combo, Clean Streak, Volley (when implemented), and active effects as appropriate.
- Remove boss countdown and quota in Endless; continue until ward destruction.
- Difficulty grows exponentially, **primarily via falling speed**; spawn frequency grows more conservatively. Exact curves remain tunable and unapproved.
- Inspect boss-specific patterns before defining the precise handoff. Do not accidentally reset or duplicate spawns.

### 2.3 Variable scroll falling speeds (global)
- Apply stable per-scroll speed variation to **all modes and stages**, not just Endless.
- Individual scrolls may overtake each other.
- Initial suggested range: **0.85×–1.15×** centered around 1.0×; this range is provisional.
- Individual modifier remains stable during descent except for spell/mistake/global difficulty effects.
- Add subtle visual indications for faster scrolls; a brief sound cue only for particularly fast ones. Avoid clutter and repeated audio in late-game high-speed conditions.
- Speed cues should represent actual urgency (effective falling speed), while preserving visibility of colored spell-scroll markers.
- Critical-plunge error cues should remain distinguishable.

### 2.4 Early word lengths
- Provisional initial distribution: **10% two-letter, 70% three-letter, 20% four-letter** words.
- Preserve longer-word progression at later levels. Measure rather than assume Volley fairness.

### 2.5 Ice empty-field behavior
- If the last active scroll is removed while Ice is active, **end Ice immediately**, discard all remaining stacked Ice duration, and resume normal spawning.
- Applies whether the field was cleared by typing, Fire, Shock, Harvest, or another effect.
- Casting Ice on an already empty battlefield should be **rejected without consuming a charge**, for both typed and quickcast paths, with restrained feedback.
- Do not misclassify a temporarily hidden/paused battlefield as empty; avoid duplicate spawn bursts.

### 2.6 Boss timer interaction
- While Ice is active: boss countdown progress is **0%**. Ice's own duration continues to tick during active gameplay.
- While Slow is active (and Ice is not): boss countdown progresses at **80%** of normal rate. This timer penalty is **nonstacking**, even when Slow movement/duration stacks.
- Ice overrides Slow for countdown. On Ice expiry, resume at 80% if Slow persists, otherwise 100%.
- Existing Slow movement effect (~60% speed) is not changed by this timer rule.
- Menus and between-level pauses freeze relevant gameplay clocks.
- Boss completion uses adjusted countdown progress, not elapsed wall time.
- Test overlapping/staked effects, boss victory boundaries, and transitions into Endless.

## 3. Approved scoring redesign direction — implement separately

### 3.1 Incorrect Enter acceleration
- Correcting a typo **before Enter** must not trigger random scroll acceleration.
- Submitting an incorrect word with Enter triggers independently randomized scroll acceleration: usually minor, sometimes major, exceptionally a rare but recoverable critical plunge.
- Exact probability distribution and speed multipliers are **not finalized**.
- Rare recovery should feel exciting; include anti-farming safeguards.
- Define composition with per-scroll speed variance, Slow, Ice, and Wind (which removes mistake speed-ups).

### 3.2 Combo
- Keep tiers: ×2 at 5, ×3 at 12, ×5 at 25, ×10 at 45 (base ×1).
- A corrected typo before Enter drops Combo to the **beginning of the previous attained tier**, even if the eventual submission is correct.
- Incorrect Enter or a missed scroll resets Combo completely.
- Volley timing expiry does not affect Combo.
- Specify edge cases/tier boundaries before coding. Evaluate interaction with Clean Streak to avoid unintended double punishment.

### 3.3 Volley
- Separate fast rhythmic capture system, distinct from Combo.
- Ignite on **four rapid successful captures**.
- **Provisional** rolling interval between captures for activation: 1.25 seconds.
- **Provisional** maintenance interval after ignition: 1.5 seconds.
- Every four *additional* successful captures, maintenance window shrinks **5% multiplicatively**, indefinitely, no fixed floor.
- Bonus increases per successful capture without cap; exact bonus growth rate **not approved**.
- Incorrect Enter resets Volley immediately. Corrected typo does not directly reset Volley if capture is completed in time. Expiry resets Volley only.
- Feedback: escalating crackle before ignition, distinct ignition, sustained magical hum/visual state, fade on break.
- Do **not** change Volley timing or spawning to guarantee early activation yet. Longer words may need a small, measured time allowance if playtesting demonstrates unfair failures; no allowance approved.
- Monitor Volley opportunities, word length, spawn availability, player skill, and stockpiling behavior.

## 4. Newly approved gameplay direction: ordinary Summon Scrolls

**Design approved in principle; numerical parameters and exact integration remain provisional. Not implemented by this commit.**

Goal: remove downtime for skilled typists in levels 1–19 while allowing beginners to ignore the mechanic. Higher scores for successfully typing additional/accelerated challenges are acceptable; typing skill should be rewarded.

- Optional, manually triggered **Summon Scrolls** action, separate from the eight spell charges.
- **Unlimited uses governed by cooldown**, not a consumable charge bank.
- Available only at relatively **low battlefield density**.
- Spawn a small batch of ordinary scrolls; **three** is a prototype suggestion, not final.
- Summoned scrolls are part of the **existing level quota**, not unlimited extra quota-free words.
- They should **accelerate progression** rather than indefinitely extend an easy level.
- Successfully captured summoned scrolls grant normal scoring plus a **modest bonus**; no points merely for pressing Summon. Bonus size not finalized.
- Existing targeting, typing, ward, Combo, Volley, and spell-scroll rules need explicit integration. Avoid creating extra natural + summoned spawns beyond remaining quota; account for pending/scheduled and currently active scrolls.
- Do not allow summon actions during completion overlays or accidentally affect boss/Endless rules. Initial intended scope is levels 1–19; confirm before implementing.
- Guard against farming, density overflow, unintended spell-charge inflation, and broken level transitions.
- Keep the UI and control simple; typing must remain the focus.

## 5. Experimental backlog — **DO NOT IMPLEMENT WITHOUT NEW APPROVAL**

### 5.1 Smoldering Volley
An already ignited Volley might temporarily smolder while no eligible scrolls are available, preserving earned momentum without indefinitely maintaining a multiplier. Potential bounded grace period; no exact rule approved. Consider whether pre-ignition partial Volley should behave differently.

### 5.2 Adaptive replenishment
Automatically spawn a small batch (roughly 3–5 as a concept) when a skilled player clears the field unusually fast. Risk: self-triggering loops, quota interference, farming. Superseded as the immediate preference by manual Summon, but retain as an experiment.

### 5.3 Word-length-aware Volley timing
If skilled players fail primarily because of longer words, consider a small capped time allowance. Example discussed (+0.1 sec per character beyond six) is **illustrative only**, not an approved parameter.

### 5.4 Offensive scroll bank / specialized scrolls
Potential future high-risk/high-reward summoned scroll types with scoring properties. Not approved. A separate mode may eventually be appropriate, but no decision.

### 5.5 Emergency random spell-scroll summon (hail-Mary)
New idea under discussion, **not approved**:
- A separate, substantially longer-cooldown action summons **one random colored spell scroll** onto the battlefield, which must be typed successfully to earn the charge.
- Intended as a risky survival opportunity when pressure is high and spell reserves are low.
- Working name “Arcane Gambit” only.
- 90–120 seconds was an illustrative cooldown, **not approved**.
- Open question: guaranteed random spell scroll vs a chance of an ordinary/non-spell result. No final decision.
- Avoid trivializing natural colored-scroll hunting, unlimited charge generation, and unavoidable failure at extreme falling speeds.
- Determine interaction with the eight-charge cap, spell selection, stage boundaries, and boss/Endless before implementation.

### 5.6 Typing development and statistics
Potential accuracy, WPM, personal bests, and post-stage statistics. Exploratory only; avoid intrusive tutoring.

## 6. Recommended implementation sequence

1. Inspect repo, identify existing test harness, game state model, spawn scheduling, timers, and deployment configuration.
2. Fix between-level battlefield visibility and Ice empty-field/cast guard; regression test.
3. Correct boss timer handling and boss-to-Endless transition; regression test.
4. Implement per-scroll speed variance and restrained cues; verify composability with spell/mistake effects.
5. Adjust early word-length distribution, retaining later difficulty progression.
6. Implement Combo/incorrect Enter/Volley redesign **only after** clarifying remaining numerical and penalty edge cases; separate commits.
7. Implement ordinary Summon Scrolls behind a feature flag or experimental branch after confirming quota accounting and bonus values.
8. Leave all Section 5 concepts as backlog until explicitly approved.

## 7. Minimum regression scenarios

- Scrolls remain visible and frozen behind level-completion dialog, with identical positions after resume.
- Scrolls persist into boss and Endless without resetting resources, speed modifiers, or active effects.
- Ice expires when field empties; no charge consumed for empty-field cast; no duplicate spawn.
- Ice + Slow overlap: boss timer 0% during Ice, 80% during Slow only, 100% otherwise.
- Menus pause timers; no timer desync after boss-to-Endless.
- Per-scroll speed variance remains stable; cues do not obscure spell scrolls or spam sounds.
- Corrected typo vs incorrect Enter produce distinct Combo/Volley/acceleration outcomes.
- Volley does not gain or lose captures due to quota transitions or unavailable scrolls unexpectedly.
- Summon does not overfill quota, farm unbounded bonus points, spawn during overlays, or bypass typing.
- Natural spell-scroll hunting remains viable and important.

## 8. Collaboration protocol

- Treat this document as **design intent**, not evidence of code implementation.
- When Claude implements a batch, record the relevant commit, tests, deviations, and unresolved questions in the PR or change notes.
- Do not merge into `main` or deploy the live site without the owner's review.
