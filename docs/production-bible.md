# TypeL — Production Bible and Decision Register

**Studio:** Eighteen Ninjas  
**Version:** 1.0 — working canonical handoff  
**Date:** 2026-11-22  
**Status:** **Adopted by the owner as the design source of truth on 2026-11-23 (D-106).** Previously: proposed for repository adoption after Claude's context-protocol audit. This document records decisions from ChatGPT discussions; it does not assert that the current code implements them.

> **Repository note (2026-11-23):** Text below is the owner-approved v1.0 as supplied, unchanged except this status line. The context-protocol audit referred to in §8 and §11 is complete (D-104). How each item maps to decisions, code and conflicts: [`production-bible-reconciliation-2026-11-23.md`](production-bible-reconciliation-2026-11-23.md). Change this document only with owner approval, and record each change in `docs/decisions.md`.

## 0. Governance and synchronization

- The GitHub repository should be the authoritative, version-controlled source of truth for both Claude Code and ChatGPT, not either model's memory.
- Distinguish **Approved**, **Experimental**, **Deferred**, **Recommended—not approved**, and **Needs audit verification**.
- For every decision, track rationale, dependencies, implementation status, acceptance criteria, and superseded behavior.
- Do not delete or broadly refactor existing code before preserving a recoverable baseline, auditing dependencies, and approving a staged plan.
- When this document conflicts with actual code, report the conflict. Code is evidence of implementation, not authority over newer approved design.
- AI tools should propose and document changes, but material game-design changes require human approval.

## 1. Product identity and commercial scope

**Approved:** TypeL is a typing-first fantasy wizard arcade game. Skillful typing, spells, scoring, environmental behavior, and audiovisual feedback should feel like one coherent world.

**Approved:** Eighteen Ninjas is the public-facing indie studio brand. Development is primarily by one human, using AI assistance for implementation and assets.

**Approved:** Target a **paid, complete Steam release**, not a feature-incomplete launch dependent on DLC. Planned post-release themed DLC may add relics, stages, and gameplay variety; avoid firm public promises of features or dates before scoping them.

**Approved:** Development capacity is variable, approximately **20–35 hours/week**.

**Planning estimate, not commitment:** approximately 9–15 months for a polished first release, highly uncertain until repository audit, vertical slice, and production velocity are measured.

## 2. Release architecture and scope boundaries

### Green — intended first-release scope (approved)

1. **The Academy:** pure typing trial → spell lessons → examinations → Grandmaster; culminates in graduation.
2. **Graduation:** completes the teaching arc and unlocks the learned spell toolkit and advanced play.
3. **Arcade & Practice:** pure typing, spell-enabled survival, targeted practice, personal records, and consistent core scoring.

**Important distinction:** Green is the intended complete first-release scope, not the first playable milestone.

### Yellow — explore, do not assume full launch commitment

**Arcane Trials:** intended 15–20 minute runs with authored distinctive stages, curated randomness, challenge tiers, and exploratory relic discovery. Prototype one representative run to validate its value and architecture before committing to the full mode.

### Red — future consideration

The expanding playground: additional relics, replay variations, Grimoires, higher Stakes, expanded medals/secrets and other future content. Keep architectural extensibility without implementing all of it now.

**Approved nuance:** include a **small curated initial set of relics** in the base game to prove the expansion system. **3–5** is a recommendation for playtesting, **not a finalized count**. Relics should add meaningful variety and never be required to make the base game feel complete.

## 3. Approved gameplay philosophy and mechanics

