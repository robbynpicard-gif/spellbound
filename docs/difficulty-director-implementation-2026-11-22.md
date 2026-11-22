# TypeL — Difficulty Director prototype: audit, implementation, simulation and playtest plan
_2026-11-22 · D-097 implementation (Phases 0–4), **reconciled with the D-098 refinement** · branch `dev/difficulty-director-20261122` · **every number is EXPERIMENTAL**; production `main` untouched_

Spec: `docs/apprenticeship-difficulty-director-2026-11-21.md` (including its D-098 addendum). Decisions: D-097 (direction), D-098 (dominant soft length windows).

> **Parallel work:** a second session implemented its own director on `dev/apprenticeship-prototype-20261119` at the same time (commits `cfc8b0e`, `4cfc06f`, recorded there as D-100). This branch is an independent alternative and is **not merged** into it. No decision number is claimed here. The owner should choose one prototype, or combine them, before either is tuned further. Key differences: this one defaults **off**, keeps every classic supporting lever (quota, spawn interval, density caps, surges) and rescales only spawn interval, and reads no field state. The other defaults on in the preview, computes its own spawn interval and density, and limits stacked long/fast words using the field's contents.

## 1. Audit of the current (classic) difficulty loop

**Live entry point.** The dev preview boots `src/main.ts` → `TypeLApp` (`src/typel/app.ts`). Its modes:

| Entry | Config source | Notes |
|---|---|---|
| Apprenticeship levels 1–12 + boss (9 apprenticeships, Normal/Hardcore) | `trialLevel()` in `src/typel/apprenticeship.ts` | Blends two old stages of `src/difficulty/Stages.ts` (position 1 + (trial−1)·4/8) at an old level mapped from 1–12 onto 1–19; boss = old level 20. |
| Endless after a boss | `trialEndless()` → `endlessConfig()` | `engine.continueIntoEndless()` keeps the field. |
| Sandbox (pace 1–5) | `sandboxConfig()` → `endlessConfig(tier)` | |
| Typing Trials | `src/typel/typingTrial.ts` | Passages, no falling words — not affected. |
| Legacy app (5×20 campaign, Practice, Duels, Wind lessons in `src/app/`) | `Stages.ts` directly | Not booted by the dev preview; duels and production rely on it. Untouched. |

**What sets each lever today (all in `Stages.ts` + `GameEngine.ts`):**
- **Word length:** a per-stage bracket (`STAGE_TUNING.lengths`, Normal 2–4 → 4–8) with a "signature" length weighted ×7 early, broadening late in a stage. `WordGenerator` samples lengths independently of speed.
- **Fall speed:** one level-wide `initialFallSpeed` from a linear 15 s → 10 s fall over the whole mode (13 → 8 s Hardcore), then per word ±25 % variance (`SPEED_VARIANCE`) × a linear in-level ramp from ×(1 − speedRamp) to ×(1 + speedRamp + 0.3). Length and speed are **independent**.
- **Spawn frequency:** from a linear gameplay-WPM target (`levelWpm`) ÷ average length, ±`spawnRamp` across the level.
- **Density:** `maxActiveWords` from fall time ÷ spawn interval; opening cluster of 4/5 words.
- **Surges:** none before level 6, then one (0.55) or two (0.35/0.75) per level, three in a boss; spawn ×0.6, +3 words; a 4 s respite after each.
- **Bosses:** linear ramp of fall speed, spawn interval and density over the timer.
- **Endless:** `escalation` compounds fall speed ×1.055 and spawn ×1.05 every 25 captures (**unbounded exponential speed**) plus a 60 s build/surge/relief/settle wave.
- **Nonlinear pressure:** none besides surges; every in-level curve is linear.

**Findings that matter for D-097:**
1. As D-097 described it, it is a staircase (D-098 has since asked to keep its *recognizable* length progression, but softly): apprenticeship 1 never spawns a word longer than 4 letters; apprenticeship 9 is 43–90 % long-and-fast with ~0 % short-and-slow (simulation below).
2. **Bug in the blend:** `trialLevel()` interpolates min/max length but copies the *lower* stage's length weights, so the upper end of odd apprenticeships' brackets never appears (e.g. Normal apprenticeship 4 is labelled 3–6 letters but only spawns 3–5). Not fixed here (classic is the comparison baseline); worth fixing if classic survives.
3. Endless fall speed grows without bound.
4. Changing `DifficultyConfig` globally would break duels (D-024: the word sequence depends only on seed), the legacy campaign tests and replays, so the director is opt-in per config.

