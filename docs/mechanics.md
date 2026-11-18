# Wizzy Type — Game mechanics (v0.27.0)

Generated from the game's own numbers (the same source as the in-game **Codex** on the main menu), so it matches what you play.

## The basics

- Words fall toward your ward. Type a word and press Enter to capture it. Typing picks the word that matches; Enter finishes it.
- A word that reaches the ward damages it (adds instability). At 100% instability the run is over.
- Ward damage per missed word: Normal 10/11/12/13/14% and Hardcore 12/13/14/15/16% (stages 1–5).
- Normal restores the ward at the start of every level. Hardcore carries damage through the stage, heals 25% after levels 5, 10, 15, and starts each stage full.
- Typos and wrong Enters make the word you were aiming at fall faster.
- Words still falling when you clear a level stay where they are for the next level, so you can read the field before it restarts.
- A captured word is swept to the desk, where its points and bonuses are read out, so nothing is written over the words still falling.

## Stages and pace

- 5 stages per mode, each a run of 20 levels. Levels 1–19: capture a set number of words. Level 20: the boss — survive the timer (60/70/80/90/100 s by stage) while the pace ramps up. Falling restarts the stage.
- Each level opens with a few words already falling, then builds: words fall faster and arrive more often as you near the goal, more sharply later in the stage.
- Surges (from level 6): short bursts where words arrive 1.7× as often. One per level up to level 12, two from level 13, three in each boss.
- When a boss timer runs out no more words come: clear what is still falling to finish. The win is already safe, so a late miss cannot end the run.
- Beat a boss to open the next stage, and to play Endless mode — the stage’s finishing pace, climbing with every word, with a best score kept per stage.

| Pace (in-game WPM) | Start | Stage 1 | Stage 2 | Stage 3 | Stage 4 | Stage 5 |
|---|---|---|---|---|---|---|
| Normal | 23 | 29 | 35 | 42 | 48 | 56 |
| Hardcore | 35 | 40 | 48 | 56 | 64 | 72 |

## Spells

- About 14.4% of words carry a spell scroll (coloured, with an icon). Capture the word to gain one charge.
- All spells share one pool that starts at 8 charges. Claiming a scroll with a full pool fizzles it for 50 × your combo multiplier points instead.
- Typing accurately widens the pool: 9 at 25 clean, 10 at 50 clean, 11 at 100 clean, 12 at 200 clean. A missed word or a wrong Enter drops it back to 8 and anything that no longer fits is lost. A corrected typo costs nothing.
- Normal: cast with the number keys 1–8 (set them in the Spellbook), or type the spell’s name and press Enter. Hardcore: type the name and press Enter.
- No falling word is a spell name, and only the exact name casts.

| Spell (type this) | What it does |
|---|---|
| Slow | Words fall slower for 8 seconds. Each cast adds its own slow: two at once are slower still. |
| Ice | Freezes every word in place, and stops new words appearing, for 8 seconds. Casting it again while frozen adds more time, but less each time (8 s, then 5.6, 3.9 …). You can keep typing. |
| Barrier | The next 2 words that reach the ward line do no harm. Each cast adds 2 more. Lasts until the end of the level. |
| Shock | Strikes the lowest word and arcs to the 3 words nearest it. They score and count toward the level. |
| Alter | Every word of 6+ letters becomes a short one, for good. Then, for 8 seconds, every new word is short and easy (3–5 letters, no rare letters or names). After that, words return to the level’s difficulty. |
| Fire | A bailout: burns every word on the field. You get each word's base points (no combo or Clean Streak), but burned words don't count toward the level. |
| Wind | Restores 50% of your ward (up to full), and every word loses the extra speed your mistakes gave it. The same in Normal and Hardcore. |
| Harvest | Claims every word on the field: they all count toward the level, for half points × your combo and Clean Streak. Your combo and streak stay as they are. |

| Stage | When | New spell |
|---|---|---|
| 1 | Level 2 | Slow |
| 1 | Level 10 | Fire |
| 1 | Beat the boss (usable next stage) | Ice |
| 2 | Level 10 | Barrier |
| 2 | Beat the boss (usable next stage) | Shock |
| 3 | Level 10 | Alter |
| 3 | Beat the boss (usable next stage) | Wind |
| 4 | Level 10 | Harvest |

## Scoring

Word score = (10 × letters × (1 + bonus %) + flat bonus) × combo multiplier × Clean Streak multiplier.

- Combo: +1 for every word captured. Score, combo and Clean Streak carry across all 20 levels of a stage.
- Clean Streak: words captured in a row without a single typo.

| Combo | Multiplier |
|---|---|
| 0–4 | ×1 |
| 5–11 | ×2 |
| 12–24 | ×3 |
| 25–44 | ×5 |
| 45+ | ×10 |

| Clean Streak | Multiplier |
|---|---|
| 0+ | ×1 |
| 5+ | ×1.2 |
| 15+ | ×1.4 |
| 25+ | ×1.65 |
| 50+ | ×2 |
| 100+ | ×2.75 |
| 200+ | ×3.5 |

## Mistakes

| Mistake | Combo | Clean Streak | Also |
|---|---|---|---|
| Typo (even if fixed) | Kept | Back one milestone | That word falls faster |
| Wrong Enter | Down one tier | Reset to 0 | The word you meant falls faster |
| Missed word | Reset to 0 | Reset to 0 | Ward damage |
| Word stopped by Barrier | Kept | Kept | No damage |

## Bonuses

Each captured word can earn bonuses; their percentages add together before the multipliers.

| Bonus | How to earn it | Worth |
|---|---|---|
| Perfect | No typos on the word | +25% |
| Quick | Capture it in the top 30% of the field | +20% |
| Clutch | Capture it in the last 15% before the ward | +50% |
| Arcane | A hard word (rare letters, clusters) | +15% per point, up to +60% |
| Long | A word of 9+ letters | +20% |
| Name | A proper name | +30% |
| Volley | Captures within 2 s of each other | +10% per link, up to +50% |
| Alliteration | Captures in a row with the same first letter | +15% per link, up to +60% |
| Librarian | Captures in alphabetical order | +10% per link, up to +50% |
| Metronome | 16 keystrokes in a very even rhythm | +15% |
| Clean Sweep | Empty the screen after 3+ captures | +100 points (× multipliers) |

| End of level | How to earn it | Worth |
|---|---|---|
| Flawless | No words missed | +25% of the level’s points |
| Under Par | Finish the level quickly | +15% of the level’s points |
| Comeback | Win after the ward fell to 25% or less | +20% of the level’s points |