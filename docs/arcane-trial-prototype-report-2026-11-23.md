# Arcane Trial prototype: The Crosswind Trial (2026-11-23)

Document status: **CURRENT (dated report)** · Decisions: D-114, D-119
(typing mastery), D-120 (compact continuous trials) · Branch:
`dev/arcane-trial-prototype-20261123`, based on
`dev/apprenticeship-prototype-20261119` at `4bd9a3c`. Yellow scope.

Every number is **Experimental**. The simulated typists are synthetic and
diagnostic. **Nothing here is human-playtested.**

## 1. Audit: what existed for Arcane Trials

| Need | Existing system | Reused? |
|---|---|---|
| Trial content or mode | Nothing: no trial code, menu or data (`main` and the dev branch) | Built new, small (`src/typel/arcaneTrials.ts`) |
| Continuous encounter | `GameEngine` single-config play: a quota ends it, no checkpoints | Reused as is |
| Pressure arc, bursts, recoveries | `DifficultyDirector`: `run` baseline, the shared seeded `EventSchedule` | Reused. Added a `'trial'` kind: authored baseline + slow swell, scaled events |
| Fair arrivals, lanes | `SPAWN_FAIRNESS` arrival spacing, overtaking-aware lanes (D-113) | Reused unchanged |
| D-109 spawn behaviours | Only behaviour 1 (≈ the default placement) | Built 4 and 5 as one formation on its own seeded stream |
| Skill response | `PressureController` (D-116) | Kept switchable for comparison. **Off by default** (see §3) |
| Spells, scoring, bank | D-115 spells, `arcaneScore`, shared bank | Unchanged |
| Measurement | `DirectorSimulation`, `BattlefieldPressure`, report tools | Reused. Added spell-point tracking (D-119) and `tools/arcane-trial-report.ts` |

Academy, Hardcore, Endless, the Sandbox and every saved run keep their
behaviour. The formation and the `'trial'` kind are only active in a trial,
and all 499 existing tests still pass unchanged.

## 2. The Crosswind Trial

**Identity:**
- Pressure sweeps from one side of the sky to the other, in runs of 5–9 scrolls (75% of scrolls follow the current side).
- About 30% of scrolls enter 8–30% of the way down, so threats arrive at several heights at once. They are never fast, and a soft ring marks where they appear.

**Tactics it invites, none required:**
- WIND, to push back a crowded side;
- SHOCK, which conducts through a one-sided cluster;
- FIRE, for a low front;
- BARRIER, for a crossing where two sides land together.

**Structure:**
- One continuous encounter: no checkpoints, phases, intermissions or waves.
- It ends after 560 resolved scrolls. The Ward is not restored.
- Pressure rises along an authored baseline (0.35 → 0.9), with a slow swell (±0.12, about 70 s) and the shared event bursts and recoveries (×1.15 and ×1.2).
- Short and medium words (vocabulary 0.35); difficulty comes from count, timing and speed.

**Rules:**
- All eight spells can drop, and you start with one of each.
- D-115 identities and normal scoring.
- A seeded run can be replayed exactly ("Same seed").

## 3. Should Arcane Trials adapt? (explicit evaluation)

The Academy's controller (D-116) eases when a player struggles. That suits
teaching. For a survival trial, the simulations show what it costs:

- **'both' (the Academy controller):**
  - Weak typists last much longer: at 60 WPM, about 8–13 min instead of 1–5.
  - But the trial's peaks almost vanish: 0.1–0.2 per minute against 0.6–1.7 on the fixed profile, for 60–90 WPM typists.
  - Casts drop to about 1 per minute, so spells stop mattering.
  - The trial stops being a distinct test.
- **'up' (adds pressure, never eases):** keeps experts busy (160 WPM: 8.8 scrolls on the field instead of 1.1). But the extra throughput shortens their run to about 6 min, and it still creates few real peaks for them.
- **'off' (authored, fixed):** reproducible. Peaks, urgency and spell use grow as typing weakens. A seed is a fair, comparable challenge.

The prototype plays **'off'**; the menu offers the other two for comparison
only.

*Recommendation, not approved:* keep the authored profile, and serve experts
with challenge tiers rather than automatic adaptation (Q-29, Q-30).

## 4. Simulations

Command: `bun tools/arcane-trial-report.ts out.json` (6 seeds per row).
- "Peaks": entries into 4+ urgent scrolls.
- "Impact pairs": the mean number of scroll pairs predicted to land within 0.45 s of each other.
- "Score typed / spells": points from typing versus Shock and Harvest (Runes are the rest).

### Authored profile (the prototype)

