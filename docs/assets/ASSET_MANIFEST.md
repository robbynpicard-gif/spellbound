# Typel — Asset Manifest

_Generated from `docs/assets/asset-manifest.json` by `tools/assets/manifest.py render`. Do not edit by hand._

Lifecycle: PLANNED → REQUESTED → GENERATED → UNDER REVIEW → APPROVED → INTEGRATED → VERIFIED (also REJECTED, NEEDS REVISION). An upload is GENERATED/UNDER REVIEW until the owner explicitly approves it.

## References

| ID | Name | File | Status | Provenance |
|---|---|---|---|---|
| REF-001 | Typel concept art (primary visual reference) | `assets-src/reference/REF-001_typel-concept-primary_v1.png` | APPROVED by owner 2026-11-21 | Supplied by the owner in chat, 2026-11-21 (generated image, "download_1.png") |

## Summary

UNDER REVIEW: 12 · PLANNED: 12 · REJECTED: 1

| ID | Name | Batch | Status | Category | Format | Size | Transparency / loop |
|---|---|---|---|---|---|---|---|
| PLT-001 | Clean sky plate region | 1 | **UNDER REVIEW** | visual/plate-edit | PNG 16:9 edit of REF-001 | used at 1920×1080, region PLT-001 | opaque (region composite) |
| PLT-002 | Clean score-engine region | 1 | **UNDER REVIEW** | visual/plate-edit | PNG 16:9 edit of REF-001 | region PLT-002 | opaque (region composite) |
| PLT-003 | Clean typewriter and desk region | 1 | **UNDER REVIEW** | visual/plate-edit | PNG 16:9 edit of REF-001 | region PLT-003 | opaque (region composite) |
| PLT-004 | Empty shelf region | 1 | **UNDER REVIEW** | visual/plate-edit | PNG 16:9 edit of REF-001 | region PLT-004 | opaque (region composite) |
| SCR-001 | Plain word scroll (blank) | 1 | **UNDER REVIEW** | visual/gameplay-target | PNG 16:9 on #FF00FF | ships 229×67 (+2×), capL/capR re-measured | alpha (chroma key); 3-slice |
| PLT-005 | Title removed from the arch top | 1b | **UNDER REVIEW** | visual/plate-edit | PNG 16:9 edit of clean plate v1 | region PLT-005 | opaque (region composite) |
| PLT-006 | Shorter shelf + TYPEL title + blank stage banner | 1b | **UNDER REVIEW** | visual/plate-edit | PNG 16:9 edit of clean plate v1 | region PLT-006 | opaque (region composite) |
| PLT-007 | Rune display (Halo-medal style) | 1b | **UNDER REVIEW** | visual/plate-edit | PNG 16:9 edit of clean plate v1 | region PLT-007 | opaque (region composite) |
| PLT-008 | Spell-key row, Ward orb, desk pipe | 1b | **UNDER REVIEW** | visual/plate-edit | PNG 16:9 edit of clean plate v1 | region PLT-008 | opaque (region composite) |
| RIB-001 | Shelf ribbon markers ×8 | 1b | **UNDER REVIEW** | visual/hud-part | PNG 16:9 sheet on #FF00FF | ~22×80 each | alpha; sheet split |
| KEY-001 | Spell gems ×8 | 1b | **UNDER REVIEW** | visual/hud-part | PNG 16:9 sheet on #FF00FF | ~30 px each | alpha; sheet split |
| MIX-001 | Hardcore lock bar, Normal/Hardcore seals, Ward orb liquid | 1b | **UNDER REVIEW** | visual/hud-part | PNG 16:9 sheet on #FF00FF | 4 sprites | alpha; sheet split |
| SCR-002 | Elemental spell scrolls ×8 | 2 | **PLANNED** | visual/gameplay-target | PNG sheet on #FF00FF | matches SCR-001 | alpha |
| SCR-003 | CATCH! stamp | 2 | **PLANNED** | visual/feedback | PNG on #FF00FF | ~123×60 | alpha |
| RCK-002 | Shelf scrolls ×8 (isolated) | 2 | **PLANNED** | visual/hud-part | PNG sheet on #FF00FF | 257×80–91 each | alpha; sheet split |
| CHR-001 | Grand Wizard pose sheet | 3 | **PLANNED** | visual/character | PNG sheet on #FF00FF | 237×329 each | alpha |
| HND-001 | Hands pose sheet | 3 | **PLANNED** | visual/character-part | PNG sheet on #FF00FF | hand_l 269×229 / hand_r 309×229 | alpha |
| MED-001 | Rune medals by category × tier | 4 | **PLANNED** | visual/reward | PNG sheet on #FF00FF | ~100×100 each | alpha |
| FX-001 | Spell effect sprites | 4 | **PLANNED** | visual/effect | PNG sheets on black (additive) or magenta | varies | alpha/additive |
| WRD-001 | Ward gauge face + needle | 4 | **REJECTED** | visual/hud | PNG on #FF00FF (2 parts) | needle 80×80, face ~170×200 | alpha |
| UI-002 | Menu panels (parchment + walnut) | 5 | **PLANNED** | visual/ui | PNG | TBD | alpha |
| AUD-VO-001 | Grand Wizard recorded lines (65) | owner | **PLANNED** | audio/voice | WAV 48 kHz/24-bit → MP3 | per line | one-shot |
| AUD-MUS-001 | Final score production | later | **PLANNED** | audio/music | WAV 48 kHz/24-bit stems | loops | seamless loops + stems |
| AUD-SFX-001 | Recorded typewriter foley layer (optional) | later | **PLANNED** | audio/sfx | WAV 48 kHz/24-bit | < 300 ms | one-shot, 4–8 variations |
| AUD-AMB-001 | Workshop ambience bed | later | **PLANNED** | audio/ambience | WAV 48 kHz/24-bit | 60–120 s | seamless loop |

