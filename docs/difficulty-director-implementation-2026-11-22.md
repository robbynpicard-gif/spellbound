# TypeL — Difficulty Director prototype: audit, implementation, simulation and playtest plan
_2026-11-22 · D-097 implementation (Phases 0–4) · branch `dev/difficulty-director-20261122` · **every number is EXPERIMENTAL**; production `main` untouched_

Spec: `docs/apprenticeship-difficulty-director-2026-11-21.md`. Decision: D-097 (direction).

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
1. It is exactly the superseded staircase: apprenticeship 1 never spawns a word longer than 4 letters; apprenticeship 9 is 43–90 % long-and-fast with ~0 % short-and-slow (simulation below).
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
| `tests/difficulty-director.test.ts` | 23 acceptance tests. |

**How it works.**
- **Layer 1 — floor:** `floor(a) = F0 + (F1 − F0)·smoothstep(a)`, `a = (apprenticeship − 1)/8`. An encounter's base adds `levelLift × arcPosition` (level 1 → boss of one apprenticeship).
- **Layer 2 — arc:** `pressure = base + (ceiling − base)·shape(p)`, `shape = (e^(kp) − 1)/(e^k − 1)` plus a swell at each surge and a recovery dip after it (a breather dip at mid-level when a level has no surges). `p` = quota share, or boss-timer share. Endless: the same 60 s wave as the engine's Endless wave, on a floor that saturates; speed overdrive capped at +18 %.
- **Layer 3 — joint mix:** a 3 × 3 grid of length band (short 2–4, medium 5–6, long 7–8, rising to 7–10 by the last apprenticeship) × speed band (slow / medium / fast time-to-Ward, which tighten with `a`; Hardcore ×0.9). Cell weights interpolate from an opening mix to a peak mix with pressure. Inside a band, pressure tilts toward longer and faster. Short/slow keeps ≥ 10 % at any pressure, and one is guaranteed at least every 8 spawns. Long/fast spikes are spaced (≥ 6 spawns apart early, ≥ 2 late; otherwise one lever drops). Opening words (which start partway down) are never fast.
- **Layer 4 — supporting levers:** quotas, timers, surges, respites, density caps, spell drops and boss ramps are the classic ones, unchanged. The spawn interval is multiplied by `(expected length ÷ classic average length)^0.6 × density(pressure)`, so letters arrive at a comparable rate.
- **Determinism:** its own seeded stream (`seed ^ 0xd1ec7041`), exactly four draws per spawn. Same seed + same commands = same words, speeds and timings (tested via `GameEngine.replay`).
- **No adaptation:** it reads only seed, spec and encounter progress (and Endless time), never WPM, accuracy, Ward, score or field contents (tested).

## 3. Simulation: classic vs director
Real `GameEngine`, 32 seeds per cell, apprenticeships 1/5/9 × levels 1/6/12/boss. The typist is a **measuring stick, not a human prediction**: never mistypes, never casts, aims at the lowest word. Reproduce: `npx tsx tools/director-report.ts 32`.
Quadrants use the same absolute thresholds for both systems: short ≤ 4 letters, long ≥ 7; slow ≥ 13.5 s to the Ward, fast ≤ 10 s. *Peak demand* = 95th-percentile typing rate needed to clear the field nearest-first. *Relief/min* = ≥ 2 s spans at or below half the run's own 80th-percentile demand, right after reaching it.

**Normal** (typist 5 cps, 300 ms reaction)