## 2. What was built

| File | Role |
|---|---|
| `src/difficulty/DifficultyDirector.ts` | Pure, deterministic director: tuning table, floor/arc/mix functions, `DifficultyDirector` sampler. No Phaser, no player inputs. |
| `src/difficulty/DifficultyConfig.ts` | Optional `director` spec on a level + validation. |
| `src/core/GameEngine.ts` | When `config.director` exists: plans each spawn's length and time-to-Ward, rescales the classic spawn interval, Wind speed reset uses each word's own spawn speed. Otherwise byte-for-byte classic. |
| `src/gameplay/WordGenerator.ts` | `nextOfLength()` with the same fairness rules; `next()` unchanged (same draw order). |
| `src/typel/apprenticeship.ts` | `directorTrialLevel / directorTrialEndless / directorSandboxConfig` wrap the classic configs. |
| `src/typel/directorFlag.ts` + `app.ts` | Dev flag (default **off**): Options checkbox, Sandbox toggle, `?director=1/0` URL. Runs show "· Director"; director runs keep separate best scores; Codex → Rules describes the active system. |
| `src/difficulty/DirectorSimulation.ts`, `tools/director-report.ts` | Real-engine simulation with a synthetic typist; classic vs director report. |
| `tests/difficulty-director.test.ts` | 38 tests: D-097 acceptance plus D-098 Slow level 1, Harvest and intermediate-window tests. |

**How it works.**
- **Layer 1 — floor:** `floor(a) = F0 + (F1 − F0)·smoothstep(a)`, `a = (apprenticeship − 1)/8`. An encounter's base adds `levelLift × arcPosition` (level 1 → boss of one apprenticeship).
- **Layer 2 — arc:** `pressure = base + (ceiling − base)·shape(p)`, `shape = (e^(kp) − 1)/(e^k − 1)` plus a swell at each surge and a recovery dip after it (a breather dip at mid-level when a level has no surges). `p` = quota share, or boss-timer share. Endless: the same 60 s wave as the engine's Endless wave, on a floor that saturates; speed overdrive capped at +18 %.
- **Layer 3 — joint mix:** a 3 × 3 grid of length band × speed band. Cell weights interpolate from an opening mix to a peak mix with pressure. Short/slow keeps ≥ 10 % at any pressure, and one is guaranteed at least every 8 spawns. Long/fast spikes are spaced (≥ 6 spawns apart early, ≥ 2 late; otherwise one lever drops). Opening words (which start partway down) are never fast. The four combinations are deliberately unequal: at Slow level 1, about 45 % of words are short/slow and ≈ 1 % long/fast.
- **D-098 — dominant, soft length windows.** Each apprenticeship has a dominant window: Slow ≈ 3–6, moving smoothly to Harvest ≈ 6–9, and 6–10 for the Grand Wizard. It also drifts gently from level 1 to the boss. "Short / medium / long" in the grid mean the lower, middle and upper part of *that* window. Window edges fade over 1.5 letters rather than cutting off. On top of that, a separate tail draw adds rare outliers:
  - **above** the window: 0.3 % → 2 % at Slow (by pressure), 3 % → 6 % from Harvest on. Never for opening words;
  - **below** it: short relief words, 1 % at Slow, 7 % from Harvest on. Only in short cells.

  Every dictionary length from 2 to 12 stays reachable, so there are **no hard gates**. Speed bands are unchanged and still vary independently of length, so all four combinations exist everywhere.
- **Layer 4 — supporting levers:** quotas, timers, surges, respites, density caps, spell drops and boss ramps are the classic ones, unchanged. The spawn interval is multiplied by `(expected length ÷ classic average length)^0.6 × density(pressure)`, so letters arrive at a comparable rate.
- **Determinism:** its own seeded stream (`seed ^ 0xd1ec7041`), exactly five draws per spawn. An outlier's length comes from the tail draw itself, rescaled within its slice. Same seed + same commands = same words, speeds and timings (tested via `GameEngine.replay`).
- **No adaptation:** it reads only seed, spec and encounter progress (and Endless time), never WPM, accuracy, Ward, score or field contents (tested).

