# TypeL — Canonical Gameplay Direction: Academy, Teacher Examinations, Arcade Campaign
_2026-11-22 · design-bible consolidation · development branch only · **direction approved; implementation and numerical tuning not implied**_

## Authority and scope
This document consolidates the owner's latest explicit direction and earlier approved decisions. It supersedes conflicting **structural descriptions** of the campaign and boss role in older docs; it does **not** silently supersede established spell effects, score arithmetic, resource rules, or audiovisual decisions. Status labels: **DECIDED** = owner-approved direction, **RECOMMENDED** = design recommendation awaiting owner acceptance, **EXPLORATORY** = needs specification/approval, **IMPLEMENTED** = independently verified in current dev code/docs. Latest explicit owner decisions outrank historical documents. Keep this document and the decision register synchronized.

## Core player promise — DECIDED
TypeL is a highly replayable, responsive, legible wizard typing arcade game. Falling word scrolls threaten the Ward. Accuracy, sustained flow, strategic spell use, and readable risk/reward create the skill ceiling. Magic behaves consistently, intuitively and materially where implemented. No hidden WPM/accuracy skill adaptation; seeded deterministic generation and replay. Never make Runes/achievements force ordinary word selection. Every run should invite another attempt through learnable skill, not arbitrary failure.

**Progression:** Academy teaches spells; its teachers are the apprenticeship boss examinations; graduation after the Headmaster unlocks a distinct **Arcade Campaign** which assumes command of the spell bank and introduces expanded scroll types, spawn behaviors, and compound encounters. Endless remains a high-skill escalating survival/scoring expression. This is the approved **design direction**, not a claim that the Campaign or teachers are implemented.

## Academy — DECIDED direction
Nine continuous apprenticeships: Time/Slow, Flame/Fire, Frost/Ice, Wards/Barrier, Storms/Shock, Ink/Alter, Winds/Wind, Harvest/Harvest, Final Examination/all learned spells. **Keep this spell order** unless explicitly revisited. Each apprenticeship is one uninterrupted scored run:
- **Phase I Recognition/Learn:** introduce the featured spell through understandable recurring battlefield problems; early access and adequate opportunity to experiment, not free unlimited charges.
- **Phase II Application/Master:** featured problem combines with previously learned mechanics, with frequent varied pressure and meaningful scoring opportunities.
- **Phase III Teacher Examination:** a characterful teacher gives their strongest test of the featured discipline **and the student's previously learned spell bank**. Headmaster tests the full bank. Multiple viable solutions; no mandatory spell cast, scripted one-answer puzzle, or unbeatable encounter when the featured charge is unavailable.
- Transition in-play with readable diegetic cues, no compulsory results screens, no interruption or arbitrary Combo/Rush reset. Teacher identity, appearance, voice, names and attack telegraphs remain exploratory.

The existing implementation (D-102) uses 12 invisible checkpoints (4 Learn, 8 Master) plus a timed boss. Keep internal checkpoints for saving and pacing as needed, but do not treat their boundaries as visible game rules. Continuous score, Combo, Rush, charges and field are already implemented per D-102. **The new teacher-boss design and campaign unlock are not yet implemented.**

## Spell-led encounter identities — DECIDED design principle; specific schedules RECOMMENDED
Each apprenticeship has a **featured encounter family**, not an exclusive rule set. Encounters are solvable by typing alone; spells improve tactical outcomes. Progressively reuse earlier families.
1. **Slow / Time:** varied arrival times, converging urgency, opportunity to buy time and sustain Rush.
2. **Fire / Flame:** lower-field clusters and emergency offensive clearing, with explicit opportunity cost (burned words do not build Combo/Rush).
3. **Ice / Frost:** precise consecutive captures during freeze, Focus builds Combo; freeze does not stop Rush clock.
4. **Barrier / Wards:** overlapping threats, corrected slips and near-breaches that reward protecting Ward/Combo/Rush.
5. **Shock / Storms:** density-sensitive connected urgent targets that make chain clearing useful; Shock does not fabricate perfect captures.
6. **Alter / Ink:** difficult long-word concentrations and transformable threats; typed transformed words retain original base scoring.
7. **Wind / Winds:** sustained attrition and genuine choices between Ward recovery and All-In wager; preserve lasting scar consequence, avoid forced wagers as a surprise.
8. **Harvest / Harvest:** deliberate accumulation of valuable active words and timing the cash-out of earned Combo/Rush.
9. **Final Examination:** combinations of all previous encounter families, testing prioritization and the complete bank.
Spell effects, exact scores, eligibility and cast semantics are governed by existing decisions D-049, D-057, D-069, D-072, D-077, D-080, D-083 and later supersessions. Do not infer new effects from thematic names.

