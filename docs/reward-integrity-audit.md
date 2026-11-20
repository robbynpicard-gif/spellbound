# D-058 audit — Runes, Triumphs, and word-related rewards

Status: **reviewed 2026-11-20**. Scope: current implementation on `dev/apprenticeship-prototype-20261119`. This audit documents observed code behavior; it does not authorize changing established scoring, spawning, or reward thresholds.

## Classification

| Reward family | Current source of eligibility | Player-facing effect | D-058 verdict |
| --- | --- | --- | --- |
| Volley Rune | Session peak Volley of 3+ words within 2 seconds (`earnedRuneIds`) | Collectible Rune seal | **Pass** — observes existing performance |
| Precision Rune | Clean streak of 10+ words | Collectible Rune seal | **Pass** |
| Chain Rune | Combo of 20+ words | Collectible Rune seal | **Pass** |
| Scribe Rune | 10+ captures at 98%+ accuracy | Collectible Rune seal | **Pass** |
| Rune finishes | 5 / 20 / 50 repeats of an earned Rune | Cosmetic wax/bronze/silver/gold seal appearance | **Pass** |
| Featured Rune | Select an already earned Rune | Cosmetic main-menu display | **Pass** |
| Lifetime Triumphs | 17 tiered definitions from authoritative lifetime counts (words, levels, wins, streaks, combo, existing bonuses, grammar captures and phrases) | Bronze/Silver/Gold progress and featured title | **Pass** — no new scoring modifiers |
| Grammarian's Ledger | Classified noun, verb, adjective, adverb captures; ambiguous words excluded | Cosmetic collection progress | **Pass** |
| Phrases of Power | Consecutive classified captures in noun→verb, adjective→noun, adverb→verb order; miss/unclassified capture breaks chain | Cosmetic phrase banner and lifetime Triumph progress | **Pass** — rarity acceptable |
| Existing Alliteration / Librarian / Metronome / Clean Sweep bonuses | Existing game-engine scoring events | **Score-affecting**, predates these cosmetic Triumphs | **Boundary / no change** — these are underlying scoring mechanics, not newly introduced achievement modifiers; any redesign requires separate owner approval |
| Experimental Wordcraft generator | Offline candidate biased toward compatible grammatical word sequences | Would change word selection if activated | **Rejected for live play** under D-058; no active GameScene wiring |

## Verified separation of concerns

- `GameScene` constructs `GameEngine` with the standard generator; the experimental generator injection hook is not supplied.
- `PhraseTracker` observes `wordCompleted` and breaks on `wordMissed`; it does not modify word generation, engine score or difficulty.
- `SaveManager.recordRunes` derives collectible awards from completed-session stats; earned Rune counts, finishes and featured choices are cosmetic.
- `triumphProgress` derives tier thresholds from lifetime counters; its role is display and unlock announcement.
- `trophyCaseScreen` explicitly identifies the grammatical patterns as cosmetic achievements, **not grammatical sentences**.

## Follow-up concerns, not implementation authorization

1. **Terminology:** The project uses *Rune* for repeatable collectible seals and *Triumph* for lifetime tiered feats. Preserve that distinction in future features.
2. **Existing scoring:** Some Triumphs track pre-existing score bonuses. Their underlying bonus mechanics are outside this cosmetic-only audit; do not conflate a score-affecting base mechanic with its cosmetic medal.
3. **Extremely rare grammar patterns:** Low unlock rates are acceptable. Do not manipulate the dictionary, target selection, or spawn order merely to raise counts.
4. **Potential future scrolls / elemental rewards:** Classify each proposal as *passive recognition*, *intentional approved gameplay mechanic*, or *design-changing proposal requiring approval* before writing code.
5. **Research archive:** The offline biased generator and tests can remain as historical experiments, but must not be reconnected to live preview or production without an explicit new decision superseding D-058.

## Implementation rule for contributors

Before changing a reward-related mechanic, answer: **(a)** Does this change what the player types, when it spawns, how it falls, or how it scores? **(b)** Is that change an already approved core mechanic? **(c)** Can the reward instead observe existing play without modifying it? If (a) is yes and (b) is no, stop and request owner approval. Prefer (c).
