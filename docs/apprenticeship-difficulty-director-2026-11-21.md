# TypeL — Shared Apprenticeship Difficulty Director
_2026-11-21 · D-097 · owner-approved CORE GAMEPLAY DIRECTION; algorithm and balance remain PROTOTYPE DESIGN, not yet implemented._

## The owner's intent
> The apprenticeship difficulties sequentially shouldn't be defined by a predetermined length of words that slowly increases; they should be determined by a slow increase of the floor of a gameplay loop that uses an exponential difficulty sequence that scales by pulling levers of word length and word fall speed. The word fall speed and word length need to be an identity of the game loop from the beginning. The scaling difficulty comes from how the player experiences that increase.

**Decision:** Every apprenticeship, from first to last, uses the **same expressive typing-pressure loop**. **Word length and fall speed are core levers from the very first lesson**. Apprenticeships progressively lift the **floor** of this loop, while the loop itself contains an escalating, nonlinear pressure arc, contrasting recoveries and climaxes. It is not a staircase that only unlocks longer words in later stages. Difficulty is experienced through **joint distributions and timing** of length and speed, not a literal exponential growth in raw pixels/second until play becomes impossible. **Do not flatten the challenge into predetermined stage-specific word-length brackets.**

## Status taxonomy
**DECIDED:** shared director across all apprenticeships; short/long and slow/fast words possible from the start; rising apprenticeship floor; nonlinear internal escalation; fair recovery variation; word length and fall speed primary; preserve core game and spells.
**EXPLORATORY:** mathematical curve, length ranges and probabilities, fall-speed caps, density contribution, progression mapping, dynamic adaptation, recovery cadence, numerical targets, stage length and mastery thresholds.
**SUPERSEDED AS FINAL DESIGN:** stage N means only lengths [N+X,N+Y]; solely linear level WPM target as entire difficulty identity; difficulty created only by more spawns; uniformly long-fast words in advanced stages.
**IMPLEMENTED CURRENTLY:** `src/difficulty/Stages.ts` uses `STAGE_TUNING.lengths` by stage, linear `levelWpm`, fallSeconds, per-level speed/spawn ramps, weighted lengths, surges, 5×20 stage scaffolding. `src/difficulty/DifficultyConfig.ts` exposes `wordLengthWeights`, `initialFallSpeed`, `speedVariance`, `speedRamp`, `spawnInterval`, `spawnRamp`, `surges`, `maxActiveWords`. These are a good integration seam but **do not yet fulfill D-097**. Confirm all other apprenticeship entrypoints before implementation. `docs/typel-direction-2026-11-21.md` D-086–096 has newer approved Arcane Rush, catch-on-wrong-submission, Shock, Ice melt, asset, music, HUD and typewriter changes: **do not regress them**.

## Four challenge quadrants (all present from the outset)
| Combination | Intended skill demand | Typical role |
|---|---|---|
| Short + slow | rhythm, recovery, easy capture, reengagement | breathing room and Rush recovery |
| Long + slow | sustained accuracy and commitment | precision challenge |
| Short + fast | reaction, target switching and prioritization | urgent but manageable |
| Long + fast | highest combined time pressure, spell tradeoffs | rare spikes early, more common at higher pressure |

A word's difficulty depends on its **time-to-Ward versus expected time to type**, not length or speed in isolation. Consider distance already fallen, actual length/complexity, available typing time, player choice, crowding, and spells. The director should create demanding **choices**, not unavoidable deaths.

## Proposed director architecture — algorithmic SPECIFICATION, not approved tuning
Create a pure deterministic `DifficultyDirector` (or equivalent) that takes:
- **mode** (Normal/Hardcore);
- **apprenticeship position** (ordinal/progress, independent of hard-coded 20-level format);
- **encounter progress** (0–1; boss or endless semantics where applicable);
- **seeded RNG and simulation tick**;
- **current field state** for fairness (available targets, pressure, max density, recent challenge mix);
- **approved encounter overrides** (teaching goal, boss, tutorial/sandbox);
and returns a reproducible **challenge envelope**: desired joint word-length/speed distribution, current floor/peak pressure, safe caps and optional spawn/density envelope. Do not make rendering, art, music or audio own difficulty.