**Encounter Director (RECOMMENDED):** seeded reusable patterns: acceleration, low-field cluster, precision window, near-breach, chain cluster, long-word concentration, attrition/wager, scoring window, mixed examination. Use per-apprenticeship and per-phase weighted selection. Avoid forced artificial achievements or spell-drop farming. Add anti-repetition, telegraphing, spawn geometry safety, and a no-charge solvability test. Treat previously suggested 35/30/20/15 weighting as an illustrative hypothesis, not canon.

## Difficulty — DECIDED direction, experimental values
Keep one shared living Director (D-097, D-101, D-102). Length and fall speed jointly sampled; dominant soft word windows rise from Slow ~3–6 with rare 7+ at opening to Harvest 6+ and Final 6–10, with occasional outliers. Spawn rate, density, position/behavior and encounter composition provide supporting variability. Frequent short pressure events, major surges, and shallow active recovery. Challenge should feel lively even to skilled typists; no empty-field penalty to earned flow. Normal and Hardcore share architecture; Hardcore starts and escalates more aggressively. No Classic player-facing switch. Boss climaxes end at a peak, not a recovery dip.

**Endless:** every apprenticeship's Endless should eventually exceed sustainable realistic human typing capacity, including 200 WPM with reaction and switching costs; no arbitrary kill timer or unreadable infinite fall speed. D-102 simulation documents a *real physical plateau* at ~30–45 min even though realistic simulated typists failed earlier. **Do not claim mathematically unlimited difficulty**. Stress-test exceptionally fast hypothetical typists and propose a readable additional lever if required. Keep word-length identity in early Endless.

## Scoring and resources — DECIDED principles
Banked score persists across all phases and into optional Endless for that apprenticeship. Combo and Rush persist through transitions under their actual rules. Correct typing earns precision; spells do not fabricate perfect captures or automatic Rush ignition. Skilled players can maintain scoring momentum through quieter passages and cash in through smart spell combinations. Each apprenticeship is a separately scored run (**RECOMMENDED operational assumption**, pending owner ratification); campaign stages and Endless records should be ruleset-versioned and comparable.

**Critical integration gaps from D-102 implementation (RECOMMENDED to fix, not yet approved as new exact rules):**
1. **Invisible Ward reset:** Normal currently heals to full at every invisible checkpoint. Replace with an explicitly communicated, diegetic phase-boundary or spell-based recovery, or continuous partial recovery policy; avoid invisible full resets. Hardcore currently carries Ward with +25 at checkpoints 4 and 8. Any policy must be visible, fair, and tested in both modes.
2. **Invisible Barrier expiration:** current layers expire at internal checkpoint. Prefer a visible phase-based lifetime or a clearly signaled duration/use count, not invisible expiration. Rebalance if lifetime becomes longer.
3. **Wind scars:** old per-level/per-checkpoint language conflicts with continuous runs. Specify a visible scar lifetime and a transparent defensive-versus-All-In trigger; do not silently change scoring or repeat-wager economics.
4. **Charge availability:** current shared pool 8→12 with clean captures and earned scroll drops. Test that a featured spell can be learned naturally without flooding charges or guaranteeing scripted spell casts. No separate mana economy.
5. **Checkpoint resume:** deterministic replay and save currently restore only at checkpoint. Clearly communicate what is preserved/lost; prevent score duplication and streak exploitation. In-game phase transitions must not create score-farming resets.
6. **Rush and spawn timing:** ensure no actionable word gaps unfairly expire the player's earned opportunity; preserve D-067 grace, D-069 Slow behavior and D-077 Ice behavior.
7. **Scoring clarity:** surface banked score, Combo, Rush, Wind wager/scars and Harvest payout without speculative formula overload. Keep reward feedback diegetic, brief, nonblocking.
8. **Boss spell-bank readiness:** carry charges into boss; avoid unavoidable mandatory charge requirements, impossible overlaps, and unfair sudden entry pressure.
9. **Codex and UI copy:** remove obsolete 'level' wording for effects now measured in invisible checkpoints; update banner, records and progress language consistently.

