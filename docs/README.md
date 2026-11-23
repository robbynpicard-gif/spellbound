# TypeL documentation — start here

This is the single entry point for anyone working on TypeL, human or AI.
It says which documents are current, which are historical, and how
conflicts are settled. The working rules are in [`AGENTS.md`](../AGENTS.md).

Decision log current through: D-106

## Current state (2026-11-23)

- **Design source of truth:** [`production-bible.md`](production-bible.md),
  adopted by the owner on 2026-11-23 (D-106). How it maps to the code, plus
  the staged plan awaiting approval:
  [`production-bible-reconciliation-2026-11-23.md`](production-bible-reconciliation-2026-11-23.md).
- **Preserved baselines:** branches `baseline/main-2026-11-23` and
  `baseline/dev-2026-11-23`.

- **Repository:** `robbynpicard-gif/spellbound`. Pages:
  `https://robbynpicard-gif.github.io/spellbound/`, with the preview at
  `/spellbound/preview/`. D-099 records a rename to `TypeL`, but GitHub
  still reports the old name (open question Q-1). Links in older documents
  to `/TypeL/` or `robbynpicard-gif/typel` are wrong until that rename happens.
- **`main`** is the stable game: the older Normal/Hardcore campaign of
  5 stages × 20 levels (D-047–D-057), plus Practice. Its decision log ends
  at D-099 and lacks D-084–D-098 and D-100–D-103.
- **`dev/apprenticeship-prototype-20261119`** holds TypeL as it is being
  designed now: nine continuous apprenticeships (Slow, Fire, Ice, Barrier,
  Shock, Alter, Wind, Harvest, then a Final Examination), each a
  Learn → Master → Boss run with optional Endless (D-085, D-102), a living
  Difficulty Director (D-097, D-101, D-102), Arcane Rush, Runes, key-art
  presentation (D-093), Sandbox and Typing Trials.
  `dev/continuous-apprenticeship-20261122` currently points at the same commit.
- **Approved but not built:** see the reconciliation plan. Highlights: no
  number-key casting in default Normal, a spell-free opening trial, the
  Chronomancer/Temporal Trial/Grandmaster structure, teacher examinations and
  graduation, Arcade & Practice, the audio split, and the desktop (Tauri) path.
- **Where each mechanic lives:** [`system-map.md`](system-map.md).
- **Waiting on the owner:** [`open-questions.md`](open-questions.md).

## How conflicts are resolved

1. **What is implemented:** the code on the branch in question, then its
   tests, then observed play. Documents never prove implementation.
2. **What is intended:** the latest explicit owner decision, then the
   Production Bible (D-106), then [`decisions.md`](decisions.md) entries the
   Bible doesn't contradict (a newer entry beats an older one). Where the
   Bible is silent, existing decisions and mechanics stay as they are.
3. **The current documents below** expand on decisions. If one disagrees
   with a newer decision, the decision wins; fix the document.
4. **Historical documents** are context only. Each one carries a
   "Document status: HISTORICAL" banner.

## How decisions are made and tracked

- Only the owner approves design. Assistants propose; a proposal is
  recorded as **Proposed** and stays that way until the owner accepts it.
- Every accepted or proposed decision is appended to `decisions.md` with
  its design, implementation and deployment status (convention from D-060).
  Old entries are never rewritten; supersede them with a new entry.
- Unanswered questions live in `open-questions.md` until a decision answers them.
- After implementation, the same change updates `system-map.md`, any
  shipped rule text (`src/data/spells.json`, Codex) and this index
  (`AGENTS.md` §6). `npm run docs:check` and CI enforce the mechanical parts.

## Document classification

Every Markdown file in the repository root and `docs/` is listed here;
`tools/check-docs.mjs` fails if one isn't.

### Current — the shared context

| Document | What it governs |
|---|---|
| `AGENTS.md` | Working rules for every assistant |
| `CLAUDE.md` | Points Claude to `AGENTS.md` |
| `docs/README.md` | This index |
| `docs/system-map.md` | Gameplay systems → source files, status, tests |
| `docs/open-questions.md` | Questions waiting for the owner |
| `docs/production-bible.md` | **Design source of truth** (D-106): scope, gameplay philosophy, production, visuals, audio, desktop/Steam |
| `docs/production-bible-reconciliation-2026-11-23.md` | Each Bible item vs the code: conflicts, classification, proposed milestones |
| `docs/decisions.md` | Append-only decision log; entries the Bible contradicts are superseded |

### Current — design and implementation references

