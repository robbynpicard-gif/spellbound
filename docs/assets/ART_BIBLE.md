# Typel — Art Bible

_Version 1 · 2026-11-21 · Owner: creative director (the owner) · Maintained by Claude · Status of this document: **PROPOSED**, derived from the approved reference. The owner's approval of individual assets is recorded in `ASSET_MANIFEST.md`._

## 0. Authority

- **Primary visual reference (owner-approved, 2026-11-21):** `assets-src/reference/REF-001_typel-concept-primary_v1.png` (5376×3024, SHA-256 `3e13600b…88beb`). Its painterly illustration, composition, Renaissance machinery, colours, lighting, personality and materials are the target.
- **Not a reference:** the old pixel-art backdrops in `public/assets/art/`, `docs/art-direction.md` (gothic pixel art, superseded) and the earlier procedural Canvas painting in `src/typel/render/paint.ts` (unused since D-093).
- **Current game art (D-093):** layers cut from REF-001 in `public/assets/typel/keyart/`. They are REF-001 itself, so they're on-style by definition; requests in this workflow replace their patched or fixed-pose parts.
- **Design decisions that still bind the art:** D-093 (the painting is the look; the paper is the Ward line; the rune arch shows the Ward), D-088's rules that carried over (hidden exact points, the strike-point paper), D-089 (block-capital handwritten scroll lettering; spell scrolls shimmer; Rune categories), D-087 (grounded, mature, satirical), and the readability rules in `docs/definitive-creative-direction-2026-11-20.md`.
- Every colour value below was **sampled from the reference** with `tools/assets/prep.py`-style median sampling (the rectangles are in `palette.json`). They are medians of painted, lit areas, so treat them as targets for the overall impression, not exact paint chips.

## 1. Style in one paragraph (the shared style block)

This paragraph is pasted, unchanged, into every Flow prompt. Changing it is a versioned decision (record it in the change log at the end).

> **TYPEL SHARED STYLE v1:** Hand-painted digital fantasy illustration that matches the attached Typel concept art exactly in technique: painterly brushwork with soft blended gradients and fine visible brush texture, confident dark-umber (never pure black) contour lines on object edges, warm saturated colour, storybook-meets-premium-indie-game finish. World: an Arcane Renaissance alchemist-wizard's workshop. Materials: aged polished brass with warm cream highlights and deep umber shadows, round rivets and engraved filigree; dark walnut and mahogany wood with visible grain; warm cream parchment with soft stains; ivory; clear glass with bright rim highlights; dark blackened iron. Lighting: cool blue-violet moonlight from the upper left as a rim light, warm amber candlelight from below on both sides as the fill, strong readable value contrast, soft shadows in crevices. Mood: whimsical, grounded, quietly satirical, mature; neither childish cartoon nor grim and dark.

## 2. Rendering characteristics

| Aspect | Rule | Seen in the reference |
|---|---|---|
| Technique | Painted, not rendered: soft gradients plus controlled brush texture. No 3D/CGI look, no photo textures, no pixel art, no flat vector. | Counter drum, tubes, rack wood |
| Contour | Thin, dark-umber outline on silhouettes and major forms (roughly 2–4 px at 1080p), lighter or absent on soft things (smoke, clouds, glow). | Scroll banners, keys, rack |
| Edges | Crisp silhouettes for anything interactive (scrolls, keys, rack rolls); soft edges only for atmosphere. | Words stay sharp against a soft sky |
| Detail density | High on the frame (machine, typewriter, rack); **low in the battlefield** where words travel; medium on the background. | The sky behind the scrolls is mostly soft cloud and gradient |
| Saturation | Warm materials are moderately saturated; magic (spell colours, Rush green, Ward cyan) is the most saturated thing on screen. | Green Rush tube, spell rolls |
| Texture scale | Wood grain, brass scratches and parchment stains are visible at 1080p but never noisy behind text. | |

## 3. Colour palette (sampled)

Values are medians of the named regions in REF-001 (see `palette.json` for p10/p90 and rectangles).

**Environment and sky**

| Role | Sample | Notes |
|---|---|---|
| Upper sky violet | `#433964` | darkest, top of the window |
| Sky blue (mid) | `#4f5f76` | behind most words |
| Cloud teal-blue | `#486e80` | soft clouds in the field |
| Lower haze | `#6b7e88` | brighter near the horizon |
| Moon highlight | `#9ac0d0` | cool, never pure white |
| Stone wall | `#1e223f` | blue-shadowed stone behind the machine |

**Materials**

