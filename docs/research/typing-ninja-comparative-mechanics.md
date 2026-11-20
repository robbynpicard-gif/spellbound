# Comparative design reference — Typing Ninja mechanics

**Status: inspiration and research only; NOT approved Spellbound features.**
Recorded 2026-11-19 from the project owner's supplied comparison. This is a reference for evolving ideas into Spellbound's wizard-world identity, **not** a specification to reproduce Typing Ninja verbatim. Do not implement anything here without owner review. Avoid duplicating existing mechanics or adding unnecessary active code.

## Design translation method

For each idea, compare: (1) the player problem or interesting decision it creates; (2) current Spellbound equivalent; (3) a distinctly magical reinterpretation; (4) readability, fairness, balance, accessibility and technical cost; (5) whether it genuinely improves typing-first play. Prefer a new interaction or synergy over cosmetic renaming. An idea may be rejected, deferred, combined with another, or implemented in similar functional capacity when that is the best fit.

## Modes — reference and exploratory directions

| Typing Ninja reference | Reference behaviour | Spellbound comparison / possible evolution (not approved) |
|---|---|---|
| Story Mode | Campaign, bosses, cosmetic unlocks | Already has Normal/Hardcore 5-stage campaigns and bosses. Explore wizard progression/cosmetics later; don't restore the removed wizard roster. |
| Main Survival | Endless phases; boss every 10 | Endless already exists; consider optional periodic magical encounters, not forced boss interruptions. |
| Boss Marathon | Boss every 3 survival phases | Possible optional Trial of Archmages / boss gauntlet, only if bosses evolve beyond timers. |
| Classic Survival | Specials but no bosses | Closest to current Endless Practice; compare before adding a redundant menu option. |
| Vanilla Survival | No specials or bosses | Potential pure typing training preset with clear score separation. |
| Baby Survival | Single letters | Potential beginner familiar-training or apprentice primer; may be better as accessibility/practice setting. |
| Extreme / Slow | Speed variants | Could be Practice pace presets; do not confuse with the Slow spell. |
| Powerless | No power-up drops | Potential spell-less mastery challenge or Triumph modifier. |
| Type n Chill | Relaxed pressure | Potential tranquil scriptorium practice; preserve player agency and accessible pacing. |
| Vocabulary Mode | Translated word lists | Potential language-study grimoires; requires curated data and language/input support. |

## Word elements — reference and exploratory directions

| Typing Ninja reference | Reference behaviour | Spellbound comparison / possible evolution (not approved) |
|---|---|---|
| Wood | Ordinary word, one capture | Already represented by ordinary scrolls; no new mechanic needed. |
| Stone / Diamond | Type outer layer, reveal another word | Warded scrolls with layered runes; assess whether multiple submissions are fun or simply repetitive. |
| Chained | Repeat identical word several times | Bound incantation requiring sustained accuracy; perhaps varied rune patterns rather than repetitive grinding. |
| Bubble | Rises from bottom, immune to powers, stacks | Levitation/anti-magic scrolls with distinct trajectories; power immunity must be visibly explained and fair. |
| Shy | Word partly hidden, reveals during typing | Veiled glyphs/illusion scrolls; avoid unfair guessing or accessibility issues. |
| Bonus | Persistent bonus word; increases multiplier | Optional enchanted manuscript / side objective; avoid infinite on-screen clutter and runaway scoring. |

## Power-ups — reference and exploratory directions

| Typing Ninja reference | Reference behaviour | Spellbound comparison / possible evolution (not approved) |
|---|---|---|
| Ice | Freezes field | Spellbound Ice already freezes words and spawning; no duplicate. |
| Air | Pushes words upward / rewind | Distinct from current Wind, which heals ward and clears mistake speed-ups. Explore gust displacement or time-reversal as future synergy, not automatic replacement. |
| Mud | Slows descent | Spellbound Slow already handles time-based slowing; explore terrain/element interaction only if mechanically distinct. |
| Bomb | Destroys several random words | Fire and Shock already provide clearing; evaluate targeted arcane detonation only if it adds agency. |
| Zap | For a duration, each capture destroys two more | Could evolve into a temporary lightning-chain enchantment; compare with existing Shock and scoring balance. |
| Typing Aid | Restores one life | Spellbound Wind heals ward; avoid a redundant recovery spell. |

## Boss mechanics — reference and exploratory directions

| Typing Ninja reference | Reference behaviour | Spellbound comparison / possible evolution (not approved) |
|---|---|---|
| Attack phase | Boss invulnerable; disruptive words | Spellbound currently uses timed survival bosses. Could introduce telegraphed arcane pressure phases without removing survival identity. |
| Defense phase | Boss vulnerable; type target words to damage HP | Potential counterspell windows, sigils or ward-breaking words; HP combat is a major design decision, not assumed. |
| Smoke bombs | Obscures active words | Arcane mist/ink cloud; readability is a non-negotiable concern. Prefer clearly telegraphed localized effects or reject. |
| Letter shuffling | Scrambles active words | Shifting runes/illusion; must preserve fair targets, typing console state and accessibility. |
| Letter injection | Adds letters to active words | Corruption/growing curses; needs clear telegraph and deterministic rules. |
| Direct word attacks | Projectile words threaten lives | Cursed projectiles/summoned hexes; potentially a strong fit if they remain legible and typeable. |

## Overlap with medals and Triumphs

These references may inspire **optional mastery conditions** rather than entire new modes: spell-less runs, precision through veiled words, survival of a boss hex, vocabulary diversity, elemental combinations, and sustained typing under unusual but fair constraints. The medals/Triumphs design must be developed independently and approved before coding.

## Code hygiene / release safety

- Keep speculative ideas in documentation, not feature flags, unused classes or dormant gameplay branches.
- Before removing unused code, prove lack of imports/references, check save compatibility and tests, and isolate changes in a non-deploying branch.
- Existing test toggles (e.g. Campaign and Practice unlock-all) are intentional playtest utilities, not automatically removable bloat.
- The historic wizard roster and wardrobes were removed by D-048; audit for genuinely dead remnants before proposing deletion. Never delete assets or code solely based on an old plan.
- Current source of truth: running implementation, in-game Codex, docs/mechanics.md and the newest accepted decisions. docs/design.md can lag and must be reconciled before using its details to implement changes.