## Asset records

### PLT-001 · Clean sky plate region

- **Game function:** Field background without the painted scrolls, flying scroll or wizard
- **Category:** visual/plate-edit · **Batch:** 1 · **Priority:** 1
- **Required format:** PNG 16:9 edit of REF-001 · **Dimensions/duration:** used at 1920×1080, region PLT-001 · **Transparency/looping:** opaque (region composite)
- **Source reference:** REF-001
- **Prompt:** v1 in `docs/assets/requests/BATCH-01_clean-plate-and-scroll.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload 2026-11-21); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** `public/assets/typel/keyart/plate.jpg (+ front.webp re-sliced)`
- **Integration notes:** align → diff → composite region onto plate; re-run tools/keyart slicing on the clean plate.
- **Test status:** checked by Claude: see INTEGRATION_LOG entry 2
- **Known limitations:** Ghost outlines; missed items need a second pass.

### PLT-002 · Clean score-engine region

- **Game function:** Blank drums, BASE/×COMBO/×RUSH plates, level plate; empty medal tray (all live)
- **Category:** visual/plate-edit · **Batch:** 1 · **Priority:** 1
- **Required format:** PNG 16:9 edit of REF-001 · **Dimensions/duration:** region PLT-002 · **Transparency/looping:** opaque (region composite)
- **Source reference:** REF-001
- **Prompt:** v1 in `docs/assets/requests/BATCH-01_clean-plate-and-scroll.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload 2026-11-21); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** `public/assets/typel/keyart/plate.jpg / front.webp`
- **Integration notes:** As PLT-001. Owner (D-096) asked for further changes, made as stage-2 edits PLT-006/007/008 on top of this result.
- **Test status:** checked by Claude: see INTEGRATION_LOG entry 2
- **Known limitations:** Model may rewrite text instead of removing it.

### PLT-003 · Clean typewriter and desk region

