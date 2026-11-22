# TypeL — Integration Log

_Append-only. Records which assets were added, what code changed, which systems were affected, and what was actually tested. Nothing is called integrated or deployed without verification._

## 2026-11-21 · Entry 0 — Asset production system established (no game change)

- **Assets added:** none to the game. Reference only: REF-001 concept art (original, byte-identical, SHA-256 `3e13600b…88beb`) and a 1920×1080 working copy in `assets-src/reference/`, plus four close-up crops for Flow.
- **Code changed:** none in `src/`. New tooling in `tools/assets/` (`guides.py`, `prep.py`, `manifest.py`) — Python, not part of the build.
- **Docs added:** `docs/assets/` (README, ART_BIBLE, AUDIO_BIBLE, ASSET_MANIFEST + `asset-manifest.json`, PRODUCTION_QUEUE, INTEGRATION_LOG, REFERENCE_GUIDE, `palette.json`, `guides/`, `requests/BATCH-01…`). Decision D-094 (see entry 1).
- **Gameplay/audio systems affected:** none.
- **Tested:** `prep.py` exercised on a synthetic magenta test image (inspect, key + despill, trim, split, fit → WebP, slice3, compare): output checked visually over dark and light backgrounds. `manifest.py check` passes. `npm run check` could not run in Claude's workspace (package installs are blocked there); the branch's GitHub Actions validation is the check of record for this commit — see the commit's Actions run.
- **Deployed:** no. The preview is unchanged.

## 2026-11-21 · Entry 1 — Re-based on D-093 (no game change)

- While this system was being set up, another session landed **D-093** (`2eef6be`): the game is now the owner's painting cut into layers (`public/assets/typel/keyart/`, `src/typel/render/keyart.json`). The asset plan was rewritten to replace those layers in place instead of redrawing parts from scratch. The first draft of batch 01 (stage plate, score engine, typewriter, key cap, rack, rolls drawn new) was withdrawn before anything was generated.
- This system's decision is recorded as **D-094** (D-093 was taken).
- Added `prep.py align / composite / diff` and `plate-regions.json`. Tested with a synthetic edit (REF-001 shrunk to 1344×756, zoomed 5 %, shifted, with a painted block): recovered scale 0.9526 and shift (37.9, 28.6) px against the true 0.952 and (38.1, 28.6), median residual 0.6 px; the diff showed only the painted block plus the expected border; the composite changed only the PLT-001 area.
- Guides rebuilt from `keyart.json`: `G-000` play layout, `G-PLT` edit regions, `G-SCR-001` scroll shape.
- **Tested:** tools as above; `manifest.py check`. `npm run check` is not runnable in Claude's workspace (package installs are blocked); GitHub Actions validates the push.
- **Deployed:** no.

## 2026-11-21 · Entry 2 — Batch 01 received and checked (not yet approved, not integrated)

- **Received** (owner upload, no approval stated yet → UNDER REVIEW): PLT-001 ×2 candidates (a, b), PLT-002, PLT-003, PLT-004, SCR-001. All 1344×756 RGB. Originals stored untouched in `assets-src/flow/<ID>/`.
- **Alignment:** every edit came back pixel-registered to REF-001 (scale 1.000, shift 0.0 px, ≥1483/1500 inliers, residual ≤ 0.01 px).
- **Containment** (pixels changed by > 24 levels; at 1344×756 against REF-001):
  - inside its own area, 21–32 %;
  - outside it, 1.1–2.2 %, which is resampling noise plus the flying scroll that PLT-004 also removed.
- **Content:**
  - PLT-001 a and b differ by under 0.1 %; **a** chosen. Sky calm, all eight scrolls, the flying scroll and the wizard removed, no ghosts.
  - PLT-002: drums, plates and level plate blank. Tray hollows are medal-shaped (star-edged), not round; acceptable.
  - PLT-003:
    - paper blank, hammer, hands and sleeves gone, all keys blank, note blank, needle gone, paper top edge unchanged (Ward line intact);
    - the invented keyboard has 3 rows plus a space bar, with the live key positions sitting on keys (A row about 10–15 px left of centre; re-measure at integration).
  - PLT-004: eight empty compartments within about 5 px of the rack layers' positions.
