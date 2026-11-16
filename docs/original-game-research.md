# Original Game Research — Typing Maniac (MetroGames)

_Status: **Not started.** Research is planned before the mechanics it affects
are finalised (core penalties before/during Milestone 1; spells before
Milestone 3)._

## Ground rules
- The original is a **mechanics reference only**. No artwork, audio, text,
  logos or code from it is copied into Spellbound (decisions.md D-009).
- Only screenshots/notes needed to describe a mechanic are kept, and only
  where legally appropriate.
- Anything that cannot be verified is marked **Unknown** with a proposed
  Spellbound adaptation.

## Sources
| Source | Notes |
|---|---|
| Archived SWF: `https://games.coolgames.com/typing-maniac/en/1.0/typing-maniac.swf` | Original host; may no longer resolve |
| Preservation archive: `https://9o3o.com/games/typing-maniac` | Playable copy via Flash emulation |
| Ruffle (Flash emulator) | Play-testing and timing observations |
| JPEXS Free Flash Decompiler | Reading game logic (ActionScript) for exact numbers |
| Historical gameplay videos | Cross-checking behaviour |

## Research checklist
Legend: ✅ Verified · 📜 Historical description only · ❓ Unknown

| # | Topic | Status | Finding | Spellbound adaptation |
|---|---|---|---|---|
| 1 | Word movement | 📜 | Words fall from top | — |
| 2 | Word targeting | ❓ | | Implemented (M1): auto-target lowest word by first letter, locked until done; click to select (decisions D-010) |
| 3 | Keyboard input behaviour | ❓ | | Implemented (M1): letters only, Backspace abandons, no key repeat (D-011) |
| 4 | Incorrect typing penalties | 📜 | Mistakes reportedly speed words up | Implemented (M1) as configurable `errorAcceleration` on the target word — **verify value and scope** |
| 5 | Word acceleration | ❓ | | |
| 6 | Level completion | 📜 | Progressive levels | Word quota per level |
| 7 | Difficulty scaling | ❓ | | |
| 8 | Scoring and bonuses | 📜 | Scoring bonuses exist | |
| 9 | Fire Book | 📜 | "Burn all words" [1] | Incineration: destroys all words (D-017) |
| 10 | Ice Book | 📜 | "Freeze all words" [1] | Frostbinding: 5 s freeze, no spawns |
| 11 | Slow Book | 📜 | Slows words [1] | Temporal Distortion: 8 s at 50% |
| 12 | Wind Book | 📜 | "Renew your life", resets danger bar to 0%, erases mistyped words [1]; fan remake also resets the danger bar [2] | Arcane Purge: instability → 0%, mistake speed-ups removed |
| 13 | Spell inventory limits | ❓ | | Max 3 per spell (GDD §10) |
| — | How books are used | 📜 | Typed as words: FIRE / ICE / SLOW / WIND [1] | Keys 1–4 instead (avoids clashing with auto-targeting; D-017) |
| — | Durations | ❓ | A fan remake uses 5 s for Ice and Slow [2] — not authoritative | Ice 5 s, Slow 8 s (data file, easy to tune) |
| 14 | Special word types | ❓ | | |
| 15 | Audio/visual effects | ❓ | | Original assets only |
| — | Missed words pile up at bottom | 📜 | Accumulation ends the game | Tower instability meter |

## Observations log

**2026-11-16 — web search for the four books.** No primary source found;
the SWF itself has not been inspected yet. Findings above come from:

1. Fan guide, 2009: http://facebookgamesinfo.blogspot.com/2009/08/play-typing-maniac-on-facebook.html
2. Fan remake (not the original; used only as a cross-check): https://github.com/halfguru/typing-maniac-clone
3. Fan tips, 2009: https://www.selinawing.com/2009/06/typing-maniac-on-facebook.html
4. iOS port review, 2011 (missed words pile up and end the game): https://appadvice.com/appnn/2011/02/review-typing-maniac

Status column stays 📜 (historical description only) until the SWF is
inspected with Ruffle/JPEXS.
