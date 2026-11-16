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
| 2 | Word targeting | ❓ | | Auto-target + click to select (GDD §7) |
| 3 | Keyboard input behaviour | ❓ | | |
| 4 | Incorrect typing penalties | 📜 | Mistakes reportedly speed words up | Configurable `errorAcceleration` |
| 5 | Word acceleration | ❓ | | |
| 6 | Level completion | 📜 | Progressive levels | Word quota per level |
| 7 | Difficulty scaling | ❓ | | |
| 8 | Scoring and bonuses | 📜 | Scoring bonuses exist | |
| 9 | Fire Book | 📜 | Destroys words | Incineration |
| 10 | Ice Book | 📜 | Freezes words | Frostbinding |
| 11 | Slow Book | 📜 | Slows words | Temporal Distortion |
| 12 | Wind Book | 📜 | Possibly removes errors/missed words | Arcane Purge — **do not finalise** |
| 13 | Spell inventory limits | ❓ | | Max 3 per spell (GDD §10) |
| 14 | Special word types | ❓ | | |
| 15 | Audio/visual effects | ❓ | | Original assets only |
| — | Missed words pile up at bottom | 📜 | Accumulation ends the game | Tower instability meter |

## Observations log
_(Dated notes go here as research happens.)_