- **Typing is primary.** Default normal play should not use number-key instant spell casting; typing and learned command words are central.
- **Spell commands are fixed and memorable**, independent of the word printed on a captured spell scroll (e.g. `SLOW`, `ICE`). Players should learn the commands as a skill.
- **Deferred modifier idea:** a future campaign stage may require casting with the specific captured scroll word; this is not the default rule and is not approved for immediate implementation.
- **Spell cadence hypothesis:** spells should feel frequent, initially around 10–15 seconds between opportunities, potentially 5–10 seconds if testing supports it. This is an experiment, not locked balance.
- **Combo and Volley:** preserve their existing intended roles in rewarding accuracy, consistency, and flow. Volley should require meaningful buildup rather than granting a multiplier on the first successful word. Earlier direction called for at least a two-word trigger. Exact implementation and thresholds must be recovered from the current Game Bible and repository.
- **Screen-clear fairness:** players who clear all available scrolls should not be punished by unavoidable inactivity while waiting for new targets. The capture/flow rules need to respect this; preserve precise existing decisions during audit.
- **Academy opening:** a legitimate spell-free typing trial teaches word capture and scoring. Pressure escalates naturally; highly skilled players can succeed. It must not rely on a scripted unavoidable failure.
- **Chronomancer:** teaches fixed-command `SLOW`; the subsequent Temporal Trial tests the spell without requiring mandatory casts to pass.
- **Teaching structure:** challenge → lesson → examination. Apprenticeship bosses may be the teachers themselves, testing both newly learned and previously learned tools. Graduation culminates in a Grandmaster trial.
- **Spawning as difficulty:** use more than spawn rate—location, pattern, movement, timing, and suspended scrolls can shape challenges. Six previously discussed spawning behaviors should be recovered exactly from prior design records, rather than guessed here. Randomly scattered suspended scrolls with variable hold durations before dropping are approved for exploration/adoption.
- **World grounding:** where intuitive, fire, water, ice, time, void, and other forces should interact in physically legible ways (e.g., water douses fire), without forcing a large physics simulation.
- **Word-bank personality:** include carefully selected typing-culture words and references; secret achievements and recognition of accuracy, consistency, and flow are favored. Preserve the detailed approved word additions from the source documents.
- **No arbitrary redesign:** do not invent new scoring formulas, spell lists, or difficulty curves where exact approved specifications exist elsewhere. Reconcile those first.

## 4. Production model

**Approved philosophy:** game design, visual art, audio, world logic, and engineering must be planned synchronously around playable stage experiences. Avoid making complete asset libraries before testing a representative slice.

Every stage brief should specify:
- Player experience and learning objective
- Mechanics, scoring, spawn behaviors, difficulty and win/loss criteria
- World setting, magical logic, teacher and environmental reactions
- Visual composition, safe gameplay zones, layers, VFX and animation
- Audio ambience, musical states, SFX, voice lines and mix priorities
- Required code/data systems, performance limits and platform compatibility
- Asset inventory, provenance, commercial-use rights and acceptance tests

**Proposed phase sequence:** 00 audit/design reconciliation; 01 desktop-ready technical foundations; 02 integrated vertical slice; 03 Academy production; 04 Arcade/Practice; 05 Arcane Trials experiment; 06 desktop/Steam integration; 07 polish/QA; 08 store/launch/support. Workstreams can overlap, and exact schedule is not fixed.

**Vertical slice proposal:** the Academy's first spell-free trial and first Chronomancer lesson. This tests pure typing, spell acquisition, world reaction, audio, visuals, teaching, and browser/desktop behavior together.

## 5. Visual direction and AI asset workflow

**Approved direction:** layered 2D as default, with expressive character/environment animation and selective 3D only where justified. Peggle 2 is a reference for polished, theatrical arcade feedback and characterful presentation—not a mandate to copy its artwork.

- Preserve gameplay readability during active typing; reserve bigger spectacle for meaningful rewards, examinations, and victory moments.
- Use current prototype screenshots and footage as **primary style authority** before finalizing prompt language. Do not invent a replacement style from generic fantasy references.
- Google Flow is a planned tool for concept and source-asset generation; outputs need editing, isolation, optimization, animation preparation, and validation before game use.
- Stage art workflow: prototype reference pack → style bible → stage concept → approved composition → individual layered assets → animation/VFX source → cleanup/export → in-game validation.
- Each stage needs an initial concept prompt and separate refinement prompts for its individual assets, always inheriting the approved visual language.
- Record generation tool, model/settings where available, date, original files, edits, usage rights, commercial license review, and any Steam disclosure relevance.

**Prompt backbone (to refine using screenshots):**
> Use the attached approved TypeL prototype screenshots as the primary visual authority. Match their palette, rendering treatment, materials, lighting, proportions and visual density. Design [STAGE/ASSET] for [GAMEPLAY PURPOSE], with [WORLD LOGIC], [CAMERA/PERSPECTIVE], and [SAFE GAMEPLAY AREA]. Avoid text, HUD, extraneous objects, and stylistic drift. Produce a clean source suitable for further game-asset processing.

## 6. Audio identity and synchronized sound design

**Approved direction:** restrained magical atmosphere emphasizing typing, spellcasting, and world sounds, with original adaptive musical responses that grow during sustained skillful performance. Compare this against a minimal atmospheric baseline before committing to full soundtrack production.

