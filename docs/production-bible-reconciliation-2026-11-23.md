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
| GAME-001 typing primary; no number-key casting in default Normal | Typed spell names cast in both modes (Verified). **Normal also casts with keys 1–8** (`PlayScene.bindInput`, `GameEngine.quickCast`, tested in `tests/spells.test.ts`) | **Yes** | Refactor | Turn number-key casting off in default Normal. Keep the reserved spell words. Whether an opt-in setting remains is open (Q-12) |
| GAME-002 spell-free, fairly escalating first trial | Apprenticeship 1 teaches Slow from its first second (`learnedSpells(1)`). "Typing Trials" is a separate speed-test mode | **Yes** | New | Add a spell-free opening trial before the Slow lesson. Escalation must be fair and survivable by skilled players, with no scripted failure. Typing Trials stays as practice |
| GAME-003 Chronomancer teaches `SLOW`; the Temporal Trial doesn't require casts | Slow teacher is "Master of Time", boss "The Unwinding Clock" (`src/typel/apprenticeship.ts`). "Chronomancer" in `docs/lore.md` and D-042 is an older, removed wizard with Rewind | **Names** | Refactor | Rename to Chronomancer and the Temporal Trial. Retire the old Rewind Chronomancer meaning. Check pass rules don't require casts (D-103 already says so) |
| GAME-004 challenge → lesson → examination → Grandmaster | Each apprenticeship runs Learn → Master → Boss (D-102). The finale is the "Final Examination" by the "Grand Wizard"; D-103 says "Headmaster" | **Order and names** | Refactor | Rename the final figure to Grandmaster. Whether each apprenticeship opens with a challenge before the lesson is open (Q-13). The Bible (§10) leaves stage count, teachers and durations unfinalized |
| Graduation unlocks the toolkit and advanced play | D-103: graduation unlocks the "Arcade Campaign". Not implemented | Partly | Refactor | Keep graduation. What it unlocks follows the SCOPE rows below |
| SCOPE-001 Academy + Arcade & Practice (green) | Sandbox (each apprenticeship's Endless), Typing Trials and the legacy Practice mode (`main` only) | Partly | Refactor | Build Arcade & Practice from the existing Endless, Sandbox and Typing Trials. Add spell-free survival, targeted practice and personal records |
| SCOPE-002 Arcane Trials (yellow) | D-103's "Arcade Campaign" (authored stages, advanced scroll types). Not implemented | **Yes** | Replace | D-103's Arcade Campaign is superseded as a committed launch mode. Its ideas move into the Arcane Trials prototype (one representative 15–20 minute run first). Where the advanced spawn behaviours live is open (Q-14) |
| SCOPE-003 expanding playground (red); RELIC-001 small relic set | No relic system exists | — | Defer / New | Keep the architecture extensible. Design 3–5 relics with Arcane Trials, after the vertical slice |
| GAME-005 Combo/Volley buildup and screen-clear fairness | Implemented. The Rush multiplier starts on the second timely perfect word (D-060). Window: 52 + 13 ticks per letter in Normal, 34 + 10 in Hardcore (`ArcaneVolley.ts`). The clock pauses on an empty field with one 0.4 s grace (D-067). Player-facing name: Arcane Rush (D-086) | Name only | Retain | Keep the mechanics exactly as built. The player-facing name, "Volley" (Bible) or "Arcane Rush" (D-086), is open (Q-15) |
| Spell cadence: one cast every 10–15 s, maybe 5–10 s | Director pressure exists. Cadence is not measured | — | New (measure) | Add cast-interval telemetry to the simulation harness, then tune toward the hypothesis. It's not a quota (D-105) |
| GAME-006 diverse spawn behaviours; suspended scrolls | Spawning varies by length, speed, Director events and the Wind/Harvest scroll types. **The "six behaviours" aren't recorded anywhere in the repo.** Suspended scrolls aren't implemented | Missing source | Defer, then New | Recover the six behaviours from the owner or ChatGPT records before any design (Q-16). Prototype suspended scrolls with variable hold times inside the D-058 rules (no word-selection bias) |
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

**M1 — Small reconciliation fixes** (Bible phase 00). Do these on dev:
1. Merge the `81bedb5` word additions; test for spell-name clashes.
2. Turn off number-key casting in default Normal (GAME-001). Update the HUD
   and Codex labels, `tests/spells.test.ts`, and decide Q-12.
3. Renames: Chronomancer, Temporal Trial, Grandmaster.
4. Fix the stale "level"/"stage" spell text (Q-9).

*Accept when:* tests pass; spells can still be typed in both modes; no
number key casts in default Normal.

**M2 — Desktop foundations** (phase 01):
1. Self-host the fonts.
2. Windows Tauri 2 spike, with the input and timing checklist from Bible §7.
3. Versioned save-migration test.

*Accept when:* the same build plays offline in the browser and the desktop
shell, with no measurable input-latency regression.

**M3 — Vertical slice** (phase 02), the Bible §4 proposal. Spell-free
opening trial → Chronomancer `SLOW` lesson → Temporal Trial, integrated with
visuals, audio and teaching. *Prerequisites:* the six spawn behaviours
(Q-16) and the six-channel audio split.

*Accept when:*
- skilled players can pass the opening trial without scripted failure;
- the Temporal Trial passes without mandatory casts;
- browser and desktop play the same.

**M4 — AUDIO-EXP-001**, once the M3 event adapter exists.

**Later phases** follow Bible §4 (03 Academy production → 08 launch) and get
planned after M3, using the velocity measured there.

## Open questions this creates

They are listed in [`open-questions.md`](open-questions.md):
- **Q-12:** keep number-key casting as an opt-in setting, or remove it?
- **Q-13:** should each apprenticeship open with a challenge?
- **Q-14:** where do advanced spawn behaviours live?
- **Q-15:** Volley or Arcane Rush?
- **Q-16:** the six spawn behaviours, and the "prior approved Game Bible"
  that the Bible §10 refers to.
