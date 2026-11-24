# Production Bible reconciliation — 2026-11-23

Production Bible §8, steps 2–6: inventory, reconcile, classify, record
risks, and propose milestones. The owner adopted
[`production-bible.md`](production-bible.md) as the design source of truth
(D-106). **This is a plan for approval. Nothing here has been implemented**,
and no gameplay code changed.

Implementation facts come from the audit in [`system-map.md`](system-map.md):
dev `cb41e71` and `main` `81bedb5`, preserved as branches
`baseline/dev-2026-11-23` and `baseline/main-2026-11-23` (§8 step 1).

**Classification:** Retain · Refactor (keep, change) · Replace · Remove ·
Defer · New (nothing exists yet).

**Precedence:** where the Bible and an older decision disagree, the Bible
wins (D-106). Where the Bible is silent, existing decisions and mechanics
stay unchanged (Bible integrity note), e.g. Hardcore, Runes, the Ward,
Wind/All-In, the Difficulty Director and Endless.

## Item-by-item

| Bible item | Repository today | Conflict | Class | Proposed action |
|---|---|---|---|---|
| GOV-001 repository as source of truth | D-104: `AGENTS.md`, docs index, docs check | None | Retain | Done in PR #12. `AGENTS.md` now carries the Bible's status labels |
| PROD-001 paid Steam release; PROD-002 20–35 h/week | Steam mentioned in D-085 | None | Retain | Recorded in D-106 |
| GAME-001 typing primary; no number-key casting in default Normal | Typed spell names cast in both modes (Verified). **Normal also casts with keys 1–8** (`PlayScene.bindInput`, `GameEngine.quickCast`, tested in `tests/spells.test.ts`) | **Yes** | Remove | **D-107: remove number-key casting completely, with no setting.** Keep the reserved spell words. **D-108: also remove click-to-target; no clicking during gameplay** (menus may be clicked) |
| GAME-002 spell-free, fairly escalating first trial | Apprenticeship 1 teaches Slow from its first second (`learnedSpells(1)`). "Typing Trials" is a separate speed-test mode | **Yes** | New | Add a spell-free opening trial before the Slow lesson. Escalation must be fair and survivable by skilled players, with no scripted failure. Typing Trials stays as practice |
| GAME-003 Chronomancer teaches `SLOW`; the Temporal Trial doesn't require casts | Slow teacher is "Master of Time", boss "The Unwinding Clock" (`src/typel/apprenticeship.ts`). "Chronomancer" in `docs/lore.md` and D-042 is an older, removed wizard with Rewind | **Names** | Refactor | Rename to Chronomancer and the Temporal Trial. Retire the old Rewind Chronomancer meaning. Check pass rules don't require casts (D-103 already says so) |
| GAME-004 challenge → lesson → examination → Grandmaster | Each apprenticeship runs Learn → Master → Boss (D-102). The finale is the "Final Examination" by the "Grand Wizard"; D-103 says "Headmaster" | **Names** | Refactor | Rename the final figure to Grandmaster. **D-107:** the spell-free opening challenge is the challenge; apprenticeships are lessons plus examinations, with no per-apprenticeship challenge. The Bible (§10) leaves stage count, teachers and durations unfinalized |
| Graduation unlocks the toolkit and advanced play | D-103: graduation unlocks the "Arcade Campaign". Not implemented | Partly | Refactor | Keep graduation. What it unlocks follows the SCOPE rows below |
| SCOPE-001 Academy + Arcade & Practice (green) | Sandbox (each apprenticeship's Endless), Typing Trials and the legacy Practice mode (`main` only) | Partly | Refactor | Build Arcade & Practice from the existing Endless, Sandbox and Typing Trials. Add spell-free survival, targeted practice and personal records |
| SCOPE-002 Arcane Trials (yellow) | D-103's "Arcade Campaign" (authored stages, advanced scroll types). Not implemented | **Yes** | Replace | D-103's Arcade Campaign is superseded as a committed launch mode. Its ideas move into the Arcane Trials prototype (one representative ~8–12-minute experimental continuous run first). **D-107: advanced spawn behaviours live in Arcane Trials** (revisit if testing shows apprenticeships benefit) |
| SCOPE-003 expanding playground (red); RELIC-001 small relic set | No relic system exists | — | Defer / New | Keep the architecture extensible. Design 3–5 relics with Arcane Trials, after the vertical slice |
| GAME-005 Combo/Volley buildup and screen-clear fairness | Implemented. The Rush multiplier starts on the second timely perfect word (D-060). Window: 52 + 13 ticks per letter in Normal, 34 + 10 in Hardcore (`ArcaneVolley.ts`). The clock pauses on an empty field with one 0.4 s grace (D-067). Player-facing name: Arcane Rush (D-086) | Name only | Retain (rename) | Keep the mechanics exactly as built. **D-107/D-108: "Volley" retired; the name is Arcane Rush.** Rename the remaining Volley wording in hints and code |
| Spell cadence: one cast every 10–15 s, maybe 5–10 s | Director pressure exists. Cadence is not measured | — | New (measure) | Add cast-interval telemetry to the simulation harness, then tune toward the hypothesis. It's not a quota (D-105) |
| GAME-006 diverse spawn behaviours; suspended scrolls | Spawning varies by length, speed, Director events and the Wind/Harvest scroll types. **The "six behaviours" aren't recorded anywhere in the repo.** Suspended scrolls aren't implemented | Recovered (D-109) | Defer, then New | **D-109 records the six behaviours and Suspended Scattered Spawning.** Even Distribution roughly matches today's default placement; the rest are new. Build them in the Arcane Trials prototype (D-107), with the deterministic tests D-109 lists. Prototype suspended scrolls with variable hold times inside the D-058 rules (no word-selection bias) |
| GAME-007 legible elemental interactions | D-069 contracts. D-058 gate on per-scroll elements. Partly implemented | None | Retain | Continue under the D-058 gate |
| GAME-008 captured-word spellcasting modifier | Exploratory in D-105 | None | Defer | No work |
| Word-bank personality and approved word additions | Typing-culture words exist only on `main` (`81bedb5`, `src/data/words.json`), not on dev | **Yes** (dev is missing them) | Retain (merge) | Bring `81bedb5` into dev. Re-check that no added word clashes with a spell name |
| VIS-001 layered 2D, expressive animation; VIS-002 prototype screenshots anchor prompts | D-093 key art (REF-001) is the visual source the prototype is built from. Asset pipeline and provenance: `docs/assets/` (D-094) | None | Retain | Capture current prototype screenshots into the reference pack (`docs/assets/REFERENCE_GUIDE.md`). Add the Bible's prompt backbone to `ART_BIBLE.md` |
| AUD-001 restrained atmosphere, adaptive response to skilled play | Synthesized score whose tempo follows danger/stress (D-092); Rush adds harp. Three volume groups: music, effects, voice (`src/typel/audio.ts`) | **Yes** | Refactor | Split mixing into typing/capture, spells, ambience, music, voice and UI. Drive musical growth from published gameplay events, not from separate audio state |
| AUD-002 AUDIO-EXP-001 | Gameplay events are published (`src/core/GameEvents.ts`, `EventBus.ts`) | None | New | Run it after the audio refactor, as the Bible specifies: read-only adapter, A/B profiles, no gameplay effect |
| AUD-003 owner-recorded announcer, fixed processing preset | Recording script and file hooks exist (D-090, `src/data/voice-manifest.json`) | None | Retain + New | Define and save the processing preset. Add subtitles, priority rules and take metadata |
| TECH-001 browser → desktop; TECH-002 Tauri 2 (recommended) | Phaser 3 + Vite web build. Saves are versioned localStorage keys with migration (`src/storage/legacyKeys.ts`). **`index.html` loads fonts from Google's servers**, so they break offline. Spells and words are data files; apprenticeship definitions live in TypeScript | Blocker found | New | Self-host the fonts. Run a Windows Tauri spike covering input latency, focus, fullscreen, audio timing, offline use and sleep/resume. Move stage and apprenticeship definitions to data files |
| Hardcore, Runes, Ward, Wind/All-In, Director, Endless | Implemented | Not mentioned in the Bible | Retain | Unchanged, per the Bible's integrity note |

## Proposed milestones (for owner approval)

Each milestone ships as its own PR, with `npm run check` and
`npm run docs:check` green and the docs updated (`AGENTS.md` §6).

**M0 — Shared context and Bible adoption** (PR #12, this change). Accept by
merging.

**M1 — Small reconciliation fixes** (Bible phase 00). **Implemented in D-111** (PR from `dev/m1-typing-only-20261123`), except the code-identifier rename, which moved to M1b. Do these on dev:
1. Merge the `81bedb5` word additions; test for spell-name clashes.
2. Remove number-key casting completely (GAME-001, D-107), and remove
   click-to-target during gameplay (D-108). Update the HUD and Codex key
   labels and `tests/spells.test.ts`.
3. Renames: Chronomancer, Temporal Trial, Grandmaster; Volley → Rush in
   hints and code (`ArcaneVolley.ts`, `volley` fields), with no change to
   behaviour.
4. Fix the stale "level"/"stage" spell text (Q-9).

*Accept when:* tests pass; spells can still be typed in both modes; no
number key or click acts during gameplay; replays and saves still load
after the Rush rename. Old replays containing `select` commands must still
replay.

**M1b — Rush code rename.** Behaviour-neutral rename of the Volley identifiers (`ArcaneVolley.ts`, fields, events). Include a save migration for the `peakVolley` lifetime stat. *Accept when:* tests pass unchanged apart from names; old saves keep their stats.

**M2 — Desktop foundations** (phase 01):
1. Self-host the fonts.
2. Windows Tauri 2 spike, with the input and timing checklist from Bible §7.
3. Versioned save-migration test.

*Accept when:* the same build plays offline in the browser and the desktop
shell, with no measurable input-latency regression.

**M3 — Vertical slice** (phase 02), the Bible §4 proposal. **Progress:** the Opening Trial is built (D-112); the Chronomancer lesson and Temporal Trial exist under their new names (D-111). Remaining: the audio split, and the teacher-examination rules (D-103). Spell-free
opening challenge → Chronomancer `SLOW` lesson → Temporal Trial, integrated
with visuals, audio and teaching. The opening challenge escalates naturally
until Slow is clearly needed (D-107). *Prerequisite:* the six-channel audio
split. The six spawn behaviours (Q-16) are needed for Arcane Trials, not
for this slice.

*Accept when:*
- skilled players can pass the opening trial without scripted failure;
- the Temporal Trial passes without mandatory casts;
- browser and desktop play the same.

**M4 — AUDIO-EXP-001**, once the M3 event adapter exists.

**M5 — Arcane Trials prototype** (Bible phase 05): one representative
~8–12-minute experimental continuous run, built on the D-109 spawn behaviours and Suspended
Scattered Spawning.

**Backlog idea (Experimental, D-108):** keep the typewriter active in the
menus for typed navigation, alongside clicking.

**Later phases** follow Bible §4 (03 Academy production → 08 launch) and get
planned after M3, using the velocity measured there.

## Open questions

Answered: Q-12 to Q-15 (D-107), Q-17 (D-108), and the spawn-behaviour half
of Q-16 (D-109). Still open, in [`open-questions.md`](open-questions.md):
- **Q-16:** the original v0.20.0 Game Bible PDF.
- **Q-18:** how the opening challenge maps onto the continuous run.
- **Q-19:** green-scope acceptance criteria.
- **Q-20:** AUDIO-EXP-001 parameters.

### D-120 — Arcane Trials prototype override (2026-11-23)

Where this reconciliation plan or historical sources specify a 15–20 minute default or mandatory three-phase encounter, **D-120 supersedes those requirements**. The first prototype should test ~8–12 minute continuous encounters with dynamic pressure/release, no mandatory phase breaks, and distinctive authored tactical identity. Duration is experimental; the mode remains Yellow. Future longer or phased variants are separate exploration, not required for the first slice.


## D-123 — immediate gratification, progressive mastery

**Implemented (D-124), Verified by tests and simulation; values Experimental; not human-playtested.**
- Length model: `src/difficulty/DifficultyDirector.ts` (`DIRECTOR_TUNING.lengths`: start/harvest/end windows, `availability`, `belowDecay`, `tiltShare`; `letterRateMatch`).
- Opening climax quotas: `src/typel/apprenticeship.ts` (`OPENING_TUNING.path`).
- On-field duplicate and prefix exclusion: `src/gameplay/WordGenerator.ts` `nextOfLength(length, active)`, called from `GameEngine.spawn()`.
- Crosswind vocabulary 0.52: `src/typel/arcaneTrials.ts`.
- Tests: `tests/immediate-gratification.test.ts`, the vocabulary tests in `tests/continuous-run.test.ts`.
- Simulation tool: `tools/gratification-report.ts`. Report: `immediate-gratification-report-2026-11-23.md`.
