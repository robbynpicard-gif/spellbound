# Wind / Harvest apprenticeship prototype — audit, tuning and status
_2026-11-20 · Claude · branch `dev/apprenticeship-prototype-20261119` · decision D-084_

Status key: **Approved** (owner design) · **Experimental** (prototype value, tune freely) · **Coded** · **Tested** (automated) · **Deployed** (preview) · **Playtested** (owner).

## 1. Audit (before changes)
| Area | Source of truth | Finding |
|---|---|---|
| Score (Arcane preview) | `GameEngine.complete()` via `proposedWordScore` | letters × 10 × Combo (1 + ⌊combo/10⌋) × Volley, one rounding. Duels use legacy `scoreWord`. |
| Ward | `InstabilityManager` (0 stable, 100 collapsed; critical ≥ 75) | No maximum/cap concept existed. |
| Wind | `SpellRegistry` → `restoreWard(50)` + `resetWordSpeeds()` | Flat +50 in both modes; `GameSceneData`/engine comments claiming Hardcore "halves" are stale. |
| Harvest | `harvestAll()` | Half base × Combo (Arcane) or × Combo × Clean Streak (legacy). |
| Shock | `chainLightning()` | Lowest word + 3 nearest, base points only. |
| Ice | `step()` | Volley clock paused while frozen (D-077 reverses this). |
| Typos (Arcane) | `applyChar()` | Any typo, even corrected, resets Combo, Clean Streak, pool and Volley. |
| Campaign carry | `CampaignMode.recordLevel` | Hardcore carries instability, heals 25 after 5/10/15; no scar fields in saves. |
| Mana | D-057 pool 8→12 | Kept; no new casting meter added. |

**Contradictions found:**
1. *Ice Focus vs Arcane typo rule.* The handoff says a typo "breaks the Focus sequence but already earned Combo remains", but the current Arcane rule resets Combo on any typo. I kept the existing Arcane rule (Focus never adds a penalty of its own). Barrier insurance is the way to keep Combo through a slip. **Owner decision needed.**
2. *Wind name.* The spell's display name is still "Arcane Purge", and its cast banner says so. Not changed.
3. *Production preview marker.* After the dev→main merge, `index.html` on main carries the "TYPEL · DEV PREVIEW" badge, so production shows it too. Not changed on main without approval.
4. `docs/sandbox-interactions.md` and older `docs/design.md` describe superseded Wind/Harvest/Ice/Alter rules (annotated, not rewritten).

## 2. What changed
| Mechanic | Rule | Status |
|---|---|---|
| Wind below max | Heal to the current (scarred) maximum, reset speed-ups; ends an active All-In | Experimental · Coded · Tested |
| Wind at max | All-In: Ward → 25%, max scarred, ×2 window 10 s | Approved direction · Experimental numbers · Coded · Tested |
| Too scarred | Calm gust (speed reset only) | Experimental · Coded · Tested |
| All-In ends | Expiry; heal; breach (Normal); breach/typo/wrong Enter (Hardcore) | Experimental · Coded · Tested |
| Scope | Normal: fresh each level. Hardcore: maximum and wagers persist all stage; milestone heals capped | Approved (tentative) · Coded · Tested |
| Shared scoring | `arcaneScore(base, Combo, Volley, All-In)`, one rounding | Coded · Tested |
| Harvest | Whole field: original base × Combo × Volley × All-In; spends Volley; keeps Combo; counts quota | Approved · Coded · Tested |
| Shock | Same 3 arcs; base × Combo × All-In; no Combo/Volley added | Arcs placeholder · Coded · Tested |
| Ice | Volley clock runs; Focus +2/+4/+8/+8 | Approved · Coded · Tested |
| Barrier | One layer insures one entry's corrected typos | Candidate · Coded · Tested |
| Alter | Shortened word keeps original base | Candidate · Coded · Tested |
| Gust | Scroll tilt + existing candle reaction; visuals only; off with reduced motion | Coded (visual) |
| HUD | Ward bar draws scarred band; label `WARD 25/85%`; `ALL-IN ×2 · 7s` while active; callouts for wager/heal/calm/broken/insured/Focus/Volley spent | Coded |
| Codex/Spellbook | Spell text and scoring/mistake sections updated | Coded |
| Apprenticeship | 4 lessons, skip/replay, discovery line for Wind+Harvest | Placeholder text · Coded · Smoke-tested |
| Sandbox | Endless, all spells, 29 charges, 40-charge pool, not recorded | Coded · Smoke-tested |

## 3. Experimental tuning (all in `src/gameplay/WardScar.ts` → `WARD_TUNING`, `ICE_FOCUS_STEPS` in `GameEngine.ts`)
| Constant | Value | Why |
|---|---|---|
| `wagerStability` | 25 | Equals the critical threshold; Normal 10–14 per miss = about two breaches from collapse |
| `firstScar` / `scarGrowth` | 15 / +5 | Each wager visibly costs more: 100 → 85 → 65 → 40 |
| `minCapAfterWager` | 40 | Stops a wager from leaving an unrecoverable Ward; caps at three wagers per scope |
| `windHeal` | 100 (to max) | "Recover to the scarred cap" reads clearly; was +50. Big Hardcore buff — watch it |
| `allInMultiplier` | ×2 | Simple, legible; stacks with Combo and Volley through one formula |
| `allInTicks` | 600 (10 s) | Enough for 5–10 typed words or one well-timed Harvest |
| `ICE_FOCUS_STEPS` | 2, 4, 8 (then 8) | As D-077 |
| Sandbox stock | 6 Wind, 4 Harvest/Shock/Ice/Slow, 3 Barrier, 2 Alter/Fire | Room for deliberate combination tests |

**Runaway check:** largest Wind+Harvest payout is about one field × Combo × Volley × 2. With a 6–8 word field at Combo ×4 and Volley ×3 that is ~24× base for one cast, and it spends Volley. Repeats need a heal, a fresh wager and a new Volley each time, and the scar shrinks the margin.

## 4. Lessons (placeholder)
1. **Mending Air:** start at 40% Ward with 2 Wind; heal.
2. **All In:** full Ward, 3 Wind and a quiet extra Harvest; first wager. Grand Wizard notices an untaught Wind+Harvest.
3. **What the Wind Carries:** the mentor hints, never prescribes; she recognizes Wind+Harvest if you find it.
4. **The Scarred Ward:** Hardcore rules, 75 s survival; mastery is two or more wagers and staying alive.

## 5. Known limitations
- Shock odds/propagation not implemented (D-080 pending). Fire unchanged (D-078/079).
- No Runes for Final Wager / Frostbound Focus / Reap What You Sow yet.
- Mentors are text panels: no portraits, voice or in-run hints.
- Sandbox has no in-run refill (Restart refills).
- Arcane rules apply to every non-duel mode; duels and replays keep legacy rules.
- `tests/server.test.ts` cannot run in the offline sandbox (missing `ws`); CI runs it.
