# Typel integrated prototype — status, four-pillar map and playtest script
_2026-11-20 · Claude · branch `dev/apprenticeship-prototype-20261119` · decision D-085_

> **Updated by D-086 (2026-11-21):** new layout, bright art, Arcane Rush, catch loop, Shock/Alter/Ice changes, orchestral music. See `docs/typel-direction-2026-11-21.md`; where they differ, that file wins.

Status words: **Decided** (owner) · **Prototype choice** (Claude, reversible) · **Built** · **Tested** (automated) · **Smoke-checked** (headless browser) · **Deployed** · **Owner-playtested**. Nothing below is owner-playtested yet.

## What the preview now is
The dev preview boots a **new Typel front end**: none of the old visuals or sounds are used. Production `main` still runs the older front end. The deterministic `GameEngine` (Arcane scoring, D-084 Wind/Harvest/Ice/Barrier/Alter rules) is reused.

| Area | What exists | Status |
|---|---|---|
| Entry | `src/main.ts` → `src/typel/app.ts`; 1920×1080 canvas, scale-to-fit | Built · Smoke-checked |
| Visuals | Procedurally painted Arcane Renaissance study (`src/typel/render/paint.ts`, `study.ts`): leaded window behind the battlefield, candlelit shelves, walnut desk, brass typewriter with live keys and paper, score counter, Combo dial, Volley tube, Ward flask (scar band), spell shelf, Rune drum, mentor letter. Smooth canvas painting, **not pixel art**. | Prototype choice (medium still open) · Built |
| Effects | Capture sweep into the typewriter, rubric-red typed letters, typo shake, breach crack, Slow/Ice field moods, Fire spread hops, Shock bolts along real chain links, Harvest sweep, Wind gust (cosmetic only), All-In veil, Volley ignition sparks, reduced-motion option | Built |
| Audio | New synthesized engine (`src/typel/audio.ts`): wood-and-brass keys, Combo-climbing capture bell, typo/wrong-Enter/breach, 8 spell timbres, Wind wager, Volley steps/ignition, Rune carousel; adaptive music (menu theme in F Lydian; gameplay/boss in D Dorian with layers by field pressure, Ward danger and Surge) | Prototype choice · Built (not audible in headless tests) |
| Apprenticeship | 9 apprenticeships (Slow → Fire → Ice → Barrier → Shock → Alter → Wind → Harvest → Grand Wizard), 12 levels + spell boss + Endless; cumulative spells; Normal/Hardcore; placeholder Masters and lines (`src/typel/apprenticeship.ts`) | Decided structure · Prototype content · Built · Smoke-checked |
| Difficulty | Each level blends the old 5×20 stage curve: trial *t* sits at stage 1 + (t−1)/2; levels 1–12 sample old levels 1–19; boss = old level 20 | Prototype choice · Built |
| Sandbox | Endless field, all spells, 6 Wind + 4 of each other, pace 1–5, Normal/Hardcore rules, nothing recorded | Built · Smoke-checked |
| Typing Trials | 15/30/60 s passages of original text, net/raw WPM, accuracy, bests | Built · Smoke-checked |
| Codex | Rules, Spells, Runes (exact triggers), Triumphs (tiers and progress) | Built · Smoke-checked |
| Runes | 25 Runes in 3 families (typing, wordplay, spellcraft "rune sequences") awarded inside the simulation; small fixed points | Prototype catalogue · Built · Tested |
| Triumphs | 8 tiered career milestones (Copper/Silver/Gold Leaf); no rewards designed | Prototype · Built |
| Shock | Seeded spatial chain: first strike guaranteed; leaps likelier when close, decaying per generation; cap 10 | Direction decided (D-080) · numbers prototype · Built · Tested |
| Fire | Combustion Chain: lower half ignites; flames leap ≤210 field px; top fifth spared; +25% base per generation | Exploratory (D-079) · prototype · Built · Tested |
| Options | Music / SFX / Announcer on-off + sliders (persisted), reduced motion, reset progress | Built |

## Prototype tuning (all provisional)
| Item | Value | Where |
|---|---|---|
| Shock reach / near / far chance / depth decay / cap | 300 px / 0.9 / 0.2 / ×0.82 per leap / 10 words | `SHOCK_TUNING` in `src/gameplay/SpellChains.ts` |
| Fire ignite line / spread / spared top / generation bonus | lower 50% / 210 px / top 20% / +25% | `FIRE_TUNING` |
| Rune points | 25–400, never multiplied | `src/gameplay/runes/RuneCatalogue.ts` |
| Hardcore Ward recovery | +25% after levels 4 and 8 (never above the scar) | `HARDCORE_RECOVERY` in `src/typel/app.ts` |
| Trial starting charges | 3 of the new spell + 1 each of up to 5 recent others | `startingCharges` |
| Wind / Harvest / Ice / Barrier / Alter | as D-084 | `WARD_TUNING`, engine |

Legacy end-of-level bonuses (Flawless, Under Par, Comeback) are now off in Arcane/Typel scoring only; legacy and duel scoring keep them.

## Known limitations
- Characters are silhouettes and text; Masters have no portraits or voices. Grand Wizard announcer is text only (D-052).
- Music and effects are synthesized placeholders; nobody has heard them yet. **Please judge the audio first.**
- Spell bosses are timed survival levels with a name and lines; no boss-specific mechanics yet.
- Hardcore and every apprenticeship are unlocked for testing; a level picker is a testing tool.
- No mid-apprenticeship save/continue; leaving ends the run.
- Lifetime "perfect captures" for Triumphs is estimated from accuracy.
- Production still runs the old front end; promoting this needs the owner's approval.

## Playtest script (about 30 minutes)
1. **Feel first:** Apprenticeship → Slow, levels 1–3. Do keys, captures and mistakes *sound and feel* right at your real speed? Is the live paper readable?
2. **Readability:** Sandbox, pace 5. Can you read and target every scroll under pressure? Anything covering the words?
3. **Volley:** chain fast perfect captures until the tube erupts (SURGE). Does the build-up feel like it's charging?
4. **Ice Focus:** Sandbox → Ice on a full field → type perfectly. Does the Combo leap feel earned? Does one slip hurt enough?
5. **Shock gamble:** Shock into a crowd, then into a sparse field. Does the chain feel exciting and understandable?
6. **Fire chain:** let words cluster, then Fire. Do you see the flames spread and understand why some survived?
7. **Wind + Harvest:** full Ward → Wind → build Volley → Harvest. Was the payoff worth the scar? Wager again from the scar.
8. **Structure:** play one apprenticeship to its boss (use the level picker), beat it, enter Endless. Does the climb feel like a stage?
9. **Typing Trial:** a 30 s run. Does it feel like a proper speed test?
10. **Codex:** can you find any rule you wondered about during play?

Feedback questions: what felt best? What felt wrong or confusing? Which spell did you *want* to use offensively? Did any Rune surprise you? Does the world look like Typel, or what should change first?
