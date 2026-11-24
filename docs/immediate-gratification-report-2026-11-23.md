# Immediate gratification, progressive mastery: first tuning pass (2026-11-23)

Document status: **CURRENT (dated report)** · Decisions: D-123 (GAME-009),
D-124 · Branch: `dev/immediate-gratification-20261123`, based on
`dev/apprenticeship-prototype-20261119` at `a26728e`, plus PR #26.

Every number is **Experimental**. The simulated typists are synthetic and
diagnostic. **Not human-playtested.**

## 1. Audit

- **Word bank:**
  - 38 two-letter, 508 three-letter and 1,539 four-letter words.
  - No word equals, prefixes or extends a spell name (now a test).
  - Some two-letter words are unusual for players (aw, eh, uh, um, ya, pi, ox).
- **The old length model didn't deliver D-123:**
  - The Opening Trial and apprenticeship 1 were 44% four-letter words, with only 1% two-letter words. The causes were the 3–6 letter window and √count weighting that favoured the big 4–5 letter buckets.
  - From apprenticeship 6 on, almost no short words remained.
- **Generator:**
  - It avoided recent words and recent first letters, but not what was on the field.
  - When the D-116 controller raises concurrency, a fast player saw duplicate words on the field in up to 0.5% of spawns with short words (0.04% before), plus prefix pairs such as "to"/"top".
  - The fallback was already bounded and length-respecting.
- **Spawn timing** followed expected length only partly (exponent 0.6).

## 2. What changed

See D-124 for the values. In short:
- the early length window drops to 2.2–3.7 letters, and later windows are slightly shorter;
- library size matters less, so short words can dominate early;
- pressure no longer pushes early words longer;
- short rhythm words stay common late;
- spawn timing follows word length more closely;
- the Opening Trial's climax holds more scrolls;
- the field never shows two identical words, or two where one prefixes the other;
- the Crosswind Trial keeps its calibrated word lengths.

Nothing changed in scoring, Combo, Arcane Rush, spells, input, mode
adaptation or Endless.

## 3. Results

Command: `bun tools/gratification-report.ts out.json` (4 seeds per row). The
same tool and simulator were run on the unchanged dev branch for the
"before" column. Arrows read before → after.
- Opening rows: no spells.
- Academy rows: a casting typist, with Normal adaptation on (D-116).
- Crosswind rows: the fixed profile.