- Keep sound effects legible and tactile; do not make typing a forced rhythm game.
- A small, consistent sound palette should support word captures, Combo/Volley, spells, environmental behavior, misses, victory, and teacher/announcer performances.
- Potential music states: quiet focus → momentum → mastery, with a stronger celebratory payoff. These are audio states, **not** new gameplay tiers.
- Game logic should publish authoritative events; music, VFX and voice respond to the same events rather than maintaining divergent state.
- Audio architecture should provide separate controls/mix priorities for typing/capture, spells, ambience, music, voice and UI.
- User will record announcer lines and wants a repeatable, fixed voice-modification preset (e.g. EQ, compression, restrained pitch/formant effects, character processing, limiter), preserving a consistent vocal identity. Prepare approved scripts, trigger/priority rules, alternate takes, subtitles and production metadata.
- Audio tools and Google Flow may provide original source material, subject to rights and technical suitability. Keep editable DAW projects, stems, dry recordings, presets and licenses.

### AUDIO-EXP-001 — Approved controlled prototype

**Purpose:** Compare (A) restrained atmospheric baseline with (B) hybrid word-capture audio that adds melodic responses during sustained performance.

**A — baseline:** ambience, essential gameplay cues, crisp non-melodic word capture, no performance-driven musical layers.

**B — hybrid:** identical ambience and essential feedback, plus subtle harmonic notes/textures tied to completed words and sustained Combo/Volley signals. Richness increases with demonstrated flow; fades naturally as it subsides.

**Non-negotiable invariants:** no changes to word capture, typing, scoring, Combo, Volley, spells, spawning, stage progression or input responsiveness. No audio-dependent gameplay outcomes.

**Special case:** when a skilled player clears the screen, musical texture may decay gracefully without falsely prolonging gameplay Combo/Volley state.

**Implementation:** read-only gameplay event adapter → switchable audio profile controller → shared mixer; configurable response thresholds, voice limits, volume, mute, graceful audio suspension/recovery. Use small synthesized/sample placeholders first, not a full score.

**Testing:** matched short sessions, preferably seeded, with reversed A/B order; measure satisfaction, flow, clarity, distraction, fatigue, typing accuracy, performance and technical overhead. Hybrid succeeds only if benefits do not meaningfully harm precision or concentration.

**Scope exclusion:** do not use this experiment to redesign the whole audio engine, create final teacher/announcer assets, or modify mechanics.

## 7. Engineering and desktop/Steam path

**Approved objective:** the current browser prototype must become a desktop game suitable for Steam, ideally without maintaining two separate game implementations.

**Provisional recommendation, subject to audit:** Tauri 2 wrapper around the existing web technology, with a platform-independent game core and platform adapters for input, saves, fullscreen, Steamworks and other desktop services. Preserve the current renderer unless evidence supports changing it.

- Test keyboard focus, key handling, latency, input-method behavior, refresh rates, scaling, fullscreen, audio timing, offline operation and sleep/resume early.
- Use versioned local saves with migration; Steam Cloud and achievements are optional release decisions, not assumed requirements.
- Prefer data-driven stage, spell, word-bank, spawn and relic definitions.
- Start with Windows as the primary supported desktop platform; evaluate others later.
- Preserve a browser build for fast iteration and packaged desktop builds for platform tests.
- Steam release work includes partner onboarding, tax/banking, store assets, packaging, licensing, AI-content disclosures as applicable, QA, release/rollback procedures.
- Do not assume generated media automatically carries exclusive or commercial distribution rights; verify current tool terms and Steam requirements.

## 8. Audit and migration protocol

Claude's context-protocol audit is in progress. **Do not interrupt it or launch major changes until complete.**

After completion:
1. Preserve working baseline with a Git tag/branch.
2. Inventory code, features, tests, assets and dependencies.
3. Reconcile the approved direction with the current implementation.
4. Classify each conflict: retain, refactor, replace, remove, defer.
5. Record dependencies and regression risk.
6. Propose ordered milestones and acceptance criteria for human approval.
7. Implement incrementally and verify browser/desktop gameplay parity.
8. Run AUDIO-EXP-001 only after relevant event/audio architecture is understood.

## 9. Decision register (condensed)

