# TypeL — Continuous apprenticeship, living difficulty and persistent scoring (D-102)
_2026-11-22 · implemented on `dev/continuous-apprenticeship-20261122`, merged into the development preview · production untouched · **every number is an experimental prototype value**_

Handoff: "Continuous Apprenticeship, Living Difficulty & Persistent Scoring" (owner-approved direction). Builds on D-097 and D-101 (word-length windows, formerly the duplicate D-098).

## 1. Audit (before)
- **Run structure.** `TypeLApp` played each of the 12 levels and the boss as a **separate `GameEngine`**. Between levels it showed a result screen and carried over score (as an offset), Combo, spell charges, the field and, in Hardcore, the Ward. **Arcane Rush, the Rune "clean" state and all random streams reset every level.** Normal's Ward was fresh every level.
- **Boss.** The boss timer counted from engine start, and an intro panel paused play before it.
- **Endless.** `continueIntoEndless` reset the capture count to 0 (fine for one level per engine, wrong for one engine per run).
- **Difficulty.** Per-level director arcs restarted at every level. Surges came from fixed progress points per level, and recovery dips were deep (0.45) and long (~5 s). The boss's last recovery ended at the very end of the fight. Endless pressure levelled off and its speed boost was capped at +18 %, so it had a permanent ceiling.
- **Records** were keyed `mode:trial` (classic) and `mode:trial:director`. There was no mid-run save.