| Scenario | WPM | Cleared % | Mean length | ≤3 letters % | 4 letters % | ≥7 % | First Combo ×2 (s) | First Rush (s) | Captures / min | Keys / min | Scrolls on field | Urgent p95 | Idle % | Casts / min |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opening | 35 | 25 → 0 | 4.04 → 2.83 | 32 → 86 | 39 → 13 | 0 → 0 | 62.8 → 25.8 | 3.9 → 2.5 | 29 → 39 | 162 → 163 | 5.7 → 7.7 | 3 → 4 | 0.1 → 0.1 | 0.0 → 0.0 |
| opening | 45 | 75 → 100 | 4.02 → 2.87 | 33 → 85 | 39 → 14 | 1 → 1 | 52.0 → 22.2 | 3.2 → 2.1 | 36 → 48 | 197 → 196 | 5.3 → 7.4 | 3 → 4 | 0.8 → 1.2 | 0.0 → 0.0 |
| opening | 60 | 100 → 100 | 4.13 → 2.87 | 31 → 85 | 38 → 14 | 2 → 0 | 45.0 → 21.1 | 2.5 → 1.8 | 45 → 59 | 243 → 238 | 5.0 → 6.6 | 3 → 3 | 4.2 → 5.1 | 0.0 → 0.0 |
| opening | 90 | 100 → 100 | 4.07 → 2.88 | 32 → 84 | 37 → 14 | 1 → 0 | 28.7 → 8.1 | 1.9 → 1.3 | 60 → 77 | 318 → 306 | 4.7 → 6.3 | 3 → 2 | 10.8 → 12.5 | 0.0 → 0.0 |
| opening | 120 | 100 → 100 | 4.10 → 2.87 | 31 → 85 | 38 → 14 | 1 → 0 | 20.1 → 8.6 | 1.5 → 1.1 | 69 → 87 | 362 → 346 | 5.4 → 6.8 | 2 → 2 | 14.3 → 14.2 | 0.0 → 0.0 |
| academy-T1 | 35 | 100 → 100 | 4.02 → 2.70 | 32 → 91 | 42 → 9 | 1 → 0 | 97.6 → 25.8 | 3.9 → 2.5 | 29 → 41 | 162 → 163 | 4.8 → 5.9 | 2 → 2 | 2.4 → 1.7 | 1.8 → 1.3 |
| academy-T1 | 45 | 100 → 100 | 4.04 → 2.71 | 31 → 90 | 41 → 9 | 1 → 0 | 79.1 → 22.2 | 3.2 → 2.1 | 35 → 49 | 195 → 194 | 5.3 → 6.0 | 2 → 2 | 3.9 → 3.5 | 1.9 → 1.0 |
| academy-T1 | 60 | 100 → 100 | 4.03 → 2.71 | 31 → 90 | 42 → 9 | 1 → 0 | 45.1 → 21.1 | 2.5 → 1.8 | 45 → 61 | 242 → 239 | 5.6 → 6.6 | 2 → 2 | 6.3 → 4.7 | 1.2 → 0.6 |
| academy-T1 | 90 | 100 → 100 | 4.07 → 2.74 | 30 → 89 | 42 → 10 | 1 → 0 | 29.1 → 8.1 | 1.9 → 1.3 | 63 → 83 | 333 → 320 | 6.9 → 8.6 | 2 → 1 | 6.8 → 5.9 | 0.5 → 0.0 |
| academy-T1 | 120 | 100 → 100 | 4.09 → 2.74 | 29 → 88 | 41 → 11 | 1 → 0 | 20.1 → 8.6 | 1.5 → 1.1 | 78 → 99 | 407 → 379 | 7.3 → 10.5 | 1 → 1 | 5.7 → 6.3 | 0.0 → 0.0 |
| academy-T2 | 35 | 100 → 100 | 4.08 → 2.90 | 29 → 86 | 43 → 13 | 1 → 0 | 101.9 → 26.5 | 3.9 → 2.9 | 29 → 39 | 161 → 163 | 4.2 → 5.3 | 2 → 2 | 2.4 → 1.6 | 0.6 → 0.9 |
| academy-T2 | 45 | 100 → 100 | 4.08 → 2.90 | 28 → 86 | 42 → 13 | 0 → 0 | 77.7 → 23.3 | 3.2 → 2.4 | 36 → 46 | 194 → 193 | 4.6 → 5.6 | 3 → 2 | 4.3 → 4.2 | 0.6 → 0.7 |
| academy-T2 | 60 | 100 → 100 | 4.10 → 2.92 | 28 → 86 | 43 → 13 | 1 → 0 | 45.0 → 21.4 | 2.5 → 1.9 | 44 → 58 | 237 → 238 | 5.0 → 6.1 | 3 → 2 | 8.6 → 5.6 | 0.6 → 0.6 |
| academy-T2 | 90 | 100 → 100 | 4.13 → 2.94 | 27 → 85 | 42 → 14 | 1 → 0 | 29.1 → 8.1 | 1.9 → 1.5 | 63 → 79 | 336 → 320 | 6.8 → 8.0 | 2 → 1 | 5.4 → 6.5 | 0.4 → 0.1 |
| academy-T2 | 120 | 100 → 100 | 4.15 → 2.96 | 27 → 83 | 41 → 15 | 1 → 0 | 20.1 → 8.7 | 1.5 → 1.2 | 77 → 95 | 410 → 386 | 7.6 → 10.4 | 2 → 1 | 5.5 → 5.7 | 0.1 → 0.0 |
| academy-T3 | 35 | 100 → 100 | 4.30 → 3.23 | 18 → 72 | 45 → 27 | 1 → 0 | 96.8 → 97.2 | 5.2 → 2.9 | 28 → 36 | 163 → 164 | 4.3 → 5.3 | 2 → 2 | 0.7 → 0.4 | 1.0 → 0.9 |
| academy-T3 | 45 | 100 → 100 | 4.32 → 3.25 | 18 → 70 | 44 → 28 | 1 → 0 | 77.5 → 77.8 | 3.2 → 2.4 | 34 → 43 | 197 → 198 | 4.8 → 5.7 | 2 → 2 | 2.7 → 1.8 | 1.2 → 1.1 |
| academy-T3 | 60 | 100 → 100 | 4.35 → 3.25 | 18 → 69 | 43 → 29 | 1 → 0 | 43.0 → 20.8 | 2.5 → 1.9 | 43 → 54 | 245 → 243 | 5.4 → 6.2 | 2 → 2 | 5.3 → 3.8 | 1.4 → 0.6 |
| academy-T3 | 90 | 100 → 100 | 4.36 → 3.27 | 17 → 68 | 43 → 30 | 2 → 0 | 48.5 → 18.7 | 1.9 → 1.5 | 61 → 75 | 340 → 332 | 6.4 → 8.0 | 2 → 1 | 5.2 → 3.6 | 0.3 → 0.0 |
| academy-T3 | 120 | 100 → 100 | 4.38 → 3.31 | 17 → 66 | 43 → 32 | 2 → 0 | 20.2 → 8.3 | 1.5 → 1.2 | 74 → 91 | 410 → 400 | 7.3 → 9.9 | 2 → 1 | 5.9 → 4.5 | 0.0 → 0.0 |
| academy-T5 | 35 | 25 → 50 | 5.43 → 4.57 | 3 → 13 | 16 → 36 | 22 → 2 | 243.8 → 143.8 | 10.0 → 9.3 | 23 → 27 | 163 → 164 | 4.2 → 4.6 | 2 → 2 | 0.0 → 0.0 | 0.7 → 0.6 |
| academy-T5 | 45 | 100 → 100 | 5.48 → 4.58 | 2 → 13 | 15 → 36 | 23 → 3 | 114.4 → 103.4 | 3.5 → 3.2 | 29 → 34 | 201 → 201 | 3.9 → 4.5 | 2 → 2 | 0.2 → 0.3 | 0.7 → 0.9 |
| academy-T5 | 60 | 100 → 100 | 5.52 → 4.60 | 3 → 13 | 15 → 35 | 25 → 3 | 145.0 → 61.9 | 2.8 → 2.5 | 36 → 42 | 254 → 251 | 4.5 → 5.0 | 2 → 2 | 1.7 → 2.0 | 1.2 → 1.0 |
| academy-T5 | 90 | 100 → 100 | 5.57 → 4.63 | 3 → 13 | 14 → 33 | 26 → 3 | 99.6 → 24.4 | 2.0 → 1.9 | 51 → 58 | 352 → 343 | 5.6 → 5.9 | 2 → 2 | 3.5 → 5.0 | 1.1 → 0.7 |
| academy-T5 | 120 | 100 → 100 | 5.58 → 4.66 | 2 → 13 | 14 → 32 | 26 → 3 | 57.6 → 17.7 | 1.6 → 1.5 | 64 → 73 | 433 → 429 | 6.2 → 7.1 | 2 → 2 | 4.2 → 2.9 | 0.4 → 0.3 |
| academy-T8 | 35 | 0 → 0 | 7.15 → 6.19 | 0 → 5 | 2 → 9 | 63 → 43 | 170.2 → — | 31.7 → 17.8 | 16 → 19 | 160 → 161 | 4.7 → 4.9 | 3 → 2 | 0.2 → 0.0 | 2.5 → 2.1 |
| academy-T8 | 45 | 0 → 0 | 7.22 → 6.42 | 0 → 5 | 2 → 8 | 68 → 49 | 124.2 → 205.7 | 11.4 → 8.4 | 21 → 25 | 201 → 201 | 4.5 → 4.4 | 2 → 2 | 0.1 → 0.3 | 1.6 → 1.0 |
| academy-T8 | 60 | 50 → 100 | 7.38 → 6.47 | 0 → 5 | 1 → 8 | 71 → 52 | 479.9 → 462.7 | 3.8 → 3.5 | 29 → 32 | 260 → 257 | 4.0 → 4.1 | 2 → 2 | 0.5 → 0.8 | 1.2 → 1.1 |
| academy-T8 | 90 | 100 → 100 | 7.40 → 6.53 | 0 → 5 | 2 → 8 | 71 → 54 | 270.9 → 274.3 | 2.7 → 2.5 | 41 → 45 | 363 → 361 | 4.3 → 4.7 | 2 → 1 | 2.5 → 2.0 | 1.4 → 2.0 |
| academy-T8 | 120 | 100 → 100 | 7.45 → 6.58 | 1 → 4 | 1 → 9 | 73 → 55 | 54.7 → 60.7 | 2.1 → 2.0 | 52 → 56 | 452 → 445 | 5.0 → 5.2 | 2 → 2 | 3.4 → 3.4 | 1.9 → 1.9 |
| crosswind-spells | 60 | 0 → 0 | 4.70 → 4.67 | 7 → 12 | 44 → 33 | 6 → 3 | 74.7 → 80.9 | 3.2 → 3.2 | 40 → 39 | 255 → 254 | 7.9 → 8.3 | 3 → 4 | 0.3 → 0.8 | 5.1 → 5.4 |
| crosswind-hands | 60 | 0 → 0 | 4.45 → 4.39 | 12 → 16 | 50 → 42 | 4 → 2 | 63.0 → — | 3.2 → 3.2 | 40 → 40 | 246 → 245 | 8.0 → 8.5 | 4 → 5 | 0.8 → 0.9 | 0.0 → 0.0 |
| crosswind-spells | 90 | 100 → 100 | 4.82 → 4.74 | 6 → 14 | 40 → 27 | 7 → 3 | 48.6 → 60.7 | 2.4 → 2.4 | 58 → 59 | 354 → 355 | 7.5 → 7.9 | 3 → 3 | 1.0 → 0.5 | 2.2 → 2.6 |
| crosswind-hands | 90 | 0 → 0 | 4.72 → 4.63 | 7 → 13 | 44 → 33 | 7 → 2 | 44.5 → 47.2 | 2.4 → 2.4 | 59 → 60 | 352 → 351 | 8.7 → 9.0 | 3 → 4 | 0.6 → 0.5 | 0.0 → 0.0 |
| crosswind-spells | 120 | 100 → 100 | 4.82 → 4.74 | 6 → 14 | 41 → 27 | 8 → 3 | 15.1 → 42.8 | 2.2 → 2.1 | 72 → 74 | 434 → 437 | 4.4 → 6.3 | 1 → 1 | 3.1 → 2.0 | 0.7 → 0.9 |
| crosswind-hands | 120 | 100 → 100 | 4.82 → 4.73 | 5 → 14 | 41 → 27 | 8 → 3 | 15.1 → 54.7 | 2.2 → 2.1 | 73 → 75 | 438 → 441 | 5.2 → 7.6 | 1 → 2 | 2.0 → 0.7 | 0.0 → 0.0 |

