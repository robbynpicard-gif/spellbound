# Typel D-093: the key art becomes the game
_2026-11-21 · recorded by Claude · branch `dev/apprenticeship-prototype-20261119` · supersedes the look of D-087, D-088 and D-089, and the unpushed D-091 patch_

## The decision
The owner's key-art painting is the **source of truth for how Typel looks**: painterly fantasy, whimsical Renaissance machinery, theatrical magical light, slightly satirical. Owner, 2026-11-21:
- "This is literally a picture of what I want to play."
- Clip it up and use it as the reference; inferences are allowed.
- It doesn't need to be this exact picture.

The reference is kept at `art/reference/typel-keyart-reference-2026-11-21.jpg` (from the owner's 5376×3024 original).

**Owner answers (2026-11-21):**
- Cut up the painting now and keep a list for better art later.
- Keep the name **Arcane Rush**: the painting's ×RUSH is the D-086 rename of Arcane Volley. The mechanics are unchanged.
- Shelve D-091: its code-drawn look is replaced, and its new sound effects wait for a separate audio proposal.

**Unchanged:** gameplay rules, scoring, spells, progression, saves, audio and music (D-092). The rendering layer only observes the engine. All 35 test files pass.

## How it's built
The painting is cut into layers by two scripts (`tools/keyart/plate.py` and `sprites.py`). Every kept pixel comes from the full-resolution painting at 1920×1080. Where something live was painted, it was removed and the area filled; those filled patches are the only soft parts.

| Layer (in `public/assets/typel/keyart/`) | What it is | Live behaviour |
|---|---|---|
| `plate.jpg` | The whole painting with every live element removed: scroll words, digits, plate values, typed text, counts, needle, medals, the flying scroll | Background |
| `front.webp` | Desk, typewriter, lower machine and lower shelf | Drawn in front of the falling scrolls; **the paper's top edge is the Ward line** |
| `arch.png` | The rune arch's glow | The Ward made visible:<br>• teal at rest<br>• green in Arcane Rush<br>• gold at Mastery<br>• amber in All-In<br>• red and faltering below 30%<br>• flashes on a breach or block<br>• Barrier charges add layered blue arches |
| `wisps.webp` | The green magic wisps | Brighten with Arcane Rush; gold at Mastery |
| `wizard.png` | The Grand Wizard on his cloud | Bobs on his cloud; pipe smoke and teacup steam. Reactions:<br>• nod: rescues, high Combo<br>• chuckle: Rush ignition, fumbles<br>• harrumph: breaches, urgent plunges, defeat<br>• impressed: 1,000+ point captures, Harvest, wagers, tier-3 Runes<br>His D-090 Rune remarks appear in a parchment speech bubble. |
| `hand_l/hand_r.png` | The apprentice's hands | The hand on the side of the key you typed dips (left keys / right keys). Both lift on captures, flinch on breaches and tremble when the Ward is weak; the right hand lifts to cast. |
| Keys (cut live from the plate) | The painted keys | Sink into their wells on each keystroke |
| `hammer.png` | The typebar | Strikes on each letter |
| Paper text | Typed letters | Oxblood typewriter ink at the strike point, sliding left (D-088). A wrong letter is a black smudge. |
| Score drums (live text) | Brass digit drums | Roll to the real score with neighbouring digits peeking above and below; extra drums squeeze in past 999,999 |
| Plates (live text) | BASE / ×COMBO / ×RUSH | Flip to each capture's values; exact points stay hidden (D-088) |
| `combo_*.png` | The blue tube | Painted liquid rises toward the next Combo multiplier; the combo count shows at the base |
| `rush_*.png` | The green tube | Painted swirling liquid rises with Arcane Rush (drained glass when idle); bubbles; erupts when hot; BUILDING / RUSHING / MASTERY under the tube |
| `gear.png` | A machine gear | Turns faster with Rush and Combo |
| Level plate (live text) | Level name and progress | — |
| `medal_1/2/3.png` | The tray's three medals | Runes arrive by tier (silver, gold, star-and-ribbon); fumbles arrive tarnished; three slots roll left. The Rune's name shows under the tray. |
| `rack_<spell>.png` ×8 | The shelf's scrolls, in game order (painting colours = spell colours) | Live ×N counts. Empty: greyed. Unlearned: an empty shelf. Number keys shown in Normal mode. A claimed scroll flies to its shelf, knocks in, and its neighbours rattle. A cast glows and jumps. |
| `needle.png` | The Ward Strength gauge | **100% points left, the red zone is weakness.** Sprung needle; jolts on a breach, strains on a wager. The scar is a dark cracked dead arc with a brass stop pin at the cap. All-In shows as an amber glow plus `ALL-IN ×N · Ns` above the gauge. Exact % on the face. |
| Note (live text) | "NO SMUDGES! And spell it right this time. — M." | The Masters' lesson lines are handwritten on it during apprenticeships |
| `scroll_plain.png` | The painting's parchment scroll, 3-slice stretched to any word | **Target:** the painting's gold corner brackets and chevrons. **Plunge:** a red halo plus the painting's CATCH! stamp slapping down.<br>**Spell scrolls:**<br>• all: an aura, a sweeping sheen, motes and the spell's glyph<br>• Fire: the painting's flame licking up from the rolled end<br>• Ice: frosted parchment |
| `catch.png`, `flame.png` | Cut from the painting | — |

**Field:**
- **Position:** the battlefield is the sky between the score engine and the shelf: x 610–1550, y 60–655 at 1920×1080.
- **Words:** they slide down into the paper, which is the Ward.
- **Spell moods and All-In:** these now wash the sky with soft light instead of a hard box.
- **Menus:** they use the same painted world at rest: full shelf, painted medals, zeroed drums and the note.

## What is still placeholder or inferred (honest gaps)
- **Resolution:** layers come from the 5376×3024 original downsampled to 1920×1080. They're sharp everywhere except the filled-in patches: the central sky behind the old scroll positions, the empty shelves, the drum faces and the plate faces.
- **Fixed poses:** the wizard and hands are cut from one painting, so they can bob, tilt and dip but can't change pose. The wizard has no eyebrow raise, sip or pipe animation.
- **Painted variety not reused:** the painting's FROSTBITE icicles, LEVITATE lightning and HEX sparks aren't reused. Ice uses frosted parchment and Shock and Slow use particle effects; Fire uses the painted flame.
- **Barrier's shelf scroll** was hidden behind the flying scroll in the painting. It's rebuilt from Ice's scroll, recoloured.
- **Spell effects** (fire bursts, lightning, frost, wind streaks, harvest) are the existing particle effects. Painted effect sprites would improve them.
- **Gauge needle:** a faint ghost of the painted needle remains near the red zone.
- **Field width:** the painting's composition leaves a 940 px field instead of the old 1240 px, so scrolls can sit closer together. Words that spawn on the right pass in front of the Grand Wizard.
- **Fonts:** Kalam (scroll words, D-089), Courier Prime (paper) and Cinzel (plates) are web fonts approximating the painting's lettering.

## Asset list for replacement art (generated or commissioned)
Each piece can be swapped on its own: same file name, same size and position (`src/typel/render/keyart.json`, 1920×1080 space). Highest value first:
1. **Clean background plate** with nothing live painted in: empty sky inside the arch, empty shelves, blank drums, blank plates, a blank note and an empty paper. Removes every filled-in patch.
2. **Scroll kit:** plain parchment (left end, stretchable middle, right end, blank) plus element variants for all 8 spells (frosted, burning, crackling, purple-hexed, and so on).
3. **Grand Wizard pose sheet:** idle, sip, puff, eyebrow raise, chuckle, harrumph, impressed, nod.
4. **Hands pose sheet:** rest, press left, press right, cast (raised, glowing), flinch, cheer.
5. **Shelf scrolls** ×8 on transparent backgrounds, including Barrier's own lavender scroll.
6. **Medals:** one per Rune category and tier (the D-089 design) in the painting's style.
7. **Spell effect sprites:** fireball burst, lightning bolt, ice crystals, wind gust, harvest sweep, barrier layer.
8. **Gauge:** a clean face (no needle) and a separate needle; drum digit strips.

## Phase notes from the brief
- **Preserved:** the engine and all rules; every event handler and the input path (byte-for-byte logic); the D-092 music-pressure logic; the D-090 voice and Rune lines; saves and progression. Production is untouched.
- **Replaced:**
  - `paint.ts` room, sky, frame, typewriter, meters, hands and keys (still in the file, unused);
  - `Hands.ts` (unused);
  - the old HUD layout.
- **Risk:** low for gameplay, which is render-only and covered by the test suite. Visual readability at high word counts needs an owner playtest.
