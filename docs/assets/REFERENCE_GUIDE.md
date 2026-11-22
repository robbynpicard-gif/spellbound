# TypeL — Reference Guide

_How references, sources and processed files are organised, and which images to attach to Flow for each kind of asset._

## 1. Where files live

| Folder | Contents | Shipped in the game? |
|---|---|---|
| `assets-src/reference/` | Approved references. REF-001 original (byte-identical to the owner's upload) and its 1920×1080 working copy. | No |
| `assets-src/reference/crops/` | Close-up crops of REF-001 to attach to Flow (C1 score engine, C2 typewriter, C3 word scrolls, C4 spell rack). | No |
| `assets-src/flow/<ID>/` | **Untouched originals** exactly as downloaded from Flow, every version (`<ID>_v1.png`, `_v1_a.png`, `_v2.png` …). Never edited. | No |
| `assets-src/work/<ID>/` | Intermediate processing (keyed, cleaned) when worth keeping. | No |
| `public/assets/typel/<group>/` | Final optimised files for new components that have no D-093 layer. Only APPROVED assets go here. | Yes |
| `docs/assets/guides/` | Shape maps for Flow (unlabelled), the play layout and the plate-edit regions (`*_labelled.png`, for people). Rebuild with `python3 tools/assets/guides.py --labelled`. | No |
| `public/assets/typel/keyart/` | The D-093 layers cut from the painting; approved assets replace them file by file. | Yes |
| `docs/assets/requests/` | Each batch's full asset requests and Flow prompts. | No |

Size policy: originals are committed to git for provenance while the total stays modest. If `assets-src/` passes ~500 MB, move originals to Git LFS or the owner's Drive and keep their SHA-256 in the manifest.

## 2. Reference library (what to attach)

| Asset family | Attach first | Then | Then (optional) |
|---|---|---|---|
| Clean-plate edits (PLT) | REF-001 full original, as the image to edit | — | — |
| Word and spell scrolls, stamps | REF-001-C3 crop, later approved SCR-001 | `G-SCR-001` shape map | — |
| Shelf scrolls | REF-001-C4 crop | approved RCK-002 roll (for later variants) | — |
| Score engine parts, medals, gauge | REF-001-C1 crop | approved PLT-002 result | — |
| Typewriter parts, hands | REF-001-C2 crop | approved PLT-003 result | approved HND-001 |
| Grand Wizard | REF-001 full | approved CHR-001 sheet | — |

As soon as an asset is approved, it replaces the concept crop as the first reference for its family, because matching what is actually in the game keeps later batches consistent.

## 3. Approved asset references

| ID | File | Use as reference for |
|---|---|---|
| REF-001 | `assets-src/reference/REF-001_typel-concept-primary_v1.png` | Everything (primary visual reference) |

| PLT-001…008 (via the clean plate) | `assets-src/work/PLT/clean-plate_v2_1920.png` | Any further plate edit: attach this as the image to edit |
| SCR-001 | `assets-src/flow/SCR-001/SCR-001_word-scroll_v1.png` | Spell-scroll variants (SCR-002) |
| RIB-001, KEY-001, MIX-001 | `assets-src/flow/<ID>/…_v1.png` | Small brass/wax/satin props |

## 4. Processing recipes (`tools/assets/prep.py`)

| Situation | Steps |
|---|---|
| Isolated object on magenta | `inspect` (check flat background) → `key --despill --preview` → check preview over dark and light → `trim` → `fit` to in-game size → `export .webp` |
| Plate edit (PLT) | `align EDIT REF-001 aligned.png` (check inliers and residual) → `diff REF-001 aligned.png diff.png` (anything changed outside the region is ignored; anything wrong inside it is a revision) → `composite BASE aligned.png out.png --name PLT-00x` → re-run `tools/keyart` slicing |
| Sprite sheet (e.g. rolls) | `key` → `split --names …` → `fit` each → `export` |
| Stretchable banner | `key` → `trim` → `slice3 --left N --right N` |
| Palette drift check | `compare FILE` (nearest art-bible swatches) plus side-by-side visual check against REF-001 |

Never: over-sharpen, posterise, heavy colour grading, or upscale by more than ~1.5× in processing (ask for a larger generation instead).

## 5. Naming

`<ID>_<slug>_v<version>[_<candidate>].png` for originals (e.g. `TYP-001_typewriter_v1_a.png`). Final files: `public/assets/typel/<group>/<ID>_<slug>.webp`. Versions only go up; a revision of an approved asset gets a new version and goes back through review.
