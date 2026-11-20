# Spellbound prototype — sensory and world-direction contract

Status: design constraints for the development preview, not finalized sound assets. Production remains unchanged.

## Core decision
The original Phaser combat engine is the baseline. Do not recreate typing combat as a standalone word-catching mini-game. Preserve responsiveness, target feedback, cadence, and audiovisual reinforcement from the stable game, then extend campaign progression and spells around it.

## Existing systems to reuse or study
- `src/main.ts`: Phaser scenes and bootstrap, existing UI and settings integration.
- `src/scenes/GameScene.ts`: combat scene; inspect before changing target interaction.
- `src/audio/Audio.ts`: audio unlock, click and game feedback; inspect before adding sound.
- `src/ui/UIRoot.ts`, `src/app/App.ts`: menu and campaign routing.
- `src/styles/`: visual hierarchy and existing presentation.

## Creative north star
A magical Renaissance writing desk at the edge of a living world: parchment, engraved brass, ink, wax seals, candlelight, arcane glyphs, natural materials and subtle supernatural disturbances. The player is an apprentice manipulating real elemental forces through words. The Grand Wizard is mischievous and clever, not a villain. The interface should feel like an instrument, not a generic dashboard.

## Sensory language — prototypes, not final assets
- **Keystroke**: crisp, restrained mechanical/ink or quill-like articulation; never a loud sample for every key. Preserve fast typing clarity.
- **Correct word / scroll capture**: distinct satisfying punctuation: brief paper snap, seal impression, or rune chime synchronized with visual impact.
- **Mistake**: subtle dry misstrike or damped clack; never a punishing buzzer or sound that masks rhythm.
- **Spell cast**: material-first layering, not generic magic whooshes: fire crackle and ignition; water splash and extinguish; ice crystalline tension; shock short conductive crack; time muted clockwork displacement; void air/room-tone withdrawal.
- **Threat approaching ward**: spatial/temporal tension, sparingly applied; don't create continuous noise that competes with typing.
- **Victory / exam**: ceremonial but concise, distinct from ordinary capture.
- **UI navigation**: light tactile click, consistent with existing game.
- **Ambient world**: low-level room/desk atmosphere with quiet moments; audio must be independently adjustable or muted.

## Interaction principles
1. Input feedback is immediate and legible. Sound reinforces a visual event; it does not substitute for it.
2. Multiple fast word captures must remain intelligible: short samples, concurrency limits, sensible gain and variation.
3. Sound events are semantic (key, error, capture, spell, damage, exam), not sprinkled ad hoc across components.
4. All audio respects the existing mute/volume controls and browser audio-unlock restrictions.
5. Prototype with placeholder synthesis or reused licensed repo assets; don't call anything final until playtested.
6. Effects must remain understandable without sound, and no flashing/strobing required.
7. Keep the original game's satisfying combat feel as the reference, but prototype visuals and sounds can evolve rather than duplicate it.

## Prototype acceptance
- The preview boots the actual Phaser typing combat and original controls, not the standalone HTML mini-game.
- A Campaign button opens apprenticeship chapter selection, then launches playable encounters.
- Original typing feel and audio feedback remain present; visual/audio refinements clearly evoke the Renaissance magical desk.
- Normal/Hardcore, Endless unlock and Practice can be layered without breaking baseline combat.
- Production build and saved progress remain untouched; prototype uses a separate save namespace.
- Verify with keyboard playtest and sound-on/sound-off testing before calling this done.

## Release boundary
Work on `dev/apprenticeship-prototype-20261119`; production is not a target for gameplay commits. A future explicit reviewed promotion to `main` is required.
