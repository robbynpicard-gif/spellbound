# Battlefield pressure — audit, first tuning pass and simulations (2026-11-23)

Document status: **CURRENT (dated report)** · Decisions: D-113, D-114 ·
Branch: `dev/battlefield-pressure-20261123`, based on
`dev/apprenticeship-prototype-20261119` at `191d3a0`.

Every tuning number here is **Experimental**. Simulated typists are
synthetic: they are useful for comparing before and after, not as a forecast
of how real players will do.

## 1. Code audit (before this pass)

| Area | Where | What it did | Status |
|---|---|---|---|
| Length × speed plan per spawn | `src/difficulty/DifficultyDirector.ts` | A joint 3×3 length/speed mix. Pressure pushed both length and speed up together. | Implemented, Verified (D-097/D-101) |
| Length windows | `lengthWindowAt` | Slow ≈ 3–6, Harvest 6+; apprenticeships 2–8 interpolated linearly, so T3–T5 already drifted long. | Implemented |
| Spawn cadence | `envelope().spawnScale`, `GameEngine` pace | The interval scaled with expected length, so longer words meant *fewer* scrolls. The mean gap was ~1.7–1.8 s in **every** apprenticeship. | Implemented |
| Events | `EventSchedule`, `effects()` | Short and major events mostly raised pressure (i.e. length and speed). Spawn compression was small (0.18 / 0.34). | Implemented |
| Opening Trial | `src/typel/apprenticeship.ts` | Borrowed T5–T8 checkpoints for pressure, and with them their vocabulary: 35% of words had 7+ letters. | Implemented (D-112) |
| Placement | `GameEngine.spawn()` | A lane search near the top only (y < 90). There was no Ward-arrival spacing, and fast scrolls could overtake slower ones through their text. | Implemented |
| Endless | `endlessLevel`, overdrive, floors | Overwhelms everyone, but the late game leans on speed and floors; pairs of near-simultaneous impacts were common. | Implemented (D-102) |
| Measurement | `DirectorSimulation.ts` | Measured outcomes and `requiredCps`, with no urgency, workload or impact metric. The sim typist used `selectTarget`, which is not typing-only. | Tools |

**Finding:** the old curve made late apprenticeships harder mainly by making
words longer. For capable typists the field stayed almost empty (fewer than 1.6
scrolls on average at 90+ WPM), and spells were hardly ever useful (≈ 0 casts
per minute). D-113 inverts this.

## 2. How the philosophy differs

| | Before (D-097 / D-101 as tuned) | Now (D-113 / D-114) |
|---|---|---|
| Primary lever | Word length and fall speed, co-equal | Simultaneous scrolls, then urgency and timing, then length |
| Early game | Length rose from T2 onward | Short and medium words; pressure shows as count and speed |
| Events | A little more pressure | Bursts of competing threats, then a recovery |
| Later apprenticeships | Longer words, same spawn cadence | Denser fields *and* longer words |
| Fairness | Lane spacing at the top only | Arrival spacing at the Ward plus overtaking-aware lanes |
| Endless | Speed and floors | Bounded speed and density, then ever-denser bursts (capped) |
| Measurement | Outcomes only | Deterministic battlefield-pressure metric |

## 3. What changed (first tuning pass)

Everything is in the existing Director and spawn code; no new gameplay
system was added. The values are listed in D-113. In summary:

1. **Length later** (`lengths.earlyCurve`, `longWeight`, `mediumWeight`, `tiltShare`): the windows of T2–T4 stay near Slow's; early pressure barely tilts toward the long end.
2. **Vocabulary separate from pressure** (`DirectorSpec.vocabulary`): the Opening Trial borrows late pressure but keeps short and medium words.
3. **Bursts** (`short`, `major`, `burstShare`): events compress spawning hard and add scrolls; they are gentler in the first apprenticeships.
4. **Academy density** (`academyDensity`): later apprenticeships spawn more often.
5. **Endless** (`endlessBurst`): after the speed and density limits, bursts keep getting denser, up to a cap.
6. **Readability** (`SPAWN_FAIRNESS`): Ward arrivals ≥ 0.45 s apart where a ≤ 1.2 s slowdown allows it; there is no overtaking through text.
7. **Saves**: `RUN_RULESET` → `run-2`.

The new metric `src/difficulty/BattlefieldPressure.ts` reports:
- active scrolls;
- urgent scrolls (≤ 4 s from the Ward);
- workload (letters due within 6 s);
- the required letter rate;
- near-simultaneous impact pairs (< 0.45 s apart).

