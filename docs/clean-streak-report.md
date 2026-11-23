> **Document status: HISTORICAL** (classified 2026-11-22, D-104). Kept for context; not a current requirement. Clean Streak report (v0.18); Clean Streak is being retired as a player-facing multiplier. Where it conflicts with `docs/decisions.md` or a current document in the [docs index](README.md), those win.

# Clean Streak — implementation report (v0.18.0)

_2026-11-17. The response to "TypeL — Scoring System Redesign & Playtest Handoff". Live at https://robbynpicard-gif.github.io/TypeL/_

## 1. What changed

Scoring now has three layers:

`word score = (10 × letters × (1 + bonus %) + flat bonuses) × combo multiplier × Clean Streak multiplier`

The result is rounded once, at the end.

- **Clean Streak** counts words captured with no typo. Milestones use the provisional values exactly as given: 0 ×1.00 · 5 ×1.20 · 15 ×1.40 · 25 ×1.65 · 50 ×2.00 · 100 ×2.75 · 200 ×3.50.
- **Corrected typo:** the streak goes back to the start of the milestone below the one reached. 50 → 25 (×1.65); 21 → 5; 3 → 0. The combo is untouched. Repeated typos keep stepping down one milestone at a time.
- **Wrong Enter:** the streak resets to 0 (×1.00). The combo still drops one tier, as before.
- **Miss:** the streak and the combo both reset to 0. Ward damage and game over are unchanged.
- **Stage persistence:** a stage is a **chapter**, meaning 4 levels plus a boss (levels 1–5, 6–10, 11–15, 16–20).
  - The streak carries between levels of a chapter.
  - It resets to 0 when the next chapter starts, and at the start of every run.
  - Each run belongs to Normal or Hardcore, so the two modes never share a streak.
  - Combo carry is unchanged: the combo still carries across every level.
- **Display:**
  - The third panel of the status bar is now the Clean Streak panel: the count, the ×multiplier, a bar to the next milestone, and a line such as "10 more for ×1.40". Accuracy and WPM moved under the level name.
  - A milestone gets an illuminated proclamation ("CLEAN STREAK III · ×1.65 on every word") with gold sparks and a bell chord. The chord grows with each tier: choir from tier III, a low swell from V, a screen flash from IV.
  - A typo gets an ink blot on the panel and the loss shown plainly ("×1.65 → ×1.40"), a small shake, and a soft two-note drop.
  - A wrong Enter shows "STREAK LOST (n)" over the typewriter with a page-tear sound.
  - A miss shows a large "STREAK BROKEN" with the number of clean words lost; the chord falls apart.
- **Stats:** the Stats screen adds "Best Clean Streak".

## 2. Files and systems changed

| Area | File |
|---|---|
| Formula, milestone table (one place to tune), step-back rule | `src/gameplay/ScoringSystem.ts` (`STREAK_MILESTONES`, `scoreWord`, `streakAfterTypo`) |
| State: streak, peak, "typo in this entry" | `src/core/GameState.ts` |
| Rules: capture, typo, wrong Enter, miss; carry-in option | `src/core/GameEngine.ts` (`setCleanStreak`, `initialCleanStreak`) |
| New event `cleanStreakChanged`; `wordCompleted` carries the streak multiplier | `src/core/GameEvents.ts` |
| Chapter carry and reset | `src/modes/CampaignMode.ts` (`chapterOf`, `recordLevel`), `src/app/App.ts` |
| Display | `src/ui/GameHUD.ts`, `src/render/StreakFeedback.ts` (new), `src/scenes/GameScene.ts` |
| Sounds | `src/audio/Audio.ts` |
| Lifetime record | `src/storage/LifetimeStats.ts`, Stats screen |

All of it runs inside the fixed 60 Hz deterministic simulation. The display only listens to events, so animations can't change the score. Duels and replays stay deterministic.

## 3. Tests

There are **30 new tests** (`tests/cleanStreak.test.ts`), and **all 211 tests pass**. They cover:

- **Milestones:** each threshold and multiplier; climbing through real captures; 49 → 50, 99 → 100 and 199 → 200.
- **Corrected typos:** before the first milestone; after reaching 5, 15 and 50; repeated typos; the combo is untouched; the word typed with the typo doesn't count.
- **Wrong Enter:** the streak goes to 0 and the combo drops one tier.
- **Miss:** the streak and combo go to 0, the ward takes damage, and the game still ends at 100%.
- **Scoring:**
  - The design example gives 609 (and 1,066 at ×3.50).
  - Flat Clean Sweep points are multiplied too.
  - The streak is applied once.
  - Rounding happens once.
