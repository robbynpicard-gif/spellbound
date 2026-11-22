# Batch 01b — HUD revision (D-096)

_Requested 2026-11-21 · Shared style block: **TYPEL SHARED STYLE v1** · Prompts: v1 · Edits are made on the batch-01 clean plate_

**Why now:** the owner revised the play screen before batch 01 is integrated: a 10 % larger field, the title moved above the shelf with a stage banner, a Rune conveyor in the score machine, the Ward as an orb on the typewriter, spell keys with a Hardcore lock, a smoking pipe, and colour ribbons on the shelf. Everything that changes the painted plate is a region edit **of the clean plate** (so it stacks on batch 01); everything that moves, lights up or appears conditionally is an isolated sprite. Text (banner, level, Rune names, key numbers) stays live.

**Plan image (for you, not for Flow):** `docs/assets/guides/G-HUD-REV1_plan_labelled.png`.

**Code-only parts (no art needed):** the 10 % larger field (x 548–1582, y 0–655 at 1080p; was 610–1550 × 60–655), the banner text, the conveyor motion, the orb’s fill level and scar, gem lighting, Hardcore dimming, ribbon visibility by learned spell, and the pipe smoke. Done at integration together with the art, so the screen changes in one coherent step.

## How to make and return them

- **Edits (PLT-005…008):** Flow image editing with Nano Banana; attach **only the clean plate** (`TYPEL-BASE_clean-plate_v1.png`) as the image to edit. Each edit starts again from that same file; don’t chain them.
- **Sheets (RIB-001, KEY-001, MIX-001):** new images; attach the listed close-up for style.
- Choose 16:9, paste the prompt, generate 2–4, upscale your pick if Flow offers it, download as PNG, rename as listed, attach here, and say which you approve.

---

## PLT-005 · Title off the top of the arch

| Field | Value |
|---|---|
| **Purpose** | Frees the top of the sky so the field can grow by 10 % and run up to the top edge (owner, D-096). |
| **Kind** | Edit |
| **Technical** | 16:9 edit of the clean plate, largest size offered; only the top-centre area is used. |
| **Attach** | `TYPEL-BASE_clean-plate_v1.png` (the clean plate from batch 01; also at `assets-src/work/PLT/clean-plate_v1_1920.png`) |
| **Return as** | `PLT-005_no-title_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

EDIT THE ATTACHED IMAGE. Keep the whole picture exactly the same: same framing, same size and position of everything, same colours, lighting and painting style. Change ONLY the following, at the top centre of the picture:
Remove the ornate TYPEL title banner and its brass scrollwork frame completely. Where it was, continue the glowing rune arch so it forms one unbroken arch across the top, with the same carved runes and the same soft cyan-green glow, and paint the night sky with soft clouds and a few small stars behind it.

DO NOT CHANGE: the moon, the rest of the arch, the green wisps, the score machine, the typewriter, the shelf, or anything else. Do not add any text, letters or objects.
```

**Acceptance criteria:** The title is gone; the arch is one unbroken band of runes with the same glow; the sky behind it is calm.
**Expected limitations:** The model may leave a ghost of the plaque or invent letter-like runes; rune shapes inside the area only need to look like the rest of the arch.

---

## PLT-006 · Shorter shelf, TYPEL title above it, blank stage banner

| Field | Value |
|---|---|
| **Purpose** | Title moves above the spell shelf; under it a banner the game writes on ("FLAME · LEVEL 2") plus a Normal or Hardcore seal (D-096). |
| **Kind** | Edit |
| **Technical** | 16:9 edit of the clean plate; only the right-hand strip (x ≳ 1560) is used. |
| **Attach** | `TYPEL-BASE_clean-plate_v1.png` (the clean plate from batch 01; also at `assets-src/work/PLT/clean-plate_v1_1920.png`) |
| **Return as** | `PLT-006_shelf-title_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

EDIT THE ATTACHED IMAGE. Keep the whole picture exactly the same: same framing, same size and position of everything, same colours, lighting and painting style. Change ONLY the right edge of the picture, around the tall wooden shelf cabinet:
1. Make the cabinet shorter from the top. Keep its width, its position, its base, its carved crest with brass trim and its EIGHT empty compartments, but lower its top so the crest sits about one sixth of the way down the picture. The eight compartments become a little shorter, stay evenly spaced, and stay completely empty.
2. In the space above the cabinet, mount the TYPEL title plaque from this picture: the same ornate brass-framed dark teal plaque with gold letters spelling exactly T-Y-P-E-L, centred above the cabinet and almost as wide as it.
3. Directly under the title plaque and above the cabinet's crest, add a small, completely BLANK parchment ribbon banner with swallowtail ends, about as wide as the cabinet, pinned by two small brass tacks. No writing on it.
Behind them, continue the stone wall and night sky as they are.

DO NOT CHANGE: anything else in the picture. Do not add any text other than the five letters TYPEL on the plaque.
```