| Appr. | Level | System | Mean len | Fall p10/p50/p90 (s) | Short-slow | Long-slow | Short-fast | Long-fast | Peak demand (cps) | Relief/min | Win | Misses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | classic | 3.07 | 10.2 / 13.6 / 18.6 | 51% | 0% | 9% | 0% | 0.5 | 1.8 | 100% | 0.0 |
| 1 | 1 | director | 4.67 | 9.9 / 16.1 / 18.3 | 41% | 10% | 5% | 2% | 0.8 | 2.1 | 100% | 0.0 |
| 1 | 6 | classic | 3.14 | 9.9 / 13.3 / 18.2 | 47% | 0% | 10% | 0% | 0.5 | 2.5 | 100% | 0.0 |
| 1 | 6 | director | 4.74 | 9.9 / 16.1 / 18.2 | 40% | 11% | 5% | 2% | 0.9 | 3.0 | 100% | 0.0 |
| 1 | 12 | classic | 3.48 | 8.9 / 12.6 / 20.2 | 41% | 0% | 20% | 0% | 0.7 | 2.1 | 100% | 0.0 |
| 1 | 12 | director | 4.80 | 9.6 / 15.0 / 18.1 | 37% | 11% | 5% | 3% | 1.0 | 2.6 | 100% | 0.0 |
| 1 | Boss | classic | 3.48 | 10.9 / 13.1 / 16.3 | 45% | 0% | 1% | 0% | 0.6 | 1.4 | 100% | 0.0 |
| 1 | Boss | director | 4.85 | 9.4 / 14.7 / 18.1 | 36% | 11% | 6% | 4% | 1.0 | 2.5 | 100% | 0.0 |
| 5 | 1 | classic | 4.88 | 8.8 / 11.8 / 16.5 | 5% | 0% | 5% | 0% | 1.1 | 2.0 | 100% | 0.0 |
| 5 | 1 | director | 5.12 | 8.6 / 14.0 / 17.3 | 30% | 10% | 7% | 6% | 1.4 | 2.8 | 100% | 0.0 |
| 5 | 6 | classic | 4.96 | 8.6 / 11.7 / 16.2 | 5% | 0% | 4% | 0% | 1.6 | 1.5 | 100% | 0.0 |
| 5 | 6 | director | 5.13 | 8.5 / 13.4 / 17.3 | 29% | 9% | 9% | 6% | 1.5 | 3.1 | 100% | 0.0 |
| 5 | 12 | classic | 5.12 | 7.6 / 10.7 / 17.3 | 8% | 0% | 11% | 0% | 4.0 | 0.1 | 100% | 0.0 |
| 5 | 12 | director | 5.19 | 8.5 / 13.2 / 17.2 | 28% | 9% | 10% | 6% | 2.2 | 1.5 | 100% | 0.0 |
| 5 | Boss | classic | 5.07 | 9.3 / 11.3 / 14.0 | 4% | 0% | 7% | 0% | 3.7 | 0.4 | 100% | 0.0 |
| 5 | Boss | director | 5.28 | 8.3 / 12.8 / 17.2 | 26% | 9% | 9% | 7% | 3.3 | 0.7 | 100% | 0.0 |
| 9 | 1 | classic | 6.79 | 7.5 / 10.3 / 14.1 | 1% | 9% | 2% | 37% | 3.4 | 0.1 | 100% | 0.0 |
| 9 | 1 | director | 5.47 | 7.6 / 11.9 / 16.5 | 23% | 7% | 9% | 9% | 2.3 | 1.8 | 100% | 0.0 |
| 9 | 6 | classic | 6.91 | 7.1 / 9.6 / 13.1 | 0% | 6% | 1% | 46% | 21.6 | 0.1 | 100% | 2.8 |
| 9 | 6 | director | 5.52 | 7.6 / 11.9 / 16.5 | 23% | 7% | 10% | 10% | 3.8 | 0.3 | 100% | 0.1 |
| 9 | 12 | classic | 7.07 | 6.2 / 8.7 / 14.2 | 0% | 9% | 1% | 45% | 78.0 | 0.3 | 47% | 6.8 |
| 9 | 12 | director | 5.57 | 7.6 / 11.8 / 16.4 | 22% | 7% | 9% | 10% | 6.6 | 0.0 | 100% | 0.3 |
| 9 | Boss | classic | 7.04 | 7.9 / 9.6 / 11.9 | 0% | 0% | 1% | 41% | 40.1 | 0.8 | 0% | 8.0 |
| 9 | Boss | director | 5.64 | 7.5 / 11.7 / 16.3 | 21% | 8% | 9% | 11% | 20.5 | 0.5 | 47% | 6.8 |