| Profile | WPM | Accuracy | Spells | Survived % | Survivors' minutes | Fell at (min) | Scrolls on field mean / p95 | Urgent mean / p95 | Peaks / min | Idle % / longest (s) | Impact pairs | Casts / min | Score typed / spells % | Mean length / ≥7 % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| off | 45 | clean | yes | 0 | — | 1.4–3.5 | 8.6 / 13 | 1.0 / 4 | 2.24 | 0.7 / 2.0 | 1.03 | 6.7 | 61 / 21 | 4.7 / 5 |
| off | 45 | clean | no | 0 | — | 0.5–0.8 | 7.6 / 13 | 1.4 / 6 | 1.92 | 1.4 / 0.5 | 1.38 | 0.0 | 89 / 0 | 4.6 / 4 |
| off | 45 | sloppy | yes | 0 | — | 0.9–2.2 | 8.3 / 13 | 1.0 / 4 | 2.08 | 0.5 / 0.5 | 1.02 | 7.1 | 68 / 6 | 4.6 / 4 |
| off | 60 | clean | yes | 0 | — | 2.3–5.3 | 8.0 / 12 | 0.9 / 4 | 1.65 | 0.6 / 2.0 | 1.00 | 5.5 | 71 / 17 | 4.7 / 5 |
| off | 60 | clean | no | 0 | — | 0.8–1.4 | 7.9 / 12 | 1.4 / 4 | 2.46 | 0.8 / 0.5 | 1.19 | 0.0 | 88 / 0 | 4.6 / 4 |
| off | 60 | sloppy | yes | 0 | — | 1.6–4.2 | 8.3 / 12 | 1.0 / 4 | 2.41 | 0.3 / 0.5 | 1.13 | 5.2 | 74 / 4 | 4.6 / 5 |
| off | 75 | clean | yes | 17 | 10.5–10.5 | 4.8–11.2 | 7.8 / 12 | 0.8 / 3 | 1.22 | 0.4 / 2.5 | 1.01 | 4.0 | 82 / 7 | 4.8 / 7 |
| off | 75 | clean | no | 0 | — | 1.7–2.8 | 8.5 / 12 | 1.4 / 4 | 1.90 | 0.6 / 0.5 | 1.27 | 0.0 | 90 / 0 | 4.6 / 4 |
| off | 75 | sloppy | yes | 0 | — | 2.8–6.6 | 8.0 / 12 | 0.9 / 4 | 1.68 | 0.4 / 2.0 | 1.04 | 4.4 | 75 / 10 | 4.7 / 5 |
| off | 90 | clean | yes | 100 | 9.2–9.7 | — | 7.5 / 11 | 0.6 / 3 | 0.59 | 0.7 / 2.0 | 1.03 | 2.4 | 85 / 5 | 4.9 / 8 |
| off | 90 | clean | no | 0 | — | 3.9–6.3 | 8.6 / 12 | 1.0 / 3 | 1.22 | 0.5 / 0.5 | 1.30 | 0.0 | 92 / 0 | 4.7 / 6 |
| off | 90 | sloppy | yes | 0 | — | 6.0–9.4 | 7.9 / 12 | 0.8 / 3 | 1.11 | 0.5 / 2.5 | 0.97 | 3.2 | 80 / 7 | 4.8 / 7 |
| off | 120 | clean | yes | 100 | 7.7–7.9 | — | 4.8 / 9 | 0.1 / 1 | 0.04 | 4.3 / 2.0 | 0.57 | 0.5 | 88 / 1 | 4.9 / 8 |
| off | 120 | clean | no | 100 | 7.6–7.9 | — | 5.4 / 9 | 0.2 / 1 | 0.11 | 2.7 / 1.5 | 0.71 | 0.0 | 92 / 0 | 4.9 / 8 |
| off | 120 | sloppy | yes | 100 | 8.7–9.0 | — | 6.8 / 11 | 0.5 / 2 | 0.49 | 1.5 / 2.5 | 0.97 | 1.6 | 84 / 3 | 4.8 / 8 |
| off | 160 | clean | yes | 100 | 7.4–7.6 | — | 1.1 / 3 | 0.0 / 0 | 0.00 | 28.2 / 2.5 | 0.03 | 0.2 | 79 / 1 | 4.8 / 8 |
| off | 160 | clean | no | 100 | 7.4–7.6 | — | 1.2 / 4 | 0.0 / 0 | 0.00 | 27.7 / 2.5 | 0.04 | 0.0 | 80 / 0 | 4.8 / 8 |
| off | 160 | sloppy | yes | 100 | 7.4–7.6 | — | 1.8 / 5 | 0.0 / 0 | 0.00 | 16.9 / 2.5 | 0.09 | 0.3 | 68 / 1 | 4.8 / 8 |

### Adaptation variants (comparison only)