### Layer 1: slowly rising apprenticeship floor
Let `a∈[0,1]` denote normalized apprenticeship progression, not a fixed number of stages. Candidate `floor(a)=F0+(F1-F0)*smoothstep(a)`, or a shallow monotonic calibrated curve. **Slow** floor growth is the principle, not a prescribed formula. Later apprenticeships still offer short-slow recoveries; floor can be interpreted as **expected baseline demand** rather than absolute minimum word length/speed. Avoid hard banning easy words.

### Layer 2: exponential-feeling pressure within a loop
Let `p∈[0,1]` denote progress through a repeatable encounter arc. Candidate normalized convex rise:
`rise(p;k)=(exp(k*p)-1)/(exp(k)-1)` for `k>0`.
`pressure(a,p)=floor(a)+(ceiling(a)-floor(a))*rise(p;k)`.
This is a **candidate design tool**, not a mandate that every spawn literally gets harder or that each level is one fixed-duration ramp. Add deterministic recovery pulses, swells and climaxes to create tension and relief; keep pressure bounded and playtest-calibrated. For Endless, repeat/extend arcs with sensible saturation instead of an unbounded impossible exponent. Bosses may modify the envelope without changing the shared language.

### Layer 3: joint length × fall-speed distribution
Instead of stage-specific hard `minLen/maxLen` identities, sample a **joint distribution** over length bands and speed bands. Both variables must vary in every apprenticeship, with challenging combinations possible from the start at lower frequency. As pressure increases, shift probability toward longer and/or faster words, **not necessarily both together**. Preserve mixed choices on screen and enough short/slow words for skilled recovery and Arcane Rush Flow Preservation.
- Determine supported lengths from actual word library, not fabricated text.
- Convert normalized speed band to **time-to-Ward / field speed** with clear caps; scale with viewport and game physics consistently.
- Make rare long-fast spikes telegraphed and survivable at early progression.
- Allow multiple simultaneous threat types; never deliberately spawn a situation with no viable response under reasonable play.
- Preserve seeded RNG/replay. If sampling uses RNG, draw order must be deterministic and logged/replayable.

### Layer 4: secondary pressure levers
**Spawn interval, simultaneous word density, surges and word complexity** remain supporting variables. They can intensify the experience but must not erase length/speed as the identity of the loop. The owner has NOT approved a new automatic skill-assist system. Do not silently adapt difficulty based on player WPM, errors, or success; propose that separately. Spell effects (Slow/Ice/Alter/Fire/Shock/Harvest/Wind/Barrier) must still act on authoritative world state, not be overridden by director recalculation. In particular: D-092 catch plunge happens on **wrong submission**, one word; D-095 scroll scale is visual and must not covertly change fall speed; D-077 Ice and Arcane Rush clock semantics preserved.

## How to implement safely — sequenced work
**Phase 0: current-loop audit (first).** Map actual 9 apprenticeship/lesson entrypoints, stage config generation, word generator, spawn timing, fall-speed sampling, bosses, sandbox, Practice, Hardcore and save/replay. Document exact current behavior and source paths. Do not assume D-047's five stages describe the latest apprenticeship implementation. Verify whether encounter pressure already includes a nonlinear curve. Identify what changing `DifficultyConfig` would break.
**Phase 1: pure director prototype.** Add a deterministic module and tests, behind a dev-only feature flag. No live production change. Choose initial *clearly labeled experimental* envelopes, not final balance.
**Phase 2: simulation.** Seeded thousands-of-spawns tests across first/middle/last apprenticeships, Normal/Hardcore, encounter openings/peaks and bosses; plot length distribution, fall-time percentiles, joint quadrant mix, estimated typing time vs time-to-Ward, density, expected breaches and recovery frequency. Confirm no absent quadrants, no unbounded speed, no silent adaptive assistance, and monotonic *statistical* floor growth.
**Phase 3: integration.** Feed director outputs through existing `DifficultyConfig` and word generation, preserving spells, Rush, catch loop, quotas, boss logic, audio, art and save semantics. If per-word speed bands require new config/engine interfaces, design that seam explicitly; don't silently substitute global fall speed for joint sampling. Test old saves/replays and migration.
**Phase 4: actual playable comparison.** Make a reversible preview-only toggle or separate dev sandbox to compare old/new difficulty. Include clear labels and a concise script to test opening, build, surge, recovery, final pressure, each quadrant and each spell apprenticeship. Measure actual player perception, not only formulas. Keep existing baseline available.
**Phase 5: review and calibration.** Owner playtest and tuning; only then update numeric decisions. Do not merge to `main` without explicit authorization. Verify deployed preview and CI.