| Document | What it governs |
|---|---|
| `docs/academy-campaign-canonical-gameplay-2026-11-22.md` | D-103 Academy and teacher-examination detail. Its Arcade Campaign and "Headmaster" are superseded by the Bible (D-106) |
| `docs/continuous-apprenticeship-2026-11-22.md` | The implemented continuous run, Director and Endless (D-102) |
| `docs/apprenticeship-difficulty-director-2026-11-21.md` | Difficulty specification (D-097, D-101) |
| `docs/arcane-volley-design-goal.md` | Arcane Rush (formerly Volley) emotional arc (D-059) |
| `docs/precision-combo-scoring-proposal.md` | Precision Combo rule (approved direction) |
| `docs/scroll-elemental-design-gate.md` | D-058 gate for scroll banks and elemental interactions |
| `docs/typel-keyart-reconstruction-2026-11-21.md` | Visual source of truth (D-093) |
| `docs/assets/README.md` | Asset production system (D-094) |
| `docs/assets/ART_BIBLE.md` | Art rules (status: Proposed) |
| `docs/assets/AUDIO_BIBLE.md` | Audio as built, plus specs for requests |
| `docs/assets/ASSET_MANIFEST.md` | Generated asset status table (do not edit by hand) |
| `docs/assets/PRODUCTION_QUEUE.md` | Asset order and dependencies |
| `docs/assets/REFERENCE_GUIDE.md` | Where references and sources live |
| `docs/assets/INTEGRATION_LOG.md` | Append-only asset integration log |
| `docs/assets/requests/BATCH-01_clean-plate-and-scroll.md` | Asset request batch 01 |
| `docs/assets/requests/BATCH-01b_hud-revision.md` | Asset request batch 01b |
| `docs/grand-wizard-voice-script.md` | Recording script, generated from `src/typel/voiceLines.ts` |
| `docs/lore.md` | World bible, never shown as text (D-034). Its Chronomancer (Rewind) entry is superseded: the Chronomancer now teaches `SLOW` (GAME-003) |

### Reference — dated reports, accurate for their scope

Newer decisions win where these disagree.

| Document | Scope |
|---|---|
| `docs/spell-order-proposal-2026-11-22.md` | Proposed spell order change (not adopted; D-103 keeps the order) |
| `docs/wind-apprenticeship-prototype-2026-11-20.md` | D-084 Wind/Harvest/Ice/Barrier/Alter prototype rules and tuning (values still in code) |
| `docs/typel-prototype-2026-11-20.md` | D-085 prototype status and playtest script |
| `docs/typel-direction-2026-11-21.md` | D-086 playtest direction (its visuals are superseded by D-087 and D-093) |
| `docs/sandbox-interactions.md` | D-069 spell interaction contracts (partly superseded; see its note) |
| `docs/foundation-roadmap.md` | D-066 roadmap (Proposed) |
| `docs/reward-integrity-audit.md` | D-058 audit of Runes and Triumphs, 2026-11-20 |
| `docs/scoring-comparison.md` | Offline scoring experiment |
| `docs/arcane-gambit-feasibility.md` | Offline prototype, not live |
| `docs/wordcraft-selection-experiment.md` | Retired offline research (D-058) |

### Historical — context only (bannered)

| Document | Why it is historical |
|---|---|
| `README.md` | Repo front page; its gameplay section and URLs describe the 2026-11-16 build |
| `docs/GDD.md` | Original pre-development design document (v1.0) |
| `docs/design.md` | v0.27 design reference for the legacy campaign |
| `docs/current-game-model.md` | 2026-11-19 snapshot of the legacy campaign; its no-preview rule is contradicted by D-060 and the deploy workflow |
| `docs/TYPEL-CURRENT-DESIGN-AND-CLAUDE-BRIDGE.md` | 2026-11-20 bridge; replaced by this index and `AGENTS.md` |
| `docs/typel-four-pillar-decision-register-2026-11-20.md` | Register through D-084; later decisions supersede parts |
| `docs/definitive-creative-direction-2026-11-20.md` | Visual direction superseded by D-093 |
| `docs/claude-prototype-handoff-2026-11-20.md` | One-time handoff |
| `docs/typel-handoff.md` | v0.13 handoff |
| `docs/gpt-handoff-v0.22.md` | v0.22 ChatGPT handoff |
| `docs/gpt-handoff-v0.25.md` | v0.25 ChatGPT handoff |
| `docs/gpt-brief-2026-11-17.md` | v0.17 brief |
| `docs/mechanics.md` | v0.27 Codex export for the legacy game |
| `docs/architecture.md` | Milestone 4 architecture; `system-map.md` is current |
| `docs/art-direction.md` | Gothic pixel direction, superseded |
| `docs/calibration-2026-11-17.md` | Calibration of the legacy stage campaign |
| `docs/clean-streak-report.md` | Clean Streak report (v0.18) |
| `docs/development-log.md` | Log, last entry 2026-11-17; later history is in `decisions.md` and git |
| `docs/original-game-research.md` | Research plan, never started |
| `docs/difficulty-director-implementation-2026-11-22.md` | Per-level Director, superseded on the preview by D-102 |
| `docs/playtests/endless-waves-clutter-2026-11-19.md` | Playtest notes for the legacy Endless |
| `docs/plans/apprentice-world.md` | 2026-11-16 character-world concept |
| `docs/plans/campaign-v2.md` | Superseded by D-047 |
| `docs/plans/options-2026-11-17.md` | Options research report |
| `docs/plans/spells-v2.md` | Spell v2 plan (implemented, later revised) |
| `docs/plans/wizards-v1.md` | Superseded by D-047 |
| `PROTOTYPE.md` | Standalone `prototype.html` slice, superseded by D-085 |
| `RENAISSANCE_OVERHAUL_PLAN.md` | Pre-D-085 overhaul plan |
| `SENSORY_DIRECTION.md` | Pre-D-085 sensory contract |

## Adding a document

Prefer updating an existing current document. If a new one is justified (a
dated audit, simulation or playtest), add it to the right table above in the
same change. To retire one, move its row to Historical and add the banner
(copy it from any historical file). Never delete a historical record without
the owner's approval.
