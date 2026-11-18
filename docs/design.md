# Wizzy Type — Current Design Reference

Last updated 2026-11-17 (v0.22.0). This is the single source of truth for the
current design. Older plans marked "Superseded" are kept only for history.

- **Confirmed** means decided by the owner.
- **Proposal** means still under discussion. Do not build it without a decision.

---

## 1. Identity — Confirmed

- A modern reimagining of Typing Maniac. Words fall, you type them before they
  reach the ward, and mistakes and misses weaken the ward.
- The player has **one Apprentice wizard of their own**.
  - There is no roster and there are no character abilities.
  - The long-term goal is single-player progression about building and
    improving *your* wizard.
  - An ability layer may be explored only once the core loop is solid (D-048).
- **Current focus: gameplay feel and the gameplay loop.** Art is parked; the
  owner will make mockups later.
- Mystical tone. No gambling mechanics and no dark patterns.
- **WPM** always means in-game Wizzy Type WPM (5 letters = 1 word).

## 2. Structure — Confirmed (D-047)

- Two modes, **Normal** and **Hardcore**. Each has **5 stages** that get harder.
- A stage is **one run of 20 levels**:
  - Levels 1–19 are standard: type a set number of words.
  - Level 20 is the stage's only **boss**: survive a timer while the pace
    ramps up.
  - That makes 10 stages and 10 bosses in all.
- Falling (ward at 0) restarts the stage from level 1.
- Stages unlock in order within each mode.
- The run is saved between levels (Continue / Save and quit).
- A stage takes about **15 minutes**.

| Stage | Name | Boss (L20) |
|---|---|---|
| 1 | The Apprentice's Tower | The Bell Tower |
| 2 | The Forgotten Stacks | The Last Index |
| 3 | The Alchemist's Vault | The Crucible |
| 4 | The Storm Spire | Eye of the Storm |
| 5 | The Unwritten | The Last Word |

## 3. Pacing and difficulty — Confirmed (D-048)

In-game WPM targets: the agreed targets raised by a third (D-048), then ~20%
more through spawn rate only (D-050), with the same shape:

| Mode | Start | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|---|
| Normal | 19 | 29 | 35 | 42 | 48 | 56 |
| Hardcore | 29 | 40 | 48 | 56 | 64 | 72 |

**Pace.** Each stage starts at the previous stage's target and reaches 95% of
its own target by level 19. Each boss ramps from 90% to 112% of its target.

**Words on screen.** Short words and a slow fall keep about 9–12 words on screen.
Normal Stage 1 uses 3–4-letter words.

**Within a level (D-051).** Each level starts calm and builds to its end:
words fall faster and arrive more often as you near the quota. Levels 1–9 build
gently (±10–15%), levels 10–14 noticeably (±20%), levels 15–19 fiercely (±30%),
so the back half of a stage presses and the last quarter makes the break
between levels a relief. The average pace (and the stage targets) is unchanged.

**Opening cluster.** Every level starts with 4 words (Hardcore 5) already
falling, so there is a choice from the first second.

**Surges.** Short bursts of extra words, so spells matter by levels 6–7:
- Levels 6–12: one surge in the middle of the level.
- Levels 13–19: two surges.
- Bosses: three surges.
- Hardcore surges last 1 second longer.

**Ward.**
- Normal restores the ward every level.
- Hardcore carries damage through the stage and heals 25% after levels 5, 10
  and 15. Each stage starts with a full ward.

**Intent.**
- At target speed without spells, most standard levels are clearable.
- Bosses need spells.
- Hardcore should feel genuinely hardcore.

Levels are generated in src/difficulty/Stages.ts. Bot results are in
docs/calibration-2026-11-17.md.

## 4. Spells — Confirmed (D-047, D-048, D-049)

- About 18% of words carry a spell scroll. Typing the word claims one charge.
- All spells share one pool of **8 charges**. Claiming a scroll with a full
  pool: it fizzles to grey smoke, the rack flashes red and shakes, and you get
  "MANA FULL · +N" (50 × the combo multiplier).
- **Casting:**
  - **Normal:** press the spell's number key (1–8), or type its name + Enter.
  - **Hardcore:** typing only.
- **Spellbook** (main menu): choose which spell is on each key. One layout for
  both modes. Default: 1 Fire, 2 Slow, 3 Ice, 4 Barrier, 5 Shock, 6 Alter,
  7 Wind, 8 Harvest.