- **Chapter carry:** carry within chapter 1, a reset at level 6, separate Normal and Hardcore runs, combo carry unchanged.
- **Existing suites:** spells, bonuses, Campaign, Practice and game over all still pass.

The full game was also built and played in a browser by a typing bot through the first chapter, with deliberate typos and wrong Enters. The panel, proclamations and setbacks all appeared as intended.

## 4. Rulings the spec left open

1. **When a milestone pays out:** the capture that reaches a milestone already scores at its multiplier. The 5th clean word scores ×1.20, which is the moment the celebration fires.
2. **What counts as a clean capture:** only words you type.
   - Words taken by spells (Shock, Harvest) don't change the streak, in either direction.
   - A word stopped by Barrier doesn't count as a miss, so it doesn't break the streak (the combo is treated the same way).
3. **Several wrong letters in a row count as one typo:** the game already counted errors this way, so typing "lxxx" costs one milestone, not three.
4. **A typo then a wrong Enter on the same word:** the typo steps the streak back, then the Enter resets it to 0.
5. **Endless Practice** keeps the streak for the whole session, because it has no chapters.
6. **The "×2" and "Clean Streak I" proclamations:** both happen on the 5th clean word. The streak proclamation now waits 0.75 s so the two don't overlap.

## 5. Balance flags (nothing changed; for discussion)

**1. 200 is nearly unreachable with the chapter reset.**

| Chapter | Words in levels | Boss words (approx.) | Total |
|---|---|---|---|
| 1 | 48 | ~31 | ~79 |
| 2 | 69 | ~46 | ~115 |
| 3 | 91 | ~68 | ~159 |
| 4 | 112 | ~120 | ~232 |

Spells that clear words lower these totals further. So:
- **50** is reachable in every chapter.
- **100** needs chapter 2 or later, played almost without a typo.
- **200** is only possible in chapter 4, with almost no mistakes across the whole chapter.

In Practice, 200 is a pure endurance target. If 100 and 200 should be goals within a run, the options are:
- carry the streak across the whole run;
- lower the top milestones;
- make a chapter reset step the streak down rather than wipe it.

**2. Typos early are cheap, typos late are expensive.** Below 15, any typo sends you to 0 or 5. At 100+, a single typo costs 50 words of progress (100 → 50). This is the intended "mastery" pressure, but expect strong players to feel the ×2.75 → ×2.00 drop sharply.

**3. Combo and streak line up at the start.** A clean player hits ×2 combo and Streak I on the same word, so early on the two layers feel like one. They separate later because typos don't break the combo.

**4. Level-end bonuses grow with the streak.** Flawless, Under Par and Comeback are percentages of the level's points, so a strong streak raises them too. They were left as they are, as asked.

**5. Score size.** At ×10 combo and ×2.00 streak, a 9-letter word with Perfect and Quick scores 90 × 1.45 × 10 × 2 = 2,610. The 6-digit score counter will overflow (999,999) in long, strong runs. It should probably grow to 7 digits.

## 6. How to playtest

1. Open https://robbynpicard-gif.github.io/TypeL/ and refresh to get v0.18.0. The version number is shown at the bottom of the Credits screen.
2. Start Campaign → Normal. Watch the third panel of the status bar: CLEAN STREAK, the ×multiplier, and the bar to the next milestone.
3. Type five words cleanly: ×2 appears, then CLEAN STREAK I.
4. Type a wrong letter and then Backspace: the panel shakes and shows the drop.
5. Press Enter on a half-typed word: "STREAK LOST" appears and the streak goes to 0.
6. Let a word through: "STREAK BROKEN" appears, and both the streak and combo go to 0.
7. Clear the boss on level 5. Level 6 starts with CLEAN STREAK 0 while the combo carries over.
8. For long-streak testing, use Endless Practice, which never resets the streak.

**What to watch for:** time to ×1.20 (about 11–15 s on level 1); whether 50 feels achievable in chapter 1 (about 79 words in total); how painful a typo feels at ×2.00 and above; and whether the multiplier visibly moves the score late in a run.