## 3. Simulation: classic vs director
Real `GameEngine`, 32 seeds per cell, apprenticeships 1/5/9 × levels 1/6/12/boss. The typist is a **measuring stick, not a human prediction**: never mistypes, never casts, aims at the lowest word. Reproduce: `npx tsx tools/director-report.ts 32`.
Lengths are classed **relative to the director's D-098 window** for that apprenticeship and level (short = its two lowest lengths or below, long = its top length or above); speeds are absolute (slow ≥ 13.5 s to the Ward, fast ≤ 10 s). Both systems are measured against the same window. *Peak demand* = 95th-percentile typing rate needed to clear the field nearest-first. *Relief/min* = ≥ 2 s spans at or below half the run's own 80th-percentile demand, right after reaching it.

**Normal** (typist 5 cps, 300 ms reaction)

| Apprenticeship | Level | System | Window | In / above / below | Length p10/p50/p90 | Fall p10/p50/p90 (s) | SS | LS | SF | LF | Peak demand (cps) | Relief/min | Win | Misses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 Slow | 1 | classic | 3–6 | 97% / 0% / 3% | 3 / 3 / 4 | 10.2 / 13.6 / 18.6 | 51% | 0% | 9% | 0% | 0.5 | 1.8 | 100% | 0.0 |
| 1 Slow | 1 | director | 3–6 | 99% / 1% / 1% | 3 / 4 / 5 | 10.1 / 16.1 / 18.3 | 45% | 6% | 6% | 1% | 0.7 | 1.7 | 100% | 0.0 |
| 1 Slow | 6 | classic | 3–6 | 96% / 0% / 4% | 3 / 3 / 4 | 9.9 / 13.3 / 18.2 | 47% | 0% | 10% | 0% | 0.5 | 2.5 | 100% | 0.0 |
| 1 Slow | 6 | director | 3–6 | 98% / 1% / 1% | 3 / 4 / 6 | 10.0 / 16.0 / 18.2 | 43% | 7% | 6% | 1% | 0.7 | 2.4 | 100% | 0.0 |
| 1 Slow | 12 | classic | 3–6 | 96% / 0% / 4% | 3 / 4 / 4 | 8.9 / 12.6 / 20.2 | 41% | 0% | 20% | 0% | 0.7 | 2.1 | 100% | 0.0 |
| 1 Slow | 12 | director | 3–6 | 98% / 1% / 1% | 3 / 4 / 6 | 9.8 / 14.6 / 18.1 | 40% | 7% | 6% | 1% | 0.8 | 2.6 | 100% | 0.0 |
| 1 Slow | Boss | classic | 3–6 | 97% / 0% / 3% | 3 / 4 / 4 | 10.9 / 13.1 / 16.3 | 45% | 0% | 1% | 0% | 0.6 | 1.4 | 100% | 0.0 |
| 1 Slow | Boss | director | 3–6 | 98% / 1% / 1% | 3 / 4 / 6 | 9.5 / 14.5 / 18.0 | 39% | 7% | 7% | 2% | 0.8 | 1.8 | 100% | 0.0 |
| 5 Shock | 1 | classic | 5–8 | 82% / 0% / 18% | 4 / 5 / 5 | 8.8 / 11.8 / 16.5 | 28% | 0% | 28% | 0% | 1.1 | 2.0 | 100% | 0.0 |
| 5 Shock | 1 | director | 5–8 | 92% / 2% / 6% | 5 / 6 / 8 | 8.7 / 13.8 / 17.4 | 36% | 7% | 11% | 2% | 1.4 | 1.9 | 100% | 0.0 |
| 5 Shock | 6 | classic | 5–8 | 80% / 0% / 20% | 4 / 5 / 6 | 8.6 / 11.7 / 16.2 | 25% | 0% | 29% | 0% | 1.6 | 1.5 | 100% | 0.0 |
| 5 Shock | 6 | director | 5–8 | 93% / 2% / 5% | 5 / 6 / 8 | 8.5 / 13.7 / 17.4 | 34% | 8% | 11% | 4% | 1.7 | 1.8 | 100% | 0.0 |
| 5 Shock | 12 | classic | 5–8 | 72% / 0% / 28% | 4 / 5 / 6 | 7.6 / 10.7 / 17.3 | 28% | 0% | 42% | 0% | 4.0 | 0.1 | 100% | 0.0 |
| 5 Shock | 12 | director | 5–8 | 92% / 3% / 6% | 5 / 6 / 8 | 8.4 / 13.4 / 17.3 | 30% | 9% | 11% | 6% | 2.6 | 1.4 | 100% | 0.0 |
| 5 Shock | Boss | classic | 5–8 | 70% / 0% / 30% | 4 / 5 / 6 | 9.3 / 11.3 / 14.0 | 16% | 0% | 25% | 0% | 3.7 | 0.4 | 100% | 0.0 |
| 5 Shock | Boss | director | 5–8 | 91% / 4% / 5% | 5 / 6 / 8 | 8.3 / 13.1 / 17.1 | 27% | 10% | 12% | 7% | 6.1 | 0.1 | 100% | 0.8 |
| 8 Harvest | 1 | classic | 6–9 | 81% / 0% / 19% | 5 / 6 / 6 | 7.9 / 10.8 / 14.9 | 17% | 0% | 39% | 0% | 1.8 | 1.5 | 100% | 0.0 |
| 8 Harvest | 1 | director | 6–9 | 89% / 4% / 8% | 6 / 7 / 9 | 7.7 / 12.6 / 16.7 | 27% | 7% | 10% | 6% | 2.8 | 1.1 | 100% | 0.0 |
| 8 Harvest | 6 | classic | 6–9 | 81% / 0% / 19% | 5 / 6 / 7 | 7.5 / 10.2 / 14.0 | 12% | 0% | 47% | 0% | 4.0 | 0.1 | 100% | 0.0 |
| 8 Harvest | 6 | director | 6–9 | 87% / 5% / 8% | 6 / 8 / 9 | 7.7 / 12.2 / 16.5 | 24% | 8% | 11% | 8% | 5.2 | 0.4 | 100% | 0.2 |
| 8 Harvest | 12 | classic | 6–9 | 70% / 0% / 30% | 5 / 6 / 7 | 6.6 / 9.2 / 15.0 | 16% | 0% | 56% | 0% | 10.5 | 0.0 | 100% | 0.4 |
| 8 Harvest | 12 | director | 6–9 | 85% / 7% / 8% | 6 / 8 / 9 | 7.6 / 12.1 / 16.4 | 22% | 8% | 11% | 9% | 7.2 | 0.2 | 100% | 0.2 |
| 8 Harvest | Boss | classic | 6–10 | 70% / 0% / 30% | 5 / 6 / 7 | 8.2 / 9.9 / 12.3 | 1% | 0% | 53% | 0% | 19.4 | 0.2 | 84% | 6.1 |
| 8 Harvest | Boss | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 9 | 7.5 / 12.0 / 16.5 | 22% | 3% | 12% | 3% | 27.2 | 0.8 | 31% | 7.4 |
| 9 Grand Wizard | 1 | classic | 6–10 | 93% / 0% / 7% | 6 / 7 / 7 | 7.5 / 10.3 / 14.1 | 11% | 0% | 42% | 0% | 3.4 | 0.1 | 100% | 0.0 |
| 9 Grand Wizard | 1 | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 10 | 7.6 / 12.3 / 16.6 | 22% | 5% | 8% | 5% | 4.7 | 0.2 | 100% | 0.2 |
| 9 Grand Wizard | 6 | classic | 6–10 | 97% / 0% / 3% | 6 / 7 / 8 | 7.1 / 9.6 / 13.1 | 7% | 0% | 47% | 0% | 21.6 | 0.1 | 100% | 2.8 |
| 9 Grand Wizard | 6 | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 10 | 7.6 / 12.2 / 16.5 | 22% | 5% | 9% | 6% | 12.6 | 0.3 | 100% | 1.6 |
| 9 Grand Wizard | 12 | classic | 6–10 | 98% / 0% / 2% | 6 / 7 / 8 | 6.2 / 8.7 / 14.2 | 7% | 0% | 40% | 0% | 78.0 | 0.3 | 47% | 6.8 |
| 9 Grand Wizard | 12 | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 10 | 7.6 / 12.0 / 16.3 | 20% | 5% | 10% | 6% | 21.0 | 0.3 | 100% | 2.7 |
| 9 Grand Wizard | Boss | classic | 6–10 | 98% / 0% / 2% | 6 / 7 / 8 | 7.9 / 9.6 / 11.9 | 0% | 0% | 37% | 0% | 40.1 | 0.8 | 0% | 8.0 |
| 9 Grand Wizard | Boss | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 10 | 7.5 / 12.0 / 16.4 | 20% | 6% | 11% | 6% | 40.0 | 1.1 | 0% | 8.0 |

