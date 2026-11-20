# Spellbound — Physical Sandbox Interactions
_2026-11-20 · Working design assumptions under D-069. Only Temporal Flow is newly implemented in code._

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
