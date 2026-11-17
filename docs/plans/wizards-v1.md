> **Superseded (2026-11-17, D-047).** Kept for history. The current design is docs/design.md.

# Wizard selection — plan v1 (DRAFT, not built)

_2026-11-16. First step toward the roguelite in [lore.md](../lore.md). Art options: design canvas, "Wizards · options A/B" board._

## Goal
Before a Campaign run, pick a wizard. Each wizard has a **mana capacity**,
**starting mana** and **one unique spell or passive**. Everything else
(levels, scrolls, bosses, Normal/Hardcore) is unchanged.

## Scope for v1: three wizards
| Wizard | Mana | Starts with | Unique |
|---|---|---|---|
| The Apprentice | 8 | Fire ×1 | None: today's game (default) |
| The Archivist | 6 | Slow ×1 | **Recall** (new spell, cast `recall`): for 10 s, the first 3 letters + Enter capture a scroll, if only one scroll on screen starts with them |
| The Pyromancer | 10 | Fire ×2 | Passive: Fire captures burned scrolls at half knowledge (and counts them); wards take 20% more damage per miss |

Later: Chronomancer (longer Slow/Ice, **Rewind**), Hedge Witch (12 mana, fewer powered scrolls), Warden (starts each level with a shield block).

## How it works in code
1. **Data:** `src/data/wizards.json` — id, name, manaCapacity, startingCharges, unique (spell id or passive id), portrait frame, colour.
2. **Engine:** replace the fixed `SPELL_POOL_SIZE` with `EngineOptions.manaCapacity` (pool checks, sanitising, HUD). Add passive hooks:
   `fireClaims: 0.5` (Pyromancer), `damageMultiplier: 1.2` (Pyromancer).
3. **Recall spell:** a timed state like Slow; while active, `submit()` accepts a 3+ letter prefix that matches exactly one word. Drops only for the Archivist (not in the shared drop table). Cast word `recall` checked against the word list like the others.
4. **Campaign:** `CampaignRun.wizard`; starting charges applied at level 1; records kept per wizard *and* mode (best run per wizard).
5. **UI:**
   - Campaign → Normal/Hardcore → **Choose your wizard** (cards with portrait, mana, starting spell, unique; locked cards greyed for later).
   - In game: the chosen wizard's portrait replaces the one in the backdrop (sprite over the left corner); mana capacity shown on the rack header ("SPELLS 3/6").
   - Run-over and records show the wizard.
6. **Art:** portraits from the chosen option (A or B) for each wizard, at 120×130, in a sprite strip; built by `tools/pixelart/` from the reference wizard.
7. **Tests:** capacity respected per wizard; starting charges; Recall prefix capture (unique match only, never ambiguous, never a cast word); Pyromancer Fire claims and damage; save migration (records gain a wizard key; old records belong to the Apprentice).

## Open questions for the owner
- Which option (A or B) for each wizard's look?
- All three wizards unlocked from the start, or unlock by clearing the campaign? (Suggested: all three open in v1; the Library unlocks the rest later.)
- Does Hardcore stay available for every wizard? (Suggested: yes.)
