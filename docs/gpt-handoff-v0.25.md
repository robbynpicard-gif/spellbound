# TYPEL — Complete design summary for ChatGPT (v0.25.0, 2026-11-18)

**Paste this whole document.** It describes what is **live now** at https://robbynpicard-gif.github.io/TypeL/ and **replaces every older handoff**. Earlier summaries (v0.17–v0.22) describe a 20-level/4-chapter campaign, boss reward picks, a six-wizard roster or older speed numbers; all of that is superseded.

## How to work with the owner
- The owner is the creative director and makes the decisions. They are a beginner programmer. Claude builds the game; ChatGPT is a design partner.
- Mark everything **Confirmed** or **Proposal**. Never turn a proposal into a decision silently. When discussing open questions, ask **one question at a time**, with a recommendation.
- **Protect the core typing feel above everything.** The owner loves how typing and capturing words feels.
- No gambling mechanics, no manipulative engagement; skill and mastery first. Never secretly help the player (e.g. easing difficulty to rescue them).
- **Art style is open** (current pixel-art look is a placeholder). Confirmed only: a 2D single screen — a field where word-scrolls fall, the wizard at a typewriter-like desk below, a spell rack at the side. Direction to explore (Proposal): **the world itself shows score, multipliers, streaks and bonuses**, instead of number dials and counters.

## Recent changes since v0.21
- Speeds +20%, only by making words arrive more often (D-050).
- Each level builds from calm to fierce, more so later in a stage; plus an extra +30% fall speed by the end of every level (~15% harder overall) (D-051, D-054).
- Spell scrolls now on ~14% of words (were 20%).
- Music builds through each stage and level (faster, ticking, ostinato, drums); the menu has its own warm, slower theme. The owner likes the music's "RuneScape" feel.
- Options: Music, Sound effects and Announcer channels, each with a switch and volume slider.
- The synthesized announcer was tried and **removed** (too robotic). It returns only with real recorded lines: the owner may record them and Claude will process them (pitch down, EQ, compression, arena reverb).
- Words stay on the field between levels of a stage.
- Endless mode is offered after beating a stage's boss.
- Testing tools: Campaign toggle (all unlocked with level picking / real progress), Reset campaign, and Practice fully open.

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
- **WPM** always means in-game TypeL WPM (5 letters = 1 word).

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
- **Words stay on the field between levels** of a stage: the next level starts
  with them where they were (D-055).
- **Endless mode after the boss:** beating level 20 offers endless play at the
  stage's peak pace (D-055).

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
between levels a relief. On top of that, fall speed rises an extra 30% by the
end of every level (D-054), about 15% harder overall.

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

- About 14% of words carry a spell scroll (D-054). Typing the word claims one charge.
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
- **Campaign testing controls** (D-055): a toggle between "all unlocked" (any
  stage, any level) and real progress, and a Reset campaign button. Remove or
  hide before release.
- **Wizard Duels.** Online duels on the 100 Normal levels.

## 7. Art and sound — Confirmed

- Pixel art at 640×360, shown at 2× with nearest filtering. Never blur it.
- The four existing backdrop sets are used; Stage 5 reuses set 4. Art
  direction is parked.
- Spells are weighty, with hit-stop.
- Music builds through each stage and each level: faster, with ticking,
  ostinato and drums as the pace quickens (D-054). The menu has its own warm,
  slower theme.
- The music is liked by the owner ("feels very RuneScape"): keep that direction.
- **Audio channels** (D-053): Music, Sound effects and Announcer, each with a
  switch and a volume slider.
- **Announcer — removed for now (D-052).** The synthesized voice sounded too
  robotic. Wanted: a real human voice (deep, showy, slightly sarcastic arena
  announcer calling the per-word bonuses). Needs recorded lines.
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


---

## Appendix A — Per-word bonuses (exact triggers)

| Bonus | Trigger | Value |
|---|---|---|
| Perfect | No typos on the word | +25% |
| Quick | Captured in the top 30% of the field | +20% |
| Clutch | Captured in the last 15% before the ward | +50% |
| Arcane | Hard word (rare letters, clusters) | +15% per point, up to +60% |
| Long | 9+ letters | +20% |
| Name | Proper names | +30% |
| Volley | Captures within 2 s of each other | +10% per link, up to +50% |
| Alliteration | Consecutive captures with the same first letter | +15% per link, up to +60% |
| Librarian | Captures in alphabetical order | +10% per link, up to +50% |
| Metronome | 16 keystrokes in a very even rhythm | +15% |
| Clean Sweep | Empty the screen after 3+ captures | +100 flat (× multipliers) |

End of level (share of that level's points): Flawless (no misses) +25%; Under Par (finished fast) +15%; Comeback (won after the ward fell to 25% or less) +20%.

**Word score** = (10 × letters × (1 + bonus %) + flat) × combo multiplier × Clean Streak multiplier, rounded once.

Miss damage to the ward: Normal 10–14%, Hardcore 12–16% per missed word (rising by stage).

## Appendix B — Bot findings (perfect typists, measured before the +20% speed, in-level ramps and scroll cuts)
- Normal: without spells, most standard levels clearable; every boss lost. With spells, every boss won.
- Hardcore: from mid-stage, typing at target speed without spells loses.
- Humans will find all of it harder. Balance is now being judged by the owner's play.

## Appendix C — Open questions and future ideas (Proposals)
1. **Wizard progression:** how the player builds and improves their Apprentice between stages (no gambling, no pay-to-win).
2. **Triumph board** (Destiny 2-like): long-term goals → currency → shop cosmetics, endless high-end goals.
3. **Medals** (Halo-like): in-play feats, same names across modes, counted separately for Campaign and Practice, each adding fixed score. Point values undecided (owner was unsure).
4. **The world shows the score** instead of dials.
5. **Boss identity:** a modifier per boss. Idea: **Spell Scramble** (a boss shuffles the number keys) — once per fight or reshuffled with warnings?
6. **Making Hardcore hardcore:** typos cost a little ward; fewer heals but a big one after the boss; fewer scrolls; longer surges; an "omen" level per stage with a rule twist.
7. **Is the bonus list too crowded?** Ideas: expand Volley, Clean Sweep tiers (Sweeper/Janitor), precision grades.
8. **Announcer:** removed for now; to return with real recorded lines (owner-recorded, processed by Claude). Which bonuses deserve calls, and how often?
9. **Art style:** fully open.

## Appendix D — Before release
- Lock Practice behind Campaign progress and remove the Campaign testing controls.
- Choose the art style and redo the art.
- Final balance from human play-tests.