- **My region map was too tight.** The first composite showed edge leftovers: a flame corner, the CATCH! stamp, shelf-scroll ends, "BA" on the plate, and a faint ×4. Fixed in `plate-regions.json`:
  - widened areas;
  - a build order of PLT-003, then PLT-001, then PLT-004, then PLT-002;
  - PLT-004 stops above the gauge;
  - a strip of PLT-001 covers the stamp's lower edge over the paper.
  - New `tools/assets/build_plate.py` + `docs/assets/plate-build.json` rebuild the plate reproducibly: `assets-src/work/PLT/clean-plate_v1_1920.png`, checked visually region by region, no leftovers found.
- **SCR-001:**
  - Flat magenta (#fe01fc). Keyed with despill: 0 % magenta-tinted opaque pixels; trimmed to 1018×260; clean on dark and light.
  - Middle parchment `#f0d9af` (std 1.4, very even) is lighter than the painting's scrolls (`#d4bb95`). A toned variant matching the painting was prepared for comparison (`assets-src/work/SCR-001_compare_v1.png`).
- **Resolution note:** the edits are 1344×756, so the clean areas are upscaled 1.43× to 1920×1080. They are a little softer than the D-093 layers cut from the 5376×3024 original, but sharper than the filled patches they replace. A 2K/4K download of the same edits would drop straight in (same geometry).
- **Game:** unchanged. Nothing integrated; waiting for owner approval.

## 2026-11-21 · Entry 3 — HUD revision requested (D-096); nothing integrated

- The owner asked for layout changes before integrating batch 01 (D-096). They are planned in `guides/G-HUD-REV1_plan_labelled.png`, requested as batch 01b, and set up for a stage-2 plate build (`plate-regions.json` PLT-005…008, `build_order_v2`, `plate-build-v2.json`; `build_plate.py` takes an `order` key).
- WRD-001 (gauge) is rejected and replaced by the orb.
- Batch 01 assets remain UNDER REVIEW: approval of PLT-001 and SCR-001 (and which scroll tone) is still open.
- **Game:** unchanged.

## 2026-11-21 · Entry 4 — Batch 01b received (except PLT-007); Rune display rethought (D-098)

- **Received** (UNDER REVIEW, originals in `assets-src/flow/`):
  - PLT-005;
  - PLT-006 a (1920×1080) and b;
  - PLT-008 a and b;
  - MIX-001, KEY-001, RIB-001.
- **Alignment:** all five edits are registered to the clean plate exactly (scale 1.000, shift 0 px).
- **Findings:**
  - **PLT-005:** title gone, arch continuous. Good.
  - **PLT-006:**
    - TYPEL is spelled correctly in both candidates, and the banner is blank.
    - **Neither shelf has 8 compartments:** a has 7, b has 6–7.
    - Plan: rebuild the interior of candidate a to 8 even compartments from its own painted compartment, by slicing and restacking painted pixels (no code-drawn substitute). Otherwise, a re-roll.
  - **PLT-008:**
    - Both have exactly 8 spell keys, an empty glass orb on the right and the pipe. The gauge is removed, and the paper's top edge is unchanged (Ward line intact).
    - a has larger spell keys and a lightly banded orb (the liquid stays readable). b has an ornate cage whose bars cross the orb.
    - Recommend a.
  - **MIX-001:** all four objects are present. The orb liquid came inside a glass ball; it will be masked to the plate orb's inner circle, so the extra rim is cut away.
  - **KEY-001:** 8 gems in order, but Shock's yellow (5) is close to Harvest's amber (8). Plan: a hue correction of gem 5 toward lemon yellow in processing.
  - **RIB-001:** 8 ribbons in the correct order and colours. Good.
- **PLT-007 re-requested (v2) as a Rune display** (D-098); its region is widened to the machine below the tubes plus the old tray area.
- **Game:** unchanged.

## 2026-11-21 · Entry 5 — PLT-007 v2 received

- **Registration:** exact, against the clean plate.
- **What came back:**
  - a dark scrying pane in a brass frame, with an intake lens at the top and a blank strip below;
  - the desk tray removed, and the pane empty.
- **Size:** the pane is about 310×140 px at 1080p, smaller than asked. That still works if the newest Rune shows centred and large, then shrinks into the recent row.
- **Tubes:** the Combo and Rush tubes were shortened by about 60 px, so their coordinates get re-measured at integration.
- **Status:** UNDER REVIEW. The only open art item is the shelf count (PLT-006).

## 2026-11-22 · Entry 6 — Batch 01 + 01b approved and integrated (commit 75fd2e8)

- **Approval:** the owner approved every asset received from Flow.
- **Choices still open, settled with my recommended defaults** (to be confirmed in review):
  - PLT-008 candidate **a**;
  - SCR-001 **toned** to the painting's parchment;
  - PLT-006 **v2** (it has 8 shelves, so no rebuild was needed).
- **Plate:**
  - Stage 1 is `clean-plate_v1`. Stage 2 is the PLT-005/006/007/008 composites, built by `build_plate.py`.
  - Each stage-2 region was measured from where its edit actually changed the plate.
  - The leftover top of the gauge and the shelf base were fixed by widening the PLT-008 desk area.
- **New layers:** `tools/assets/integrate_hud_rev1.py` (re-runnable) writes:
  - `plate.jpg`, `front.webp`, and `arch.png` (re-cut so the arch runs unbroken where the title was);
  - `scroll_plain.png`: SCR-001 toned, at 2× resolution, 3-slice caps 47 px;
  - ribbons ×8, gems ×8, the lock bar split into a stretchable bar plus a separate padlock, both seals, and the orb liquid.
  - `prep.py key` now also clears enclosed magenta pockets, such as inside the padlock shackle.
- **`keyart.json` changes:**
  - field changed to x 548–1582 × y 0–655;
  - tube bottoms re-measured;
  - new blocks: `shelf` (8 boards), `rackCount`, `spellKeys`, `orb`, `runeDisplay`, `banner`, `pool`, `pipe`.
  - The keyart slicer (`tools/keyart`) must not be re-run over these values: it would restore the D-093 layout.
- **Code (rendering only):**
  - `keyart.ts`: new layers, shelf and ribbon placement, pipe smoke, menu dressing.
  - `PlayScene.ts`:
    - stage banner and seal; progress on the banner;
    - Rune display, Halo-style, replacing the tray (D-098);
    - Ward orb with a liquid level, slosh, and a cracked scar cap, replacing the needle and gauge;
    - spell keys with gems lit by charges, a press and flare on cast, and numbers in Normal;
    - Hardcore lock bar with gems dark;
    - ribbons for learned spells;
    - shelf scrolls at 0.56 scale on the new boards; counts and pool text moved; Rush state label moved inside the tube.
  - `app.ts`: a `stage` label (e.g. "Flame · Level 2", the boss name, "Endless", "Sandbox · Pace N").
- **Unchanged:** the engine, rules, scoring, audio, saves, hitboxes and fall timing. The field enlargement changes only how the logical field maps to the screen.
- **Tested:**
  - GitHub Actions on 75fd2e8: typecheck, all tests and the production build pass. Claude can't install packages in its own workspace, so CI is the check of record.
  - A static mock-up of every new element's position (`/home/claude/work/mock_*`, not committed) was checked by eye.
- **Not verified:** the live preview. Claude's attempt to run the Pages deploy (`deploy.yml`, workflow_dispatch) was refused by its permissions. It needs the owner to start it.
- **Status:** INTEGRATED, not VERIFIED.
