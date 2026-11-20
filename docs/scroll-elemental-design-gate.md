# D-058 design gate — Scroll bank and elemental interactions

Status: **audit and proposal only; no new gameplay behavior approved** (2026-11-20). This is a shared handoff for ChatGPT, Claude, and other contributors. Preserve the accepted rules in `docs/decisions.md` (especially D-048, D-049, D-054, D-057, D-058) unless the owner approves a superseding decision.

## Current systems: confirmed in code

- **Scrolls already exist as drops:** `GameEngine` rolls `config.spellDropChance` and selects from available spells using `dropWeights`. The latest accepted decision specifies **14.4% of words** for scroll drops; individual mode/config values remain authoritative. Capturing a scroll word grants a spell charge if capacity permits; full-pool overflow has its existing consolation behavior.
- **A bank already exists in a limited form:** `SpellManager` maintains a **shared pool of eight charges**, growing to 9/10/11/12 with clean captures under D-057. Spell charges are consumable and spells are invoked by typing their name and Enter, or quick-cast in Normal mode. This is not a separate inventory of deployable collectible scroll items.
- **Existing spells:** Slow, Ice, Barrier, Shock, Alter, Fire, Wind, Harvest. Their effects and spell weights are defined in `src/spells/SpellRegistry.ts` and `src/data/spells.json`. Do not introduce a ninth spell or modify drop weights in this audit.
- **Elemental logic already exists:** `ElementalReactions.ts` defines pure deterministic reactions (steam, extinguish, freeze, melt, conduct, shatter, fan, smother, disperse). `ElementalStatus.ts` tracks timed status. `GameEngine.castSpell` currently maps Fire, Ice, Shock and Wind into elemental status and emits an `elementalReaction` event when a defined pair occurs.
- **Important limitation:** `GameEngine` currently stores a **single workshop elemental status**, not elemental states per falling word or world object. Some reaction types involve Water, Earth, or Void even though these are **not castable spells** in the existing eight-spell registry. The reaction resolver is broader than the live interaction surface.

## Classification and decision

| Idea | D-058 classification | Action now |
| --- | --- | --- |
| Cosmetic Rune/Triumph for naturally observed spell usage or a naturally occurring reaction | Passive recognition | **Candidate for later**; no artificial spawning, charges, or scoring |
| Show existing spell charges more clearly in Spellbook / HUD | Presentation of approved mechanic | **Compatible**, subject to UI review; do not alter capacity |
| Explain existing elemental reactions in Codex/Spellbook, clearly distinguishing available from hypothetical | Documentation/presentation | **Compatible**; avoid implying unimplemented elements are playable |
| Separate deployable scroll inventory in addition to existing shared charges | Changes resource economy, input flow and decision-making | **Requires owner approval** |
| Let players pre-bank scrolls between levels/runs, craft or trade them | Changes progression, balance and persistence | **Requires owner approval** |
| Automatically spawn words/elements to make reactions or Rune triggers frequent | Alters typing game for secondary rewards | **Do not implement under D-058** |
| Make Water extinguish Fire on an actual world target | Intuitive elemental design, but needs target/state model and effect semantics | **Requires owner approval before gameplay implementation** |
| Add Water/Earth/Void as castable elements, or introduce per-word statuses | Expands spell roster and changes gameplay | **Requires owner approval** |
| Change reaction damage multipliers, Fire/Ice behavior, spell drop rates or shared pool | Balance changes to accepted mechanics | **Requires owner approval** |
| Add deterministic tests for existing elemental rules and spell-pool invariants | Safety guard; no player-facing changes | **Implement now** |

## Clarifications worth resolving before a scroll-bank implementation

1. **Meaning of bank:** Is the requested bank simply the existing shared spell-charge pool with clearer presentation, or a *separate* inventory of deployable scroll items?
2. **Scope:** Are stored scrolls limited to the current level, carried through a Campaign stage, or permanent between runs?
3. **Agency and cost:** Does deploying a scroll consume a charge, replace an existing cast, or create a new action? Each option changes the core loop.
4. **Elemental targets:** Should interactions occur between spells on the field, on individual words, or on distinct environmental objects? The current single-status implementation does not answer this.

Until the owner resolves these, **do not implement a second inventory, alter the existing charge pool, or add elemental gameplay effects**.

## Design-review checklist for every proposal

- Does this preserve natural word selection, timing, target locks, and typing responsiveness?
- Does it preserve the existing eight spells, scroll drop probabilities, and pool economics?
- Is the effect intentional, understandable to players, and compatible with deterministic replays?
- Is the new reward merely observing play? If so, can it remain rare?
- If any accepted behavior changes, has the owner explicitly approved the specific change and has a superseding decision been recorded?

**Recommended implementation after approval:** Start with a read-only Spellbook/HUD explanation of the existing charge pool and the *currently castable* elemental interactions. Evaluate a separate scroll bank as its own design proposal, not as a quiet extension of the Rune system.