| Spell | Effect |
|---|---|
| Fire | Burns every word. Base points (10 per letter), no multipliers, no quota. A bailout. |
| Slow | Words fall at 60% speed for 8 s; casts stack. |
| Ice | Freezes words and spawning for 8 s; recasts while frozen add 70% of the last (max ~27 s). |
| Barrier | The next 2 words that reach the ward do no harm; combo and streak are safe. |
| Shock | Strikes the lowest word and the 3 nearest: base points, count toward quota. |
| Alter | Words of 6+ letters become short ones; easy words for 8 s. |
| Wind | Restores 50% ward (not above full), removes mistake speed-ups. Same in both modes. |
| Harvest | Claims every word: half base points × combo × Clean Streak; counts toward quota; multipliers unchanged. |

| Stage | Level 2 | Level 10 | From the boss (usable next stage) |
|---|---|---|---|
| 1 | Fire | Slow | Ice |
| 2 | — | Barrier | Shock |
| 3 | — | Alter | Wind |
| 4 | — | Harvest | — |
| 5 | — | — | — |

A stage that follows a boss reward starts with 1 charge of that spell. No
falling word is a spell name or starts with one.

## 5. Scoring — Confirmed (D-040, D-046)

Three layers multiply together:

1. **Word score.**
   - 10 points per letter.
   - 11 per-word bonuses: Perfect, Quick, Clutch, Arcane, Long, Name, Volley,
     Alliteration, Librarian, Metronome, Clean Sweep.
   - 3 end-of-level bonuses: Flawless, Under Par, Comeback.
2. **Combo multiplier.** ×1, then ×2 at 5 words, ×3 at 12, ×5 at 25 and ×10 at
   45.
3. **Clean Streak** (words typed with no typo). ×1.2 at 5, ×1.4 at 15, ×1.65 at
   25, ×2 at 50, ×2.75 at 100 and ×3.5 at 200.

Score, combo and Clean Streak carry through the whole 20-level stage. The
combined multiplier can reach ×35. It stays uncapped unless that becomes a
problem.

| Mistake | Combo | Clean Streak | Other |
|---|---|---|---|
| Typo (even if fixed) | unchanged | back one milestone | that word falls faster |
| Wrong Enter | down one tier | reset to 0 | the guessed word falls faster |
| Missed word | reset to 0 | reset to 0 | ward damage |

Best scores are kept per stage. The main menu shows how many stages are
cleared in each mode.

## 6. Other modes — Confirmed

- **Endless Practice.** Pick a mode, stage and level, then play at the
  Campaign pace with no end. The level's surges repeat every quota's worth of
  words.
  - **Testing build:** every stage is open (`PRACTICE_UNLOCK_ALL` in
    src/app/flags.ts).
  - **Before release:** lock Practice behind Campaign progress again.
- **Wizard Duels.** Online duels on the 100 Normal levels.

## 7. Art and sound — Confirmed

- Pixel art at 640×360, shown at 2× with nearest filtering. Never blur it.
- The four existing backdrop sets are used; Stage 5 reuses set 4. Art
  direction is parked.
- Spells are weighty, with hit-stop.
- The music is liked by the owner ("feels very RuneScape"): keep that direction.
- **Announcer** (D-051): a deep, showy, slightly sarcastic arena-announcer
  voice calls the per-word bonuses (Perfect, Quick, Clutch, Arcane, Long word,
  Name-caller, Volley, Alliteration, Librarian, Metronome, Clean Sweep). Only the
  best bonus per word, common ones only sometimes, never more than one call
  every 1.4 s. Currently the browser's speech voice, pitched down.
- Sound effects are rounded; the typewriter is brassy and clunky.

## 8. Under discussion — Proposals, not approved

- **Wizard progression:** how the player builds and improves their Apprentice.
- **An ability layer,** once the loop is solid.
- **Hardcore extras:** see the status doc.
- **Boss spell scramble:** a boss shuffles the number keys (whole fight, or
  reshuffling with warnings?).
- **Triumph board, medals and a shop.**
- **Reactive audio and a more kinetic stage end.**
- **A world that shows the score** instead of number dials.
- **Expanding Volley.**
- **Clean Sweep tiers:** Sweeper / Janitor.
- **Precision grades.**
- **Visual families:** Scriptorium, Arcane Engine, Crucible.

## 9. Process

- Plan before big changes. The owner approves major directions.
- Record decisions in docs/decisions.md. Never silently overwrite a confirmed
  decision.