| Role | Sample | Notes |
|---|---|---|
| Parchment (scroll banner body) | `#d4bb95` | word scrolls; p90 `#dfc89f` |
| Paper (typewriter sheet) | `#eedcbe` | lighter than scrolls: the brightest neutral on screen |
| Scroll ink (word lettering) | `#15100d` | near-black warm brown |
| Red ink (typed letters) | `#5e1f17` (shadow) → `#742c23` | the typewriter's stamped letters |
| Brass plate (mid) | `#a98551` | name plates, frames |
| Brass highlight | `#e3c2a1` – `#fce19e` | specular edges; drum faces `#fce19e` |
| Brass shadow / iron | `#251c10` / `#40342b` | machine body |
| Rack walnut (lit) | `#805e42` | |
| Rack interior (shadow) | `#2e1c14` | |
| Typewriter wood | `#795138` | |
| Desk floor | `#473328` | |
| Ivory key caps | `#d9be86` | warm, not white |
| Velvet (medal tray) | `#5e2429` | |
| Candle wax / flame | `#b8a077` / `#e7b881` | |

**Magic and state colours**

| Role | Sample | Game meaning |
|---|---|---|
| Combo liquid | `#498fb4` | Precision Combo tube |
| Arcane Rush glow | `#baec9a` (core) | Rush tube, field-edge glow |
| Ward runes | `#9dd0ab` | the rune arch / Ward light |
| CATCH! warning | red ring around a plunging scroll | catch loop |

**Spell family colours (rack rolls, in rack order).** These match the code's `SPELL_HUE` order and hues (`src/typel/render/paint.ts`); the reference paints them lighter and more pastel on parchment:

| # | Spell | Reference roll | Code `SPELL_HUE` |
|---|---|---|---|
| 1 | Slow | `#a57ebc` violet | `#8e5cd6` |
| 2 | Fire | `#d98152` orange | `#e8641c` |
| 3 | Ice | `#71c7ca` cyan | `#3cc4d4` |
| 4 | Barrier | `#b0b1ba` periwinkle-silver | `#8aa6d8` |
| 5 | Shock | `#d2b852` yellow | `#e8c21a` |
| 6 | Alter | `#c27d82` (lit) / `#94525d` (shade) rose | `#d65a8e` |
| 7 | Wind | `#73944e` (lit) / `#4d6d3c` (shade) green | `#4fbf78` |
| 8 | Harvest | `#c49240` gold | `#e0a030` |

## 4. Lighting and shadow

- **Key/rim light:** cool moonlight from the **upper left** (the moon sits upper-left of the window). Brass and glass catch cool rim highlights on their upper-left edges.
- **Fill:** warm candlelight from **below, left and right** (candles stand beside the machine and beside the rack). Undersides of brass glow amber.
- **Magic is a light source:** the Rush tube, Ward runes and spell effects cast coloured glow on nearby brass and wood (code adds additive glows on top; painted assets should show only a faint baked glow, so live effects stay readable).
- Shadows are warm umber/plum, never neutral grey or pure black. Contact shadows are soft.
- **Isolated assets** (on magenta) are lit as if they stood in the scene, but cast **no shadow onto the background**; code adds drop shadows where needed.

## 5. Perspective and camera

- The player is **seated at the desk, looking forward and slightly down** into the window (first person, hands visible). Eye level is about two-thirds up the screen.
- The typewriter is seen from the typist's seat: front of the keyboard nearest, slight downward view onto key caps, the paper standing up from the platen facing the player.
- The machine column (left) and rack (right) are seen nearly **front-on** with a gentle inward turn toward the centre; their sides barely show.
- Background architecture uses one-point perspective centred on the window. No dramatic fish-eye, no Dutch angles.
- All assets share this camera so they can be layered without looking pasted in.

## 6. Material treatments

| Material | Treatment |
|---|---|
| **Parchment** | Warm cream body, slightly darker toasted edges, soft coffee-stain blotches toward the ends, rolled ends with a dark spiral; flat and clean in the middle where text sits. Never wrinkled under the letters. |
| **Wood** | Walnut/mahogany with long visible grain, carved scrolls and acanthus on crests, worn lighter edges where hands touch; dark interiors. |
| **Brass** | Warm gold mid-tone, cream specular streaks, umber shadows, round rivets every few centimetres, engraved filigree and small sunburst/star motifs; slight green patina only in deep crevices. |
| **Iron** | Blackened blue-grey iron panels between brass frames, low contrast, matte. |
| **Glass** | Clear with a faint cool tint, bright vertical highlight strip, darker refraction at the edges; contents are drawn by code. |
| **Ink** | Warm near-black for print; oxblood red for the typewriter's stamped letters; ink splatter is small, angular specks. |
| **Magical energy** | Luminous, wispy, flowing ribbons with tiny sparkles; spell-coloured; brightest at the core with soft falloff. Drawn mostly by code (particles, additive glows) so it can react to gameplay. |