**Acceptance criteria:** TYPEL spelled correctly; the banner is blank; the cabinet still has exactly 8 evenly spaced empty compartments with its base where it was; the crest sits about a sixth of the way down.
**Expected limitations:** Spelling: check TYPEL letter by letter. Shelf counts drift (7 or 9): count before sending. If the plaque comes out too small or crooked, re-run; I can’t repaint lettering.

---

## PLT-007 · Rune conveyor display (replaces level plate and medal tray)

| Field | Value |
|---|---|
| **Purpose** | The Rune medals ride a conveyor inside the score machine; the Rune name shows on the strip under it. The level name moves to the new banner (D-096). |
| **Kind** | Edit |
| **Technical** | 16:9 edit of the clean plate; only the lower-left area is used. |
| **Attach** | `TYPEL-BASE_clean-plate_v1.png` (the clean plate from batch 01; also at `assets-src/work/PLT/clean-plate_v1_1920.png`) |
| **Return as** | `PLT-007_rune-conveyor_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

EDIT THE ATTACHED IMAGE. Keep the whole picture exactly the same: same framing, same size and position of everything, same colours, lighting and painting style. Change ONLY the lower part of the brass score machine on the left and the desk in front of it:
1. Replace the large slanted blank brass plate on the machine with an arcane display window: a wide, glass-fronted window set into the machine, framed in polished brass with rivets. Behind the glass is a dark interior lit by a faint cyan arcane glow, with a narrow horizontal conveyor belt of linked brass plates running left to right over small rollers. The belt is EMPTY: nothing is standing on it. Under the window, add a narrow, blank brass name strip with no lettering.
2. Remove the red velvet medal tray from the desk completely. Paint the walnut desk top there, keeping the loose scroll and the ink spot at the far left.

DO NOT CHANGE: the drum counter, the small plates, the glass tubes and their contents, the gears, pipes and steam, the typewriter, or anything else. Do not add any text, numbers, medals or objects.
```

**Acceptance criteria:** A wide glass display set into the machine where the level plate was, with an empty belt inside and a blank strip under it; the desk tray is gone and the desk looks natural.
**Expected limitations:** The model may put medals or objects on the belt (ask it to remove them) or make the window too small; it must fit medals about 90 px tall at 1080p.

---

## PLT-008 · Typewriter: 8 spell keys, Ward orb; desk: pipe instead of gauge

| Field | Value |
|---|---|
| **Purpose** | Spell keys 1–8 cast in Normal (as now) and light up with charges; a glass orb on the typewriter shows the Ward draining and its scar; a big smoking pipe on the desk (D-096). |
| **Kind** | Edit |
| **Technical** | 16:9 edit of the clean plate; the typewriter and the lower-right desk are used. |
| **Attach** | `TYPEL-BASE_clean-plate_v1.png` (the clean plate from batch 01; also at `assets-src/work/PLT/clean-plate_v1_1920.png`) |
| **Return as** | `PLT-008_spell-keys-orb-pipe_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

EDIT THE ATTACHED IMAGE. Keep the whole picture exactly the same: same framing, same size and position of everything, same colours, lighting and painting style. Change ONLY the typewriter and the desk at the lower right:
1. Above the top row of letter keys, add a new row of exactly EIGHT spell keys, centred on the typewriter. Each spell key is round, a little larger than the letter keys, with a thick polished brass rim and a clear, colourless faceted crystal set into the middle of its ivory cap. No letters, numbers or symbols. Make room by moving the letter keys down a little; the paper, the platen and the top of the typewriter must not move.
2. On the right side of the typewriter, replace the brass gear wheel and the crank handle with a round glass orb about as wide as three keys, held in an ornate brass cage bolted to the typewriter's side and joined to it by a short brass pipe. The orb is clear, EMPTY glass with bright highlights; there is nothing inside it.
3. Remove the WARD STRENGTH gauge and its cable from the desk at the lower right.
4. In its place, lay a large, long-stemmed wizard's pipe resting on the desk: a carved dark briar bowl with a brass band and a long curved stem, its bowl glowing faintly with embers. No smoke.
Keep the pinned parchment note where it is.

DO NOT CHANGE: the paper, the platen, knobs and levers, the colour and style of the letter keys, the score machine, the shelf, the sky, or anything else. Do not add hands, text or other objects.
```

**Acceptance criteria:** Exactly 8 spell keys in a row, centred, each with a clear crystal; the paper’s top edge has not moved (it is the Ward line); the orb is empty, clearly glass and readable at a glance; gauge gone; the pipe reads as a pipe, with no smoke.
**Expected limitations:** This is the most complex edit. Likely problems: 7 or 9 keys, tinted crystals, a squashed keyboard, or a moved paper. If it fails twice, split it: first the spell keys only, then the orb, pipe and gauge on the result.

---

## RIB-001 · Shelf ribbon markers ×8