| Profile | WPM | Accuracy | Spells | Survived % | Survivors' minutes | Fell at (min) | Scrolls on field mean / p95 | Urgent mean / p95 | Peaks / min | Idle % / longest (s) | Impact pairs | Casts / min | Score typed / spells % | Mean length / ≥7 % |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| both | 45 | clean | yes | 0 | — | 3.7–6.4 | 5.5 / 9 | 0.6 / 2 | 0.50 | 0.9 / 2.5 | 0.41 | 3.6 | 76 / 12 | 4.6 / 4 |
| both | 60 | clean | yes | 17 | 13.1–13.1 | 7.8–12.1 | 5.1 / 8 | 0.4 / 2 | 0.11 | 0.3 / 1.0 | 0.42 | 1.5 | 91 / 2 | 4.8 / 7 |
| both | 75 | clean | yes | 100 | 10.9–11.4 | — | 5.2 / 9 | 0.3 / 2 | 0.16 | 0.9 / 1.5 | 0.48 | 1.3 | 90 / 3 | 4.8 / 8 |
| both | 90 | clean | yes | 100 | 9.5–9.6 | — | 5.5 / 10 | 0.3 / 2 | 0.23 | 1.7 / 2.5 | 0.64 | 1.1 | 90 / 1 | 4.8 / 8 |
| both | 120 | clean | yes | 100 | 7.6–7.9 | — | 6.7 / 11 | 0.3 / 2 | 0.11 | 2.6 / 2.5 | 1.07 | 0.9 | 91 / 2 | 4.9 / 8 |
| both | 160 | clean | yes | 100 | 5.7–5.9 | — | 8.8 / 14 | 0.2 / 1 | 0.03 | 2.7 / 2.0 | 1.84 | 0.9 | 93 / 2 | 4.9 / 8 |
| up | 45 | clean | yes | 0 | — | 1.4–3.5 | 8.6 / 13 | 1.0 / 4 | 2.19 | 0.6 / 2.0 | 1.02 | 6.6 | 67 / 14 | 4.7 / 5 |
| up | 60 | clean | yes | 0 | — | 3.4–5.3 | 7.9 / 12 | 0.9 / 4 | 1.60 | 0.6 / 2.0 | 0.91 | 4.9 | 76 / 13 | 4.7 / 5 |
| up | 75 | clean | yes | 33 | 10.7–10.9 | 6.8–10.5 | 8.0 / 12 | 0.8 / 3 | 1.28 | 0.6 / 3.0 | 1.06 | 3.9 | 81 / 8 | 4.8 / 7 |
| up | 90 | clean | yes | 83 | 9.3–9.7 | 9.5–9.5 | 8.2 / 12 | 0.8 / 3 | 0.99 | 0.5 / 2.5 | 1.16 | 2.4 | 89 / 2 | 4.9 / 8 |
| up | 120 | clean | yes | 100 | 7.5–7.7 | — | 7.7 / 11 | 0.4 / 2 | 0.20 | 1.2 / 2.5 | 1.27 | 0.9 | 92 / 2 | 4.9 / 8 |
| up | 160 | clean | yes | 100 | 5.7–5.9 | — | 8.8 / 13 | 0.2 / 1 | 0.03 | 2.5 / 2.0 | 1.83 | 0.9 | 93 / 2 | 4.9 / 8 |

### Reading it

- **Duration:** survivors take 7.4–10.5 min, inside the ~8–12 min target. They are near its bottom for experts, because spawning sets the pace.
- **Continuous:** the longest empty stretch is ≤ 2.5 s for everyone up to 120 WPM; there are no checkpoints. Pressure fluctuates through bursts, recoveries and the swell.
- **Spells matter, typing leads:**
  - At 75–90 WPM, hands alone falls at 1.7–6.3 min, while clean typing with spells survives (100% at 90 WPM).
  - Typing still earns 61–93% of the score; spells earn 0–21%, which matches D-119.
- **Accuracy matters:** sloppy 90 WPM typists fall at 6–9 min where clean ones survive.
- **Short words:** the mean length is 4.6–4.9 letters, with 4–8% of words at 7+.
- **Fairness:** about 1 predicted near-simultaneous pair at a time on dense fields, similar to Academy late game. The fairness rule acts when each scroll appears; Slow, Wind and the player's own order can bring scrolls together later.
- **Experts:** at 160 WPM the fixed profile is too gentle (28% idle, no peaks) (Q-30).

## 5. Not done

- More trials.
- Behaviours 2, 3 and 6, and Suspended Scattered Spawning.
- Challenge tiers, relics and Hardcore trials.
- Any human playtest.

## 6. Owner decisions after review (D-121)

- **Q-29:** the fixed authored profile is the baseline; adaptation stays experimental.
- **Q-30:** 90 WPM is the initial calibration reference, not a requirement. Challenge tiers come later.
- **Q-31:** keep the 560-scroll quota.

Playtest checks are tracked as Q-32. No further expansion until the owner has played the trial.
