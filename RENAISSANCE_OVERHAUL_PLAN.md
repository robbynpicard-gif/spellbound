# TypeL — Renaissance Workstation Visual/Audio Overhaul

Status: approved scope for the development preview; implementation and deployment verification are separate milestones. Production `main` is frozen.

## Experience target
A playable Renaissance wizard's desk, not a new typing game: physical brass typewriter and parchment, warm timber, ink and candles, magic leaking into the room. The player sees a clear combat field and feels each word captured. Playability and responsive typing win over decorative complexity.

## Visual composition (1280 × 720 baseline)
1. **Upper 65% — living combat field.** Falling words remain readable and unobstructed. Ward line is unmistakable. No floating dashboard over word spawn lanes. Wizard/arched-window setting provides depth, not visual noise.
2. **Lower centre — hero instrument.** Large heavy brass/wood typewriter with parchment input, moving keys/typebars, carriage feedback and a visible active target. Mechanical motion is nonblocking and under 100ms for key-down feedback.
3. **Right — spell rack.** Physical scroll slots, clear charges and numbered shortcuts; magical response originates in the world, not solely the UI.
4. **Upper corners — compact instrumentation.** Score, combo, chain, instability and Volley progress, with meaningful contrast and no overlap with falling words.
5. **End screen — apprentice's ledger.** Highest combo, clean streak, Volley bonuses, best Volley in rolling two seconds, accuracy, WPM, score; a clear zero Volley state and guidance to earn more.

## Sound direction
- Keys: short woody thunk + brass typebar + restrained paper/carriage resonance; small deterministic pitch/volume variation, no input delay.
- Captures: layered snap/seal/chime; rising pitch/brightness on combo tiers and Volleys; do not stack loud effects during rapid typing.
- Errors: brief damped misstrike, not a buzzer.
- Elements: fire crackle, ice fracture, shock snap, time clockwork, void ambience ducking; semantic event routing through existing audio buses.
- Ambience/music: quiet study room; existing volume/mute controls remain authoritative.

## Delivery slices and acceptance
**0 — Reliable preview (must precede claiming success).** Verify GitHub Pages deployment, ensure /preview/ serves development branch, display build identifier sourced from the deployed build, confirm browser refresh and isolation from production saves. Build/test both branches.

**1 — Layout pass.** Recompose existing Phaser scene with readable combat field, coherent wood/brass/parchment framing, prominent physical typewriter and integrated spell rack. Screenshots at desktop and narrow viewport; no word occlusion.

**2 — Tactile pass.** Immediate key animation, responsive carriage/typebar motion, layered keys/captures/errors, and existing mute settings. Test fast typing for lost input and auditory overload.

**3 — Reward pass.** In-combat Volley callout at third capture in two seconds, escalating follow-on bursts, combo power feedback, score pop and end-of-level ledger. Volley 0 must be explicit and actionable.

**4 — World pass.** Small but readable elemental reactions and environmental changes, candle/ink/rune accents, short ceremonial level clear. Placeholder assets are allowed; gameplay must remain fully functional.

**5 — Review gate.** Run `npm ci && npm run check`, verify deployed preview URL, complete a campaign level with sound on/off, check Normal and Hardcore, and compare production main. Record what is verified and what remains concept-only.

## Guardrails
- Preserve existing GameEngine, scoring, targeting, keyboard latency, campaign progression, and production audio behavior.
- No forced Enter-based typing redesign, new monetization, asset licensing assumptions, or production promotion.
- No need to seek approval for ordinary composition and placeholder choices; request user input only for decisions that fundamentally alter mechanics or style.
- Never equate committed with deployed, or visual mockup with playable feature.