**Hardcore** (typist 6.5 cps, 250 ms reaction)

| Apprenticeship | Level | System | Window | In / above / below | Length p10/p50/p90 | Fall p10/p50/p90 (s) | SS | LS | SF | LF | Peak demand (cps) | Relief/min | Win | Misses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 Slow | 1 | classic | 3–6 | 100% / 0% / 0% | 3 / 4 / 4 | 8.8 / 11.9 / 16.6 | 26% | 0% | 22% | 0% | 1.0 | 2.0 | 100% | 0.0 |
| 1 Slow | 1 | director | 3–6 | 98% / 1% / 1% | 3 / 4 / 6 | 8.7 / 13.2 / 16.3 | 32% | 5% | 11% | 3% | 1.1 | 2.2 | 100% | 0.0 |
| 1 Slow | 6 | classic | 3–6 | 100% / 0% / 0% | 3 / 4 / 5 | 8.6 / 11.6 / 15.9 | 21% | 0% | 23% | 0% | 1.1 | 3.8 | 100% | 0.0 |
| 1 Slow | 6 | director | 3–6 | 98% / 1% / 1% | 3 / 4 / 6 | 8.6 / 13.2 / 16.2 | 32% | 5% | 12% | 3% | 1.2 | 3.2 | 100% | 0.0 |
| 1 Slow | 12 | classic | 3–6 | 100% / 0% / 0% | 3 / 4 / 5 | 7.4 / 10.5 / 17.5 | 16% | 0% | 28% | 0% | 1.4 | 2.3 | 100% | 0.0 |
| 1 Slow | 12 | director | 3–6 | 98% / 1% / 1% | 3 / 4 / 6 | 8.4 / 13.1 / 16.2 | 31% | 6% | 11% | 3% | 1.3 | 2.4 | 100% | 0.0 |
| 1 Slow | Boss | classic | 3–6 | 100% / 0% / 0% | 3 / 4 / 5 | 9.3 / 11.3 / 14.0 | 10% | 0% | 16% | 0% | 1.2 | 2.2 | 100% | 0.0 |
| 1 Slow | Boss | director | 3–6 | 98% / 1% / 1% | 3 / 4 / 6 | 8.3 / 12.7 / 16.1 | 29% | 6% | 13% | 4% | 1.3 | 2.2 | 100% | 0.0 |
| 5 Shock | 1 | classic | 5–8 | 97% / 0% / 3% | 5 / 6 / 6 | 7.5 / 10.4 / 14.3 | 12% | 0% | 41% | 0% | 2.1 | 2.0 | 100% | 0.0 |
| 5 Shock | 1 | director | 5–8 | 92% / 2% / 6% | 5 / 6 / 8 | 7.6 / 12.1 / 15.6 | 30% | 7% | 12% | 5% | 2.3 | 1.9 | 100% | 0.0 |
| 5 Shock | 6 | classic | 5–8 | 98% / 0% / 2% | 5 / 6 / 7 | 7.2 / 9.8 / 13.4 | 8% | 0% | 44% | 0% | 3.1 | 0.9 | 100% | 0.0 |
| 5 Shock | 6 | director | 5–8 | 92% / 3% / 6% | 5 / 6 / 8 | 7.6 / 11.9 / 15.5 | 29% | 7% | 12% | 6% | 2.8 | 1.6 | 100% | 0.0 |
| 5 Shock | 12 | classic | 5–8 | 99% / 0% / 1% | 5 / 6 / 7 | 6.3 / 8.9 / 14.7 | 8% | 0% | 37% | 0% | 9.5 | 0.0 | 100% | 0.0 |
| 5 Shock | 12 | director | 5–8 | 91% / 3% / 6% | 5 / 6 / 8 | 7.6 / 11.7 / 15.4 | 26% | 8% | 11% | 7% | 4.7 | 0.8 | 100% | 0.0 |
| 5 Shock | Boss | classic | 5–8 | 99% / 0% / 1% | 5 / 6 / 7 | 7.8 / 9.4 / 11.7 | 0% | 0% | 38% | 0% | 7.5 | 0.3 | 100% | 0.3 |
| 5 Shock | Boss | director | 5–8 | 91% / 4% / 5% | 5 / 7 / 8 | 7.5 / 11.5 / 15.3 | 24% | 8% | 12% | 9% | 9.8 | 0.0 | 100% | 1.3 |
| 8 Harvest | 1 | classic | 6–9 | 97% / 0% / 3% | 6 / 7 / 7 | 6.4 / 8.8 / 12.0 | 3% | 0% | 66% | 0% | 3.5 | 0.2 | 100% | 0.0 |
| 8 Harvest | 1 | director | 6–9 | 88% / 4% / 8% | 6 / 7 / 9 | 7.0 / 10.9 / 14.7 | 19% | 5% | 17% | 9% | 3.9 | 0.5 | 100% | 0.0 |
| 8 Harvest | 6 | classic | 6–9 | 98% / 0% / 2% | 6 / 7 / 8 | 6.1 / 8.2 / 11.2 | 1% | 0% | 66% | 0% | 17.2 | 0.0 | 100% | 2.1 |
| 8 Harvest | 6 | director | 6–9 | 87% / 4% / 8% | 6 / 8 / 9 | 6.8 / 10.6 / 14.7 | 18% | 5% | 17% | 12% | 7.7 | 0.2 | 100% | 0.6 |
| 8 Harvest | 12 | classic | 6–9 | 99% / 0% / 1% | 6 / 7 / 8 | 5.3 / 7.5 / 12.3 | 3% | 0% | 46% | 0% | 45.4 | 0.2 | 59% | 4.8 |
| 8 Harvest | 12 | director | 6–9 | 85% / 7% / 8% | 6 / 8 / 9 | 6.8 / 10.5 / 14.6 | 16% | 6% | 16% | 14% | 11.1 | 0.1 | 100% | 0.8 |
| 8 Harvest | Boss | classic | 6–10 | 99% / 0% / 1% | 6 / 7 / 8 | 6.7 / 8.1 / 10.0 | 0% | 0% | 55% | 0% | 26.2 | 0.6 | 0% | 7.0 |
| 8 Harvest | Boss | director | 6–10 | 88% / 5% / 8% | 6 / 8 / 9 | 6.8 / 10.5 / 14.7 | 15% | 2% | 16% | 4% | 30.9 | 0.8 | 0% | 7.0 |
| 9 Grand Wizard | 1 | classic | 6–10 | 97% / 0% / 3% | 7 / 8 / 8 | 6.0 / 8.3 / 11.2 | 0% | 0% | 16% | 0% | 9.9 | 0.0 | 100% | 0.8 |
| 9 Grand Wizard | 1 | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 10 | 6.8 / 10.7 / 14.7 | 15% | 4% | 14% | 7% | 6.8 | 0.2 | 100% | 0.3 |
| 9 Grand Wizard | 6 | classic | 6–10 | 98% / 0% / 2% | 7 / 8 / 9 | 5.8 / 7.8 / 10.6 | 0% | 0% | 19% | 0% | 40.0 | 0.9 | 88% | 5.3 |
| 9 Grand Wizard | 6 | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 10 | 6.8 / 10.6 / 14.5 | 15% | 4% | 15% | 8% | 16.2 | 0.5 | 100% | 2.0 |
| 9 Grand Wizard | 12 | classic | 6–10 | 99% / 0% / 1% | 7 / 8 / 9 | 5.2 / 7.3 / 11.6 | 1% | 0% | 23% | 0% | 80.3 | 1.0 | 3% | 7.0 |
| 9 Grand Wizard | 12 | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 10 | 6.7 / 10.4 / 14.5 | 14% | 4% | 15% | 10% | 19.7 | 0.4 | 97% | 2.2 |
| 9 Grand Wizard | Boss | classic | 6–10 | 99% / 0% / 1% | 7 / 8 / 9 | 6.5 / 7.8 / 9.6 | 0% | 0% | 28% | 0% | 60.0 | 1.4 | 0% | 7.0 |
| 9 Grand Wizard | Boss | director | 6–10 | 88% / 4% / 8% | 6 / 8 / 10 | 6.7 / 10.3 / 14.6 | 14% | 4% | 15% | 9% | 35.6 | 0.9 | 0% | 7.0 |


