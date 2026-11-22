# Typel — Asset Production System

_Established 2026-11-21 (D-094, building on D-093). **Claude specifies and integrates. The owner generates and approves. Flow produces the visual assets.**_

| Document | Purpose |
|---|---|
| [ART_BIBLE.md](ART_BIBLE.md) | Visual rules derived from the approved concept art, including the shared style block pasted into every prompt |
| [AUDIO_BIBLE.md](AUDIO_BIBLE.md) | The existing audio, documented so it is preserved, plus the spec for future audio requests |
| [ASSET_MANIFEST.md](ASSET_MANIFEST.md) | Every asset and its status (generated from `asset-manifest.json`) |
| [PRODUCTION_QUEUE.md](PRODUCTION_QUEUE.md) | Batches, order, dependencies, open owner questions |
| [INTEGRATION_LOG.md](INTEGRATION_LOG.md) | What went into the game, what code changed, what was tested |
| [REFERENCE_GUIDE.md](REFERENCE_GUIDE.md) | Where files live, what to attach to Flow, processing recipes, naming |
| `requests/` | Full asset requests with copy-ready Flow prompts, one file per batch |
| `guides/` | Flat-colour layout maps attached to Flow |
| `palette.json` | Colours sampled from the concept art |

Tools: `tools/assets/guides.py` (layout maps), `tools/assets/prep.py` (keying, cropping, slicing, export, palette check), `tools/assets/manifest.py` (status updates; renders ASSET_MANIFEST.md).

## Audit of the current rendering (dev branch at D-093 `2eef6be`, 2026-11-21)

**How the Typel preview draws today**

- `src/main.ts` boots Phaser 3.90 at a fixed **1920×1080** canvas, scaled to fit the window. Two scenes: `TypelMenuScene` (`src/typel/render/study.ts`, the world behind the HTML menus) and `TypelPlayScene` (`src/typel/render/PlayScene.ts`). Menus, Codex and options are HTML/CSS (`src/typel/app.ts`, `typel.css`).
- **D-093 (landed while this system was being set up):** the owner's painting is cut into layers by `tools/keyart/` (OpenCV) and loaded by `src/typel/render/keyart.ts` from `public/assets/typel/keyart/`: `plate.jpg` (background with live content removed and filled), `front.webp` (desk, typewriter, lower machine and shelf in front of the scrolls), `arch.png` (the Ward), `wisps.webp`, `wizard.png`, `hand_l/hand_r.png`, `medal_1–3.png`, `rack_<spell>.png` ×8, `scroll_plain.png` (3-slice), `flame.png`, `catch.png`, `hammer.png`, `needle.png`, `gear.png`, Combo/Rush tube parts. Every position is in `src/typel/render/keyart.json`, which is the painting's own space scaled to 1920×1080.
- **Live on top:** score drum digits, plate values, level name, typed letters on the paper, keys (cut from the plate and pressed), tube liquids, medals by tier, shelf counts, gauge needle and scar, the Master's lines, Grand Wizard remarks. Words and their scrolls are positioned from engine state in the field (x 610–1550, y 60–655); **the paper's top edge is the Ward line**.
- **The renderer only reacts to engine events** and reads `GameEngine` state; cosmetic motion never changes hitboxes or speeds. The art pipeline keeps this property.
- The older procedural painting (`paint.ts`, `Hands.ts`) is unused. `public/assets/art/*.png` belong to the legacy game.
- **Text** is live Phaser text: Kalam Bold scroll words, Courier Prime paper, Cinzel plates and numbers. Fonts load from Google Fonts (`index.html`); an offline/Steam build will need them self-hosted in `public/assets/fonts/` (noted, not urgent).
- **Audio** is fully synthesized (AUDIO_BIBLE) and untouched by D-093 and by this work.

**Remaining gaps against the painting (from D-093's own honest-gaps list and this audit)**

| Gap | Visible as | Fix |
|---|---|---|
| Filled-in patches where live content was painted | Soft smears in the middle of the sky, drum and plate faces, empty shelves, paper, note | **Batch 01** PLT-001…004 (edits of the painting) |
| Plain scroll cut from the painted TRANSMUTE scroll | Slight softness, painted-out letters | **Batch 01** SCR-001 |
| Spell scrolls use tints and particles instead of the painting's frosted/burning/crackling banners | Spell scrolls look less painted than the concept | Batch 02 SCR-002 |
| Barrier's shelf scroll is a recoloured Ice scroll | Lavender scroll doesn't match the others | Batch 02 RCK-002 |
| Wizard and hands have one fixed pose each | They can only bob, tilt and dip | Batch 03 CHR-001, HND-001 |
| Medals are the painting's three; effects are particles; a ghost of the painted needle | | Batch 04 |
| Field is narrower than before (940 px vs 1240 px) | Words can sit closer together | D-093 composition; owner playtest, not an art request |

## Asset architecture

1. **Layered components, not one picture.** Painted layers sit behind and in front of live elements; everything that moves or changes is a separate sprite or live text. No number, word or meter is painted into art.
2. **Replace D-093 layers in place.** A new asset keeps the layer's file name, size and position in `keyart.json`, so swapping it needs no layout change. The game stays playable at every step.
3. **Clean plates by editing the painting.** Flow edits REF-001 one region at a time. `prep.py align` registers the edit back to the painting (feature matching, similarity transform), `diff` shows every change, and `composite` takes only the allowed region (`plate-regions.json`). The D-093 slicing then re-cuts `plate.jpg` and `front.webp` from the clean plate.
4. **New isolated objects on magenta.** Scrolls, poses, medals and effects are generated on flat magenta and keyed (`prep.py key --despill`), checked over dark and light backgrounds, trimmed and sized to their slot.
5. **Native 1080p game files, full-resolution sources.** Shipped files match the 1920×1080 canvas; originals stay untouched in `assets-src/flow/`.
6. **Animation by parts and tweens**, never AI frame sequences. Pose sheets give alternate rigid poses; magic stays in code-driven particles and glows so it can respond to gameplay.
