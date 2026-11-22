# TypeL — Physical Sandbox Interactions
_2026-11-20 · Working design assumptions under D-069. Only Temporal Flow is newly implemented in code._

> **Superseded in part (D-083/D-084):** Wind, Harvest, Ice and Alter descriptions below are older. Current prototype rules: `docs/wind-apprenticeship-prototype-2026-11-20.md` and the in-game Codex.

## World rule
Spells are expressions of physical properties of the arena, not arbitrary score buttons. Interactions should be intuitive, deterministic, readable and grounded in the world's material and temporal rules. Prefer one shared interaction rule to special-case pairs of spells. Player typing/input remains responsive and runs in real time. Avoid granting points or Volley multipliers automatically through environmental interactions.

## Time domains
- **Player time:** typing, input, UI response and accessibility controls. Never slowed by Slow.
- **World motion time:** moving words/projectiles and physical effects; Slow affects movement already, currently through stacking speed factors.
- **Volley opportunity time:** separate monotonic fixed-tick clock; frozen while field is empty or Ice prevents world motion; runs at 80% rate during Slow, granting 25% more real-time opportunity, without directly granting multiplier. Slow stacks do not multiply this benefit. Current implementation in GameEngine.
- **Spell durations and spawning:** remain governed by existing simulation ticks until explicitly reviewed. Do not silently change these under the new time-domain model.

## Elemental/physical contracts (design defaults; not claims of implementation)
| Spell | Physical identity | Default interactions / constraints |
| --- | --- | --- |
| Slow (Temporal Distortion) | Local time distortion | Slows falling motion and extends Volley opportunity by 25%; doesn't slow typing or stack extra Volley bonuses |
| Ice (Frostbinding) | Stasis / cold | Halts falling words and spawning under current rules; time-sensitive motion pauses; future exposed fire can be extinguished or suppressed |
| Fire (Incineration) | Heat / combustion | Burns eligible field words as existing spell; extinguished by cold/wind where physical fire exists; does not retroactively reverse burned words |
| Wind (Arcane Purge) | Airflow / cleansing | Restores ward and clears mistake acceleration; extinguishes exposed workshop flames where applicable; future airborne effects may be displaced |
| Shock (Chain Lightning) | Conductive discharge | Chains by existing spatial targeting; future water/conductivity effects may modify arcs only with an approved balance rule |
| Barrier (Arcane Shield) | Protective ward | Intercepts impacts as existing charges; elemental protection should be consistent but not grant free charges |
| Alter (Transmutation) | Material/form transformation | Shortens words and influences future word difficulty under existing rules; transformation does not secretly alter scoring formulas |
| Harvest | Collection / extraction | Claims words according to existing rules; no free Volley captures or fabricated achievement opportunities |

## Existing vs proposed
- **Already present:** Slow movement scaling; Ice freeze; Fire burn; Wind ward repair/speed reset; Shock arcs; Barrier blocks; Alter transformation; Harvest capture; ambient candle extinguishing by Ice/Wind and relighting by Fire; existing elemental reaction event.
- **New preview implementation:** Slow affects Volley opportunity time at a bounded 80% clock rate.
- **Future candidates, not implemented:** elemental cross-reactions involving water, conduction, fire spread, environmental duration changes, projectiles and localized time fields. Do not imply these exist.

## Acceptance and safety
- Spell interactions must preserve replay determinism, consistent scoring, and gameplay readability.
- No surprise resource generation, changes to word spawning, or hidden achievements.
- Test Slow/Volley before expanding to additional interactions. Evaluate stacking, Ice overlap, empty-field Flow Preservation and the exact moment Slow expires.
- Change existing spell semantics only with explicit acceptance or a reversible, narrowly scoped preview experiment.

## D-074 — Offensive/defensive utility review (2026-11-20)
Design interpretation of D-073; no gameplay changes authorized by this review.

| Spell | Offensive utility | Defensive utility | Constraint / proposed contract |
| --- | --- | --- | --- |
| Slow | Stretch Volley opportunity and sustain scoring | Delay breaches | Keep existing bounded 80% Volley clock; do not multiply benefit by stacks |
| Ice | Freeze a favorable board and plan typed captures | Stop motion and spawning | Preserve stasis identity; inspect interaction with spell refresh and Flow Preservation |
| Fire | Sacrifice unfavorable board to reset scoring opportunities | Emergency full-field clear | Base points only, no level progress or free Volley; distinguish from Harvest |
| Shock | Remove troublesome targets to improve remaining board | Eliminate urgent low words and neighbors | Spatial deterministic chains; no free Volley captures |
| Barrier | Enable deliberate risk-taking while protection remains | Block next misses | No direct score bonus; protection is its offensive enabling value |
| Alter | Shorter/easier words support reliable Volley and combo | Reduce demanding typing sequences | Retain lower per-word base value; no compensatory points |
| Wind | Restore a stable platform for aggressive play | Heal ward and undo mistake acceleration | Do not invent damage or bonus; asymmetrical spell identities are desirable |
| Harvest | Cash out current board into points and progress | Clear immediate threats | Existing half-point × combo/Clean Streak; no free Volley |

**World interaction rule:** prefer intuitive consistent properties (cold suppresses exposed flames; airflow displaces exposed effects; conduction depends on actual conductive media), not arbitrary pair-specific bonus tables. Ambient reactions already implemented do not imply gameplay combat reactions exist.

**Design caution:** Offensive opportunity does not require every spell to score directly. Preserve player agency and distinguish tempo-building (Slow), stasis (Ice), reset (Fire), precision clearing (Shock), risk underwriting (Barrier), difficulty shaping (Alter), recovery (Wind), and cash-out (Harvest). Treat new cross-reactions and altered numerical rules as separate proposals requiring playtest and approval.

## D-075 — Pressure/charge balance evaluation plan (2026-11-20)
No balance numbers are changed. Use the existing Slow–Volley interaction as the baseline. Measure the same fixed-seed encounter situations at early/medium/late pressure with at least three policies: spend Slow offensively when Volley is active; conserve Slow for threatened breaches; adaptive policy using visible threat and charge count. Compare completed words, Volley best, score, ward loss, charges spent/remaining, and survival. Repeat with varied seeds and realistic typing accuracy/speed, and distinguish the player-facing difficulty setting from actual battlefield pressure. Desired qualitative outcomes: early offensive play is attractive and not required for survival; medium yields credible competing decisions with visible opportunity cost; high naturally favors survival but skilled aggressive play remains viable. Inspect charge supply, threat visibility, and ability availability before changing durations, drop weights, or scoring. No hidden difficulty-dependent spell mechanics or forced defensive mode. Prototype and validate numerical adjustments individually.