- **Game function:** Blank paper, no hands/sleeves, blank keys, blank note, no gauge needle
- **Category:** visual/plate-edit · **Batch:** 1 · **Priority:** 1
- **Required format:** PNG 16:9 edit of REF-001 · **Dimensions/duration:** region PLT-003 · **Transparency/looping:** opaque (region composite)
- **Source reference:** REF-001
- **Prompt:** v1 in `docs/assets/requests/BATCH-01_clean-plate-and-scroll.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload 2026-11-21); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** `public/assets/typel/keyart/front.webp`
- **Integration notes:** Key letters become live text on blank caps (rendering change at integration). Paper top edge must not move (Ward line). Owner (D-096) asked for further changes, made as stage-2 edits PLT-006/007/008 on top of this result.
- **Test status:** checked by Claude: see INTEGRATION_LOG entry 2
- **Known limitations:** Invented keys under the hands may misalign.

### PLT-004 · Empty shelf region

- **Game function:** Shelf behind the live rack_<spell> layers
- **Category:** visual/plate-edit · **Batch:** 1 · **Priority:** 1
- **Required format:** PNG 16:9 edit of REF-001 · **Dimensions/duration:** region PLT-004 · **Transparency/looping:** opaque (region composite)
- **Source reference:** REF-001
- **Prompt:** v1 in `docs/assets/requests/BATCH-01_clean-plate-and-scroll.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload 2026-11-21); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** `public/assets/typel/keyart/plate.jpg / front.webp`
- **Integration notes:** As PLT-001. Owner (D-096) asked for further changes, made as stage-2 edits PLT-006/007/008 on top of this result.
- **Test status:** checked by Claude: see INTEGRATION_LOG entry 2
- **Known limitations:** Flying-scroll remnants on shelf 4.

### SCR-001 · Plain word scroll (blank)

- **Game function:** Parchment banner behind every falling word (3-slice)
- **Category:** visual/gameplay-target · **Batch:** 1 · **Priority:** 1
- **Required format:** PNG 16:9 on #FF00FF · **Dimensions/duration:** ships 229×67 (+2×), capL/capR re-measured · **Transparency/looping:** alpha (chroma key); 3-slice
- **Source reference:** REF-001-C3 (TRANSMUTE/ALAKAZAM)
- **Prompt:** v1 in `docs/assets/requests/BATCH-01_clean-plate-and-scroll.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload 2026-11-21); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** `public/assets/typel/keyart/scroll_plain.png`
- **Integration notes:** Replaces the cut-from-painting scroll; keyart.json capL/capR updated.
- **Test status:** checked by Claude: see INTEGRATION_LOG entry 2
- **Known limitations:** May come back with a word or curl.

### PLT-005 · Title removed from the arch top

- **Game function:** Frees the top of the field (field +10 %, D-096)
- **Category:** visual/plate-edit · **Batch:** 1b · **Priority:** 1 · **Depends on:** PLT-001
- **Required format:** PNG 16:9 edit of clean plate v1 · **Dimensions/duration:** region PLT-005 · **Transparency/looping:** opaque (region composite)
- **Source reference:** clean plate v1
- **Prompt:** v1 in `docs/assets/requests/BATCH-01b_hud-revision.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload: PLT-005_no-title_v1.png); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Stage-2 plate build (plate-build-v2.json).
- **Test status:** not tested
- **Known limitations:** Ghost plaque, letter-like runes.

### PLT-006 · Shorter shelf + TYPEL title + blank stage banner

