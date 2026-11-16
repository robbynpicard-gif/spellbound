# Spellbound — Spell system v2 plan (implemented)

_Agreed with the project owner and implemented, 2026-11-16 (decisions.md D-025/D-026). Pairs with [campaign-v2.md](campaign-v2.md). Supersedes D-017 once implemented._

## Rules for all spells
- **Collecting:** scroll words (renamed from "tomes") fall at about 6–8% of spawns. Each scroll shows **a random word plus the spell's icon and colour**. Type that word + Enter to gain a charge. A pop-up pauses the round the first time a spell's scroll can appear, and it teaches the cast word.
- **Casting:** type the cast word + Enter.
- **Cast-word rule (checked by an automated test):** a cast word is never a falling word, never the start of a falling word, and never begins with a falling word or another cast word. To keep `fire`, remove **firebolt, fireball, firebrand, firestorm** from `words.json`.
- **Pool:** 8 charges shared across all spells, with **no per-spell cap**. If the pool is full, the scroll scores but its charge is lost; the HUD flashes "pool full".
- **Rarity comes only from drop weights** (relative, among spells introduced so far): Slow 5 · Ice 4 · Barrier 4 · Shock 3 · Alter 3 · Fire 2 · Wind 1.5 · Harvest 1. With all 8 unlocked that's roughly 21 / 17 / 17 / 13 / 13 / 9 / 6 / 4%. Tune in play-testing.
- **Intro boost:** on the level that introduces a spell, that spell's weight is ×3.

## Spells, in power order (= intro order)
| # | Spell | Cast | Intro | Effect | Stacking | Score / quota |
|---|---|---|---|---|---|---|
| 1 | ⏳ Temporal Distortion | `slow` | L1 | Words fall slower | **Each cast is a separate 8 s stack; ×0.6 per active stack** (×0.6 / ×0.36 / ×0.216). E.g. casts at 0 s and 4 s → 0–4 s ×0.6, 4–8 s ×0.36, 8–12 s ×0.6, then normal. **Slow timers pause while Ice is active.** | n/a |
| 2 | ❄️ Frostbinding | `ice` | L3 | Freezes all words and stops spawns; typing still works | **Each cast adds +5 s** to remaining time | n/a |
| 3 | 🛡️ Arcane Shield | `barrier` | L6 | The next 2 words that reach the ward line do no damage; lasts until used up or the level ends; the ward line glows | **Each cast +2 blocks** | n/a |
| 4 | ⚡ Chain Lightning | `shock` | L8 | Destroys the most urgent (lowest) word and arcs to the 3 nearest | n/a | Base points + quota |
| 5 | ⚗️ Transmutation | `alter` | L11 | Every word of 6+ letters becomes a 3–4 letter word, keeping its position and speed (later also strips special word types). Clears the console if it was on a changed word | n/a | n/a |
| 6 | 🔥 Incineration | `fire` | L13 | Bailout: destroys every word on the field | n/a | **No points, no quota**; burned scrolls are lost (assumed) |
| 7 | 🌬️ Arcane Purge | `wind` | L16 | Normal: instability → 0%. **Hardcore: removes 50% of current instability.** Both modes: words lose the extra speed from mistakes | n/a | n/a |
| 8 | 🌾 Harvest (working name) | `harvest` | L18 | Claims every word on the field | n/a | **Counts toward quota, half points** |

Power rationale: Slow and Ice buy time; Barrier prevents damage; Shock is the first spell that makes progress; Alter is situational but grows stronger late; Fire is a full reset with no reward; Wind undoes 7–10 misses; Harvest gives survival and progress together.

Removed for now: **Meteor/Crash** (owner decision). Deferred: Alchemical Cleansing (until Cursed words exist). Dropped: Rejuvenation (overlaps with Wind).

## Spare free cast words (checked against the word list on 2026-11-16)
block, bulwark, jolt, change, swap, turn, crash, quake, boulder, reap, claim, siphon, absorb, drain, devour, consume

## Open questions
- Shock: arc to the 3 *nearest* words, or 3 random words anywhere?
- Final name for Harvest
- Hardcore: no healing besides the boss heal until Wind (L16); Barrier (L6) softens this