## Acceptance tests (required)
1. First apprenticeship can produce all four quadrants with meaningful nonzero probability; no forced progression gate on longer words.
2. Last apprenticeship still has short/slow relief; statistically harder typical and peak situations.
3. Length and speed change together in a controlled **joint** sampling scheme; distinct short-fast and long-slow scenarios exist.
4. Pressure curve is convex/nonlinear in at least one approved test scenario; not just a fixed linear ramp.
5. Escalation is bounded and does not generate unavoidable failure for a reasonable calibrated typing skill; avoid asserting universal fairness from synthetic tests.
6. Replaying a seed and actions reproduces every word, speed and timing outcome.
7. No alterations to existing spell effects, score math, Rush, catch trigger, audio, visuals, lesson unlocks, or campaign state.
8. Difficulty Codex/help text reflects actual implementation and clearly distinguishes experimental tuning.
9. Preview builds and gameplay tests pass, with verified branch/commit; production untouched.

## Decision requests for the owner AFTER a playable prototype
- Preferred **intensity of exponential-feeling ramp** and frequency/length of recovery windows.
- Whether advanced apprenticeship raises floor chiefly by probability shifts, higher minimum speed, or a mix (while still allowing relief).
- What counts as an acceptable rare long-fast threat at the first lesson.
- Whether the same director should shape boss and Endless pressure differently.
Do not block initial reversible experimentation on these values.

**Creative north star:** Players recognize the same living, escalating loop from their first spell lesson to their last. Progression is felt as greater mastery under richer, faster, more consequential pressure—not as a menu unlocking longer words.


## D-098 owner refinement — dominant word-length windows with rare outliers (2026-11-22)
**DECIDED:** Preserve the familiar progression feel of the older word-length model. Each apprenticeship has a **dominant, softly bounded word-length window**, with **small, nonzero probabilities** of words outside it. **Slow apprenticeship** is the illustrative early anchor **3–6 letters**; seven-letter words must not be common at Slow level 1, and should be especially rare at its opening. **Harvest** is the illustrative late anchor: **6+ letters normally**, with occasional shorter-word relief. Intermediate apprenticeships shift their dominant window naturally from Slow toward Harvest. **The director must not interpret D-097's 'all four quadrants from the beginning' as equal frequency or common long-fast threats in the opening lesson.** The challenge's primary levers remain word length AND fall speed; joint probability, encounter pressure, and rare outliers matter.

**EXPLORATORY, not owner-approved numeric balance:** precise intermediate windows; upper length cap for Harvest based on available dictionary and readable gameplay; tail percentages; exact per-lesson or per-encounter shifts; how to distribute lower vs upper outliers; whether exceptional long words are telegraphed or scored specially. A possible prototype is 95–99% within the dominant range at the start of Slow level 1, with very rare 7+ words; do NOT treat this illustrative percentage as an owner decision. Likewise, '6+' is a dominant late-game lower anchor, not a requirement to generate arbitrarily long words.

**Implementation revision:** Replace the earlier interpretation 'no stage-specific word-length brackets' with 'no **hard exclusion** of words outside a dominant window'. Retain a clear apprenticeship-specific weighted range and long/short tails. Support a separate **opening-lesson safety envelope** so Slow level 1 does not unexpectedly flood with seven-letter words. Evolve distribution gradually by apprenticeship and encounter progress. Preserve seeded RNG, fall-speed diversity, density, spells, Rush, and fairness. Test frequency and quantiles for each apprenticeship, including Slow level 1 and Harvest, with deterministic sampling. A test must explicitly fail if seven-letter words are common at Slow level 1 or short words are common at Harvest, using prototype-defined tolerances labeled experimental. Reconcile with D-097, rather than replacing its shared difficulty director.