**Hardcore** (typist 6.5 cps, 250 ms reaction)

| Appr. | Level | System | Mean len | Fall p10/p50/p90 (s) | Short-slow | Long-slow | Short-fast | Long-fast | Peak demand (cps) | Relief/min | Win | Misses |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | classic | 3.92 | 8.8 / 11.9 / 16.6 | 26% | 0% | 22% | 0% | 1.0 | 2.0 | 100% | 0.0 |
| 1 | 1 | director | 4.82 | 8.7 / 13.5 / 16.2 | 30% | 9% | 9% | 4% | 1.4 | 2.6 | 100% | 0.0 |
| 1 | 6 | classic | 3.97 | 8.6 / 11.6 / 15.9 | 21% | 0% | 23% | 0% | 1.1 | 3.8 | 100% | 0.0 |
| 1 | 6 | director | 4.89 | 8.6 / 13.3 / 16.2 | 29% | 9% | 9% | 4% | 1.5 | 3.2 | 100% | 0.0 |
| 1 | 12 | classic | 4.07 | 7.4 / 10.5 / 17.5 | 16% | 0% | 28% | 0% | 1.4 | 2.3 | 100% | 0.0 |
| 1 | 12 | director | 4.94 | 8.4 / 13.1 / 16.1 | 28% | 9% | 8% | 5% | 1.5 | 2.4 | 100% | 0.0 |
| 1 | Boss | classic | 4.06 | 9.3 / 11.3 / 14.0 | 10% | 0% | 16% | 0% | 1.2 | 2.2 | 100% | 0.0 |
| 1 | Boss | director | 5.01 | 8.3 / 12.7 / 16.1 | 28% | 8% | 10% | 6% | 1.5 | 1.9 | 100% | 0.0 |
| 5 | 1 | classic | 5.87 | 7.5 / 10.4 / 14.3 | 0% | 1% | 2% | 5% | 2.1 | 2.0 | 100% | 0.0 |
| 5 | 1 | director | 5.22 | 7.7 / 11.9 / 15.5 | 26% | 8% | 8% | 6% | 2.0 | 2.3 | 100% | 0.0 |
| 5 | 6 | classic | 5.97 | 7.2 / 9.8 / 13.4 | 0% | 2% | 1% | 9% | 3.1 | 0.9 | 100% | 0.0 |
| 5 | 6 | director | 5.29 | 7.6 / 11.7 / 15.5 | 25% | 7% | 9% | 7% | 2.3 | 2.1 | 100% | 0.0 |
| 5 | 12 | classic | 6.09 | 6.3 / 8.9 / 14.7 | 0% | 6% | 1% | 23% | 9.5 | 0.0 | 100% | 0.0 |
| 5 | 12 | director | 5.33 | 7.5 / 11.5 / 15.4 | 24% | 8% | 9% | 7% | 3.1 | 1.2 | 100% | 0.0 |
| 5 | Boss | classic | 6.07 | 7.8 / 9.4 / 11.7 | 0% | 0% | 1% | 24% | 7.5 | 0.3 | 100% | 0.3 |
| 5 | Boss | director | 5.40 | 7.5 / 11.4 / 15.3 | 23% | 8% | 9% | 9% | 5.0 | 0.4 | 100% | 0.2 |
| 9 | 1 | classic | 7.77 | 6.0 / 8.3 / 11.2 | 0% | 1% | 0% | 74% | 9.9 | 0.0 | 100% | 0.8 |
| 9 | 1 | director | 5.61 | 6.8 / 10.6 / 14.8 | 17% | 5% | 13% | 15% | 3.4 | 0.9 | 100% | 0.0 |
| 9 | 6 | classic | 7.87 | 5.8 / 7.8 / 10.6 | 0% | 0% | 0% | 82% | 40.0 | 0.9 | 88% | 5.3 |
| 9 | 6 | director | 5.65 | 6.8 / 10.5 / 14.7 | 15% | 5% | 13% | 17% | 5.3 | 0.2 | 100% | 0.0 |
| 9 | 12 | classic | 8.09 | 5.2 / 7.3 / 11.6 | 0% | 4% | 0% | 79% | 80.3 | 1.0 | 3% | 7.0 |
| 9 | 12 | director | 5.74 | 6.7 / 10.4 / 14.7 | 15% | 4% | 13% | 17% | 7.4 | 0.1 | 100% | 0.1 |
| 9 | Boss | classic | 8.07 | 6.5 / 7.8 / 9.6 | 0% | 0% | 0% | 93% | 60.0 | 1.4 | 0% | 7.0 |
| 9 | Boss | director | 5.77 | 6.7 / 10.3 / 14.7 | 15% | 5% | 13% | 18% | 19.2 | 0.7 | 41% | 5.9 |