**D-098 anchors (deterministic sampling, 20,000 plans across each level, experimental tolerances in the tests):**

| | 3–6 | 7+ | 7+ in the first quarter | 6+ | ≤ 4 | ≤ 5 (relief) |
|---|---|---|---|---|---|---|
| Slow L1 Normal / Hardcore | 98.5 % / 98.4 % | 0.5 % / 0.7 % | 0.3 % / 0.6 % | | | |
| Slow boss Normal | 98.1 % | 0.9 % | | | | |
| Harvest L1 Normal / Hardcore | | | | 92.6 % / 92.4 % | 1.7 % / 1.9 % | 7.4 % / 7.6 % |
| Harvest boss Normal | | | | 92.5 % | 1.7 % | 7.5 % |

Test tolerances (labelled experimental):
- **Slow L1:** ≥ 95 % within 3–6, ≤ 2 % 7+ (≤ 1 % in the first quarter), p10 ≥ 3, p90 ≤ 6, and outliers present on both sides.
- **Harvest:** ≥ 85 % 6+, ≤ 3 % ≤ 4 letters, 1–15 % ≤ 5 letters, median ≥ 7, < 8 % 11+.
- **Intermediate apprenticeships:** monotonic window, median and p10, no jumps of more than one letter.

A mutation check confirmed the tests fail if Slow's window widens to 3–7 or Harvest's relief share triples.