It is simulation-only.

## 4. Simulations

Command: `bun tools/battlefield-report.ts out.json` (4 seeds per row).
- **Opening rows:** the typist doesn't cast; `opening+slow` is a measurement-only variant with SLOW available.
- **Academy rows:** the typist casts spells by typing their names.
- **Endless rows:** survival time, with a 60 min cap.

Values are shown as before → after.

### Normal

| Scenario | Mode | WPM | Cleared % (Endless: survival) | Active mean / p95 | Urgent mean / p95 | ≥7-letter % | Mean spawn gap (s) | Casts / min | Impact pairs |
|---|---|---|---|---|---|---|---|---|---|
| opening | normal | 45 | 0 → 25 | 3.6/8 → 4.8/11 | 0.5/3 → 0.7/4 | 35 → 1 | 1.79 → 1.35 | 0.0 → 0.0 | 0.39 → 0.45 |
| opening+slow | normal | 45 | 0 → 100 | 4.1/10 → 5.6/12 | 0.4/2 → 0.5/3 | 34 → 1 | 1.83 → 1.46 | 2.0 → 2.4 | 0.40 → 0.27 |
| opening | normal | 60 | 100 → 100 | 2.1/6 → 3.4/10 | 0.2/2 → 0.3/2 | 37 → 1 | 1.77 → 1.28 | 0.0 → 0.0 | 0.14 → 0.32 |
| opening+slow | normal | 60 | 100 → 100 | 2.4/8 → 3.5/11 | 0.1/1 → 0.1/1 | 37 → 1 | 1.78 → 1.31 | 0.9 → 1.0 | 0.17 → 0.18 |
| opening | normal | 90 | 100 → 100 | 0.8/2 → 1.2/4 | 0.0/0 → 0.0/0 | 35 → 1 | 1.76 → 1.24 | 0.0 → 0.0 | 0.01 → 0.04 |
| opening | normal | 120 | 100 → 100 | 0.6/1 → 0.7/2 | 0.0/0 → 0.0/0 | 34 → 1 | 1.76 → 1.26 | 0.0 → 0.0 | 0.00 → 0.01 |
| opening | normal | 200 | 100 → 100 | 0.3/1 → 0.3/1 | 0.0/0 → 0.0/0 | 34 → 1 | 1.76 → 1.26 | 0.0 → 0.0 | 0.00 → 0.00 |
| academy T1 | normal | 45 | 100 → 100 | 1.8/5 → 1.9/6 | 0.0/0 → 0.0/0 | 1 → 1 | 1.78 → 1.73 | 0.0 → 0.2 | 0.09 → 0.05 |
| academy T1 | normal | 60 | 100 → 100 | 0.8/2 → 0.8/2 | 0.0/0 → 0.0/0 | 1 → 1 | 1.78 → 1.73 | 0.0 → 0.0 | 0.01 → 0.00 |
| academy T1 | normal | 90 | 100 → 100 | 0.5/1 → 0.5/1 | 0.0/0 → 0.0/0 | 1 → 1 | 1.78 → 1.73 | 0.0 → 0.0 | 0.00 → 0.00 |
| academy T3 | normal | 45 | 100 → 25 | 5.1/9 → 5.7/10 | 0.5/2 → 0.6/3 | 12 → 2 | 1.78 → 1.55 | 1.1 → 0.8 | 0.67 → 0.43 |
| academy T3 | normal | 60 | 100 → 100 | 1.2/3 → 1.6/4 | 0.0/0 → 0.0/0 | 12 → 2 | 1.70 → 1.48 | 0.0 → 0.0 | 0.02 → 0.04 |
| academy T3 | normal | 90 | 100 → 100 | 0.6/1 → 0.7/1 | 0.0/0 → 0.0/0 | 12 → 2 | 1.70 → 1.48 | 0.0 → 0.0 | 0.00 → 0.00 |
| academy T5 | normal | 45 | 75 → 25 | 5.4/9 → 7.8/11 | 0.7/3 → 1.0/3 | 40 → 21 | 1.81 → 1.60 | 2.6 → 3.8 | 0.61 → 0.58 |
| academy T5 | normal | 60 | 100 → 100 | 3.1/7 → 6.5/10 | 0.2/1 → 0.6/3 | 41 → 24 | 1.73 → 1.38 | 0.8 → 3.0 | 0.32 → 0.55 |
| academy T5 | normal | 90 | 100 → 100 | 0.8/2 → 1.5/4 | 0.0/0 → 0.0/0 | 41 → 24 | 1.71 → 1.31 | 0.1 → 0.2 | 0.01 → 0.04 |
| academy T5 | normal | 120 | 100 → 100 | 0.6/1 → 0.8/2 | 0.0/0 → 0.0/0 | 41 → 24 | 1.71 → 1.31 | 0.1 → 0.3 | 0.00 → 0.01 |
| academy T5 | normal | 200 | 100 → 100 | 0.3/1 → 0.4/1 | 0.0/0 → 0.0/0 | 41 → 24 | 1.71 → 1.31 | 0.1 → 0.3 | 0.00 → 0.00 |
| academy T8 | normal | 45 | 0 → 0 | 5.4/8 → 7.9/11 | 0.9/3 → 1.7/5 | 66 → 69 | 1.78 → 1.22 | 2.3 → 1.0 | 0.53 → 0.77 |
| academy T8 | normal | 60 | 75 → 0 | 4.4/8 → 7.3/11 | 0.5/2 → 1.0/4 | 71 → 67 | 1.77 → 1.46 | 2.1 → 3.6 | 0.43 → 0.63 |
| academy T8 | normal | 90 | 100 → 100 | 1.1/3 → 5.8/10 | 0.0/0 → 0.5/2 | 73 → 71 | 1.70 → 1.27 | 0.1 → 3.1 | 0.02 → 0.45 |
| academy T8 | normal | 120 | 100 → 100 | 0.7/1 → 2.7/7 | 0.0/0 → 0.0/0 | 73 → 73 | 1.70 → 1.14 | 0.1 → 0.6 | 0.00 → 0.16 |
| academy T8 | normal | 200 | 100 → 100 | 0.4/1 → 0.6/2 | 0.0/0 → 0.0/0 | 73 → 74 | 1.70 → 1.13 | 0.2 → 0.2 | 0.00 → 0.00 |
| academy T9 | normal | 45 | 0 → 0 | 5.9/9 → 7.7/10 | 1.0/3 → 1.5/4 | 66 → 68 | 1.70 → 1.31 | 2.0 → 1.8 | 0.54 → 0.59 |
| academy T9 | normal | 60 | 25 → 0 | 5.2/8 → 7.7/11 | 0.7/3 → 1.1/4 | 72 → 69 | 1.72 → 1.49 | 2.6 → 4.6 | 0.57 → 0.51 |
| academy T9 | normal | 90 | 100 → 100 | 1.6/4 → 6.4/10 | 0.0/0 → 0.6/3 | 75 → 71 | 1.59 → 1.23 | 0.3 → 3.9 | 0.05 → 0.57 |
| academy T9 | normal | 120 | 100 → 100 | 0.8/2 → 4.4/9 | 0.0/0 → 0.2/1 | 77 → 74 | 1.59 → 1.08 | 0.1 → 1.7 | 0.01 → 0.33 |
| academy T9 | normal | 200 | 100 → 100 | 0.4/1 → 0.8/2 | 0.0/0 → 0.0/0 | 76 → 77 | 1.59 → 1.03 | 0.2 → 0.5 | 0.00 → 0.01 |
| endless T1 | normal | 60 | 2.6 min → 2.7 min | 9.5/13 → 10.1/13 | 1.1/3 → 1.0/3 | 4 → 3 | 1.28 → 1.25 | 4.4 → 4.5 | 1.56 → 0.81 |
| endless T1 | normal | 120 | 16.2 min → 16.3 min | 2.4/13 → 3.4/15 | 0.3/2 → 0.5/3 | 4 → 4 | 0.95 → 0.90 | 0.6 → 0.9 | 0.48 → 0.40 |
| endless T1 | normal | 200 | 42.8 min → 54.5 min | 5.5/16 → 8.5/16 | 1.1/5 → 1.8/6 | 6 → 6 | 0.63 → 0.56 | 2.1 → 3.3 | 2.25 → 2.70 |
| endless T9 | normal | 60 | 0.6 min → 0.5 min | 7.7/10 → 8.6/12 | 1.8/4 → 2.1/4 | 83 → 82 | 1.20 → 0.94 | 2.1 → 2.0 | 1.07 → 1.37 |
| endless T9 | normal | 120 | 16.9 min → 11.1 min | 5.3/11 → 7.8/13 | 0.9/4 → 1.1/5 | 73 → 69 | 1.00 → 0.91 | 5.3 → 7.1 | 0.96 → 1.02 |
| endless T9 | normal | 200 | 43.1 min → 44.1 min | 4.5/15 → 7.8/16 | 1.1/5 → 1.4/6 | 69 → 62 | 0.64 → 0.53 | 5.2 → 8.1 | 1.28 → 1.68 |

