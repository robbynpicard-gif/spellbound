# Typel — Integration Log

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