**Reading it.**
- **Slow:** classic and director now share the recognizable 3–6 feel. The director uses the whole window (classic barely leaves 3–4), has ≈ 1 % 7+ words, and adds speed variety, with rare 5–6-letter fast words as its "long/fast". Levels run ~20–25 % longer than classic, down from ~35 % before D-098.
- **Middle (Shock):** the director's 5–8 window holds ~92 %; classic still lives around 4–6.
- **Harvest:** ~85–89 % inside 6–9 (or 6–10 at the boss), a median of 7–8, and rare shorter relief (≈ 8 % below 6, under 2 % ≤ 4). Classic sits at 5–7.
- **Grand Wizard:** the director's 6–10 window. Classic is uniformly long and fast and turns into a wall; the director stays harder than Slow on every axis but keeps relief. For the 60-WPM measuring typist, director levels there are gentler than classic. Director bosses at Harvest are *harder* than classic (31 % vs 84 % clears, Normal). The late-game balance is the main tuning question.
- **Pressure:** demand still rises convexly toward each level's end, with dips after surges.

## 4. Experimental tuning parameters (`DIRECTOR_TUNING`)
| Parameter | Current value | Effect |
|---|---|---|
| `floor` | Normal 0 → 0.5, Hardcore 0.15 → 0.65 | Baseline pressure across apprenticeships |
| `span` | 0.5 / 0.45 | Headroom from a level's start to its climax |
| `levelLift` | 0.12 | Level 12 starts higher than level 1 |
| `levelK`, `bossK` | 2.6, 2.0 | Steepness of the exponential-feeling rise |
| `bossCeilingBonus` | 0.1 | Extra peak for bosses |
| `swell` / `recovery` | +0.12 at surges; −45 % dip 0.13 after; mid-level breather | Climaxes and relief |
| `openingMix` / `peakMix` | see file (long/fast 2 % → 20 %; short/slow 36 % → 10 %) | Joint length × speed distribution |
| `reliefReserve`, `reliefEvery` | 10 %, every 8 spawns | Guaranteed breathing room |
| `spikeGap` | 6 → 2 spawns | Spacing of long/fast spikes |
| `lengths.start / harvest / end` | 3–6 → 6–9 → 6–10 | D-098 dominant windows (Slow, Harvest, Grand Wizard) |
| `lengths.levelDrift`, `edge`, `bandSpread` | 0.5 step, 1.5 letters, 0.35 | In-apprenticeship drift, softness of window edges, overlap of short/medium/long parts |
| `lengths.above` | 0.3 %→2 % (Slow), 3 %→6 % (Harvest+), by pressure | Rare longer outliers |
| `lengths.below` | 1 % (Slow) → 7 % (Harvest+) | Shorter relief words |
| `lengths.tailDecay` | 0.3 per extra letter | How quickly outliers thin out |
| `speeds` | slow 19–16 s → 18–14.5 s; medium 15–12 → 13.5–10.5; fast 11–8.5 → 9.5–7 | Time-to-Ward bands, first → last apprenticeship |
| `hardcoreSpeedScale` | 0.9 | Hardcore bands |
| `lengthTilt`, `speedTilt` | 1, 1 | In-window tilt toward longer / faster with pressure |
| `density` | spawn interval ×1.08 → ×0.92 | Supporting density lever |
| `letterRateMatch` | 0.6 | 1 = classic letters/min (longer gaps), 0 = classic words/min (more typing) |
| `endless` | 60 s waves; floor saturates over ~3 laps; overdrive ≤ +18 % | Bounded Endless |

