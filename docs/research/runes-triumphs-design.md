# Runes and Triumphs — active design exploration

Last updated 2026-11-19. **Design decisions confirmed by project owner; not yet implemented.** This is an evolving design reference. Exact Rune catalogue, thresholds, point values, visuals and implementation details remain open.

## Confirmed: Runes

- Previously called medals. **Runes** are predictable, repeatable recognitions of unique or impressive *moment-to-moment* gameplay feats.
- Rune names should describe the accomplishment clearly. Once experienced, players should be able to deliberately reproduce their triggers.
- Runes should be relatively **rare**, recognizing genuinely noteworthy feats rather than appearing constantly.
- Each discovered Rune appears in a permanent **Trophy Case**, with a career total of how many times it has triggered.
- The award presentation **never pauses gameplay, takes keyboard focus, obscures falling words or interrupts typing**.
- Runes appear in a fixed **analog rolling carousel** integrated into the physical typewriter/scroll-processing interface. Inspiration: Halo's functional rolling medal feed, translated to a magical Renaissance aesthetic with mechanical, slot-machine-like shifts. This is aesthetic/kinetic inspiration **only**; no wagering, gambling, random rewards or dark patterns.
- A captured scroll can visually feed through the scroll processor before a Rune is awarded. For non-capture achievements, the fixed display can activate directly. Presentation must be asynchronous and responsive when multiple awards occur.
- Runes grant **small fixed bonus points**, unaffected by combo or Clean Streak multipliers. Exact values and balance are not decided.
- **Limited overlap:** Different feats may trigger together; related tier variants should award only the highest qualifying tier for a single event.
- **Distinct feat windows:** Every new qualifying feat counts, but continuous conditions must not repeatedly award without a fresh qualifying event.
- **Round 6:** Develop a roughly equal three-way catalogue of **typing mastery, language/wordplay, and spellcraft**. Inclusivity and discoverable skill are important.
- **Rune families** are the preferred organizational pattern: related feats share a thematic identity and can include progressively impressive named Runes. Families need not be simple numerical tiers; distinct feats within a theme are welcome.
- **Standalone unique Runes** are also encouraged where a specific feat warrants independent recognition.
- The catalogue is **extensible**: future gameplay modifiers, special scrolls, elemental interactions, and boss mechanics can add new Rune families or standalone Runes without redesigning the system.
- The Rune design should be distinct from existing scoring bonuses; avoid merely rebranding Perfect, Clutch, Volley, etc. Evaluate how to elevate existing signals into noteworthy achievements.

## Confirmed: Triumphs

- **Triumphs** are larger, long-term, **tiered milestones** rewarding both early and sustained player progress.
- Triumphs may relate to Rune feats and career totals, but should not be limited to grinding Rune counts.
- Exact tier structure, rewards and visibility are undecided.

## Round 7 — confirmed creative direction

- Rune rarity combines **graduated difficulty and discovery**. Some awards are accessible introductions, others demand mastery or unusual, learnable conditions.
- Explore simple word patterns, meaningful linguistic metadata and **magical-world vocabulary** together; do not assume every suggested variation must be implemented.
- Explore a grammar-chain family inspired *functionally* by Halo's escalating multi-kill medals: **Double Noun → Triple Noun → Nountacular**. The names and exact thresholds remain proposals until approved.
- Consider a curated **Arcane Lexicon** of magic-specific words for distinctive visual recognition and Rune triggers. This is an idea, not yet a mechanic.
- Prioritize intuitive triggers, typing-first fairness, accessible presentation and avoiding redundant scoring bonuses.

## Round 8 — confirmed design direction

- **Grammar classification:** A word may have multiple valid parts of speech (e.g. noun and verb). A capture may advance a relevant chain for each recognized category, with the award engine enforcing the agreed related-tier overlap rules. Use reliable, deterministic word metadata; do not infer categories from spelling during live gameplay.
- **Arcane vocabulary:** Magic-specific words should be visibly distinct on the battlefield, not merely tracked invisibly for Rune conditions. Preferred initial treatment: a **shimmering arcane-blue** accent plus a non-color glyph/marking for accessibility. Exact art treatment remains open.
- **Spell-duration Rune sequences:** Explore easy-to-understand, hard-to-master escalating feats performed **while a cast spell remains active**. Recognition should reward typing actions during the effect, not just spell casting.
- **Proposed Ice family (not yet approved):** Frostscribe (3 typed captures in one Ice effect), Frostweaver (5), Frostmaster (8). Test feasibility against Ice's spawn freeze, active duration and typical field size; don't force artificial stockpiling.
- The first twelve proposed Runes discussed in chat are **candidates**, not confirmed triggers or balanced thresholds. Keep the catalogue open to refinement.

## Round 9 — confirmed and clarified

- **Spell activations open feat opportunities, not automatic Rune sequences.** Each cast may create a specific, observable gameplay situation in which a player can attempt a defined Rune challenge. Merely casting a spell never awards a Rune or automatically starts counting a generic spell sequence.
- **Per-cast opportunities:** When a Rune is tied to a particular cast, that cast defines its own eligibility window; later casts do not automatically extend or merge the earlier window. The exact beginning/end of each opportunity is defined by the Rune, not a universal spell timer.
- **Example under consideration (not yet approved trigger):** Fire may leave surviving scrolls near the top of the screen. Capturing/eliminating those survivors within a defined time after the cast could qualify for a Fire-related Rune. Confirm the actual Fire behavior and tune its measurable window before implementation.
- **Subtle physical progress indicators:** Where a Rune challenge has meaningful progress, small engraved pips/marks near the typewriter may show it without obscuring gameplay. No progress display is required for every cast.
- **Rune announcer is core identity:** Recognizable spoken Rune/medal callouts, inspired by the celebratory cadence of Halo and Knight Squad, should form part of the iconic feedback layer of the game. Design for memorable names, timing and escalation without disrupting typing. Exact voice, audio mixing, queue priorities and accessibility settings remain open.
- **Three feedback layers:** actual player feat → mechanical Rune carousel → announcer callout. They should coordinate but never pause gameplay, steal keyboard focus or obstruct falling scrolls.

## Still open

- The first concrete Rune catalogue, measurable triggers and rarity thresholds.
- Rune difficulty/accessibility mix and how to make language feats deterministic with the available word metadata.
- Fixed bonus point amounts, point balance and anti-farming controls.
- Carousel capacity, animation timing, queue handling, sound and reduced-motion accessibility.
- Trophy Case layout, lifetime tracking and save migration.
- Triumph tiers, unlocks, presentation and relationship to Rune collections.
- Testing requirements and deployment approval.

## Engineering constraints

Do not implement until triggers and UI behaviour are approved. When implementing, preserve the live build; work on a non-main branch, run focused tests and report clear pass/fail results. No merge or deployment without explicit owner approval. Historical Typing Ninja references are at [typing-ninja-comparative-mechanics.md](typing-ninja-comparative-mechanics.md) and are inspiration, not requirements.