### Hardcore

| Scenario | Mode | WPM | Cleared % (Endless: survival) | Active mean / p95 | Urgent mean / p95 | ≥7-letter % | Mean spawn gap (s) | Casts / min | Impact pairs |
|---|---|---|---|---|---|---|---|---|---|
| opening | hardcore | 60 | 0 → 0 | 5.0/8 → 6.7/11 | 0.6/3 → 0.9/4 | 30 → 1 | 1.34 → 1.08 | 0.0 → 0.0 | 0.55 → 0.87 |
| opening | hardcore | 90 | 100 → 100 | 1.8/5 → 3.4/10 | 0.1/1 → 0.3/2 | 39 → 1 | 1.31 → 0.93 | 0.0 → 0.0 | 0.08 → 0.53 |
| opening | hardcore | 120 | 100 → 100 | 0.9/3 → 1.8/5 | 0.0/0 → 0.0/0 | 37 → 1 | 1.32 → 0.89 | 0.0 → 0.0 | 0.01 → 0.12 |
| opening | hardcore | 200 | 100 → 100 | 0.4/1 → 0.5/1 | 0.0/0 → 0.0/0 | 37 → 1 | 1.32 → 0.91 | 0.0 → 0.0 | 0.00 → 0.01 |
| academy T1 | hardcore | 60 | 50 → 25 | 4.8/12 → 5.4/12 | 0.3/2 → 0.4/2 | 1 → 2 | 1.33 → 1.30 | 1.2 → 1.5 | 0.77 → 0.38 |
| academy T1 | hardcore | 90 | 100 → 100 | 0.8/2 → 0.8/2 | 0.0/0 → 0.0/0 | 1 → 2 | 1.29 → 1.25 | 0.0 → 0.0 | 0.01 → 0.01 |
| academy T1 | hardcore | 120 | 100 → 100 | 0.6/1 → 0.6/1 | 0.0/0 → 0.0/0 | 1 → 1 | 1.29 → 1.25 | 0.0 → 0.0 | 0.00 → 0.00 |
| academy T3 | hardcore | 60 | 25 → 75 | 6.0/10 → 7.0/11 | 0.6/3 → 0.6/3 | 13 → 3 | 1.42 → 1.28 | 1.5 → 1.8 | 0.81 → 0.60 |
| academy T3 | hardcore | 90 | 100 → 100 | 1.2/3 → 1.4/4 | 0.0/0 → 0.0/0 | 14 → 3 | 1.30 → 1.12 | 0.0 → 0.0 | 0.04 → 0.04 |
| academy T3 | hardcore | 120 | 100 → 100 | 0.7/2 → 0.8/2 | 0.0/0 → 0.0/0 | 14 → 3 | 1.30 → 1.12 | 0.0 → 0.0 | 0.01 → 0.01 |
| academy T5 | hardcore | 60 | 0 → 0 | 6.3/9 → 7.9/11 | 0.9/3 → 1.0/4 | 39 → 23 | 1.43 → 1.22 | 2.4 → 4.5 | 0.82 → 0.71 |
| academy T5 | hardcore | 90 | 100 → 100 | 2.4/6 → 6.3/10 | 0.1/1 → 0.5/2 | 47 → 28 | 1.31 → 1.05 | 0.5 → 2.4 | 0.20 → 0.66 |
| academy T5 | hardcore | 120 | 100 → 100 | 0.9/2 → 2.0/6 | 0.0/0 → 0.0/0 | 47 → 29 | 1.31 → 0.99 | 0.2 → 0.4 | 0.02 → 0.12 |
| academy T8 | hardcore | 60 | 0 → 0 | 6.7/9 → 8.2/11 | 1.5/4 → 1.8/5 | 71 → 71 | 1.28 → 1.08 | 1.9 → 2.8 | 0.94 → 0.79 |
| academy T8 | hardcore | 90 | 75 → 50 | 3.9/8 → 7.3/11 | 0.4/2 → 0.8/3 | 72 → 67 | 1.34 → 1.15 | 2.2 → 5.4 | 0.45 → 0.71 |
| academy T8 | hardcore | 120 | 100 → 100 | 1.4/4 → 5.8/11 | 0.0/0 → 0.4/2 | 75 → 69 | 1.29 → 0.95 | 0.3 → 4.4 | 0.05 → 0.59 |
| academy T9 | hardcore | 60 | 0 → 0 | 6.4/9 → 8.2/11 | 1.3/4 → 1.6/4 | 74 → 68 | 1.36 → 1.21 | 3.9 → 5.0 | 0.89 → 0.96 |
| academy T9 | hardcore | 90 | 75 → 0 | 4.8/8 → 7.4/11 | 0.6/3 → 1.0/4 | 73 → 71 | 1.33 → 1.16 | 3.1 → 5.1 | 0.61 → 0.64 |
| academy T9 | hardcore | 120 | 100 → 100 | 1.8/4 → 6.5/11 | 0.1/0 → 0.6/3 | 76 → 71 | 1.23 → 0.95 | 0.4 → 4.5 | 0.10 → 0.65 |
| endless T1 | hardcore | 60 | 0.8 min → 0.9 min | 10.4/13 → 11.1/15 | 2.1/5 → 1.6/5 | 2 → 3 | 1.01 → 1.06 | 3.1 → 5.1 | 2.02 → 1.05 |
| endless T1 | hardcore | 120 | 7.2 min → 7.3 min | 5.3/14 → 6.2/14 | 0.8/4 → 0.9/4 | 3 → 3 | 0.83 → 0.79 | 1.8 → 2.2 | 1.23 → 0.82 |
| endless T1 | hardcore | 200 | 18.6 min → 22.1 min | 3.7/16 → 6.8/16 | 1.0/6 → 1.7/7 | 5 → 5 | 0.59 → 0.54 | 1.2 → 2.6 | 1.38 → 2.15 |
| endless T9 | hardcore | 60 | 0.3 min → 0.3 min | 7.7/9 → 8.4/10 | 2.3/4 → 2.4/5 | 82 → 82 | 0.99 → 0.88 | 1.5 → 0.8 | 1.66 → 0.91 |
| endless T9 | hardcore | 120 | 11.5 min → 5.7 min | 5.9/11 → 7.9/13 | 1.2/5 → 1.4/5 | 67 → 64 | 0.94 → 0.88 | 7.4 → 8.6 | 1.12 → 1.00 |
| endless T9 | hardcore | 200 | 25.0 min → 19.0 min | 4.9/14 → 7.8/14 | 1.6/7 → 1.7/7 | 63 → 62 | 0.57 → 0.54 | 7.4 → 8.3 | 1.53 → 1.65 |

