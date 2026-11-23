> **Document status: HISTORICAL** (classified 2026-11-22, D-104). Kept for context; not a current requirement. Superseded by D-047. Where it conflicts with `docs/decisions.md` or a current document in the [docs index](../README.md), those win.

> **Superseded (2026-11-17, D-047).** Kept for history. The current design is docs/design.md.

# TypeL — Campaign v2 plan (implemented)

_Agreed with the project owner and implemented, 2026-11-16 (decisions.md D-025/D-026). Replaces the 10-level campaign (D-014/D-016) once approved for implementation. Spell details: [spells-v2.md](spells-v2.md)._

## Structure
- 20 levels in 4 chapters. Each chapter has 4 normal levels plus a boss level (5, 10, 15, 20).
- Target length for a full run: about 20 min. Normal levels last about 45–60 s; bosses 60/75/90/120 s.
- **Losing restarts the run** at level 1 (as today).
- Difficulty: today's level 10 becomes the new level 20, so the same ceiling is reached over a gentler ramp.

## Modes
- **Normal:** instability resets to 0% at the start of each level.
- **Hardcore:** instability carries through the whole run. Available from the start, with its own records. Healing: Wind removes 50% of current instability, plus a **25% heal after each boss** (default; the owner had no preference).
- Practice is unaffected.

## Spell introductions (Fire first, then least to most powerful — D-030)
- When a spell's scroll first becomes collectible, a **pop-up pauses the round at its start**; Enter dismisses it. That spell's drop weight is ×3 on its intro level. No new spells are introduced on boss levels.

| Ch | Levels | Introduced | Boss |
|---|---|---|---|
| 1 Apprentice's Tower | 1–4 | L1 Fire · L3 Slow | L5, 60 s |
| 2 Sunken Library | 6–9 | L6 Ice · L8 Barrier | L10, 75 s |
| 3 Alchemist's Vault | 11–14 | L11 Shock · L13 Alter | L15, 90 s |
| 4 Storm Spire | 16–19 | L16 Wind · L18 Harvest | L20, 120 s |

## Bosses (survival)
- Survive the timer; there's no word quota. Pace starts at the chapter's level and ramps up through the timer. Scrolls still drop.
- Surviving gives a big score bonus, plus a **choice of 1 of 3 random spells** (introduced so far, weighted by drop weights, no duplicates) as a free charge. If the pool is full, the player can swap one out or skip.

## Draft level parameters (interpolated from today's levels 1→10)
| Lv | Quota | Speed | Spawn ms | Max on screen | Length | Instab./miss |
|---|---|---|---|---|---|---|
| 1 | 15 | 45 | 2200 | 5 | 3–7 | 10 |
| 2 | 16 | 49 | 2120 | 5 | 3–7 | 10.5 |
| 3 | 18 | 53 | 2040 | 6 | 3–8 | 10.5 |
| 4 | 19 | 58 | 1960 | 6 | 4–8 | 11 |
| 5 | BOSS 60s | 58→ | 1960→ | 6 | 4–8 | 11 |
| 6 | 20 | 62 | 1880 | 6 | 4–8 | 11.5 |
| 7 | 22 | 66 | 1800 | 7 | 4–9 | 11.5 |
| 8 | 23 | 70 | 1720 | 7 | 4–9 | 12 |
| 9 | 24 | 74 | 1640 | 7 | 4–9 | 12.5 |
| 10 | BOSS 75s | 74→ | 1640→ | 7 | 4–9 | 12.5 |
| 11 | 26 | 79 | 1560 | 8 | 5–10 | 12.5 |
| 12 | 27 | 83 | 1480 | 8 | 5–10 | 13 |
| 13 | 28 | 87 | 1400 | 8 | 5–10 | 13.5 |
| 14 | 30 | 91 | 1320 | 9 | 5–11 | 13.5 |
| 15 | BOSS 90s | 91→ | 1320→ | 9 | 5–11 | 13.5 |
| 16 | 31 | 95 | 1240 | 9 | 5–11 | 14 |
| 17 | 32 | 100 | 1160 | 9 | 6–11 | 14.5 |
| 18 | 34 | 104 | 1080 | 10 | 6–12 | 14.5 |
| 19 | 35 | 108 | 1000 | 10 | 6–12 | 15 |
| 20 | BOSS 120s | 108→ | 1000→ | 10 | 6–12 | 15 |

## Open questions
- Whether special word types get assigned to chapters
- Chapter intro screens and story text
- Level names for 11–20