## Graduation and Arcade Campaign — DECIDED direction; detailed content EXPLORATORY
Graduation on clearing the Headmaster unlocks Arcade Campaign. Campaign is distinct from the Academy, assumes full spell-bank knowledge, and introduces advanced scroll types, six previously discussed spawn behaviors and suspended scattered scrolls (random hang time then fall), with gradually increasing compound combinations. Do not invent six precise behaviors from memory: recover their exact approved definitions before coding. Academy may preview a new behavior when pedagogically useful; Campaign is its primary home. Campaign stage rhythm proposed: **Establish → Escalate → Climax**, with own records and varied encounter identities. Exact number of stages, narrative, unlock permanence, boss roster and visual assets remain exploratory.

**Elemental caution:** existing `ElementalReactions.ts` has pure reaction definitions, but live game has a single workshop status, not per-scroll elemental state; Water/Earth/Void are not castable spells. Do not present unimplemented reactions as working campaign mechanics or introduce new elemental scroll types without separately specifying targeting, interactions, visuals, fairness and tests. D-058 gate remains authoritative.

## Accessibility, integrity, measurement
- Keep readable scroll text at maximum density, no overlapping labels, fair spawn lanes and telegraphed exceptional threats; input must never be blocked by visual effects.
- Maintain Normal quick-cast vs Hardcore typed spell commands, and ensure typed spell names cannot be mistaken for normal word targets.
- Fixed-step determinism, separate RNG streams, replay tests, pause/resume correctness, stable spell/resource accounting.
- Instrument **spell opportunity** (encounter actually invites the featured spell), spell availability, use, success, alternate solutions, damage, Combo/Rush continuity, score distribution, failure cause and idle gaps. Simulated bots **without spells cannot establish teacher-boss fairness**; add spell-casting bots and human playtests.
- For each teacher test a no-charge typist, novice with featured spell, competent multi-spell typist, and skilled typist using alternate strategy. Ensure spell is useful, never mandatory.
- Test both Normal/Hardcore, early/late apprenticeships, low/high WPM, accessibility and 200-WPM Endless.
- Version leaderboard/record rules when progression or scoring rules change. Preserve legacy saves and records.

## Recommended implementation order
1. Fix invisible resource boundaries (Ward, Barrier, Wind scars, copy) and verify scoring continuity.
2. Build a deterministic encounter-pattern library and per-apprenticeship/phase weighting, preserving the existing spell bank.
3. Introduce teacher examinations as encounter compositions with multiple solutions, not hard counters.
4. Add graduation and campaign unlock/state; build a **small vertical slice** with one advanced spawn behavior, then expand to the approved six and suspended-scatter behavior.
5. Validate scoring, spell availability, difficulty and fair Endless escalation with human playtests and spell-aware simulations.
Do not merge to production without owner authorization.

## Explicitly unresolved decisions for owner
- **Ward:** when/how should Normal heal inside a continuous apprenticeship? phase milestone, gradual recovery, earned event, or spell only?
- **Barrier and Wind:** what visible lifetime should replace invisible checkpoint expiry, especially for long-running scoring?
- **Graduation:** must all nine apprenticeships be cleared in Normal, or can Hardcore also qualify? (Recommended: either qualifies.)
- **Campaign access:** graduation-gated only, or partial early preview? (Recommended: graduation unlock; optional teaser only.)
- **Boss loss/retry:** retry boss from a checkpoint with preserved earned score/charges vs restart run; avoid farming and misleading records.
- **Campaign scope:** stage count, scroll types, exact six spawn behaviors and elemental interaction contracts.
- **Endless:** where to expose entry (after each teacher, after campaign, or both), and whether it shares the score run or begins a distinct leaderboard run.
