# Development Log

Newest entries at the top.

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
