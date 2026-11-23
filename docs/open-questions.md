# TypeL — open questions for the owner

One register for every question that needs an owner decision. Add new ones
at the end of "Open". When one is answered, move it to "Resolved" with the
decision ID that answers it. Design questions from D-103 are kept in their
own list and not copied here:
[`academy-campaign-canonical-gameplay-2026-11-22.md`](academy-campaign-canonical-gameplay-2026-11-22.md)
→ "Explicitly unresolved decisions for owner" (Ward healing, Barrier and
Wind lifetimes, graduation rules, Campaign access, boss retry, Campaign
scope, Endless entry).

## Open

**Q-1 · Repository name and URLs** (found 2026-11-22 audit)
D-099 says the repository became `robbynpicard-gif/TypeL` with the site at
`/TypeL/`. GitHub still reports `robbynpicard-gif/spellbound` at
`/spellbound/`. Should the repository be renamed as D-099 says, or should
D-099 be amended to keep `spellbound`? Until then, every `/TypeL/` link in
the repo is wrong.

**Q-2 · Bringing `main` and dev back together**
Dev is 49 commits ahead of `main`. `main` has one gameplay-data commit that
dev lacked (`81bedb5`, 44 new words in `src/data/words.json`); they're cherry-picked into dev in D-111. Still open: when should dev's TypeL replace `main`'s legacy campaign as
the stable game?

**Q-3 · Shared docs on `main`**
The shared-context PR targets the dev branch, where the current decisions
are. `main`'s docs stay stale until dev is promoted. Should a docs-only copy
also go to `main` now?

**Q-4 · Preview workflow**
`docs/current-game-model.md` (2026-11-19) says no preview branch or
`/preview/` workflow without an owner decision. D-060 and
`.github/workflows/deploy.yml` show one in use. Please confirm the preview
workflow is approved, so it can be recorded as a decision.

**Q-7 · Missing decision entries**
Code or docs cite decisions that aren't in `docs/decisions.md`: D-024
(Wizard Duels, cited in `server/match.ts`), and D-091 (key-art patch on an
unpushed branch, per D-092 and D-093; no `keyart` branch exists on GitHub).
D-074 and D-075 exist only as sections inside `docs/sandbox-interactions.md`,
not in the log. Should the missing entries be added to the log from these
sources, or recorded as "not recoverable"?

**Q-8 · Wizard Duels**
The server and client code exist and have tests, but no menu path reaches
`src/app/MultiplayerFlow.ts` on either branch. The README says duels work
locally. Keep the code as-is, wire it back in, or retire it?

**Q-10 · Which dev branch is canonical**
`dev/apprenticeship-prototype-20261119` (deployed as the preview) and
`dev/continuous-apprenticeship-20261122` point at the same commit and
receive the same pushes. Should the second be retired so there is one dev line?

**Q-11 · Unused code on dev** (low priority)
`src/typel/render/Wizard.ts` and `Hands.ts` are no longer reached (superseded
by D-093). The legacy campaign code is compiled and tested on dev but not
reached by the preview. Keep both until dev is promoted, or plan a cleanup?

**Q-16 · The original Game Bible** (Bible §10)
The six spawn behaviours are now recorded (D-109). Still missing: the
original "Wizzy Type — Game Bible for ChatGPT (v0.20.0)", a ten-page PDF
that ChatGPT located but that isn't in the repository. Please upload it, so
it can be added as a historical document and checked against newer decisions.

**Q-19 · Green-scope acceptance criteria** (from PR #13, D-110)
What are the release acceptance criteria, external playtest targets, release
timing and Steamworks/business checklist? Which relics, if any, go in the
base game (RELIC-001)?

**Q-20 · AUDIO-EXP-001 parameters** (from PR #13, D-110)
Bible §6 fixes the experiment's structure. Still undecided: the placeholder
sounds, response thresholds, session design and success metrics.

## Resolved

**Q-5 · Normal quick-cast:** resolved by D-106 (GAME-001). Default Normal
drops number-key casting. Whether an opt-in setting stays is Q-12.

**Q-6 · Difficulty baseline and spell cadence:** resolved by D-106. The
Bible §3 confirms the cadence hypothesis (10–15 s, maybe 5–10 s, not a
quota) and difficulty from spawning variety, not just speed. D-105 is absorbed.

**Q-12 · Number-key casting as an option:** resolved by D-107. Removed
completely; typing is always the input.

**Q-13 · Challenge before lesson:** resolved by D-107. The spell-free
opening challenge is the challenge; apprenticeships teach the tools.

**Q-14 · Where advanced spawn behaviours live:** resolved by D-107. Arcane
Trials, to be revisited if testing shows apprenticeships benefit.

**Q-15 · Volley or Arcane Rush:** resolved by D-107. Rush; "Volley" is retired.

**Q-17 · Clicking a word to target it:** resolved by D-108. No clicking
during gameplay; menus only.

**Q-16 (first half) · The six spawn behaviours:** recovered by ChatGPT and
recorded as D-109. The Game Bible PDF is still open (Q-16).

**Q-9 · Stale player-facing rule text:** resolved by D-111. The spell text
and hints now match the continuous run and the name Arcane Rush. Whether the
Barrier and Wind lifetimes are the right design remains in D-103's list.

**Q-18 · How the Academy opening fits the continuous run:** resolved for the
MVP by D-112. It is a separate, finite, spell-free stage with its own
results; falling still moves you on; score doesn't carry over.
