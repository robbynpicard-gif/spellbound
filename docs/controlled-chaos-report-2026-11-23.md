# Controlled chaos: D-115 and D-116 implementation report (2026-11-23)

Document status: **CURRENT (dated report)** · Decisions: D-115, D-116, D-118 ·
Branch: `dev/canonical-playable-20261123`. It contains PR #17 (D-113/D-114),
the docs of PR #19 (D-115/D-116) and PR #18 (renumbered D-117).

Every number here is **Experimental**. The simulated typists are synthetic and
diagnostic; they are not a substitute for human playtesting (D-116).

## 1. Audit: what the preview did versus D-115 and D-116

| Area | Before (dev at `191d3a0` + PR #17) | D-115 / D-116 | Now |
|---|---|---|---|
| Order | Slow, Fire, Ice, Barrier, Shock, Alter, Wind, Harvest | Slow, Barrier, Wind, Fire, Ice, Shock, Alter, Harvest | Canonical order; saved progress is migrated by spell |
| SLOW | 60% for 8 s, stacking; spawns continue | Slows descent; spawning continues | Unchanged (already matched) |
| BARRIER | 2 layers until the next checkpoint; also saved Combo/Rush from a corrected slip | Ward breaches only; short-lived; no unlimited stacking | 2 layers for 7 s; recasting refreshes; no slip protection |
| WIND | Healed the Ward, cleansed mistake speed, or wagered All-In (×2, scars) | Physical repulsion only; no healing, no All-In, no scoring | A gust pushes scrolls up, hardest near the Ward |
| FIRE | Paid base × (1 + 0.25 per generation) | Zero points | Same reach; pays nothing, no progress |
| ICE | Freeze movement and spawns; Focus | Same | Unchanged (already matched) |
| SHOCK | Always the 3 lowest scrolls, then probabilistic leaps, capped at 10 | One guaranteed strike, guaranteed local conduction, diminishing distant jumps, no fixed cap | Implemented as specified |
| ALTER | Every word with more than 3 letters, plus 8 s of easy future spawns | Existing difficult words only; no effect on future spawns | Words of 5+ letters only; no spawn window |
| HARVEST | base × Combo × Rush × All-In | base × Combo × Rush; consumes Rush | Same, without All-In |
| Extra multipliers | Elemental reactions multiplied Fire and Shock | No extra jackpots | Off in TypeL |
| Academy unlocks | All unlocked for testing; Hardcore a global toggle | Normal clear → next stage + that stage's Hardcore | Implemented, with a playtest "unlock everything" option |
| Replay | Only the stage's own spells | Same difficulty, later spells usable and obtainable | Whole earned repertoire can drop; starting bank drawn from it |
| Hardcore | Random seed each attempt | Fixed, reproducible, no adaptation | Fixed seed per stage; controller off |
| Difficulty | Deterministic curve, no skill response (D-097/D-113) | Bounded skill-responsive pressure inside Academy Normal, the Opening Trial and Endless | `PressureController` inside the Director |

**Removed from active play:**
- All-In wagers, Ward scars and the All-In multiplier;
- Wind healing and Wind's cleansing of mistake speed;
- Barrier's Combo insurance and the "COMBO SAVED" feedback;
- Fire's points;
- Shock's three guaranteed strikes and its 10-word cap;
- Alter's easy-spawn window;
- TypeL's elemental-reaction multiplier;
- the Runes and Codex text that depended on these.

**Kept but unreachable from the preview:** the legacy campaign (`src/app`, `src/scenes`, `src/modes`; it is still `main`'s game) and `WardScar.ts`, which old saves and the legacy tests still use.

## 2. The D-116 controller

`src/difficulty/PressureController.ts` (values in `PRESSURE_CONTROL`; D-118
lists them).

- **Inputs, sampled every 0.5 s:**
  - the rolling effective typing rate;
  - rolling accuracy;
  - the letter rate the field needs (nearest first);
  - urgent scrolls;
  - Ward breaches;
  - recent powerful spells.
- **Output:** a damped, dead-banded offset L, clamped to authored bounds. L shortens or lengthens spawn gaps, raises or lowers how many scrolls may share the field, and biases the Director's word and speed mix.
- **By mode:**
  - On in both directions in the Opening Trial and Academy Normal.
  - Upward only in Endless.
  - Off in Hardcore and the Sandbox.
- **Empty field:** the next scroll comes within 0.65 s, so a clear earns a short rest, not a long wait.
- **Determinism:** it reads only simulation state at fixed ticks, so replays and checkpoint saves still reproduce a run exactly (tested).

## 3. Simulations

Command: `bun tools/controlled-chaos-report.ts out.json` (3 seeds per row; Academy typists cast by typing spell names).
- **"Idle":** time with no scroll on the field.
- **"Longest empty":** the longest such stretch.
- **"Trend reversals":** direction changes of the offset's 5-second trend, a measure of oscillation.
- **Arrows:** controller off → on, for the same typist and seeds.

| Scenario | WPM | Accuracy | Cleared % (off → on) | Idle % (off → on) | Longest empty (s) | Scrolls on field, mean (off → on) | Urgent p95 | Offset L mean [min, max] | Trend reversals / min | Casts / min (off → on) |
|---|---|---|---|---|---|---|---|---|---|---|
| opening | 35 | clean | 0 → 0 | 0.0 → 0.0 | 0.0 → 0.0 | 6.0 → 5.5 | 3 | -0.26 [-0.50, 0.28] | 1.05 | 0.0 → 0.0 |
| opening | 45 | clean | 0 → 67 | 5.5 → 0.0 | 1.5 → 0.0 | 4.8 → 5.4 | 3 | -0.18 [-0.50, 0.73] | 1.48 | 0.0 → 0.0 |
| opening | 60 | clean | 100 → 100 | 13.5 → 3.3 | 2.0 → 1.0 | 4.4 → 5.0 | 3 | -0.04 [-0.50, 0.95] | 1.17 | 0.0 → 0.0 |
| opening | 90 | clean | 100 → 100 | 30.9 → 13.8 | 3.0 → 2.0 | 1.6 → 4.1 | 4 | 0.17 [-0.50, 1.00] | 1.31 | 0.0 → 0.0 |
| opening | 120 | clean | 100 → 100 | 44.7 → 15.6 | 7.5 → 1.0 | 0.8 → 4.9 | 2 | 0.36 [-0.40, 1.00] | 1.53 | 0.0 → 0.0 |
| opening | 160 | clean | 100 → 100 | 58.5 → 24.7 | 5.0 → 2.0 | 0.5 → 4.5 | 2 | 0.58 [0.00, 1.00] | 0.91 | 0.0 → 0.0 |
| academy T1 | 35 | clean | 0 → 100 | 0.5 → 2.0 | 1.0 → 1.0 | 7.0 → 4.5 | 2 | -0.19 [-0.60, 0.57] | 1.37 | 2.8 → 1.6 |
| academy T1 | 45 | clean | 100 → 100 | 10.9 → 2.8 | 2.0 → 1.0 | 1.7 → 5.0 | 1 | -0.00 [-0.60, 0.83] | 1.24 | 0.0 → 1.4 |
| academy T1 | 60 | clean | 100 → 100 | 30.7 → 7.5 | 2.0 → 1.0 | 0.8 → 5.7 | 2 | 0.15 [-0.60, 1.07] | 1.22 | 0.0 → 1.6 |
| academy T1 | 60 | sloppy | 100 | 9.9 | 1.0 | 3.2 | 1 | -0.06 [-0.60, 0.94] | 1.28 | 0.5 |
| academy T1 | 90 | clean | 100 → 100 | 50.9 → 7.5 | 3.0 → 2.0 | 0.5 → 6.3 | 2 | 0.50 [-0.60, 1.10] | 1.39 | 0.0 → 0.2 |
| academy T1 | 120 | clean | 100 → 100 | 61.1 → 7.7 | 6.0 → 2.0 | 0.4 → 7.4 | 1 | 0.74 [-0.35, 1.10] | 1.28 | 0.0 → 0.1 |
| academy T1 | 120 | sloppy | 100 | 11.4 | 1.5 | 4.7 | 1 | 0.48 [-0.60, 1.10] | 1.47 | 0.1 |
| academy T1 | 160 | clean | 100 → 100 | 70.9 → 11.5 | 8.0 → 2.0 | 0.3 → 4.2 | 0 | 0.97 [0.00, 1.10] | 0.17 | 0.0 → 0.0 |
| academy T3 | 35 | clean | 0 → 100 | 0.0 → 0.3 | 0.0 → 1.0 | 8.9 → 4.1 | 2 | -0.33 [-0.60, 0.33] | 1.34 | 4.5 → 0.7 |
| academy T3 | 45 | clean | 33 → 100 | 0.0 → 1.9 | 0.5 → 1.0 | 7.5 → 4.6 | 2 | -0.19 [-0.60, 0.47] | 1.38 | 2.9 → 1.0 |
| academy T3 | 60 | clean | 100 → 100 | 12.7 → 4.5 | 2.5 → 1.0 | 1.7 → 5.3 | 2 | -0.00 [-0.60, 0.90] | 1.31 | 0.0 → 1.5 |
| academy T3 | 60 | sloppy | 100 | 6.7 | 1.0 | 3.6 | 1 | -0.20 [-0.60, 0.61] | 1.57 | 0.7 |
| academy T3 | 90 | clean | 100 → 100 | 38.1 → 6.7 | 3.0 → 2.0 | 0.7 → 6.2 | 2 | 0.33 [-0.60, 1.06] | 1.34 | 0.0 → 0.6 |
| academy T3 | 120 | clean | 100 → 100 | 51.6 → 6.0 | 3.0 → 1.5 | 0.5 → 7.5 | 2 | 0.59 [-0.32, 1.18] | 1.20 | 0.0 → 0.1 |
| academy T3 | 120 | sloppy | 100 | 10.2 | 2.0 | 5.0 | 1 | 0.33 [-0.60, 1.15] | 1.54 | 0.1 |
| academy T3 | 160 | clean | 100 → 100 | 63.8 → 7.1 | 5.5 → 2.5 | 0.4 → 10.1 | 1 | 0.86 [0.00, 1.18] | 0.64 | 0.0 → 0.0 |
| academy T5 | 35 | clean | 0 → 0 | 0.0 → 0.0 | 0.0 → 0.0 | 8.5 → 4.1 | 2 | -0.53 [-0.60, 0.00] | 1.09 | 5.0 → 0.7 |
| academy T5 | 45 | clean | 0 → 100 | 0.0 → 0.3 | 0.5 → 1.0 | 8.3 → 4.0 | 2 | -0.41 [-0.60, 0.19] | 1.54 | 3.6 → 0.5 |
| academy T5 | 60 | clean | 100 → 100 | 0.0 → 1.7 | 0.0 → 1.0 | 7.3 → 4.5 | 2 | -0.21 [-0.60, 0.34] | 1.58 | 2.5 → 0.9 |
| academy T5 | 60 | sloppy | 100 | 2.7 | 1.0 | 3.1 | 1 | -0.40 [-0.60, 0.38] | 1.84 | 0.4 |
| academy T5 | 90 | clean | 100 → 100 | 15.3 → 2.6 | 2.0 → 1.0 | 1.6 → 5.6 | 1 | 0.11 [-0.60, 0.78] | 1.60 | 0.0 → 1.1 |
| academy T5 | 120 | clean | 100 → 100 | 34.5 → 3.6 | 3.0 → 1.5 | 0.8 → 6.5 | 2 | 0.32 [-0.60, 0.98] | 1.56 | 0.0 → 0.4 |
| academy T5 | 120 | sloppy | 100 | 7.3 | 1.5 | 4.2 | 1 | 0.10 [-0.60, 0.85] | 1.74 | 0.6 |
| academy T5 | 160 | clean | 100 → 100 | 52.1 → 6.1 | 4.0 → 2.0 | 0.5 → 7.6 | 2 | 0.63 [-0.31, 1.20] | 1.57 | 0.0 → 0.3 |
| academy T8 | 35 | clean | 0 → 0 | 0.0 → 0.2 | 0.0 → 0.5 | 8.2 → 4.6 | 2 | -0.55 [-0.60, 0.00] | 0.54 | 7.5 → 3.1 |
| academy T8 | 45 | clean | 0 → 0 | 0.7 → 0.4 | 1.5 → 1.0 | 7.6 → 4.3 | 2 | -0.53 [-0.60, 0.00] | 0.94 | 6.8 → 1.9 |
| academy T8 | 60 | clean | 0 → 100 | 0.5 → 0.3 | 1.5 → 1.0 | 7.6 → 4.1 | 2 | -0.48 [-0.60, 0.14] | 1.49 | 5.9 → 1.6 |
| academy T8 | 60 | sloppy | 0 | 0.1 | 0.5 | 4.5 | 2 | -0.57 [-0.60, 0.00] | 0.96 | 1.8 |
| academy T8 | 90 | clean | 100 → 100 | 1.1 → 1.7 | 2.5 → 1.0 | 6.1 → 4.4 | 2 | -0.18 [-0.60, 0.51] | 1.99 | 2.9 → 1.8 |
| academy T8 | 120 | clean | 100 → 100 | 7.1 → 3.1 | 1.5 → 2.5 | 2.8 → 5.0 | 2 | 0.08 [-0.60, 0.72] | 2.08 | 0.8 → 2.3 |
| academy T8 | 120 | sloppy | 100 | 3.9 | 1.0 | 3.7 | 2 | -0.21 [-0.60, 0.54] | 1.79 | 0.7 |
| academy T8 | 160 | clean | 100 → 100 | 27.9 → 3.8 | 2.0 → 2.5 | 1.0 → 6.1 | 2 | 0.38 [-0.40, 1.03] | 1.85 | 0.1 → 1.3 |
| academy T9 | 35 | clean | 0 → 0 | 0.0 → 0.0 | 0.0 → 0.0 | 8.1 → 5.4 | 3 | -0.51 [-0.60, 0.00] | 0.97 | 8.6 → 6.3 |
| academy T9 | 45 | clean | 0 → 0 | 0.4 → 0.2 | 1.0 → 0.5 | 7.9 → 5.0 | 3 | -0.56 [-0.60, 0.00] | 0.33 | 7.3 → 2.9 |
| academy T9 | 60 | clean | 0 → 100 | 0.5 → 0.2 | 2.0 → 1.5 | 7.7 → 4.5 | 2 | -0.55 [-0.60, 0.00] | 1.34 | 6.7 → 2.3 |
| academy T9 | 60 | sloppy | 0 | 0.0 | 0.0 | 4.9 | 2 | -0.57 [-0.60, 0.00] | 0.09 | 2.6 |
| academy T9 | 90 | clean | 100 → 100 | 0.4 → 0.9 | 2.5 → 1.5 | 7.0 → 4.5 | 2 | -0.30 [-0.60, 0.33] | 1.79 | 3.8 → 1.5 |
| academy T9 | 120 | clean | 100 → 100 | 0.9 → 2.1 | 1.0 → 2.0 | 5.2 → 5.0 | 2 | -0.07 [-0.60, 0.47] | 1.77 | 1.5 → 1.5 |
| academy T9 | 120 | sloppy | 100 | 2.8 | 1.0 | 3.8 | 1 | -0.29 [-0.60, 0.36] | 2.18 | 0.9 |
| academy T9 | 160 | clean | 100 → 100 | 17.4 → 4.4 | 2.0 → 2.0 | 1.6 → 5.9 | 2 | 0.21 [-0.60, 0.83] | 1.79 | 0.5 → 1.1 |
| endless T5 | 90 | clean | 6 min → 7 min | 0.4 → 0.0 | 1.0 → 0.0 | 8.8 → 8.9 | 4 | 0.00 [0.00, 0.14] | 0.20 | 4.2 → 4.4 |
| endless T5 | 160 | clean | 19 min → 17 min | 7.7 → 1.9 | 3.0 → 1.5 | 5.4 → 7.9 | 4 | 0.12 [0.00, 0.71] | 1.99 | 2.4 → 2.7 |
| endless T5 | 200 | clean | 29 min → 26 min | 14.5 → 3.1 | 4.5 → 6.0 | 4.7 → 8.1 | 5 | 0.19 [0.00, 1.02] | 2.42 | 2.0 → 2.5 |

| Hardcore (fixed) | WPM | Repertoire | Cleared % | Idle % | Scrolls mean | Casts / min |
|---|---|---|---|---|---|---|
| T3 | 90 | stage | 100 | 17.8 | 1.7 | 0.1 |
| T3 | 90 | full | 100 | 17.9 | 1.5 | 0.2 |
| T3 | 120 | stage | 100 | 35.2 | 0.8 | 0.0 |
| T3 | 120 | full | 100 | 35.2 | 0.8 | 0.0 |
| T3 | 160 | stage | 100 | 52.0 | 0.5 | 0.0 |
| T3 | 160 | full | 100 | 52.0 | 0.5 | 0.0 |
| T5 | 90 | stage | 100 | 0.1 | 6.7 | 1.6 |
| T5 | 90 | full | 100 | 0.6 | 6.1 | 1.7 |
| T5 | 120 | stage | 100 | 10.9 | 2.2 | 0.2 |
| T5 | 120 | full | 100 | 11.6 | 1.9 | 0.5 |
| T5 | 160 | stage | 100 | 34.6 | 0.8 | 0.0 |
| T5 | 160 | full | 100 | 34.6 | 0.8 | 0.0 |
| T8 | 90 | stage | 0 | 0.5 | 7.0 | 4.7 |
| T8 | 90 | full | 0 | 0.5 | 7.0 | 4.7 |
| T8 | 120 | stage | 100 | 0.6 | 6.2 | 3.6 |
| T8 | 120 | full | 100 | 0.6 | 6.2 | 3.6 |
| T8 | 160 | stage | 100 | 7.1 | 2.8 | 1.1 |
| T8 | 160 | full | 100 | 7.1 | 2.8 | 1.1 |

### Reading it

- **No more waiting:**
  - For capable typists, idle time in Academy Normal falls from 30–71% to 2–12%.
  - The longest empty stretch drops to 2.5 s or less.
  - Scrolls on the field rise from below 1 to 4–10.
- **Beginners:**
  - The controller eases. 35–45 WPM typists now clear apprenticeships 1–5, and the field still holds 4–5 scrolls.
  - The later examinations (T8, T9) still stop 35–45 WPM typists (Q-26).
- **Strong typing still pays:** faster typists clear sooner, score more and cast less (tested).
- **Stable:**
  - About 1–2 trend reversals a minute, which matches the Director's own peaks and recoveries.
  - The offset never stays pinned at either bound for long, except at 160 WPM in apprenticeship 1, which is that stage's ceiling.
- **Endless:** still overwhelms everyone. Strong typists last somewhat less long (200 WPM: 29 → 26 min) and face fuller fields. That is still long for experts (Q-23).
- **Hardcore:**
  - Fixed and reproducible, but sparse for 120+ WPM typists in apprenticeships 3–5.
  - The simulated caster shows almost no gain from the full repertoire (Q-27).
  - Human play is needed here.

## 4. Not done

- An Arcane Trials prototype (Q-28).
- Graduation.
- Per-scroll spatial behaviours (D-109 stays with Arcane Trials).
- Human playtesting.
