# TypeL — Spell unlock order: evaluation and proposal (not implemented)
_2026-11-22 · prepared with D-102 · **proposal only: the current order is unchanged in the build**_

Current order (one spell per apprenticeship): **Slow → Fire → Ice → Barrier → Shock → Alter → Wind → Harvest**, then the Final Examination with every spell.

## 1. What each spell teaches, and how it touches Combo and Arcane Rush
| # | Spell | What it teaches | Combo | Arcane Rush |
|---|---|---|---|---|
| 1 | Slow | Buying time; spells are tempo tools | Only by typing | Window gets 25 % more time; its clock pauses under the freeze |
| 2 | Fire | Field reading: clusters in the lower half, chain spread | None (base points only) | None; no progress either |
| 3 | Ice | Converting safety into momentum: Frostbound Focus +2/+4/+8 Combo per perfect word | Big gains, if perfect | Window keeps running during the freeze |
| 4 | Barrier | Risk insurance: a slip you correct keeps Combo and Rush | Protects it | Protects it |
| 5 | Shock | Emergency clearing near the Ward, paid × Combo | Paid by it, never adds | Never adds |
| 6 | Alter | Reshaping the field (short words, full value) | Only by typing | Only by typing |
| 7 | Wind | Ward economy and the All-In wager (×2 for 10 s, scars the Ward) | Indirect (×2 window) | Indirect |
| 8 | Harvest | Cashing out: claims the field × Combo × Rush; spends Rush | Kept | **Spent**: the payoff for building it |

## 2. Assessment
**What works.**
- **Slow first** is the right opener. It is easy to understand, forgiving, and it makes the Rush window visible.
- **Harvest last** is correct. It is the cash-out for Combo and Rush, so it only means something once the player values both.
- **Wind before Harvest** sets up the best scoring decision in the game: wager All-In, then Harvest inside the ×2 window.

**Where the order teaches less well.**
1. **Fire, the second spell, teaches the least about scoring.** It adds no Combo, no Rush and no progress, at the moment a new player is learning what Combo and Rush are. It is a good spell, but it sits early as a "big boom" with no momentum lesson.
2. **Barrier, the fourth spell, arrives after Ice**, the spell whose reward (Focus) a single slip destroys. Barrier is the natural safety net for Combo-building. Teaching it before Ice would let Ice's Focus be learned with a net.
3. **Shock and Fire are both area-damage spells** that pay base or Combo without building momentum. Separated by Ice and Barrier, the second feels like a repeat rather than a new idea.
4. **Alter, the sixth spell, is a defensive and control tool** that would help most in the mid-game, where D-101's longer words begin (Storms, 5–8 letters). It currently arrives one apprenticeship after that step.

## 3. Candidate orders
**A. Momentum-first (recommended for playtest):**
Slow → **Barrier** → **Ice** → Fire → **Alter** → Shock → Wind → Harvest
- The second spell teaches Combo protection, and the third uses it: Ice's Focus is learned with a safety net.
- Fire then arrives as a field tool once the player understands what it doesn't pay.
- Alter lands at Storms, where words get longer; Shock follows as its emergency partner.
- Wind and Harvest stay as the finale pair.

**B. Minimal change:** swap only **Barrier and Fire** (Slow → Barrier → Ice → Fire → Shock → Alter → Wind → Harvest). This captures most of the Combo-teaching benefit with the least disruption to mentors, hints and art.

**C. Two-track:** alternate a momentum spell and a field spell: Slow (tempo) → Fire (field) → Barrier (momentum) → Shock (field) → Ice (momentum) → Alter (field) → Wind → Harvest. This makes every apprenticeship feel different, but it delays Ice's Focus, the biggest Combo lesson, to the fifth apprenticeship.

## 4. What a reorder would touch
- `TRIALS` (spell, mentor, boss, hints), `learnedSpells`, `startingCharges` and drop weights (`introducesSpell`).
- Mentor texts, boss names, spell-themed art and voice lines, and the apprenticeship glyphs.
- Hardcore spell typing (unchanged rules, new order).
- Rune sequences tied to spells (unchanged).
- Simulations: re-run `tools/director-report.ts` with spell-casting typists. Today's typists don't cast, so the report can't yet show a spell's value.

## 5. Suggested evaluation
Add a spell-casting policy to the simulation typist (for example: Slow when demand is above capacity, Ice at three or more words, Harvest at Rush ≥ ×3, Wind wager at full Ward) and compare orders A, B and current on score per run, Combo retention through surges, and clear rates. Then playtest A against the current order with two or three players across apprenticeships 1–4.
