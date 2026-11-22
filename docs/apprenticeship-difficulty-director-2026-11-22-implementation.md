# TypeL Difficulty Director: prototype implementation and audit
_2026-11-22 · implements D-097 as a **reversible dev prototype** (decision D-100) · branch `dev/apprenticeship-prototype-20261119` · all numbers EXPERIMENTAL_

Companion to the specification `docs/apprenticeship-difficulty-director-2026-11-21.md` and the simulation report `docs/difficulty-director-simulation-2026-11-22.md`.

## Phase 0: audit of the classic system (what Typel did before)
- **Entrypoints.** TypeL's apprenticeship (`src/typel/app.ts`) builds every level from `trialLevel(mode, trial, level)` in `src/typel/apprenticeship.ts`:
  - trial 1–9 maps onto old stages 1→5;
  - levels 1–12 map onto old levels 1–19, and the boss is old level 20;
  - each level is a blend of two `Stages.ts` configs.

  `trialEndless` and `sandboxConfig` reuse `endlessConfig`. The old campaign (`src/app`) and Wizard Duels read `Stages.ts` directly.
- **Word length** is a staircase: one fixed bracket per stage (Normal 2–4, 3–5, 3–6, 4–7, 4–8; Hardcore 3–5 … 5–9), weighted around one "signature" length. Complexity is capped per stage. Apprenticeship 1 can never show a word longer than 4 letters.
- **Fall speed** is one number per level, unrelated to word length. It's a linear 15 → 10 s drop over the whole journey (Hardcore 13 → 8 s). Each word gets ±25% uniform variance, and the average climbs linearly from ×0.85 to ×1.45 through each level.
- **Spawn frequency** comes from a linear WPM target ÷ average length, with a linear in-level ramp. Surges sit at fixed points from about level 4 of a trial, with a 4 s breather after each. Bosses ramp linearly on their timer.
- **Endless** compounds without bound: speed ×1.055 every 25 words, plus 60 s waves.
- **Determinism:** words, speeds, layout and drops each use their own seeded stream.
- **Verdict:** pressure inside a level is linear; length and speed are independent and step up by stage. This doesn't satisfy D-097.

## What was built
- **`src/difficulty/DifficultyDirector.ts`:** a pure, deterministic module with no player-skill input.
  - **Floor:** `floor(position)` with smoothstep across the whole journey. The position covers all 117 apprenticeship levels, so the floor also creeps up level by level.
  - **Encounter pressure:** `pressure = floor + (ceiling − floor) · rise(p; k) · (1 − relief(p))`, where `rise(p;k) = (e^{kp} − 1)/(e^k − 1)`. Two Gaussian relief windows sit near 42% and 74%. Bosses use a wider span and a steeper k. Endless repeats the arc in laps of 30 captures, and each lap's peak and speed saturate (`1 − 0.72^lap`), never unbounded.
  - **Joint sampling:** each spawn draws a cell from a 3×3 length-band × speed-band matrix that blends from a calm mix to a peak mix as pressure rises. Then a length inside the band (from the real word library) and a jittered fall time inside the speed band.
  - **Bounded and fair:**
    - hard speed cap (5.0 s Normal / 4.3 s Hardcore to fall the field);
    - short+slow never below 12%;
    - long+fast words on the field at once capped (1 when calm, 2 at peak);
    - every word gets at least 1.5 × a reference typist's time for its length.
  - **Secondary levers:** spawn interval and room on the field follow the same pressure. Surges sit on the arc's swells, and the engine's post-surge breather still applies.
  - **RNG:** exactly three draws per spawn from its own stream.
- **Engine seam (`GameEngine`):** a config with `director` set uses the director for each word's length and speed and for the base pace. Surges, recovery, spells, Slow, Ice, plunges, error acceleration, scoring, Rush and Runes are untouched. The director uses a fourth seeded stream, so classic replays are byte-identical. `WordGenerator.nextOfLength()` keeps the no-repeat and first-letter fairness rules.
- **Configs:** `trialLevel`, `trialEndless` and `sandboxConfig` take an optional system argument. The default is classic, so existing callers and tests are unchanged. Director configs keep each level's quota, boss timer, Ward rules, spells and opening words.
- **Dev flag:** "Difficulty (dev): Director · D-097 prototype | Classic stages" on the Apprenticeship and Sandbox screens, stored in Typel prefs. **It defaults to Director on the dev preview.** Records are kept separately per system (`…:director`). The Codex ("How the pressure builds") and the Endless text describe whichever system is active.
- **Untouched:** the old campaign, Wizard Duels, `Stages.ts`, production.

## Simulation summary (full tables in the report)
The bot typist plays levels 1, 4, 8, 12 and the boss of apprenticeships 1, 5 and 9, on 6 seeds, in both modes.