## 5. Design conflicts and open questions (for the owner)
1. **D-024 (word sequence depends only on the seed).** With the director, length depends on encounter progress, which depends on captures, so two players with the same seed can see different words. Replays stay exact. Classic levels and duels keep D-024; the director is single-player only. Classic's speed ramp already worked this way for speeds.
2. **Level length.** Quotas are preserved as instructed, so first-apprenticeship levels run ~20–25 % longer. Options: keep; scale quotas by letters; or lower `letterRateMatch`.
3. **Late-game intensity.** For the measuring typist, the director's last apprenticeship is gentler than classic's wall (see §3). Raise `floor`, `peakMix` long/fast or the density lever if needed.
4. **Field-aware fairness was deliberately not added.** "Never spawn an unwinnable situation" is approximated by sequence rules (spike spacing, guaranteed relief, never-fast openers), not by reading the field, because reading the field would amount to hidden assistance. A field-aware guard is a separate proposal.
5. **Spike telegraphing** (spec: "telegraphed and survivable") is not visual yet. Plans are tagged (`directorSnapshot.lastPlan`), so a cue can be added if the owner wants one. No presentation was changed.
6. **Decision number collision:** the owner's refinement is recorded as D-098, but D-098 already exists (the Rune display, 2026-11-21). Both entries now sit in `decisions.md`; consider renumbering the refinement (e.g. D-101).
7. **What "long" means.** After D-098 the grid's long/short are relative to each apprenticeship's window. At Slow, a "long/fast" word is a fast 5–6-letter word; genuine 7+ fast words are below 0.3 %. Confirm that is the intended reading of "all four combinations remain possible".
8. **Hardcore slow band in the last apprenticeship** is 16–13 s, so on the absolute 13.5 s scale relief there is mostly short/medium-speed. Decide whether relief should mean "slow" or "slower than the current band".