### Reading it

- **Easy to type:**
  - In the Opening Trial and apprenticeships 1–2, 83–91% of words have 2–3 letters and 9–15% have 4.
  - Apprenticeship 3 is about 3.3 letters on average, apprenticeship 5 about 4.6, and Harvest about 6.5. Each step rises gradually.
- **Rewards early, through ordinary typing:**
  - Combo ×2 at 45 WPM: 79 → 22 s in apprenticeship 1 and 52 → 22 s in the Opening.
  - The first Rush comes about a second sooner.
  - Captures per minute rise 25–40% at every speed.
- **Hard to keep up:**
  - The keystroke workload is unchanged: it follows the typist, Enter included.
  - Early, the sky holds 1–3 more scrolls, with similar urgency.
  - The Opening's climax still stops 35 WPM typists on the authored curve (4 of 6 runs at 45 WPM fall).
- **Gentler for slower typists:**
  - Apprenticeship 5 at 35 WPM clears 25% → 50% of the time.
  - Apprenticeship 8 at 60 WPM clears 50% → 100%.
  - With adaptation, the Opening at 35 WPM sometimes clears.
  - This is a judgement for playtesting (Q-34).
- **Fixed modes:** the Crosswind Trial keeps its D-121 calibration. At 90 WPM, spells survive and hands alone falls; 120 WPM survives.
- **Fairness:** duplicate and prefix words on the field drop to 0%. Same-first-letter pairs at 16 scrolls stay near baseline: unavoidable with 26 letters.

## 4. Not done

- Human playtesting.
- Curating the two-letter bank (Q-34).
- Any Arcade-specific tuning (D-122): Arcade reuses Endless configurations, so it inherits the new lengths.
