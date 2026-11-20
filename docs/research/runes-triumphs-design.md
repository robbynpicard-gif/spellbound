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

## Round 10 — confirmed announcer direction

- **Personality:** A mischievous magical entity: playful, witty, occasionally sarcastic, and recognizably its own character. Specific voice casting, wording and persona are open.
- **Primary behavior:** Escalating callouts, so consecutive qualifying Rune achievements can build energy and intensity.
- **Practical flexibility:** Award frequency may make announcing every Rune impractical. Preserve the ability to prioritize major feats, suppress/condense minor spoken callouts, and still show earned Runes in the mechanical carousel. Exact queue, priority and interruption rules remain undecided.
- Announcer callouts must never disrupt typing or obscure the battlefield. Announcer audio should be adjustable and accessible; specific controls remain open.

## Round 11 — confirmed announcer scope and escalation

- **Rune-only announcer:** Spoken announcements are reserved for **Rune awards**. The announcer does **not** narrate general gameplay, spell casts, victories, failures, bosses, or unrelated events.
- **Escalation is family-specific:** Named Rune chains/families (e.g. Double Noun → Triple Noun → Nountacular) can build the announcer's intensity across their milestones. **Not all Rune triggers are chains**; standalone Runes receive their own distinct callout without requiring a sequence.
- **Occasional personality:** Rare witty commentary may accompany exceptional **Rune awards only**; keep Rune names recognizable and central. Do not interpret this as permission for ambient chatter.
- Preserve Round 10's practical option to prioritize important spoken Rune awards when frequency is high. Every earned Rune still receives visual carousel recognition.
- Exact cooldowns, spoken queue, family progression timing, mixing, voice lines and implementation remain open.

## Proposed overarching narrative direction — Grand Wizard and Apprentice (2026-11-19)

**Concept under consideration, not yet a final approved narrative implementation.**

- The entire game may be framed as a powerful, eccentric **Grand Wizard teaching the player's apprentice wizard**.
- Typing remains a real mechanical fight against **the darkness**, but the darkness is not necessarily a creepy, horror-like or inherently evil threat. It serves as the Grand Wizard's training challenge for the apprentice to acquire knowledge and magical power.
- Campaign progression could represent successive lessons and increasingly difficult magical trials. A possible eventual **final boss is the Grand Wizard himself**, as a culminating examination after overcoming the darkness, not a villainous betrayal.
- **The Grand Wizard is the previously specified mischievous Rune announcer.** His occasional playful/sarcastic comments address the apprentice; Rune names and family escalation remain central.
- **Strict audio restraint:** Spoken Grand Wizard commentary remains reserved for Rune achievements, not routine casts, bosses, victories or general gameplay narration. Callouts should be rare enough to remain iconic; prioritize major feats if needed. Adjustable audio and non-disruptive delivery are important.
- **Gameplay-first:** This is an identity/story layer on top of the typing-first loop, not permission to add interruptions, mandatory exposition, forced dialogue or mechanics changes. The game should remain compelling with the voice muted.
- Story framing, mentor characterization, exact darkness lore, stage mapping, final boss mechanics and whether/how to show the wizard outside Rune callouts remain **open for discussion**.

## Narrative Round 1 — confirmed

- **Darkness:** A real magical force under the Grand Wizard's control. He deliberately uses it to train **other wizards**, including the player apprentice; avoid a creepy/horror framing.
- **Mentor arc:** The Grand Wizard begins playfully teasing the apprentice and becomes gradually, genuinely impressed as the apprentice earns **more impressive Rune feats or advances through Rune chains**. The voice remains Rune-only and should not crowd the core gameplay.
- The eventual Grand Wizard final-boss examination remains a **possible future narrative direction**, not a committed boss design.

## Rune catalogue scope refinement — confirmed direction, proposed examples

- **Favor simplicity and recognizability over a sprawling catalogue.** Earlier lists of 12 candidates and equal family allocations are exploratory, not quotas or approved implementations.
- **Spellcraft:** Aim for **one distinctive Rune or Rune chain per spell**; triggers should celebrate a meaningful feat enabled by a cast, not casting itself. Leave room for later mechanics/modifiers.
- **Typing skill:** A small handful of especially unusual/impressive feats, plus **substantial flawless typing streaks**.
- **Language:** Selective quirky grammar/parts-of-speech correlations or patterns, including the previously discussed noun family; don't include every possible variation.
- **Failure/comedy:** Include some rare, memorable mishap/failure Runes that let the Grand Wizard tease the apprentice playfully, without encouraging failure farming or interrupting gameplay.
- **Flawless level/stage examples:** A flawlessly completed level should award a Rune called **Flawless**; a flawlessly completed stage should award **Flawless Perfection**. These names and associations are user-proposed direction; the operational meaning of 'flawless' (typing errors, misses, damage, etc.) still needs a clear decision. Preserve separation from the existing level-end Flawless score bonus and ensure no redundant/double-triggered reward.
- Prioritize earned, understandable triggers; maintain Trophy Case lifetime counts and Rune-only announcer, and avoid flooding the player with announcements.

## Narrative/Rune Round 2 — confirmed

- **Flawless definition:** A flawless level or stage requires **zero typing mistakes, zero missed scrolls, and zero damage** throughout the applicable level/stage. The Rune names are **Flawless** (level) and **Flawless Perfection** (stage). Clarify how inherited damage, stage boundaries and existing scoring bonuses interact before coding.
- **Participation Runes:** An intentionally ironic category of collectible Runes recognizing **unusual, memorable, comedic mishaps**. They may include **tiered failures**, not just isolated awards.
- **Failure is not a scoring opportunity:** Participation Runes award **zero bonus points**, regardless of any ordinary positive-Rune fixed-point scheme. Avoid incentivizing intentional mistakes; anti-farming details remain open.
- **Generational Fumble:** Proposed Rune for a spectacular mishap that ends a substantial successful/flawless streak; exact streak length and failure criteria TBD.
- **Grand Wizard audio:** On a sufficiently major fumble, the wizard may occasionally immediately exclaim **"HA! FAIL!"**, with a configurable/defined percentage chance. This is a *voice variation*, not random Rune eligibility; not every ordinary mistake triggers speech. Maintain the Rune-only announcer restriction: a voiced fumble reaction should accompany a qualifying Participation Rune, not arbitrary gameplay failure.
- Grand Wizard's sarcasm should be playful, not mean-spirited or overwhelming; do not let voice interrupt typing.

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