- **Game function:** Title above the shelf; banner shows trial · level (live) and a Normal/Hardcore seal
- **Category:** visual/plate-edit · **Batch:** 1b · **Priority:** 1 · **Depends on:** PLT-004
- **Required format:** PNG 16:9 edit of clean plate v1 · **Dimensions/duration:** region PLT-006 · **Transparency/looping:** opaque (region composite)
- **Source reference:** clean plate v1
- **Prompt:** v1 in `docs/assets/requests/BATCH-01b_hud-revision.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload: PLT-006_shelf-title_v1_a.png + _b); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** rack_<spell> layers re-placed and scaled to the new compartments; rackCount positions re-measured.
- **Test status:** not tested
- **Known limitations:** Shelf count; TYPEL spelling.

### PLT-007 · Rune display (Halo-medal style)

- **Game function:** Large display in the score machine that absorbs earned Runes: newest shown big with its name, then joins a row of recent Runes (D-098)
- **Category:** visual/plate-edit · **Batch:** 1b · **Priority:** 1 · **Depends on:** PLT-002
- **Required format:** PNG 16:9 edit of clean plate v1 · **Dimensions/duration:** region PLT-007 · **Transparency/looping:** opaque (region composite)
- **Source reference:** clean plate v1
- **Prompt:** v2 in `docs/assets/requests/BATCH-01b_hud-revision.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 REQUESTED (v2 prompt: conveyor concept replaced by Rune display (D-098)); 2026-11-21 GENERATED (owner upload PLT-007_rune-display_v2.png); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Replaces keyart tray slots and the level plate; level name moves to the stage banner. Medals keep the D-093 cut-outs until MED-001.
- **Test status:** not tested
- **Known limitations:** Pane ~310×140 at 1080p, smaller than asked; the two tubes were shortened by ~60 px, so tube coordinates must be re-measured at integration.

### PLT-008 · Spell-key row, Ward orb, desk pipe

- **Game function:** 8 spell keys (1–8), Ward orb on the typewriter, pipe instead of the gauge
- **Category:** visual/plate-edit · **Batch:** 1b · **Priority:** 1 · **Depends on:** PLT-003
- **Required format:** PNG 16:9 edit of clean plate v1 · **Dimensions/duration:** region PLT-008 · **Transparency/looping:** opaque (region composite)
- **Source reference:** clean plate v1
- **Prompt:** v1 in `docs/assets/requests/BATCH-01b_hud-revision.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload: PLT-008_spell-keys-orb-pipe_v1_a.png + _b); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** keys re-measured; spell keys cut live and pressed; needle/gauge code replaced by the orb; pipe smoke = existing steam emitter.
- **Test status:** not tested
- **Known limitations:** Key count, paper top must not move.

### RIB-001 · Shelf ribbon markers ×8

- **Game function:** Spell-colour ribbon per shelf, visible once that spell is learned
- **Category:** visual/hud-part · **Batch:** 1b · **Priority:** 1 · **Depends on:** PLT-006
- **Required format:** PNG 16:9 sheet on #FF00FF · **Dimensions/duration:** ~22×80 each · **Transparency/looping:** alpha; sheet split
- **Source reference:** REF-001-C4
- **Prompt:** v1 in `docs/assets/requests/BATCH-01b_hud-revision.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload: RIB-001_shelf-ribbons_v1.png); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Shown when learned, regardless of charges.
- **Test status:** not tested
- **Known limitations:** Colour order; pink/violet keying.

### KEY-001 · Spell gems ×8

