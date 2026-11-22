# Batch 01 — Clean plate and word scroll

_Requested 2026-11-21 · Shared style block: **TYPEL SHARED STYLE v1** (ART_BIBLE §1) · Prompts: v1_

## Why this batch is first

Since D-093 the game is built directly from your painting. It's cut into layers, and every number, word and meter is live on top. Wherever something live was painted (the words on the scrolls, the drum digits, plate values, medals, the typed word, the shelf scrolls, the note's handwriting, the gauge needle), the D-093 cut had to fill the hole by guessing. Those filled patches are the soft, smeary areas you can see in the current preview: the middle of the sky, the drum faces, the plates, the empty shelves and the paper.

This batch replaces those patches with properly painted, clean versions, plus the one gameplay object every word sits on (the plain parchment scroll). It is the most visible improvement for the least art, and nothing in it is decorative-only.

**Method.** The four PLT requests are *edits of your painting*, not new paintings. Each asks Flow to change one area only. When you send the result back, I:
1. line it up exactly with the original (`prep.py align`),
2. check what changed (`prep.py diff`),
3. copy in only that area, blending the edges (`prep.py composite`, areas in `plate-regions.json`).

Anything the edit changed outside its area is ignored, so the rest of the painting stays exactly as you approved it.

The area map is in `docs/assets/guides/G-PLT_edit-regions_1920x1080_labelled.png`:
- blue: PLT-001;
- yellow: PLT-002;
- red: PLT-003;
- green: PLT-004.

**Order:** any. PLT-001 (the sky) and SCR-001 (the scroll) matter most, because they sit right where the player reads.

## How to make and return each asset

1. In Flow, start an **image** generation with the Nano Banana image model.
   - The four PLT requests are **edits**: attach the painting as the image to edit.
   - SCR-001 is a **new image**.
   - If your Flow doesn't offer image editing, the Gemini app's image editing (also Nano Banana) does the same job.
2. Attach the files listed under **Attach**, in that order.
3. Choose the **aspect ratio** listed.
4. Paste the **Flow prompt** exactly.
5. Generate 2–4 candidates. Pick the best one or two using the **acceptance criteria**.
   - If Flow offers an upscale (2K/4K), upscale your pick before downloading.
6. Download as **PNG**. Rename it as given under **Return as**. Add `_a` and `_b` if you send two candidates.
7. Attach the files to this chat. Say which one you prefer and whether you approve it.
   - An upload alone stays **UNDER REVIEW**.