**Pressure curves, Normal, level 12** (required cps by tenth of the level; director pressure 0–1)

- Appr. 1 classic: demand 0.5 0.3 0.0 0.1 0.2 0.2 0.0 0.2 0.5 0.7
- Appr. 1 director: demand 0.9 0.4 0.1 0.2 0.3 0.2 0.1 0.2 0.5 0.5; pressure 0.12 0.14 0.16 0.20 0.18 0.23 0.28 0.35 0.38 0.42
- Appr. 5 classic: demand 1.0 0.8 0.6 0.6 1.1 1.4 1.2 1.5 2.7 4.0
- Appr. 5 director: demand 1.1 0.9 0.6 0.5 0.8 1.0 0.8 1.1 1.6 2.0; pressure 0.37 0.38 0.40 0.45 0.43 0.48 0.54 0.63 0.62 0.68
- Appr. 9 classic: demand 1.8 1.7 2.0 2.5 4.3 7.4 17.0 16.5 40.0 70.4
- Appr. 9 director: demand 1.5 1.4 1.3 1.3 2.1 2.8 3.0 3.6 5.6 10.7; pressure 0.62 0.63 0.64 0.68 0.67 0.70 0.75 0.82 0.81 0.87


**Reading it.**
- **First apprenticeship:** classic is short-only (0 % long). The director keeps short/slow dominant (~41 %) but adds long/slow (~11 %) and rare long/fast (~3 %). It is still comfortable for the reference typist. Levels last ~35 % longer, because quotas are unchanged and words are longer.
- **Middle:** classic narrows to 4–6 letters; the director keeps all nine cells.
- **Last:** classic is uniformly long and fast (Hardcore up to ~90 % long/fast) and becomes a wall from level 6 on. The director is harder than its own first apprenticeship on every axis (length, fall time, pressure, spike share) but keeps ~20 % short/slow (Normal). **For the 60-WPM measuring typist, director levels in the last apprenticeship are gentler than classic; the bosses are comparably hard (≈40 % clears).** Whether the late game should be harder is the main tuning question.
- **Pressure curves:** the director's demand rises convexly toward each level's end, with dips after surges. Classic rises too, but mostly because the typist falls behind.

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
| `lengths` | short 2–4, medium 5–6, long 7–8 → 7–10 | Length bands |
| `speeds` | slow 19–16 s → 18–14.5 s; medium 15–12 → 13.5–10.5; fast 11–8.5 → 9.5–7 | Time-to-Ward bands, first → last apprenticeship |
| `hardcoreSpeedScale` | 0.9 | Hardcore bands |
| `lengthTilt`, `speedTilt` | 1, 1 | In-band tilt toward longer / faster with pressure |
| `density` | spawn interval ×1.08 → ×0.92 | Supporting density lever |
| `letterRateMatch` | 0.6 | 1 = classic letters/min (longer gaps), 0 = classic words/min (more typing) |
| `endless` | 60 s waves; floor saturates over ~3 laps; overdrive ≤ +18 % | Bounded Endless |

