> **Document status: HISTORICAL** (classified 2026-11-22, D-104). Kept for context; not a current requirement. 2026-11-20 bridge. The entry point is now docs/README.md and AGENTS.md (D-104); its principles live on in decisions.md. Where it conflicts with `docs/decisions.md` or a current document in the [docs index](README.md), those win.

# TYPEL — current design authority and Claude continuation briefing
_2026-11-20 · living bridge document; update before Claude handoff_

## Read this first

**The deployed game is a prototype, NOT the artistic target, gameplay authority, or visual reference.** Preserve the feel and game identity agreed with the owner, not the accidents of existing code. Use the code as selectively reusable infrastructure. If a historical decision or implementation conflicts with the current approved direction, follow this document and the newer decision record, then ask before changing core principles. Do not assume all D-001–D-059 are simultaneously current. The historical log is context, not a checklist.

**Product fantasy:** TypeL is a magical arcade typing game. The player's own accurate, fast typing feels like charging and operating a living arcane typewriter. The game should have an intuitive, physically coherent elemental world and compelling high-skill flow, with spectacular but readable audiovisual rewards. Don't manufacture rare rewards by rigging word generation.

## Design commitments (owner-approved)

- **Simple scoring:** `(captured letters × 10) × precision Combo multiplier × Volley multiplier`. Bonus medals and Triumphs may celebrate organic achievements, but must not secretly complicate the core formula.
- **Precision Combo:** a visible count of consecutively perfect word captures; multiplier `1 + floor(combo / 10)`; one wrong keystroke breaks the chain immediately, even if corrected. Combo represents long-term, potentially uncapped power.
- **Clean Streak:** retire as an independent *player-facing score multiplier*. Rehome spell-pool growth and earned achievements safely; preserve save compatibility and historical statistics when necessary. Legacy state in code is not approval to revive the concept.
- **Arcane Volley:** fast, flawless, word-length-aware capture rhythm creates immediate, incremental charge; magical buildup promises a dramatic eruption; player sustains Surge; exceptional skill pushes beyond a soft cap. Candidate early ×1.2/×1.4/×1.6/×1.8; candidate ignition at ×2; candidate sustained Surge through ×5; then +0.1 increasingly demanding increments (×5.1, ×5.2...). **The emotional arc is accepted; numerical thresholds, timing and exact stages are not final.** Normal should welcome participation, Hardcore demand more. Typing errors break momentum; natural pauses should decay fairly. No spawn manipulation.
- **D-058 core integrity:** rewards, runes, Triumphs and grammar/parts-of-speech recognition observe naturally generated captures; do not bias spawning, difficulty, agency or responsiveness to force them to occur. Rare rewards are fine. Intentionally gameplay-changing spells require clear player-facing logic and approval.
- **Elements and spells:** intuitive, grounded interactions wherever possible (e.g. water extinguishes fire), without forcing redesigns just to support an element. Existing eight spells and partial reactions are implementation experiments, not a complete elemental vision.
- **Visual/audio direction:** arcane typewriter with building sparks, glow, rising sound and explosive but nonblocking Surge. Visual readability and typing input remain paramount. Existing art, layout, wizard roster and campaign presentation are not fixed artistic targets.
- **Scope and preservation:** deterministic fixed-tick simulation, fair word generator, tests, existing save compatibility and useful infrastructure are worth keeping where they serve the vision. Production main must stay stable until owner approves changes.

## Latest engineering state and caveats

Repo `robbynpicard-gif/TypeL`; production `main` → `https://robbynpicard-gif.github.io/TypeL/`; dev branch `dev/apprenticeship-prototype-20261119` → `/typel/preview/` when a **main-origin Pages workflow** packages the dev build. **Never deploy Pages directly from dev** (github-pages environment rejects it). `.github/workflows/deploy.yml` on main packages production and dev preview together; changes to dev alone do not publish until a new main Pages run.

New **experimental** Arcane Volley code in `src/gameplay/ArcaneVolley.ts` uses fixed-tick, word-length-scaled capture windows; first clean capture arms a short timing window at ×1; second timely clean capture earns ×1.2, then +0.2 per qualifying capture to ×5, then +0.1 with progressively more captures per step. Pauses decay the displayed multiplier, late captures start over, errors reset. This is a **playtest hypothesis, not final balance**. It is wired only to solo `experimentalScoring` in `GameEngine`; duels and other legacy paths still use old scoring. Current implementation does not yet check whether a viable word is available before allowing momentum to decay; that fairness concern remains open. HUD has Kindle/Surge/Mastery labels; the first capture now displays a short 'VOLLEY · LINK NEXT!' brass fuse meter that drains with the actual two-word timing window. Solo legacy two-second Volley callouts and meter are suppressed, but other legacy audio/scoring paths still require future consolidation. No art overhaul yet.

Old code still present: legacy `ScoringSystem` tiers, Clean Streak, old Volley bonuses, campaign carryover and achievement mappings. **Do not delete blindly**: these have secondary dependencies. Retired Wordcraft preview toggle and its test have been removed; offline grammar-bias experiments remain as non-live research. `WordGenerator` is the stable natural generator. Arcane Gambit is offline only, not live-approved. Grammar PhraseTracker observes capture order, does not bias spawn.

## What Claude should do when handed this project

1. Treat this document plus `docs/arcane-volley-design-goal.md` and newer accepted decisions D-058/D-059 as current direction. Audit historical decisions for supersession; never promote old choices into creative constraints by default.
2. Evaluate the deployed build critically against this vision; label code **keep / refactor / replace / retire**. In particular, do not treat old Volley ×1.5/×2/×3, Clean Streak, visual arrangement or legacy bonus scoring as the intended destination.
3. Prototype and playtest ignition/payoff, qualification windows, natural pause decay, word availability fairness, and soft-cap difficulty. Prefer feel over attachment to placeholder numbers. Do not alter word spawning to satisfy rewards.
4. Protect main, preserve saves/achievements and deterministic simulation, run checks before commits, and document deviations from approved design. Do not merge to production without owner consent.
5. Continue development in small reviewable stages; tell the owner what is actually built, tested, deployed, and still proposed. Do not claim that a documented goal is implemented.

## Still open for owner review

Exact ignition timing and audiovisual payoff, whether Surge is one extended phase or multiple climaxes, precise Volley pace thresholds and decay, whether to freeze decay when no eligible target exists, post-×5 cost curve, migration of old score/achievement paths, elemental breadth, spell and campaign evolution, full visual identity, and overall game feel.

**Design priority:** preserve the exciting *experience* while remaining free to replace current mechanics and visuals that get in its way.