**Files to attach** (I'm sending them to you with this request):
- `REF-001_typel-concept-primary_v1.png`: your original painting, full resolution.
- `REF-001-C3_word-scrolls.jpg`: a close-up of the word scrolls.
- `G-SCR-001_word-scroll_16x9.png`: a flat shape map for the scroll.

---

## PLT-001 · Clean sky (no scrolls, no wizard)

| Field | Value |
|---|---|
| **Purpose** | The sky the words fall through, which is the field (x 610–1550, y 60–655). It is currently patched where the eight painted scrolls were. The Grand Wizard is drawn as his own layer, so the plate behind him needs plain sky too. |
| **Visual reference** | Your painting: the night sky, clouds, stars, moon, rune arch, green wisps, floating islands and castle stay as they are. |
| **Style** | Unchanged from the painting. |
| **Composition** | Identical framing. Only the sky's contents change. |
| **Technical** | **Edit** of REF-001, 16:9, the largest size offered. Used at 1920×1080. Only the blue area is taken. |
| **Attach** | 1. `REF-001_typel-concept-primary_v1.png` (the image to edit) |
| **Return as** | `PLT-001_clean-sky_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

EDIT THE ATTACHED IMAGE. Keep the whole picture exactly the same: same framing, same size and position of everything, same colours, lighting and painting style. Change ONLY the following, in the night sky:
1. Remove all eight floating parchment word scrolls (FIREBALL, FROSTBITE, LEVITATE, HEX, TRANSMUTE, ALAKAZAM, BEFUDDLE and MISCHIEF), together with everything attached to them: the flames, icicles, yellow lightning, purple sparks, gold corner brackets and chevrons, the red ring and the red CATCH! stamp, and the pale light streaks above MISCHIEF.
2. Remove the blue rolled scroll flying toward the shelf on the right, with its spark trail.
3. Remove the old wizard with the pipe and teacup, together with his cloud, smoke and steam.
Where those things were, paint the night sky that would naturally be behind them: the same soft violet-to-blue gradient, soft clouds and a few small stars, continuing the green magic wisps and the distant floating islands and castle where they pass behind. Keep the middle of the sky calm and soft.

DO NOT CHANGE: the moon, the glowing rune arch, the TYPEL title banner, the green wisps, the score machine, the typewriter, the hands, the shelf, the candles, the note, the gauge, or anything else. Do not add any new objects, text or characters.
```

**Negative constraints:** no new objects, text or creatures in the sky. No changes outside the sky. No sharper or brighter detail in the middle of the sky than the painting has.
**Acceptance criteria:** all eight scrolls, the flying scroll and the wizard are gone. The sky behind them is believable and calm. The arch, wisps, moon and castle are intact where they show. No ghost outlines of scrolls.
**Expected limitations:** edits can miss one item (often MISCHIEF's ring or the flying scroll's sparks) or leave faint ghost rectangles; send a second pass ("also remove …") if so. The model may subtly repaint the whole image; that's fine, since only the sky area is used. It may also recolour the sky slightly, which I'll match at the blended border. If the arch runes change shape inside the area, I'll keep the original runes (the arch is its own layer anyway).

---

## PLT-002 · Clean score engine (blank drums, plates, level plate; empty tray)

| Field | Value |
|---|---|
| **Purpose** | The game draws the score, BASE / ×COMBO / ×RUSH values, level name and medals live. These currently sit on patched surfaces. |
| **Visual reference** | The brass score machine on the left of your painting. |
| **Composition** | Identical framing. Only the drum faces, plate faces, level plate face and tray contents change. |
| **Technical** | **Edit** of REF-001, 16:9, the largest size offered. Only the yellow areas are taken. |
| **Attach** | 1. `REF-001_typel-concept-primary_v1.png` (the image to edit) |
| **Return as** | `PLT-002_clean-engine_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

EDIT THE ATTACHED IMAGE. Keep the whole picture exactly the same: same framing, same size and position of everything, same colours, lighting and painting style. Change ONLY the following, on the brass score machine at the left:
1. The six rolling drum wheels of the big score counter: remove every digit and the comma, so each wheel shows a clean, blank, curved cream-and-brass face with the same shading and the same grooves between the wheels.
2. The three small brass plates under the counter (BASE, xCOMBO, xRUSH): remove all their lettering, so they are blank polished brass plates with the same frames and rivets.
3. The large slanted brass plate lower down (LEVEL 4: THE WARD): remove all its lettering, so it is a blank polished brass plate with the same frame.
4. The red velvet tray at the bottom left: remove the three medals and their ribbons, leaving three empty, softly shadowed hollows in the red velvet.

DO NOT CHANGE: the glass tubes or their blue and green contents, the pipes, gears, crest or steam, the sky, the typewriter, or anything else. Do not add any text, numbers or symbols.
```

**Negative constraints:** no leftover or new digits or letters. The tubes' contents and other parts stay as they are.
**Acceptance criteria:** drums, the three plates and the level plate are blank and still look like polished brass/cream with the same shading. The tray is empty velvet. The machine is otherwise unchanged.
**Expected limitations:** this is the hardest edit, because models like to rewrite text rather than remove it. If you see scrambled letters, re-run with "make them completely blank, no characters at all". Faint marks I can clean up by hand, since these faces are simple gradients.

---

## PLT-003 · Clean typewriter and desk (blank paper, no hands, blank keys, blank note, no needle)

| Field | Value |
|---|---|
| **Purpose** | The typed word, the typebar, the hands, the Master's lines and the gauge needle are all live or animated layers. Painting them out underneath stops ghosting when they move (the hands dip, the hammer swings, the needle sweeps). Blank keys let the game print the key letters itself and press them cleanly. |
| **Visual reference** | The typewriter, the desk, the pinned note and the Ward Strength gauge in your painting. |
| **Composition** | Identical framing. Only the paper, the keyboard area under the hands, the note's writing and the needle change. |
| **Technical** | **Edit** of REF-001, 16:9, the largest size offered. Only the red areas are taken. |
| **Attach** | 1. `REF-001_typel-concept-primary_v1.png` (the image to edit) |
| **Return as** | `PLT-003_clean-desk_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

EDIT THE ATTACHED IMAGE. Keep the whole picture exactly the same: same framing, same size and position of everything, same colours, lighting and painting style. Change ONLY the following, at the typewriter and on the desk:
1. The paper in the typewriter: remove the red word INCANTAT, the ink splatter and the small typebar hammer striking the paper, so the paper is a clean, blank, cream sheet.
2. Remove both hands and both purple sleeves completely. Paint the rest of the typewriter keyboard that was underneath them: the same rows of round keys with polished ivory faces in brass rims, the keyboard's walnut body and brass frame, continuing down to the bottom edge of the picture.
3. Make every key cap face completely blank ivory, with no letters on any key.
4. The pinned parchment note at the lower right: remove all the handwriting, leaving blank parchment with its red pin, folds and stains.
5. The WARD STRENGTH gauge at the lower right: remove the black needle, leaving the dial face with its scale, red zone and centre cap.

DO NOT CHANGE: the platen, knobs, levers or brass frame of the typewriter, the desk, the candles, the shelf, the score machine, the sky, or anything else. Do not add any hands, people, text or objects.
```

**Negative constraints:** no hands, no letters on keys or paper, no handwriting, no needle. Nothing new on the desk.
**Acceptance criteria:**
- The paper is blank.
- The keyboard is complete and believable under where the hands were (round ivory keys in staggered rows, matching the visible ones).
- Every key is blank.
- The note is blank.
- The gauge has no needle.
- The typewriter's shape and position are unchanged, especially the paper's top edge: it is the Ward line.

**Expected limitations:**
- The keyboard under the hands is invented, so key spacing may not match the painted rows exactly. I'll check it against the live key positions in `keyart.json` and ask for a revision if the rows drift.
- If blank keys come back with letters on some, a second pass ("make every key blank") usually fixes it.
- The "WARD STRENGTH" words on the gauge may get garbled. The game can print that label live if needed.

---

## PLT-004 · Empty shelf

| Field | Value |
|---|---|
| **Purpose** | The eight spell scrolls on the shelf are separate live layers (counts, greyed-out when empty, jump on cast, rattle on knock), so the shelf behind them should be empty. It is currently patched. |
| **Visual reference** | The tall walnut shelf on the right of your painting. |
| **Composition** | Identical framing. Only the shelf's contents change. |
| **Technical** | **Edit** of REF-001, 16:9, the largest size offered. Only the green area is taken. |
| **Attach** | 1. `REF-001_typel-concept-primary_v1.png` (the image to edit) |
| **Return as** | `PLT-004_empty-shelf_v1.png` |

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

EDIT THE ATTACHED IMAGE. Keep the whole picture exactly the same: same framing, same size and position of everything, same colours, lighting and painting style. Change ONLY the following, on the tall wooden shelf cabinet at the right:
1. Remove all eight rolled, coloured scrolls lying on the shelves, with their ribbons and seals.
2. Remove the white numbers (x4, x1, x3 and so on) beside them.
Where they were, paint the empty shelves: the dark walnut interior of each compartment, its back wall and its shelf board, with the same soft warm candlelight and shadows. All eight compartments stay, evenly spaced, and are completely empty.

DO NOT CHANGE: the cabinet's frame, carved crest or brass trim, the candle, the sky, the note, the gauge, or anything else. Do not add any objects or text.
```

**Negative constraints:** no objects left on the shelves, no numbers. The number of shelves and their spacing are unchanged.
**Acceptance criteria:** eight empty compartments with clean interiors, lit consistently. The cabinet is otherwise identical.
**Expected limitations:** the flying scroll overlaps the fourth shelf, so the model may leave part of it. A second pass, or PLT-001's result, covers that.

---

## SCR-001 · Plain word scroll (blank, isolated)

| Field | Value |
|---|---|
| **Purpose** | The parchment banner behind every falling word. The game prints the word and stretches the middle to fit any length. It replaces the current `scroll_plain.png`, which was cut from the painted TRANSMUTE scroll, letters removed. Batch 02 adds the elemental versions for spell scrolls. |
| **Visual reference** | The TRANSMUTE and ALAKAZAM banners in your painting (crop C3). |
| **Style** | Parchment `#d4bb95` (body) to `#dfc89f` (light), dark-umber outline, toasted edges, rolled ends with dark spirals. |
| **Composition** | One level, horizontal, blank banner, centred, about 80% of the width, with a rolled end at each side. |
| **Technical** | **New image**, 16:9, on flat magenta. I cut it into left end, stretchable middle and right end. It ships at the game's scroll size (67 px tall, plus a 2× version). |
| **Attach** | 1. `REF-001-C3_word-scrolls.jpg` · 2. `G-SCR-001_word-scroll_16x9.png` |
| **Return as** | `SCR-001_word-scroll_v1.png` |

**Why magenta:** Flow can't make real transparency. So the scroll is painted on flat pure magenta, a colour Typel never uses, and I cut it out. A flat background with no shadow or gradient gives the cleanest cut.

**Flow prompt (copy all):**

```
TYPEL SHARED STYLE v1: Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

TASK: Paint ONE horizontal parchment scroll banner exactly like the plain word banners in the first image (such as the TRANSMUTE and ALAKAZAM banners), but completely BLANK, following the shape map in the second image. A long, flat, rectangular strip of warm cream parchment with slightly toasted edges and a crisp dark-umber outline, with a rolled-up end at each side; each roll is a vertical cylinder slightly taller than the strip, with a visible dark spiral at its top and bottom. Centred, perfectly straight and level, filling about 80 percent of the width of a 16:9 image. No tilt, no curl, no flutter.

The middle 70 percent of the strip must be flat, evenly coloured, clean parchment, because the game will print a word there: no stains, wrinkles, writing, seals or ribbons in the middle. Light stains are allowed only near the rolled ends.

BACKGROUND: one perfectly flat, uniform, pure magenta colour (#FF00FF). No shadow, no gradient, no glow, no sky.

DO NOT INCLUDE: any text, letters or numbers; fire, ice, lightning or other magic effects; wax seals; ribbons; a second scroll.
```

**Negative constraints:** no text, magic effects, seals, curl, or uneven middle.
**Acceptance criteria:**
- The banner is level, with a clean, even middle.
- The ends match the painting's scrolls, with a crisp outline.
- The background is flat magenta.
- At game size (about 67 px tall) it reads as the same scroll as in the painting.

**Expected limitations:** the model may write a word on it, which is likely, or curl the banner. Faint marks I can clean; a word or a strong curl needs a redo. The middle is stretched sideways in the game, so its texture must be even.