| | Classic | Director |
|---|---|---|
| Apprenticeship 1: words ≥ 7 letters | 0% | 22% |
| Apprenticeship 1: long+fast | 0% | 6% |
| Apprenticeship 9 (Normal): words ≤ 4 letters | 2% | 43% |
| Apprenticeship 9 (Hardcore): short+slow | 0% | 12% |
| Median fall time, apprenticeship 1 → 9 (Normal) | 13.1 → 9.8 s | 12.2 → 9.5 s |
| In-level demand curve (apprenticeship 1, by fifths) | 1.00 1.13 1.26 1.36 1.51 (straight) | 1.00 1.05 1.15 1.26 1.39 (convex, relief dip near 74%) |
| Tight words (time-to-Ward < 2× typing time) | 0% | 0% |

- **Statistically harder:** apprenticeship 9 has more fast (short-fast 15%, long-fast 13%) and longer words than apprenticeship 1. It never becomes uniformly long and fast; classic apprenticeship 9 Hardcore is 96% long words.
- **Fewer calm stretches:** the director's top-demand words spread through a level instead of piling up at its end, so calm windows are fewer (27% vs 51% at apprenticeship 9). The relief windows and the post-surge breather are the counterweight. **This is a tuning question for the playtest.**
- **The bot never casts spells.** It's a pressure probe, not a human, and the results don't claim fairness for players.

## Experimental tuning parameters (all in `DIRECTOR_TUNING`)
| Parameter | Prototype value | What it does |
|---|---|---|
| `floor` | Normal 0.08 → 0.42, Hardcore 0.22 → 0.58 | How hard the calm opening is across the journey |
| `span` | level 0.55, boss 0.65, endless 0.55 | How far each encounter climbs above its floor |
| `riseK` | level 3.0, boss 3.4, endless 2.6 | Convexity: calmer start, sharper climax |
| `relief` | 42% (depth 0.55), 74% (depth 0.6) | Breathers inside every encounter |
| `endlessLapGrowth`, `endlessSpeedLift` | 0.72, +15% | How Endless laps climb and saturate |
| `lengths` | short 2–4, medium 5–6, long 7–9 (Hardcore 7–10), +1 after position 0.55 | Length bands |
| `fallSeconds` | Normal 16 / 12 / 8.6 s; Hardcore 14 / 10.5 / 7.4 s | Speed bands at the journey start |
| `journeySpeedup`, `bandSpeedup` | ×1.30 (Hardcore ×1.32), slow takes 35% of it | How much faster each band gets by the end |
| `pressureSpeedup`, `arcBandSpeedup` | +30% at the peak, slow takes 50% of it | Speed lift inside the arc |
| `jitter` | ±8% | Variation inside a speed band |
| `minFallSeconds` | 5.0 s / 4.3 s | Hard speed cap |
| `joint.calm`, `joint.peak` | see the report | Length × speed mix at calm and at peak |
| `shortSlowMin` | 12% | Relief never disappears |
| `maxLongFast` | 1 → 2 on the field | Limits stacked spikes |
| `refCps`, `fairnessMargin`, `reactionSeconds` | Normal 3.0 → 4.6, Hardcore 3.8 → 5.6 chars/s; ×1.5; 0.9 s | Fairness floor per word |
| `wpm`, `arrival` | Normal 30 → 58, Hardcore 40 → 72; swing ×0.88 → ×1.25, relief ×0.82 | Secondary arrival pace |
| `complexity` | Normal 0.5 → none, Hardcore 1 → none | Rare letters and clusters over the journey |
| Surges | none (levels 1–3), one (4–8), two (9–12), three (boss) | Climaxes on the arc |

## Recommended playtest (about 25 minutes, Director on; flip to Classic to compare)
1. **Early: apprenticeship 1, levels 1 and 6 (Normal).**
   - Do long words (7–9 letters) feel welcome rather than unfair this early?
   - Is a rare fast long word a thrill or a cheap shot?
   - Does each level open calmly and build?
2. **Middle: apprenticeship 5, levels 4 and 10, and the boss.**
   - Can you feel the breathers (around 40% and 75% of the level) and the climax near the end?
   - Do short divers (short and fast) and long drifters (long and slow) ask for different play?
   - Do spells still feel like the right answers?
3. **Late: apprenticeship 9, levels 8 and 12, the boss, then Endless for two minutes.**
   - Is it clearly harder than apprenticeship 5, yet never a wall of long fast words?
   - Do short-slow breathers still appear?
   - Does Endless build in waves rather than speed up forever?
4. **Hardcore: apprenticeship 9, level 12.** Same questions, plus whether the speed cap feels right.
5. **Compare:** replay one level from steps 1 and 3 on Classic.

**Owner decisions requested after playing:**
- the intensity of the ramp and the frequency of breathers;
- whether late apprenticeships should raise the floor mostly through more fast words, faster minimums, or a mix;
- what counts as an acceptable long+fast threat in lesson 1;
- whether bosses and Endless should get their own shapes.
