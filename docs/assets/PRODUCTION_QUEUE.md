# Typel — Production Queue

_Updated 2026-11-21. Statuses live in `ASSET_MANIFEST.md`; this file holds order, dependencies, priorities and open questions._

## Rule of order
Essential gameplay visuals first; decoration only after, unless the owner changes priority. One batch at a time: a batch is complete when every asset in it is APPROVED (or explicitly dropped), INTEGRATED and the preview is verified.

Since D-093 the game is the owner's painting cut into layers (`public/assets/typel/keyart/`, positions in `src/typel/render/keyart.json`). Each batch **replaces those layers one by one, keeping file name, size and position**, so the game never stops being playable.

## Batch 01 — Clean plate and word scroll · **REQUESTED 2026-11-21**
Request: `requests/BATCH-01_clean-plate-and-scroll.md`

| Order | ID | Asset | Why now |
|---|---|---|---|
| 1 | PLT-001 | Clean sky (no scrolls, no wizard) | The field the player reads; currently the biggest filled-in patch |
| 2 | SCR-001 | Plain word scroll | The gameplay target itself |
| 3 | PLT-002 | Clean score engine | Live score, plates, level and medals sit on patched surfaces |
| 4 | PLT-003 | Clean typewriter and desk | Typed word, hammer, hands, note and needle are live; stops ghosting |
| 5 | PLT-004 | Empty shelf | Spell scrolls are live layers in front of it |

Integration when approved: align → diff → composite each region onto a new clean plate (`tools/assets/prep.py`), re-run the D-093 slicing (`tools/keyart/`) on it so `plate.jpg` and `front.webp` are rebuilt, swap `scroll_plain.png`, print key letters live on blank caps (PLT-003), run `npm run check`, smoke-test in the browser at typing speed, verify the preview build.

## Batch 02 — Spell scrolls and the shelf · PLANNED
SCR-002 elemental spell scrolls ×8 (needs SCR-001) · RCK-002 shelf scrolls ×8 incl. a real Barrier scroll (needs PLT-004) · SCR-003 CATCH! stamp (only if the current one looks soft).

## Batch 03 — Characters in motion · PLANNED
CHR-001 Grand Wizard pose sheet · HND-001 hands pose sheet (needs PLT-003).

## Batch 04 — Rewards, effects, gauge · PLANNED
MED-001 Rune medals · FX-001 spell effect sprites · WRD-001 gauge face + needle.

## Batch 05 — Menus · PLANNED
UI-002 menu panels.

## Audio · nothing requested
The current synthesized audio is preserved (AUDIO_BIBLE). AUD-VO-001 (the owner's recordings) can happen any time; AUD-MUS-001, AUD-SFX-001 and AUD-AMB-001 are later.

## Open questions for the owner
None blocking batch 01. (Earlier questions about the field height, the rack and the Grand Wizard's presence were settled by D-093.)