| ID | Decision | Status |
|---|---|---|
| PROD-001 | Paid, complete Steam release under Eighteen Ninjas | Approved |
| PROD-002 | 20–35 hours/week variable solo capacity | Approved planning input |
| SCOPE-001 | Academy + Arcade/Practice green | Approved |
| SCOPE-002 | Arcane Trials yellow exploration | Approved |
| SCOPE-003 | Expanding playground red/future | Approved |
| RELIC-001 | Small initial relic set; themed DLC extensibility | Approved principle; exact count/design open |
| GAME-001 | Typing primary; fixed dedicated spell commands | Approved |
| GAME-002 | Spell-free, fairly escalating first trial | Approved |
| GAME-003 | Chronomancer `SLOW` lesson + nonmandatory-cast Temporal Trial | Approved |
| GAME-004 | Challenge → lesson → examination → Grandmaster | Approved |
| GAME-005 | Combo/Volley flow fairness, meaningful buildup | Approved; exact formula audit required |
| GAME-006 | Diverse spawn behaviors and suspended scrolls | Approved direction; full taxonomy audit required |
| GAME-007 | Intuitive world/elemental interactions | Approved principle |
| GAME-008 | Captured-word-dependent spellcasting stage modifier | Deferred idea |
| VIS-001 | Layered 2D with expressive animation; selective 3D | Approved |
| VIS-002 | Prototype references anchor Flow prompt style | Approved |
| AUD-001 | Atmospheric soundscape + restrained adaptive musical response | Approved direction |
| AUD-002 | A/B hybrid word-capture experiment AUDIO-EXP-001 | Approved experiment |
| AUD-003 | User-recorded announcer with fixed repeatable processing | Approved approach |
| TECH-001 | Browser-to-desktop Steam architecture | Approved objective |
| TECH-002 | Tauri 2 as desktop wrapper | Recommended; audit-dependent |
| GOV-001 | Repository as shared source of truth; decisions versioned | Recommended for adoption |

## 10. Unresolved items and explicit non-assumptions

- Exact current spell inventory and balance; current word-bank contents; six spawn behaviors; Combo/Volley equations and capture windows; current asset style and sound files: **recover from the repository and prior approved Game Bible**.
- Exact Academy stage count, teachers, level progression and stage durations: **not finalized here**.
- Exact relic count, effects, discovery/unlock behavior and DLC format: **requires design review and testing**.
- Audio musical palette, harmonic system, thresholds and final production tools: **to be established by controlled experiment**.
- Desktop framework, current rendering/audio stack and feasibility: **await audit**.
- Final Steam launch date, price, achievements, cloud saves and supported OSes: **not approved**.
- AI-generated content commercial terms and Steam policies: **verify at production/release time**.

## 11. Immediate next actions

1. Complete Claude's current context-protocol audit.
2. Supply this document to Claude as **proposed canonical production context** and request a reconciliation report, not immediate implementation.
3. Cross-check missing exact mechanics against repository and historical approved design artifacts.
4. Approve the reconciled Production Bible and commit it to GitHub.
5. Establish a repeatable ChatGPT ↔ GitHub ↔ Claude workflow: changes proposed in chat, approved by human, committed in repository, then read by both assistants.
6. Build desktop baseline and vertical slice; run AUDIO-EXP-001 as a controlled, reversible experiment.

---

**Integrity note:** This document consolidates known conversation decisions and recommendations. It is not a verified audit of the current source code, and should not replace the existing Game Bible until reconciled. Any unlisted mechanic should remain unchanged pending review.

## 12. Amendments (owner-approved, recorded in `docs/decisions.md`)

- **2026-11-23 · D-107:**
  - **Number-key casting is removed completely**, in every mode. Typing is always the input; relics are also expected to use typed names (refines GAME-001, §3).
  - **The Academy opens with the spell-free challenge.** Its chaos escalates until spells are needed. Apprenticeships provide the tools and lessons, and are not each preceded by a challenge (refines GAME-002 and GAME-004).
  - **Advanced spawn behaviours belong to Arcane Trials**, subject to change if testing shows apprenticeships benefit (refines GAME-006, SCOPE-002).
  - **"Volley" is renamed Rush** (player-facing "Arcane Rush"). Read "Volley" in §3, §6 and GAME-005 as Rush (refines GAME-005, AUD-002).
- **2026-11-23 · D-108:**
  - **No clicking during gameplay;** clicking is allowed only in menus. Typed menu navigation with an always-active typewriter is an idea to explore (refines GAME-001).
  - **The flow multiplier stays "Arcane Rush"** (refines D-107's rename).
- **2026-11-23 · D-109:** the six spatial spawn behaviours and Suspended Scattered Spawning are recovered and recorded. They belong to Arcane Trials per D-107 (completes GAME-006's recovery; numbers stay Experimental).


- **2026-11-23 · D-113:** Conceptual spell identities approved (GAME-007): SHOCK = guaranteed local conduction with increasingly unlikely extra cluster hops; WIND = physical repulsion preserving threats (pure-repulsion prototype first, healing/All-In unresolved); SLOW = manageable momentum without indefinite stacking; ICE = emergency total stop retaining threats; FIRE = decisive destructive cleansing. Numerical effects, scoring and implementation conflicts remain open. BARRIER, ALTER and HARVEST are pending identity review.
