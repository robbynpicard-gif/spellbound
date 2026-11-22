# TypeL — lore (world bible, never shown as text)

> Per D-034 the game never tells this story in words. It is a reference for
> the art, sound and naming, so the world is felt through play and pictures.

## Premise (unspoken)
Your master is gone, and their scrolls of forgotten knowledge drift through the
tower on the night wind. Bound to an enchanted typewriter, you capture each
scroll by typing its word before it slips past your wards. Every scroll you
capture becomes your **knowledge**. **Powered scrolls** glow with colour: they
also hold **mana** for a spell.

## How the mechanics map to the story
| Game rule | In the story |
|---|---|
| Falling word | A drifting scroll of knowledge |
| Typing a word + Enter | Capturing the scroll with the typewriter |
| Score | Knowledge gathered (the brass counter) |
| Spell scroll (coloured) | Powered scroll: stores mana for that spell |
| Spell pool of 8 | The wizard's **mana capacity** |
| Casting (type the spell's word) | Spending stored mana |
| Instability / ward health | The wards, sustained by the runic seal |
| A word reaching the ward line | A scroll slipping past, cracking the seal |

## Chapters (shown on the pop-up at the start of each chapter)
1. **The Apprentice's Tower** — the tower is quiet without your master; scrolls drift past the windows at night.
2. **The Sunken Library** — the flooded archive stirs; waterlogged scrolls rise with older, longer words.
3. **The Alchemist's Vault** — the furnaces wake; scrolls of strange, twisting transmutation words.
4. **The Storm Spire** — the storm tears the sky open; every scroll your master wrote comes home at once.

Victory: "The storm passes. Every scroll is home, and the tower remembers your name."
Defeat: "The wards fail, and the scrolls scatter on the wind."

Text lives in `src/data/lore.json`.

---

## Proposal (not built): TypeL as a typing roguelite

**Core loop:** choose a wizard → play a run of chapters → between levels, choose
upgrades → bosses → the run ends → knowledge carries over to unlock more.

### Wizards
Each wizard changes three things: **mana capacity**, a **starting spell**, and
one **unique spell or passive**.

| Wizard | Mana | Starts with | Unique |
|---|---|---|---|
| The Apprentice (default) | 8 | Fire | Balanced — today's game |
| The Archivist | 6 | Slow | **Recall** spell: for 10 s, the first 3 letters + Enter capture a scroll (the "type 3 letters" idea) |
| The Chronomancer | 7 | Ice | Slow and Ice last 50% longer; **Rewind** spell restores the ward lost in the last 5 s |
| The Pyromancer | 10 | Fire ×2 | Fire captures burned scrolls at half knowledge; wards take +20% damage |
| The Hedge Witch | 12 | — | Mana capacity is huge, but powered scrolls drop 30% less often |
| The Warden | 6 | Barrier | Starts each level with 1 Barrier block; Wind heals only 60% |

### Between levels: the study
After each level, pick **1 of 3 boons** (the boss-reward screen already works this way):
- *Inkwell of Plenty* — +1 mana capacity
- *Steady Hands* — mistakes no longer speed scrolls up
- *Scholar's Lens* — +15% knowledge from words of 8+ letters
- *Wax Seal* — the first miss each level does no damage
- *Quickened Quill* — Shock arcs to 1 more scroll

### Meta-progression: the Library
Knowledge earned in every run is kept. Spend it in a persistent Library to
unlock wizards, new boons, special word types (Cursed, Shielded…) and the
spellbook entries (full spell descriptions).

### Why it fits
The shared pool is already a per-wizard number, the boss reward is already a
pick-1-of-3, and the campaign is already one run. A roguelite layer reuses all
three; the main new pieces are wizard selection, a boon pool, and saved
knowledge.
