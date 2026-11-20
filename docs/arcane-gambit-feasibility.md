# Arcane Gambit — single emergency roll per stage

**Status: OFFLINE PROTOTYPE ONLY.** Not connected to the playable preview, GameEngine, UI, saves or production. Governed by D-058.

## Player's intended moment

The interesting decision occurs when the player has **run out of spells or is saving their last strategic charges**. They may choose to risk a single hail-Mary summon. A random spell-bearing scroll appears, and they must still type and capture it. The outcome may help or may be useless. **The gamble is the point**, not a guaranteed rescue.

The user explicitly wants this **simple**, and suggested **one use per stage** rather than a separate elaborate cooldown bank. That is the leading prototype assumption, not an approved live rule.

## Minimal offline implementation

`src/gameplay/ArcaneGambitPrototype.ts` models:
- One available emergency roll at the start of a stage.
- The roll consumes the opportunity, selecting one random existing spell ID with an independent seeded RNG.
- Further rolls in the same stage fail without consuming RNG.
- The next stage explicitly resets the opportunity.
- No cooldown timer, earned Gambit charges, extra scroll storage, score bonuses, spell changes, word-spawn bias, or alterations to the existing eight-charge pool.

The result is **not** a spawned word or a granted spell. A future playable trial would need to spawn a normal capturable scroll using existing targeting and typing rules. Tests cover determinism, one-use behavior, stage reset and uncertain outcome.

## Design comparison

| Criterion | Existing spell pool only | One-use Arcane Gambit |
| --- | --- | --- |
| Emergency agency when out of charges | No additional option | One uncertain option |
| Gameplay complexity | None added | One activation control, one stage-use indicator |
| Reward reliability | Existing held spells are known | Random scroll may be unhelpful |
| Typing remains central | Yes | Yes **if** scroll must be captured normally |
| New economy | None | One stage-limited opportunity; no recharge |
| Main risk | Few hail-Mary moments | Adds clutter under pressure and overlaps ordinary scroll drops |

## Kill criteria

Abandon the idea if it requires changing ordinary word frequency, targeting, word difficulty, spell balance or auto-capture to be useful; if the emergency scroll adds frustrating clutter; or if a one-time extra spell trivializes bosses. **Do not increase reward frequency to make the feature look successful.**

## Pending design authorization

The user has proposed, but not finalized, the once-per-stage rule. Before connecting the prototype to live preview, confirm **whether one use per Campaign stage is the intended rule**. Then build a reversible preview-only trial with a single activation control and a visible used/available state, retaining natural word capture and no changes to production. The prototype's uniformly random selection is also provisional; spell weighting should be decided before live testing.

**Next recommended step:** get the one-use-per-stage rule confirmed, then implement a small preview-only usability trial rather than a full new scroll-bank system.
