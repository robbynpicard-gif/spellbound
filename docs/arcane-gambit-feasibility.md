# Arcane Gambit — emergency-scroll feasibility experiment

**Status: PROTOTYPE ONLY / NOT APPROVED FOR LIVE GAMEPLAY.** D-058 governs. Implemented offline in `src/gameplay/ArcaneGambitPrototype.ts` with deterministic tests. Nothing is connected to `GameEngine`, `GameScene`, UI, saves, scroll drops or production.

## Recovering the actual brainstorm

Two different ideas were discussed and should **not** be conflated:

1. **Ordinary Summon:** a low-density batch of ordinary falling words/scrolls, potentially repeatable on a cooldown; captured items still require typing and count toward quota. This is an offensive or tempo-oriented action, not an emergency rescue.
2. **Arcane Gambit / emergency hail-Mary:** a **separate long-cooldown slot-machine ability**, used when the player is overwhelmed and their spell backlog is depleted. Activating it summons **one random spell-bearing scroll**, not a directly usable spell charge. The player must type and capture that scroll; it may not be the spell they need. The original discussion floated **90–120 seconds of active gameplay** for its cooldown. Ordinary natural scroll drops remain the primary source of spells.

The user now clarifies they envision a **separate bank of cooldown-style scrolls/arcane abilities**, possibly spending a charge to call down a random scroll in a crunch. That is a feasibility question, **not** permission to alter the live game.

## Implemented, isolated thought experiment

The prototype models a *hypothetical separate Gambit charge*, a 90-second fixed-tick cooldown, and one uniformly random spell ID from the existing eight spells. It refuses requests on cooldown or without a charge. It returns a **spell identity for a hypothetical falling scroll**, not a cast, a free spell charge, or an actual spawned word. The seed is independent of the engine RNG. Tests check deterministic outcomes, charge/cooldown safety and that different seeds do not guarantee the same spell.

**Not modeled:** how Gambit charges are earned; where summoned scrolls spawn; whether the player can capture them under pressure; visual readability; whether Ice halts their fall; how the summoned scroll interacts with the existing full spell pool; whether the random distribution should match natural drop weights; or how this affects campaign balance. The 90-second timer, charge economy and uniform roll are **test assumptions, not approved values**.

## D-058 viability assessment

**Potential upside:** a desperate, uncertain choice can create memorable moments. Keeping the prize as a falling scroll preserves the typing requirement, and an independent seeded RNG can preserve deterministic replays.

**Major risks:**
- **Overlaps existing spells and scroll collection:** an additional button/charge bank competes with the existing eight-charge shared pool and Spellbook.
- **Emergency usability paradox:** summoning *another falling word* when already overwhelmed can make a bad situation worse. A random scroll may be irrelevant, unreachable or immediately lost.
- **Two resource economies:** if Gambit charges are earned or banked, the source, persistence, capacity and recharge behavior must be defined. Avoid silently awarding them for typing achievements or manipulating word spawns.
- **Pressure on the core loop:** UI controls, cooldown displays, target selection and on-field clutter can reduce typing clarity.
- **Balance:** an extra source of spells could reduce the intended significance of natural scroll drops, especially at bosses.
- **Misleading reliability:** a synthetic RNG test proves deterministic bookkeeping, **not** that the feature is fun or viable.

## Recommendation and stop condition

**Do not integrate yet.** The offline implementation is intentionally cheap to abandon. Before a live prototype, explicitly decide whether a separate bank earns its complexity relative to the existing spell pool. If it needs boosted scroll drops, automatic captures, altered target locks, or softened difficulty to feel useful, **abandon it under D-058** rather than contort Typal around it.

If the owner wants to proceed with a *preview-only, reversible* player trial, seek explicit approval for the following **three** changes together: (1) an independent Gambit charge economy and its acquisition method, (2) one activation input and cooldown indicator, (3) spawning one ordinary capturable scroll using existing word-generation and target rules. Keep normal and production behavior unchanged until the experiment proves useful. Do not bundle Ordinary Summon into this trial.

**Next best step:** evaluate whether the existing shared spell pool can deliver the same last-second decision without an extra bank, using a side-by-side design sketch and usability criteria, before adding any gameplay code.
