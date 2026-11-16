# Development Log

Newest entries at the top.

---

## 2026-11-16 — Milestone 1: Core gameplay prototype

**Done**
- Simulation (no Phaser): `GameEngine`, `GameState`, `GameEvents`,
  `WordGenerator`, `TargetManager`, `ScoringSystem`, `InstabilityManager`,
  `DifficultyConfig` + one `PROTOTYPE_LEVEL`, 427-word list.
- Presentation: `GameScene` (fixed-step loop with smooth interpolation),
  `WordView` (gold typed letters, target plate, red error flash + shake),
  `Effects` (spark bursts, floating points), `FieldBackground` (ward line and
  danger glow that change with instability stage), `GameHUD` (score, combo,
  words/quota, accuracy, WPM, instability meter), `OverlayPanel` (pause and
  end-of-game summary).
- Title screen now starts the game (Enter or click).
- Decisions D-010 to D-013 recorded.

**Verified**
- Typecheck, production build: clean.
- 35 unit tests pass, including: completion, auto-target choice, wrong-key
  acceleration, stray keys, Backspace, click targeting, combo scoring, miss →
  instability, loss at 100%, win at quota, max-words cap, and exact replay
  from the command log.
- In the browser: words spawn and fall; typing highlights letters and destroys
  words with effects; wrong keys flash red and speed the word up; Backspace
  and click targeting work; Esc pauses (simulation frozen); 10 misses end the
  game with the summary panel; Enter restarts. No console errors.
- Fixed during testing: small gap between typed and untyped letters (text
  outline width).

**Temporary / placeholder**
- Art is drawn with shapes; no audio yet.
- End-of-game panel stands in for the Milestone 2 Results screen.
- Scoring values are provisional (D-012).

**Not yet verified against the original:** wrong-key acceleration amount
and scope (research #4–5).

**Next:** Milestone 2 — campaign levels and difficulty. Needs decision D-008.

---

## 2026-11-16 — Milestone 0: Project foundation

**Environment found**
- Windows 11 Pro, Node.js 24.21.0, npm 11.19.0, Git 2.55.0, VS Code installed.
- Started from an empty folder; no existing files or Git repository.

**Done**
- Created `package.json` with dev/build/test scripts.
- Installed (exact versions): `phaser@3.90.0`; dev: `vite@8.3.8`,
  `typescript@5.9.3`, `vitest@5.1.0`.
- Added `tsconfig.json` (strict mode), `vite.config.ts` (GitHub Pages-friendly
  `base: './'`, Vitest config), `index.html`, `.gitignore`, `.gitattributes`.
- Created the folder structure from the GDD, plus `src/render/` and `tests/`
  (see decisions.md D-003).
- Wrote first simulation-layer modules: `core/GameConfig.ts`,
  `core/EventBus.ts` (typed events), `core/Random.ts` (seeded RNG).
- Wrote `BootScene` and a temporary `MainMenuScene` title screen to prove
  Phaser boots and animates.
- Unit tests for `SeededRandom` and `EventBus` (10 tests).
- Docs: README, GDD (copied from the brief), architecture, decisions, research
  plan, this log.

**Verified**
- `npm run typecheck` — no errors.
- `npm test` — 10/10 passing.
- `npm run build` — succeeds.
- `npm run dev` — page loads, Phaser 3.90.0 renders the title screen,
  no console errors.

**Temporary / placeholder**
- `MainMenuScene` is a title card only; real menu comes later.
- No art, audio or fonts yet; system fonts are used.

**Open questions**
- D-008: menus in Phaser or HTML/CSS? (Needed before Milestone 2.)

**Next:** Milestone 1 — core gameplay prototype.
