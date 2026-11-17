# Wizzy Type — Current Design Reference

Last updated 2026-11-17 (v0.19.0). This is the single source of truth for the
current design. It merges the consolidated summary from the ChatGPT design
sessions with the owner's later stage decision (D-047). Older plans in
docs/plans/ marked "Superseded" are kept only for history.

Sections are labelled **Confirmed** (decided by the owner) or **Proposal**
(still being discussed). Proposals are not approved and must not be built
without a decision.

---

## 1. Identity — Confirmed

- A modern reimagining of Typing Maniac: words fall, you type them before they
  land, and mistakes weaken your ward.
- The player has **one Apprentice wizard of their own**. The multi-wizard roster
  is shelved (D-045). Don't bring it back without discussing it first.
- Mystical tone. No gambling mechanics and no dark patterns.
- **WPM** always means in-game Wizzy Type WPM (5 letters = 1 word, measured
  during play).

## 2. Structure — Confirmed (D-047)

- **Two modes:** Normal and Hardcore.
- **Five stages per mode,** each harder than the last. That makes 10 stages in all.
- **A stage is one run of 20 levels.** Levels 1–19 are standard and level 20 is
  the stage's only boss. That makes 5 bosses per mode and 10 in all.
- **Two spells per stage:** one at level 10, one by beating the boss.
- Chapters are removed.

| Stage | Name | Boss (L20) | Spell at L10 | Spell from boss |
|---|---|---|---|---|
| 1 | The Apprentice's Tower | The Bell Tower | Slow | Ice |
| 2 | The Forgotten Stacks | The Last Index | Barrier | Shock |
| 3 | The Alchemist's Vault | The Crucible | Alter | Fire |
| 4 | The Storm Spire | Eye of the Storm | Wind | Harvest |
| 5 | The Unwritten | The Last Word | — | — |

### Run rules (Claude's recommendations, built in v0.19.0 and open to change)

- Falling restarts the stage from level 1.
- Stages unlock in order within each mode.
- The run is saved between levels. Use Continue, or Save and quit from the pause menu.
- A boss's spell is first playable in the next stage, which starts with 1 charge of it.
- Normal restores the ward every level. Hardcore carries ward damage through
  the stage, heals 25% after levels 5, 10 and 15, and starts each stage with a
  full ward.
- Score, combo and Clean Streak carry across all 20 levels of a stage.

### Difficulty targets (in-game WPM)

| Mode | Start | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|---|
| Normal | 12 | 18 | 22 | 26 | 30 | 35 |
| Hardcore | 18 | 25 | 30 | 35 | 40 | 45 |

Levels are generated from these targets in src/difficulty/Stages.ts. Each stage
starts at the previous stage's target and reaches 95% of its own target by
level 19. Each boss ramps from 90% to 112% of its target. Bot measurements are
in docs/calibration-2026-11-17.md.

## 3. Scoring — Confirmed (D-046)

Scoring has three layers:

1. **Word score:** based on word length, plus the existing 11 bonuses, which are kept.
2. **Combo multiplier:** builds as you type words.
3. **Clean Streak:** counts words typed with no typo. Milestones at
   5/15/25/50/100/200 give ×1.2/1.4/1.65/2.0/2.75/3.5. The values are configurable.

Each kind of mistake is handled differently:
- A **typo** knocks Clean Streak back.
- A **wrong Enter** is penalised on its own.
- A **missed word** damages the ward and breaks the streak.

See docs/clean-streak-report.md.

## 4. Art and sound — Confirmed

- Pixel art at 640×360, shown at 2× with nearest-neighbour filtering. Never blur
  the pixel art (docs/art-direction.md).
- Spells should feel weighty: big casts, hit-stop and a heavy impact sound (D-045).
- Sound effects should be rounder rather than sharp, and the typewriter brassy and clunky.
- Backdrops still use the four existing art sets. Stage 5 reuses set 4 until
  new art is made.

## 5. Other modes — Confirmed

- **Endless Practice:** pick a mode, stage and level you have reached. Same
  speed as the Campaign, with no end.
- **Duels:** use the 100 Normal levels in order ("Stage s · Level n").

## 6. Under discussion — Proposals, not approved

- Expanding Volley.
- Clean Sweep tiers (Sweeper / Janitor).
- Precision grades.
- Visual families: Scriptorium, Arcane Engine, Crucible.
- Rebalancing the late bosses (see the calibration report).
- New art for Stage 5 and per-stage boss scenes.

## 7. Process

- Plan before big changes. Owner approves major directions.
- Record new decisions in docs/decisions.md. Never silently overwrite a
  confirmed decision.