## 2. What changed
| Area | Now |
|---|---|
| **Run** (`GameEngine` `RunPlan`, `apprenticeshipRun`) | One engine plays the whole apprenticeship. The 12 old levels are **internal checkpoints** (segments with their own quota and supporting levers). The engine moves to the next one on the same tick, with no screen, button or reset. **Learn** = checkpoints 1–4 (`RUN_TUNING.learnShare` 0.3), **Master** = 5–12, then the **Boss Examination** (existing timer, ramp and victory rule). Only the last segment or the Ward falling ends the game. |
| **Scoring** | Score, Combo, Arcane Rush (its timer and rules untouched), spell charges, active spell effects, the mana pool and the field all persist through every checkpoint and into the boss and Endless. Nothing is granted or ended at a boundary. A test fails if any checkpoint resets Combo. |
| **Established rules mapped to checkpoints** | Normal's Ward (and scars) is restored at each checkpoint, as it was every level. Hardcore's Ward carries, with its +25 recoveries at checkpoints 4 and 8. Barrier layers last until the end of the checkpoint ("until the end of the level"). The Flawless Rune is judged per checkpoint, and Flawless Perfection = every checkpoint and the boss Flawless. |
| **Phase presentation** | A small fading title near the top of the field ("Master · Phase II…", the boss's name), a little confetti and an existing chime; the boss uses the existing boss music and sting plus the boss lines on the Master's note. The stage banner shows "FLAME · LEARN", "FLAME · <BOSS>" or "FLAME · ENDLESS". The progress line shows "Learn 45 %", "Survive 42 s" or the scroll count. Per-level hints now appear on the note at their checkpoint. Gameplay never pauses. |
| **Director** (`DifficultyDirector.ts`) | **Baseline:** floor(a) plus a convex rise over the whole run (`run.k` 1.6). The boss continues from there and climbs; its **last recovery ends by 80 %**, then pressure rises smoothly to its **maximum at the final second** (tested for all 9 × 2). **Events:** a seeded schedule of **short pressure events** (every 8–15 s start to start, 3–7 s long; Learn skips ~30 % and softens them) and **major surges** (every 25–40 s, 5–8 s long). Each surge is followed by a **recovery of 2.5–3.5 s at depth 0.22** (about half as deep and 40 % shorter than before) that keeps spawning, slightly sparser, with a kinder mix. Events raise pressure, speed up spawning and allow more words on the field. **Timing:** every gap between spawns is jittered ×0.7–1.3. The joint length × speed mix and the D-101 windows are unchanged. Hardcore: events ×1.15, recoveries ×0.75, speed bands ×0.9 and a higher floor. |
| **Endless** | An **Endless level L** starts at the boss's peak and rises **forever** (Normal +0.10/min, Hardcore +0.15/min). It drives bounded levers: the mix (saturates), the spawn interval (×e^(−0.35·ΔL), floor 260/220 ms), extra words on the field (+2 per ΔL, cap +6, field cap 16), a fall-speed overdrive (bounded at ×2.3/×2.5; no word ever reaches the Ward in under 3 s), fewer guaranteed reliefs, more frequent events and shallower recoveries. No fall-speed exponential. |
| **Save and resume** (`runSave.ts`) | At every checkpoint the seed and the exact command log are saved. Resuming replays the log, so the run restores **exactly** (field, score, Combo, Rush, charges, Ward, Director and random streams). Play after the last checkpoint is not kept, so there is no duplication or farming. Endless is not saved. After a loss: "Retry from checkpoint", "Restart" or "Leave". |
| **Records** | New ruleset keys `mode:trial:run-1`. The old `mode:trial` and `mode:trial:director` records stay untouched in the save. |
| **One difficulty system** | The Classic/Director toggles, the flag (`directorFlag.ts`), "Director" labels and the obsolete text are removed. Normal and Hardcore remain. The classic level functions remain only as the source of each checkpoint's supporting levers and for regression tests. The Sandbox plays the Endless of apprenticeship 1/3/5/7/9. |

Determinism: the engine is fixed-step, so the director never depends on frame rate. Pauses stop the simulation (no timer drift). The same seed and commands reproduce the run, as the resume tests check.

## 3. Simulations
`npx tsx tools/director-report.ts 3` uses the real engine. The typists are realistic: 45–200 WPM, reading 480→220 ms, target switching 320→150 ms, typos 5 %→1.5 % (noticed, erased and retyped), no spells, always aiming at the lowest word. They are measuring sticks; real players also cast spells.

**Normal: share of runs that cleared the boss** (3 seeds; where failed runs ended: L = Learn, M = Master, B = Boss)

| Apprenticeship | 45 WPM | 60 WPM | 90 WPM | 120 WPM | 160 WPM | 200 WPM |
|---|---|---|---|---|---|---|
| 1 Time (Slow) | 100% | 100% | 100% | 100% | 100% | 100% |
| 2 Flame | 100% | 100% | 100% | 100% | 100% | 100% |
| 3 Frost | 0% (BBM) | 100% | 100% | 100% | 100% | 100% |
| 4 Wards | 0% (MBM) | 100% | 100% | 100% | 100% | 100% |
| 5 Storms | 0% (LLM) | 33% (BB) | 100% | 100% | 100% | 100% |
| 6 Ink | 0% (LLM) | 0% (BBM) | 100% | 100% | 100% | 100% |
| 7 Winds | 0% (LLL) | 0% (MMM) | 100% | 100% | 100% | 100% |
| 8 Harvest | 0% (LLL) | 0% (MMM) | 100% | 100% | 100% | 100% |
| 9 Final Examination | 0% (LLL) | 0% (LLL) | 100% | 100% | 100% | 100% |

**Hardcore: share of runs that cleared the boss** (3 seeds; where failed runs ended: L = Learn, M = Master, B = Boss)

| Apprenticeship | 45 WPM | 60 WPM | 90 WPM | 120 WPM | 160 WPM | 200 WPM |
|---|---|---|---|---|---|---|
| 1 Time (Slow) | 0% (LLL) | 67% (B) | 100% | 100% | 100% | 100% |
| 2 Flame | 0% (LLL) | 33% (MB) | 100% | 100% | 100% | 100% |
| 3 Frost | 0% (LLL) | 0% (MMM) | 100% | 100% | 100% | 100% |
| 4 Wards | 0% (LLL) | 0% (MMM) | 100% | 100% | 100% | 100% |
| 5 Storms | 0% (LLL) | 0% (LLL) | 100% | 100% | 100% | 100% |
| 6 Ink | 0% (LLL) | 0% (LLL) | 33% (BB) | 100% | 100% | 100% |
| 7 Winds | 0% (LLL) | 0% (LLL) | 0% (MMM) | 100% | 100% | 100% |
| 8 Harvest | 0% (LLL) | 0% (LLL) | 0% (MMM) | 100% | 100% | 100% |
| 9 Final Examination | 0% (LLL) | 0% (LLL) | 0% (LLL) | 100% | 100% | 100% |

**Endless survival (minutes; every run ended in a loss)**

| Mode | Apprenticeship | 45 WPM | 60 WPM | 90 WPM | 120 WPM | 160 WPM | 200 WPM |
|---|---|---|---|---|---|---|---|
| normal | 1 Time (Slow) | 0.8 | 2.2 | 9.8 | 16.6 | 24.0 | 30.4 |
| normal | 5 Storms | 0.6 | 1.0 | 3.8 | 8.6 | 16.1 | 23.4 |
| normal | 8 Harvest | 0.4 | 0.4 | 1.2 | 4.4 | 12.0 | 18.8 |
| normal | 9 Final Examination | 0.4 | 0.5 | 0.8 | 4.5 | 10.6 | 18.0 |
| hardcore | 1 Time (Slow) | 0.4 | 0.6 | 2.2 | 6.1 | 11.3 | 15.8 |
| hardcore | 5 Storms | 0.3 | 0.5 | 0.9 | 3.2 | 7.4 | 11.4 |
| hardcore | 8 Harvest | 0.4 | 0.4 | 0.5 | 1.4 | 4.5 | 8.8 |
| hardcore | 9 Final Examination | 0.2 | 0.3 | 0.4 | 0.8 | 4.1 | 8.1 |

Endless failure causes: typing demand 47, reaction and switching 1.
Apprenticeship failure causes: typing demand 96, reaction and switching 1.

**Endless bottleneck (what the bounded levers allow over time)**

| Mode · apprenticeship | 0 min | 10 min | 20 min | 30 min | 45 min | 60 min | 90 min |
|---|---|---|---|---|---|---|---|
| normal · 1 | 0.72 w/s · 3 l/s | 1.02 w/s · 5 l/s | 1.37 w/s · 6 l/s | 2.21 w/s · 10 l/s | 2.74 w/s · 13 l/s | 2.87 w/s · 14 l/s | 2.98 w/s · 14 l/s |
| normal · 9 | 0.75 w/s · 6 l/s | 1.07 w/s · 9 l/s | 1.44 w/s · 12 l/s | 2.32 w/s · 19 l/s | 3.13 w/s · 25 l/s | 3.27 w/s · 27 l/s | 3.40 w/s · 28 l/s |
| hardcore · 1 | 0.93 w/s · 4 l/s | 1.57 w/s · 7 l/s | 2.99 w/s · 14 l/s | 3.29 w/s · 16 l/s | 3.51 w/s · 17 l/s | 3.59 w/s · 17 l/s | 3.64 w/s · 17 l/s |
| hardcore · 9 | 0.83 w/s · 7 l/s | 1.55 w/s · 13 l/s | 3.35 w/s · 27 l/s | 3.69 w/s · 30 l/s | 3.39 w/s · 28 l/s | 3.46 w/s · 28 l/s | 3.49 w/s · 28 l/s |

**Reading it.**
- **Skill:** clear rates rise steadily with skill. At Normal, 45 WPM clears apprenticeships 1–2, 60 WPM clears 1–4, 90 WPM and up clears everything. Hardcore needs roughly 30 WPM more for the same reach.
- **Failure causes:** almost all failures are typing demand. Overlapping word labels averaged 0.00 pairs; the spawn lane logic keeps the field readable, so nothing failed from clutter.
- **Endless:** every typist falls, and later the faster they are. At 200 WPM: ~30 min in Slow and ~18 min in the Final Examination (Normal); ~16 and ~8 min in Hardcore.
- **Cadence (measured):** short events every ~12 s, surges every ~32 s, recovery ~3 s.

**Endless bottleneck (honest limit).** From about 30–45 minutes, the spawn floor and the 16-word field cap with the bounded overdrive become the limit. Arrival then levels off at ~2.9–3.6 words/s (Slow ≈ 14–17 letters/s; Final Examination ≈ 27–30 letters/s), while L keeps rising with nothing left to drive. For a realistic 200-WPM typist that plateau is above sustainable capacity (≈ 2.3 words/s of Slow words with switching), so the run still ends. A hypothetical typist faster than ~250 WPM with near-instant switching could hold Slow's plateau. Going further would need another bounded lever, for example a larger field cap, a lower spawn floor or a longer-word drift within Slow's identity. This is flagged for the owner, not hidden.

## 4. Tuning (all in `DIRECTOR_TUNING` and `RUN_TUNING`; experimental)
| Group | Values |
|---|---|
| Phases | `learnShare` 0.3 (4 of 12 checkpoints); boss durations unchanged (60–100 s) |
| Floor / run baseline | floor Normal 0→0.36, Hardcore 0.15→0.55; run span 0.4, k 1.6 |
| Boss | rise 0.22, k 1.8; swells at 22/47/68 % (7 % long, 5 % recovery); climax from 85 % (+0.36); short events stop at 80 % |
| Short events | gap 8–15 s, 3–7 s, intensity 0.5–1, +0.13 pressure, spawn −18 %, +1 word; Learn skips 30 %, Learn intensity ×0.8 |
| Major surges | gap 25–40 s, 5–8 s, intensity 0.75–1, +0.3 pressure, spawn −34 %, +3 words; first at 18 s |
| Recovery | 2.5–3.5 s, −0.22 pressure, spawn +12 %, −1 word |
| Hardcore | events ×1.15, recoveries ×0.75, speed ×0.9 |
| Density / timing | spawn × 1.12→0.9 by pressure; gap jitter ×0.7–1.3; letter-rate match 0.6 |
| Endless | growth 0.10 / 0.15 per min; spawn k 0.35, floor 260 / 220 ms; +2 words per ΔL (cap +6); overdrive ×2.3 / ×2.5 (tau 2.5); relief reserve ≥ 4 %, relief every ≤ 14; longer-word outliers +1.5 %/ΔL (≤ 6 %); minimum fall 3 s |
| Unchanged from D-101 | length windows, joint mix tables, relief reserve 10 % / every 8, spike gap 6→2, speed bands |

## 5. Known issues and owner decisions
1. **Endless plateau** above ~45 min (see §3): it is unsustainable for realistic typists, but not infinite in principle. Which lever, if any, should grow next?
2. **Run length.** A full apprenticeship is now ~8–10 min plus the boss. Shorten with `learnShare`, the checkpoint quotas or fewer checkpoints.
3. **Normal's Ward is restored at every checkpoint.** This keeps the old "fresh every level" rule, but the player can't see checkpoints. Consider tying it to visible phase changes, or to a gentler partial heal.
4. **Barrier layers end at each checkpoint**, as before, but that boundary is now invisible. Consider "until the end of the phase".
5. **The mana pool now follows Combo across checkpoints** (it was re-based each level). This is consistent with persistent momentum, but it is an economy change worth watching.
6. **Spell texts** still say "level" (Barrier, Wind's Normal scars). In practice that now means a checkpoint; the wording needs an owner pass.
7. **The simulated typists never cast spells**, so the clear rates understate real players.
8. **Not verified by playing in a browser in this session.** The preview's build and deploy succeeded; please play-test.
9. The repository is still `robbynpicard-gif/spellbound` on GitHub (the rename hasn't happened), so the preview is at `/spellbound/preview/`.

## 6. Recommended playtest (~45 min)
1. **Slow, Normal, from Learn (~10 min):** does it feel like one continuous examination? Is the Learn → Master change noticeable but not disruptive? Do pressure moments come often enough, and are recoveries short but welcome? Can you keep a Combo and Rush through a surge?
2. **Frost or Storms, Normal, from Master:** overlapping threats, spell use under surges (Ice Focus in a surge, Shock into a crowd). Do checkpoints ever feel like interruptions?
3. **Any boss (Boss only):** does it build to a climax in the last ~15 %? Does the transition from Master into the boss in a full run feel fair, with no empty field and no pause?
4. **Leave mid-run, then Resume:** you should be back at the last checkpoint with the same score and field. Lose on purpose, then "Retry from checkpoint".
5. **Endless after a boss, ~5 min:** does it feel increasingly unsustainable without becoming unreadable?
6. **Hardcore Slow from Learn:** higher pressure earlier, carried Ward, typed spells.
