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
- Initial Rune catalogue should **blend typing mastery with language/vocabulary and wordplay**, rather than focusing exclusively on elite typing performance. Inclusivity and discoverable skill are important. Spellcraft can be explored subsequently.
- The Rune design should be distinct from existing scoring bonuses; avoid merely rebranding Perfect, Clutch, Volley, etc. Evaluate how to elevate existing signals into noteworthy achievements.

## Confirmed: Triumphs

- **Triumphs** are larger, long-term, **tiered milestones** rewarding both early and sustained player progress.
- Triumphs may relate to Rune feats and career totals, but should not be limited to grinding Rune counts.
- Exact tier structure, rewards and visibility are undecided.

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
