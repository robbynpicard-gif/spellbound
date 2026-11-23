# AGENTS.md — rules for every AI assistant working on TypeL

These rules apply equally to ChatGPT, Claude, Codex and any other assistant.
`CLAUDE.md` only points here. Do not keep a separate, private definition of
the game in a conversation or handoff: the repository is the shared memory.

## 1. Start here, every session

1. `git fetch` and look at the branch you will work on. Two lines exist
   (verify, they change):
   - `main` — the stable game, published at the Pages root. It is the
     older 5-stage × 20-level campaign build.
   - `dev/apprenticeship-prototype-20261119` — the TypeL apprenticeship
     prototype, published at `/preview/` by the `main` Pages workflow.
     Almost all current design work lands here.
2. Read [`docs/production-bible.md`](docs/production-bible.md), the
   owner-approved design source of truth (D-106), and its reconciliation
   plan, which says what is built, what conflicts and what comes next.
   Then read [`docs/README.md`](docs/README.md): which documents are
   current, which are historical, and the current-state snapshot.
3. Read [`docs/system-map.md`](docs/system-map.md) for where each
   mechanic lives in code and its status.
4. Read the newest entries of [`docs/decisions.md`](docs/decisions.md)
   (the bottom of the file) and [`docs/open-questions.md`](docs/open-questions.md).

## 2. Source-of-truth hierarchy

| Question | Authority (highest first) |
|---|---|
| What is implemented? | Source code on the branch in question → automated tests → observed play on the deployed build. Never assume a branch, its tests and its deployment agree without checking. |
| What is intended? | Latest explicit owner decision → `docs/production-bible.md` (D-106) → accepted entries in `docs/decisions.md` that the Bible doesn't contradict (newer beats older) → the current documents listed in `docs/README.md`. Where the Bible is silent, existing decisions and mechanics stay unchanged. |
| Context only | Documents marked **HISTORICAL**, dated handoffs, prototypes, old conversations. They never override the two rows above. |

A proposal is not approved because it is written down. Code is evidence of
implementation, not of approval.

## 3. Status vocabulary

Label every significant claim or proposal with one or more of:

- **Implemented** — present in source code (name the branch and file).
- **Verified** — confirmed by a passing test or direct observation (say which).
- **Approved** — explicitly accepted by the owner (cite the decision).
- **Proposed** — awaiting owner approval.
- **Experimental** — built for evaluation, not permanently adopted.
- **Superseded** — replaced by a newer decision (cite it).
- **Deferred** — accepted as an idea, deliberately not scheduled.
- **Recommended — not approved** — advice awaiting an owner decision.
- **Needs audit verification** — claimed somewhere, not yet checked
  against code or records.

Cite Production Bible item IDs (e.g. GAME-001) next to D-numbers.

They combine: "Approved, not implemented" and "Implemented, not verified" are
both normal. For deployment, say **not deployed / preview verified /
production verified**, with the commit. A push or a merge is not proof of
deployment.

## 4. Mandatory verification workflow

Before proposing or implementing a gameplay change:

1. Identify the affected mechanic.
2. Inspect its source code (start from `docs/system-map.md`).
3. Review its tests.
4. Read the current design documents for it.
5. Check `docs/decisions.md` for newer accepted decisions, on **both**
   `main` and the dev branch.
6. State existing behaviour and intended behaviour separately.
7. Decide whether a change is actually needed.
8. List dependencies and likely regressions.
9. Present the recommendation with its status labels (§3).
10. Implement only after the owner approves; then update tests and the
    documents in §6 in the same change.

Never conclude a feature is missing because a conversation didn't mention
it. Search the code first.

## 5. Standing constraints

- Don't redesign existing functionality without first verifying how it works
  now and getting owner approval (D-058). Don't invent scoring formulas,
  spell lists or difficulty curves where an approved specification exists;
  recover it instead (Bible §3, §10).
- Material design changes, including any change to the Production Bible,
  need the owner's approval and a new `docs/decisions.md` entry.
- Don't bias word generation to make rewards happen (D-058). Keep the
  simulation deterministic: fixed tick, seeded RNG, replayable (D-004, D-005).
- Spell commands are fixed words (GAME-001). Typing the spell name + Enter
  casts in every mode. Number keys 1–8 still quick-cast in Normal today, but
  GAME-001 removes them from default Normal (planned, M1). Spell names are reserved, so no falling
  word may equal, start with, or prefix one (`src/data/wordList.ts`). Don't
  add a new casting mode (e.g. Tab) or change targeting without a verified reason.
- Don't change production (`main`) or merge into it without explicit owner
  consent. Run `npm run check` before every commit that touches code.
- Never report work as done, tested or deployed unless you did it and saw
  the result. If you couldn't check something, say so.

## 6. Keeping the shared context current (part of every change)

When a change alters a mechanic, a rule, a file layout or a status, update
in the **same commit or PR**:

- `docs/system-map.md` — the affected row (files, status, tests).
- `docs/decisions.md` — append a new entry; never rewrite an old one.
  Mark superseded entries by adding a new entry that names them.
- Player-facing rule text that the code ships (`src/data/spells.json`,
  the Codex) when the rule changed.
- `docs/open-questions.md` — add new questions; move answered ones to
  "Resolved" with the decision ID.
- `docs/README.md` — classify any new document, and refresh the
  current-state snapshot if it changed.

**Decision numbers:** before adding one, find the highest ID on every branch
(`git fetch origin && git grep -h -o 'D-[0-9]\{3\}' $(git branch -r --format='%(refname:short)') -- docs/decisions.md | sort -u | tail -1`)
and use the next number. If two sessions collide, renumber the newer one and
leave a note (see D-101).

**No new standalone handoff documents.** Put durable facts in the files
above. A dated report (audit, simulation, playtest) is fine, but it must be
listed in `docs/README.md`.

Run `npm run docs:check` (no install needed) before committing doc changes.
CI runs it too (`.github/workflows/docs-check.yml`).

## 7. Commands

`npm run dev` (http://localhost:5173) · `npm test` · `npm run check`
(typecheck + tests + build) · `npm run docs:check` · `npm run server`
(multiplayer server, local only).