| Field | Value |
|---|---|
| **Purpose** | A ribbon in each spell’s colour hangs from its shelf, so an empty slot still shows which spell belongs there; shown only once that spell is learned (D-096). |
| **Kind** | New image |
| **Technical** | 16:9 sheet on flat magenta; I split it into 8 files (~22×80 px each in game). |
| **Attach** | `REF-001-C4_spell-rack.jpg` (shelf close-up) for style |
| **Return as** | `RIB-001_shelf-ribbons_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

TASK: Paint a neat set of EIGHT small hanging satin ribbon markers, like bookmark ribbons hung from a shelf edge, in the same painted style as the attached Typel concept art. Each ribbon hangs straight down from a small brass clip at the top and ends in a swallowtail (V-notched) tip at the bottom; each is about four times taller than it is wide, with a soft satin sheen and a crisp dark-umber outline. All eight are identical in size, shape, angle and lighting, arranged in one row with clear empty gaps between them; only the colour changes. Left to right: 1. soft violet, 2. burnt orange, 3. icy cyan, 4. pale periwinkle-silver, 5. golden yellow, 6. dusty rose-pink, 7. leaf green, 8. amber gold.

BACKGROUND: one perfectly flat, uniform, pure magenta colour (#FF00FF). No shadow, no gradient, no glow on the background, no surface, no scenery.

DO NOT INCLUDE: text, numbers, emblems, a shelf, overlapping ribbons.
```

**Acceptance criteria:** Eight identical ribbons in the right colour order, separated by magenta, satin-painted like the painting.
**Expected limitations:** Colour order may shuffle (I can re-map if every colour is distinct); pink and violet sit closest to magenta, so I’ll check their edges.

---

## KEY-001 · Spell gems ×8

| Field | Value |
|---|---|
| **Purpose** | Set into the crystals of the spell keys: lit when that spell has charges, flash on cast, dimmed when empty or in Hardcore. |
| **Kind** | New image |
| **Technical** | 16:9 sheet on flat magenta; split into 8 (~30 px in game). |
| **Attach** | `REF-001-C2_typewriter.jpg` (typewriter close-up) for style |
| **Return as** | `KEY-001_spell-gems_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

TASK: Paint a neat set of EIGHT round cabochon gemstones, in the same painted style as the attached Typel concept art: smooth polished domes with a soft inner glow, a bright highlight at the upper left and a thin dark-umber outline, seen from slightly above like the key caps on the typewriter. All eight are identical in size, shape and lighting, in one row with clear empty gaps between them; only the colour changes. Left to right: 1. soft violet, 2. burnt orange, 3. icy cyan, 4. pale periwinkle-silver, 5. golden yellow, 6. dusty rose-pink, 7. leaf green, 8. amber gold. No settings or rims; just the stones.

BACKGROUND: one perfectly flat, uniform, pure magenta colour (#FF00FF). No shadow, no gradient, no glow on the background, no surface, no scenery.

DO NOT INCLUDE: text, numbers, symbols, rims, keys or overlapping stones.
```

**Acceptance criteria:** Eight round smooth stones, same size and lighting, right colour order, separated by magenta.
**Expected limitations:** Gems may come out faceted or set in rims; a rim is fine if all eight match.

---

## MIX-001 · Hardcore lock bar, Normal and Hardcore seals, Ward orb liquid

| Field | Value |
|---|---|
| **Purpose** | Lock bar: laid across the spell keys in Hardcore (spell keys don’t cast there). Seals: on the stage banner, blue = Normal, red skull = Hardcore. Orb liquid: drawn inside the Ward orb and drained as the Ward takes damage. |
| **Kind** | New image |
| **Technical** | 16:9 sheet on flat magenta; I split it into 4 files. |
| **Attach** | `REF-001-C2_typewriter.jpg` for style |
| **Return as** | `MIX-001_lock-seals-orb_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

TASK: Paint four separate objects in the same painted style as the attached Typel concept art, well spaced apart with clear empty gaps, none overlapping:
1. Across the top: a long, heavy locking bar of blackened iron, perfectly horizontal and about ten times longer than it is tall, with a riveted brass clamp at each end and a small brass padlock hanging from its middle.
2. Bottom left: a round wax seal in deep midnight blue with a feather-quill emblem pressed into it.
3. Bottom middle: a round wax seal in blood red with a small grinning skull emblem pressed into it, the same size and style as the blue seal.
4. Bottom right: a perfect sphere of luminous, swirling arcane liquid in teal-green with brighter cyan streaks and tiny sparkles, glowing softly from within; no glass, no container, just the floating sphere of liquid.

BACKGROUND: one perfectly flat, uniform, pure magenta colour (#FF00FF). No shadow, no gradient, no glow on the background, no surface, no scenery.

DO NOT INCLUDE: text, letters or numbers; any other objects; shadows on the background.
```

**Acceptance criteria:** All four objects present and separate; the bar is long and straight; the two seals are the same size; the liquid is a clean glowing sphere with no glass.
**Expected limitations:** The skull may come out cartoonish; the sphere’s soft glowing edge needs gentle keying; if the sphere has glass, ask again with “no glass”.