- **Game function:** Set into spell-key crystals; lit with charges, flash on cast, dim when empty/Hardcore
- **Category:** visual/hud-part · **Batch:** 1b · **Priority:** 1 · **Depends on:** PLT-008
- **Required format:** PNG 16:9 sheet on #FF00FF · **Dimensions/duration:** ~30 px each · **Transparency/looping:** alpha; sheet split
- **Source reference:** REF-001-C2
- **Prompt:** v1 in `docs/assets/requests/BATCH-01b_hud-revision.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload: KEY-001_spell-gems_v1.png); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Additive glow drawn in code.
- **Test status:** not tested
- **Known limitations:** Facets/rims vary.

### MIX-001 · Hardcore lock bar, Normal/Hardcore seals, Ward orb liquid

- **Game function:** Lock bar over spell keys in Hardcore; seal on stage banner; liquid masked in the orb by Ward level, scar shown as dead cap
- **Category:** visual/hud-part · **Batch:** 1b · **Priority:** 1 · **Depends on:** PLT-008
- **Required format:** PNG 16:9 sheet on #FF00FF · **Dimensions/duration:** 4 sprites · **Transparency/looping:** alpha; sheet split
- **Source reference:** REF-001-C2
- **Prompt:** v1 in `docs/assets/requests/BATCH-01b_hud-revision.md` (TYPEL SHARED STYLE v1)
- **Status:** **UNDER REVIEW** — history: 2026-11-21 REQUESTED; 2026-11-21 GENERATED (owner upload: MIX-001_lock-seals-orb_v1.png); 2026-11-21 UNDER REVIEW
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Orb liquid level = Ward stability; scar = dark cracked cap above the recoverable maximum (code).
- **Test status:** not tested
- **Known limitations:** Skull tone; soft sphere edge.

### SCR-002 · Elemental spell scrolls ×8

- **Game function:** Visual identity of each falling spell scroll (burning, frosted, crackling, hexed…)
- **Category:** visual/gameplay-target · **Batch:** 2 · **Priority:** 2 · **Depends on:** SCR-001
- **Required format:** PNG sheet on #FF00FF · **Dimensions/duration:** matches SCR-001 · **Transparency/looping:** alpha
- **Source reference:** REF-001-C3 FIREBALL/FROSTBITE/LEVITATE/HEX
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Replaces particle/tint stand-ins for spell scrolls; the live glyph stays.
- **Test status:** not tested
- **Known limitations:** —

### SCR-003 · CATCH! stamp

- **Game function:** Plunge warning stamp (catch loop)
- **Category:** visual/feedback · **Batch:** 2 · **Priority:** 2
- **Required format:** PNG on #FF00FF · **Dimensions/duration:** ~123×60 · **Transparency/looping:** alpha
- **Source reference:** REF-001 CATCH! stamp
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Current one is cut from the painting; replace only if it looks soft.
- **Test status:** not tested
- **Known limitations:** —

### RCK-002 · Shelf scrolls ×8 (isolated)

- **Game function:** rack_<spell> layers; includes a proper Barrier scroll (currently a recoloured Ice scroll)
- **Category:** visual/hud-part · **Batch:** 2 · **Priority:** 2 · **Depends on:** PLT-004
- **Required format:** PNG sheet on #FF00FF · **Dimensions/duration:** 257×80–91 each · **Transparency/looping:** alpha; sheet split
- **Source reference:** REF-001-C4
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** —
- **Test status:** not tested
- **Known limitations:** —

### CHR-001 · Grand Wizard pose sheet

- **Game function:** Idle, sip, puff, eyebrow raise, chuckle, harrumph, impressed, nod (D-093 reactions)
- **Category:** visual/character · **Batch:** 3 · **Priority:** 2
- **Required format:** PNG sheet on #FF00FF · **Dimensions/duration:** 237×329 each · **Transparency/looping:** alpha
- **Source reference:** REF-001 wizard
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** —
- **Test status:** not tested
- **Known limitations:** Character consistency across poses: generate as one sheet.

### HND-001 · Hands pose sheet

- **Game function:** Rest, press left, press right, cast (raised, glowing), flinch, cheer
- **Category:** visual/character-part · **Batch:** 3 · **Priority:** 2 · **Depends on:** PLT-003
- **Required format:** PNG sheet on #FF00FF · **Dimensions/duration:** hand_l 269×229 / hand_r 309×229 · **Transparency/looping:** alpha
- **Source reference:** REF-001 hands
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** —
- **Test status:** not tested
- **Known limitations:** —

### MED-001 · Rune medals by category × tier

- **Game function:** Rune tray medals (D-089 categories) in the painting style
- **Category:** visual/reward · **Batch:** 4 · **Priority:** 2 · **Depends on:** PLT-002
- **Required format:** PNG sheet on #FF00FF · **Dimensions/duration:** ~100×100 each · **Transparency/looping:** alpha
- **Source reference:** REF-001 medals
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** —
- **Test status:** not tested
- **Known limitations:** —

### FX-001 · Spell effect sprites

- **Game function:** Fireball burst, lightning bolt, ice crystals, wind gust, harvest sweep, barrier layer
- **Category:** visual/effect · **Batch:** 4 · **Priority:** 2
- **Required format:** PNG sheets on black (additive) or magenta · **Dimensions/duration:** varies · **Transparency/looping:** alpha/additive
- **Source reference:** REF-001 effects on scrolls
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Rigid sprites driven by code; no frame-by-frame AI animation.
- **Test status:** not tested
- **Known limitations:** —

### WRD-001 · Ward gauge face + needle

- **Game function:** Clean gauge (no needle) and a separate needle
- **Category:** visual/hud · **Batch:** 4 · **Priority:** 2 · **Depends on:** PLT-003
- **Required format:** PNG on #FF00FF (2 parts) · **Dimensions/duration:** needle 80×80, face ~170×200 · **Transparency/looping:** alpha
- **Source reference:** REF-001 gauge
- **Prompt:** not yet written
- **Status:** **REJECTED** — history: 2026-11-21 PLANNED; 2026-11-21 REJECTED (superseded by the Ward orb on the typewriter (D-096))
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** PLT-003 may already deliver an acceptable face; then only the needle is needed.
- **Test status:** not tested
- **Known limitations:** —

### UI-002 · Menu panels (parchment + walnut)

- **Game function:** Main menu, Codex, options
- **Category:** visual/ui · **Batch:** 5 · **Priority:** 2
- **Required format:** PNG · **Dimensions/duration:** TBD · **Transparency/looping:** alpha
- **Source reference:** REF-001 materials
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** —
- **Test status:** not tested
- **Known limitations:** —

### AUD-VO-001 · Grand Wizard recorded lines (65)

- **Game function:** Rune announcer voice (D-090)
- **Category:** audio/voice · **Batch:** owner · **Priority:** 2
- **Required format:** WAV 48 kHz/24-bit → MP3 · **Dimensions/duration:** per line · **Transparency/looping:** one-shot
- **Source reference:** docs/grand-wizard-voice-script.md
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Owner records; IDs from voiceLines.ts; plug in via voice-manifest.json.
- **Test status:** not tested
- **Known limitations:** —

### AUD-MUS-001 · Final score production

- **Game function:** Replace synthesized D-092 stand-ins for release
- **Category:** audio/music · **Batch:** later · **Priority:** 2
- **Required format:** WAV 48 kHz/24-bit stems · **Dimensions/duration:** loops · **Transparency/looping:** seamless loops + stems
- **Source reference:** AUDIO_BIBLE §3
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** —
- **Test status:** not tested
- **Known limitations:** —

### AUD-SFX-001 · Recorded typewriter foley layer (optional)

- **Game function:** Deepen key/carriage/bell sounds
- **Category:** audio/sfx · **Batch:** later · **Priority:** 2
- **Required format:** WAV 48 kHz/24-bit · **Dimensions/duration:** < 300 ms · **Transparency/looping:** one-shot, 4–8 variations
- **Source reference:** AUDIO_BIBLE §2
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** Only if owner wants recorded sound; current synthesis is approved.
- **Test status:** not tested
- **Known limitations:** —

### AUD-AMB-001 · Workshop ambience bed

- **Game function:** Quiet candles/gears/wind room tone
- **Category:** audio/ambience · **Batch:** later · **Priority:** 2
- **Required format:** WAV 48 kHz/24-bit · **Dimensions/duration:** 60–120 s · **Transparency/looping:** seamless loop
- **Source reference:** AUDIO_BIBLE §4
- **Prompt:** not yet written
- **Status:** **PLANNED** — history: 2026-11-21 PLANNED
- **Approved source file:** —
- **Final integrated path:** TBD
- **Integration notes:** —
- **Test status:** not tested
- **Known limitations:** —