Untouched: spell effects, scoring, Arcane Rush, the catch loop (plunges multiply the planned speed exactly as before), Ice Focus, Wind/Harvest, audio, art, Runes, unlocks and progress saves. Director best scores use `…:director` keys.

## 6. How to play the comparison
Preview build of this branch (once it is deployed, see below): **Options → "Experimental Difficulty Director"**, or add `?director=1` to the URL (`?director=0` turns it off). The Sandbox has Classic / Director buttons; with the director, pace *n* stands for apprenticeship 1, 3, 5, 7 or 9. In-game subtitles show "· Director". Console: `typelEngine.directorSnapshot` shows live pressure, band ranges and the last plan.

## 7. Recommended playtest (≈ 45 min, Normal first, then repeat 2–3 in Hardcore)
For each step play Classic, then Director, same apprenticeship/level (use the level picker). Note answers 1–5.
1. **Early — Apprenticeship 1 (Slow), levels 1, 6, 12 and boss.** Does it feel like the familiar 3–6 letter start? Did a 7+ word ever surprise you (it should be very rare)? Did you notice slow/fast variety? Did levels feel too long?
2. **Middle — Apprenticeship 5, levels 1, 9 (surges) and boss.** Can you feel a build toward the end of the level, a peak during surges and a breather after? Short-fast vs long-slow: do they ask for different decisions?
3. **Harvest (8), levels 1 and 12 and boss:** are 6+ letters the norm, with an occasional short breather? Then **Late — Apprenticeship 9, levels 1, 12 and boss.** Is it still the same game as apprenticeship 1, only richer? Is there enough relief? Is it hard enough?
4. **Endless after one boss (≈ 3 min).** Does it keep escalating in waves without becoming impossible?
5. **Sandbox, Director pace 1 vs 5, with spells:** Slow, Ice (Focus), Alter, Wind at full Ward, Harvest, and a deliberate wrong submission (catch the plunge). Do all of them behave as before?

For each: rate 1–5 for *fairness*, *excitement*, *readability* and *sense of progression*, and note any moment that felt unwinnable.

## 8. Verification
- `bun test` locally: 470 / 470 pass (432 existing + 38 new). CI `npm run check` (typecheck, vitest, Vite build) passed on GitHub Actions for this branch.
- Not verified in a browser here (the session could not download the CI build). Pages deploys only from `main` + `dev/apprenticeship-prototype-20261119` and also redeploys production, so this branch is **not** on `/TypeL/preview/` until the owner merges it into the dev preview branch and runs the deploy.