## 5. Design conflicts and open questions (for the owner)
1. **D-024 (word sequence depends only on the seed).** With the director, length depends on encounter progress, which depends on captures, so two players with the same seed can see different words. Replays stay exact. Classic levels and duels keep D-024; the director is single-player only. Classic's speed ramp already worked this way for speeds.
2. **Level length.** Quotas are preserved as instructed, so first-apprenticeship levels run ~35 % longer. Options: keep; scale quotas by letters; or lower `letterRateMatch`.
3. **Late-game intensity.** For the measuring typist, the director's last apprenticeship is gentler than classic's wall (see §3). Raise `floor`, `peakMix` long/fast or the density lever if needed.
4. **Field-aware fairness was deliberately not added.** "Never spawn an unwinnable situation" is approximated by sequence rules (spike spacing, guaranteed relief, never-fast openers), not by reading the field, because reading the field would amount to hidden assistance. A field-aware guard is a separate proposal.
5. **Spike telegraphing** (spec: "telegraphed and survivable") is not visual yet. Plans are tagged (`directorSnapshot.lastPlan`), so a cue can be added if the owner wants one. No presentation was changed.
6. **Hardcore slow band in the last apprenticeship** is 16–13 s, so on the absolute 13.5 s scale relief there is mostly short/medium-speed. Decide whether relief should mean "slow" or "slower than the current band".

Untouched: spell effects, scoring, Arcane Rush, the catch loop (plunges multiply the planned speed exactly as before), Ice Focus, Wind/Harvest, audio, art, Runes, unlocks and progress saves. Director best scores use `…:director` keys.

## 6. How to play the comparison
Preview build of this branch (once it is deployed, see below): **Options → "Experimental Difficulty Director"**, or add `?director=1` to the URL (`?director=0` turns it off). The Sandbox has Classic / Director buttons; with the director, pace *n* stands for apprenticeship 1, 3, 5, 7 or 9. In-game subtitles show "· Director". Console: `typelEngine.directorSnapshot` shows live pressure, band ranges and the last plan.

## 7. Recommended playtest (≈ 45 min, Normal first, then repeat 2–3 in Hardcore)
For each step play Classic, then Director, same apprenticeship/level (use the level picker). Note answers 1–5.
1. **Early — Apprenticeship 1, levels 1, 6, 12 and boss.** Do long words feel like a fair challenge, or out of place? Did you notice slow/fast variety? Did levels feel too long?
2. **Middle — Apprenticeship 5, levels 1, 9 (surges) and boss.** Can you feel a build toward the end of the level, a peak during surges and a breather after? Short-fast vs long-slow: do they ask for different decisions?
3. **Late — Apprenticeship 9, levels 1, 12 and boss.** Is it still the same game as apprenticeship 1, only richer? Is there enough relief? Is it hard enough?
4. **Endless after one boss (≈ 3 min).** Does it keep escalating in waves without becoming impossible?
5. **Sandbox, Director pace 1 vs 5, with spells:** Slow, Ice (Focus), Alter, Wind at full Ward, Harvest, and a deliberate wrong submission (catch the plunge). Do all of them behave as before?

For each: rate 1–5 for *fairness*, *excitement*, *readability* and *sense of progression*, and note any moment that felt unwinnable.

## 8. Verification
- `bun test` locally: 455 / 455 pass (432 existing + 23 new). CI `npm run check` (typecheck, vitest, Vite build) passed on GitHub Actions for this branch.
- Not verified in a browser here (the session could not download the CI build). Pages deploys only from `main` + `dev/apprenticeship-prototype-20261119` and also redeploys production, so this branch is **not** on `/TypeL/preview/` until the owner merges it into the dev preview branch and runs the deploy.