## 7. Outline and edge treatment

- Interactive or readable shapes: crisp dark-umber contour + 1–2 px light inner highlight on the lit side (the reference's scroll banners and keys).
- Background shapes: contour fades with distance; far castle and islands have soft, low-contrast edges.
- No white "sticker" outlines, no glow halos baked around isolated assets (they read as cut-out mistakes when keyed).

## 8. Typography and readability

- **All changing text is rendered live by the game**, never painted: words, typed letters, score digits, multipliers, counts, level names, Rune names, Master's notes. Painted assets must have **blank** surfaces where these go.
- Word scrolls: bold handwritten **block capitals** (current font Kalam Bold, D-089), near-black ink `#15100d`-ish on `#d4bb95` parchment. Target contrast ratio ≥ 7:1.
- Typewriter stamps: large red-ink slab-serif capitals on the lightest paper.
- Engraved numbers/labels (score drum, plates): Cinzel (D-087) in dark umber or oxblood on brass/cream.
- The title logo "TYPEL" is the one place lettering may be designed as art, and it will be done as a separate, carefully checked asset (generators misspell).
- Readability beats atmosphere: nothing behind the field may be brighter than the scroll parchment or busier than a soft cloud.

## 9. Composition and visual hierarchy

Since D-093 the play screen **is** the painting's composition: the painting scaled to 1920×1080 is the game's coordinate space (`src/typel/render/keyart.json`; annotated in `docs/assets/guides/G-000_play-layout_1920x1080_labelled.png`). New assets must land on the same positions.

1. **Falling word scrolls**: the field is the sky inside and around the rune arch, x 610–1550, y 60–655. Highest contrast, always on top.
2. **The paper on the typewriter**: its top edge (y ≈ 661) is the Ward line. Brightest neutral; the typed word stamps here.
3. **The typewriter and hands**: bottom centre; the physical heart of the scene. The rune arch glows as the Ward.
4. **Score engine** (left): drum counter, BASE / ×COMBO / ×RUSH plates, Combo and Arcane Rush tubes, level plate, medal tray.
5. **Spell shelf** (right): eight scrolls in game order with live counts.
6. **Grand Wizard** on his cloud (top right), **Ward Strength gauge** and **Master's note** (desk, lower right), candles.
7. **Background**: stone alcove, night sky, moon, floating islands, distant castle; calm where words fall.

## 10. Animation principles

- **Physical first:** keys depress 3–5 px and spring back (≈90 ms); typebars swing to the strike point; drum digits roll mechanically; rolls fly and *knock* into the rack. Motion has weight and settles; never floaty.
- **Gameplay owns position.** Animation is cosmetic: it never moves a scroll's hitbox, changes a fall speed or delays input (D-069, definitive direction).
- **Layered, not baked:** moving parts are separate sprites (keys, typebar, carriage, hands, gauge needle, drum digits, liquids). Painted plates do not contain anything that moves.
- **Reduced motion:** every looping or shaking animation has a still alternative (`prefs.reducedMotion()`).
- **Frame-by-frame animation is avoided** for AI-generated art (frames drift). Use rigid parts plus tweens, and code-drawn particles for magic.

## 11. Anti-patterns (reject or revise)

- Pixel art, chibi/cartoon proportions, glossy mobile-game UI, flat vector icons, 3D-render or photographic look.
- Any painted text, letters, numbers, runes that look like Latin letters, logos, signatures or watermarks on gameplay assets.
- Busy, bright or high-contrast detail behind the word field; a bright moon or castle where words fall.
- Pure black shadows or pure white highlights over large areas; neon colours outside magic.
- Baked drop shadows or glows around isolated assets; magenta fringes after keying.
- Gritty grimdark (retired, D-086) or candy funland (retired, D-087).
- Casino/slot-machine styling (the score drum is a mechanical counter, not a slot machine).
- Visual drift between batches: if a new asset's brass, wood or line weight no longer matches approved ones, it is flagged for revision, never hidden in integration.

## 12. Reference library

Approved assets become references for later requests (see `REFERENCE_GUIDE.md`). Each request lists exactly which files to attach.

## Change log

| Version | Date | Change |
|---|---|---|
| 1 | 2026-11-21 | First version, derived from REF-001. Shared style block v1. Palette sampled. |
