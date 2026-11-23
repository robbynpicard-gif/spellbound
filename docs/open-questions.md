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
dev lacks (`81bedb5`, 44 new words in `src/data/words.json`). Should that
word-bank change be brought into dev? And when should dev's TypeL replace
`main`'s legacy campaign as the stable game?

**Q-3 · Shared docs on `main`**
The shared-context PR targets the dev branch, where the current decisions
are. `main`'s docs stay stale until dev is promoted. Should a docs-only copy
also go to `main` now?

**Q-4 · Preview workflow**
`docs/current-game-model.md` (2026-11-19) says no preview branch or
`/preview/` workflow without an owner decision. D-060 and
`.github/workflows/deploy.yml` show one in use. Please confirm the preview
workflow is approved, so it can be recorded as a decision.

**Q-5 · Normal quick-cast**
Owner direction recorded as D-105 says Hardcore's typed casting is the
preferred model for normal play. Today Normal also allows number keys 1–8,
in a fixed order (Slow, Fire, Ice, Barrier, Shock, Alter, Wind, Harvest).
The legacy game let players remap the keys (D-049 Spellbook); the preview
does not. Should Normal keep quick-cast, keep it with remapping, or drop it?
No change is made until you decide.

**Q-6 · Difficulty baseline and spell cadence (D-105)**
D-105 records your brief: the early game is too forgiving, late-game
pressure should inform the new baseline, the gentle opening may become an
intro phase, and casting roughly every 10–15 s is a balancing hypothesis.
Is that wording right, and should it now drive Director tuning?

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

**Q-9 · Stale player-facing rule text**
`src/data/spells.json` still says Barrier lasts "until the end of the level"
and that Wind scars clear "each level" or "for the whole stage". The
preview's apprenticeship hints say "Volley" where the player-facing name is
Arcane Rush. Those words no longer match a continuous run. This is shipped
game text, so it wasn't changed in this audit. It overlaps with D-103's
Barrier and Wind questions.

**Q-10 · Which dev branch is canonical**
`dev/apprenticeship-prototype-20261119` (deployed as the preview) and
`dev/continuous-apprenticeship-20261122` point at the same commit and
receive the same pushes. Should the second be retired so there is one dev line?

**Q-11 · Unused code on dev** (low priority)
`src/typel/render/Wizard.ts` and `Hands.ts` are no longer reached (superseded
by D-093). The legacy campaign code is compiled and tested on dev but not
reached by the preview. Keep both until dev is promoted, or plan a cleanup?

## Resolved

_None yet._
