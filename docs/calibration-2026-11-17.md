# Calibration report — stage campaign (v0.19.0)

Bots played each sampled level in the real engine (seed 7, spells unused):

- **plan**: the WPM the level is generated for.
- **perfect**: WPM reported by a bot that types each word the moment it appears
  (the pace the level actually demands).
- **@target**: a steady typist at exactly the stage's target WPM.
- **@80%**: a steady typist at 80% of the target.

WPM is in-game Wizzy Type WPM (5 letters = 1 word). Ward = shield left.

## Normal (targets 18/22/26/30/35)

| Stage | Level | plan | perfect | @target | @80% |
|---|---|---|---|---|---|
| 1 | 1 | 12 | 13 | won | won |
| 1 | 10 | 15 | 15 | won | lost |
| 1 | 19 | 17 | 18 | won | lost |
| 1 | Boss | 18 | 18 | won (ward 90%) | won |
| 2 | 1 | 18 | 18 | won | won |
| 2 | 19 | 21 | 21 | won | lost |
| 2 | Boss | 22 | 22 | won (ward 89%) | won |
| 3 | 1 | 22 | 22 | won | lost |
| 3 | 19 | 25 | 26 | won (88%) | lost |
| 3 | Boss | 26 | 25 | won (ward 64%) | lost |
| 4 | 1 | 26 | 26 | won | lost |
| 4 | 19 | 29 | 29 | won (87%) | lost |
| 4 | Boss | 30 | 31 | **lost** | lost |
| 5 | 1 | 30 | 31 | won | lost |
| 5 | 19 | 33 | 35 | won (72%) | lost |
| 5 | Boss | 35 | 36 | **lost** | lost |

## Hardcore (targets 25/30/35/40/45)

| Stage | Level | plan | perfect | @target | @80% |
|---|---|---|---|---|---|
| 1 | 1 | 18 | 19 | won | won |
| 1 | 19 | 24 | 24 | won (52%) | lost |
| 1 | Boss | 25 | 24 | won (88%) | won |
| 2 | 19 | 29 | 29 | won (87%) | lost |
| 2 | Boss | 30 | 29 | won (61%) | lost |
| 3 | 19 | 33 | 34 | won (58%) | lost |
| 3 | Boss | 35 | 36 | won (2%) | lost |
| 4 | 19 | 38 | 40 | won (70%) | lost |
| 4 | Boss | 40 | 41 | won (10%) | lost |
| 5 | 19 | 43 | 42 | won | lost |
| 5 | Boss | 45 | 44 | **lost** | lost |

## Observations (no values changed)

1. Measured pace matches the plan closely, so the targets are honoured.
2. Late bosses ramp to 112% of target. A steady target-speed typist without
   spells loses Normal 4–5 and Hardcore 5. Spells and bursts of speed should
   make them winnable, but this is the main thing to playtest.
3. There is little slack below target: a typist at 80% loses from around level
   10 of stage 1 onward. Humans type in bursts and use spells, so real play
   will differ. Needs human playtests.
4. Stage 1 Normal starts very gently (12 WPM, ~3.5 s between words).