### Reading the results

- **Opening Trial.**
  - Long words fell from ~35% to ~1%, and the mean length is now ≈ 4.2.
  - The field holds more scrolls (p95 8 → 11), and spawns come faster in the climax.
  - It is clearable without spells from ~60 WPM.
  - At 45 WPM it is cleared 25% of the time without spells and **100% with SLOW**, which is the "why SLOW matters" lesson D-113 asks for.
- **Academy.**
  - T1 is unchanged for a 45 WPM typist.
  - From T3 on, the baseline rises: more scrolls, more urgency, more casts. For example, T9 at 90 WPM goes from 1.6 to 6.4 active scrolls and from 0.3 to 3.9 casts per minute, which is about one every 15 s, matching the experimental 10–15 s cadence.
  - The clear threshold rises across the journey: T1 ≈ 45, T3 ≈ 60, T5 ≈ 60, T8/T9 ≈ 90 WPM (Normal).
  - Hardcore stays roughly +30 WPM.
- **Endless.**
  - Still unwinnable. Weaker typists fall at the same times as before or sooner.
  - Strong typists face fuller fields, with urgency at p95 6–7.
  - A 200 WPM typist on Normal now lasts 44–55 min (Q-23).
- **Fairness.**
  - The arrival rule keeps fewer than 10% of new Director scrolls within 0.45 s of another at spawn (`tests/battlefield-pressure.test.ts`).
  - The "impact pairs" column counts every pair on the field at each sample, including scrolls that Slow, Wind or the player's order bring together later, so it still rises with density.
  - There were no overlaps in the early game.

## 5. Not done in this pass

- Arcane Trials (D-114): not built (SCOPE-002).
- 120–200 WPM typists still see a near-empty Academy field (Q-22).
- The impact-pair count in dense Endless is not yet reduced (Q-23).
- Validated by deterministic simulation only. There has been no human playtest yet.

Owner questions: Q-21 to Q-24 in `docs/open-questions.md`.
