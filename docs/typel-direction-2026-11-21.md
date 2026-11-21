# Typel direction update — owner playtest of the D-085 prototype
_2026-11-21 · recorded by Claude · decision D-086 · branch `dev/apprenticeship-prototype-20261119`_

**Purpose:** nothing from this playtest is lost. Every item is marked **Owner decision** (the owner said it), **Prototype choice** (Claude's reversible implementation), or **Open** (needs the owner).

## 1. Playtest results (owner, D-085 prototype)
| # | Test | Owner result |
|---|---|---|
| 1 | Typing feel, sound, paper readability | Yes to all. Paper readable. Change the scroll font (see §3). |
| 2 | Readability at pace 5 | Owner can't keep up; a stronger typist probably could. **No change requested.** |
| 3 | Volley build-up | Yes. It needs a better name and must feel like the **most powerful part of the game**; offense in flow is palpable, and so is the defensive layer when things get tough. |
| 4 | Ice Focus | Yes: the Combo sequence is "amazing and obvious". |
| 5 | Shock | Not really: it usually bolted down onto a single target. → §5 |
| 6 | Fire spread readability | Not really. → Open item O-1 |
| 7 | Wind + Harvest | "Oh ya." Keep it. |
| 8 | Boss and Endless | The boss mode feels great. |
| — | Overall | "We're on a lovely track." Tweaks needed, but the direction is right. |

## 2. Identity and direction (Owner decisions)
- **Typel is "Peggle for typing", with Bejeweled Blitz excitement and Balatro-style score chasing.** Louder, more saturated, more timeless, more magical. The earlier dark, gritty, Fallout-inspired direction is **retired**.
- **Add animations** wherever they help the feel and help the player understand what's happening. Ground everything with sound design.
- **The end state is a definitive typing game, likely on Steam.** The browser build is a prototype; final sound design must be fleshed out for a full release.
- **Pronunciation:** the title screen shows "Tie-pull" (/ˈtaɪ.pəl/).
- **The flow state is renamed "Arcane Rush"** (formerly Arcane Volley). Internal code keeps `volley` names; every player-facing word says Arcane Rush.
- **Every decision must be documented. No forgotten decisions.**

## 3. Layout (Owner decision, from the annotated screenshot)
| Zone | Screen area (1920×1080) | Purpose |
|---|---|---|
| Purple | x 402–1642, y 0–936 | Gameplay field (much taller than before) |
| Orange | x 402–1642, y 936–1080 | **Ward floor**: animated, reflects mood, energy and the changing state of play |
| Yellow | x 1648–1920, full height | **Spell rack** (position already right). Claimed spell scrolls swish over and **knock into the wooden shelf**. |
| Red | x 0–400, y 594–1080 | **The player's wizard** at the **interactive, reactive typewriter**. The wizard looks into the Ward, chases the scrolls, and reacts **charmingly, excitedly, with naivety and discovery**. |
| Blue / green | x 0–198 / 198–398, y 0–590 | **Escalating Combo and Arcane Rush meters** plus an **arcade-like counter** showing base points + Combo mult × multiplier. Analog, magical and mechanical. A large peripheral element that adds rising tension. |

**Prototype choices inside the zones:**
- The arcade counter spans both columns at the top. Each capture tallies its chips: BASE · ×COMBO · ×RUSH · (×ALL-IN) · POINTS.
- The blue column is a glass Combo tube that fills toward the next multiplier, with notches.
- The green column is the Arcane Rush tube. A gold bar shows the open timing window, bubbles rise as Rush builds, and stars erupt from the top once it ignites.
- Field edges glow green during Rush (gold at Mastery).
- The Master's lines appear as subtitles on the Ward floor. The level name and progress sit on the floor's left; Ward %, its maximum and the All-In timer sit on the right.

## 4. Feel changes (Owner decisions → implementation)
| Item | Owner decision | Prototype implementation |
|---|---|---|
| Scroll font | Blockier, slightly handwritten, clear, bold, thematic; nothing fancy | **Kalam Bold** (Google Font). Fallback: Patrick Hand / Trebuchet. *Prototype choice; easy to swap.* |
| Backspace | The old highlight stayed after backspacing (bug). Backspace must be as prioritized as typing and **uniquely satisfying** | Bug fixed: scroll highlights now update on every frame. The deleted letter un-inks from the paper and the scroll and drips away as ink. Sound: a crisp reverse "schwip" plus the carriage ratcheting back. The wizard's hand taps. |
| Catch loop | A mistype makes the targeted word fall **drastically**, at **varying urgencies**, as a regular part of the mistype loop: an opportunity for a cool recovery moment | Each mistype (wrong letter or wrong Enter) on the aimed word triggers a seeded **plunge**: brisk ×2.2 (50%), urgent ×3.2 (35%), desperate ×4.5 (15%). A further mistype escalates one tier. The word gets an urgency ring, a trail and a CATCH! tag; the sound is a cartoon slide whistle and the wizard leans in. Catching it pays **Saving Grace** (+75) or **Daring Rescue** (+200, desperate tier). *Tiers, odds and points are prototype values.* Replaces the old small `errorAcceleration` bump in Typel scoring only. |
| Shock | Originate from the bottom; tackle the words closest to the Ward; **guarantee the 3 closest**, then normal lightning behaviour | The 3 words nearest the Ward are always struck; lightning rises from the Ward floor into them, then the seeded chain grows from all three (cap 10). |
| Alter | Some words weren't affected (length gate). **All words should become 2–3 letters** | The 6+ letter gate is removed in Typel: every word longer than 3 letters is rewritten. Words that are already 2–3 letters stay. |
| Ice | Spawning stayed suspended on a cleared board. Add a **slow melt period** after clearing: a small rest, so the spell never feels wasted | When the field is cleared during a freeze, the freeze ends after **2 s** (`ICE_MELT_TICKS`), with a "The ice melts…" callout and drip sounds. *Melt length is a prototype value.* |
| Music | **More orchestral**: whimsical, magical, quirky, satirical. "Peggle, but for a satirical magical wizard world" | Synthesized stand-ins for an orchestra: pizzicato and tuba oom-pah, bassoon and clarinet melody, strings, glockenspiel, flute, brass, timpani, snare and triangle.<br>• **Menu:** a waltz in G.<br>• **Gameplay:** a bouncy F-major scherzo; layers add with pressure, Arcane Rush brings the full orchestra and flute, and Ward danger brings tremolo strings and a darker mode.<br>• **Boss:** a D-minor galop.<br>*All original composition, prototype quality. A real orchestral score is needed for release.* |
| Animations | "Spice up the gameplay", help the player understand, ground with sound | Animated:<br>• scroll pop-in and capture star bursts, with letters flying into the counter;<br>• a chip-by-chip tally and a slot-machine score roll;<br>• COMBO ×N fanfares with confetti;<br>• ARCANE RUSH ignition with a shockwave ring and Mastery;<br>• spell-name callouts and Rune toasts;<br>• Fire spread hops, Shock bolts from the floor, Harvest sweep, Wind gust and streaks;<br>• Ward floor flashes, cracks and shields;<br>• the rack knock with sawdust;<br>• level title cards, and the wizard's reactions. |

## 5. The wizard (Owner decision; Prototype design)
**Prototype design:** a cartoon apprentice with a starry purple hat, a big white beard, big eyes and a blue star robe.

**Reactions:**
| Trigger | Reaction |
|---|---|
| Idle | Breathes, sways his hat, blinks |
| Aimed scroll | His eyes follow it |
| Typing | His hands tap the keys |
| Capture | Grins (^^) and hops |
| Mistype | Winces, sweat drop |
| Plunge | Wide eyes, leans in |
| Breach | Jumps, his hat pops up |
| Spell cast | Raises a sparkling hand |
| Combo milestone, All-In, level clear | Cheers |
| Arcane Rush | Wonder eyes and a green aura |
| Low Ward | Trembles nervously |

*Placeholder character art; the final design is open.*

## 6. Visual palette (Prototype choice following §2)
- **Field:** an indigo-to-magenta night sky with nebulae, a big crescent moon, floating islands and a glowing tower town on the horizon.
- **Frame:** a gilded field frame with jewels.
- **Room:** a jewel-toned library and the wizard's lamplit nook.
- **Spell colours:** Slow violet, Fire orange, Ice cyan, Barrier periwinkle, Shock yellow, Alter pink, Wind green, Harvest amber.
- **Fonts:** Lilita One for arcade numbers and callouts; Cinzel Decorative for titles.

## 7. Open items (need the owner)
- **O-1 Fire readability:** the owner couldn't read the spread. Options: slower generation hops with a visible "fuse" between words; a preview ring showing what would burn; or a clearer rule (for example, "Fire burns the lowest cluster").
- **O-2 Rush as "the most powerful part":** this pass makes Rush much louder visually and musically. Does it now *feel* like the most powerful thing? If not: bigger multipliers, a Rush-only scoring layer, or Rush-triggered spell empowerment.
- **O-3 Readability at pace 5** for average typists: leave as a skill ceiling, or add an assist? (No secret assistance, per standing rules.)
- **O-4 Catch-loop tuning:** are the plunge speeds dramatic enough, too punishing, and is the 50/35/15 split right?
- **O-5 Final font, character design and orchestral score** for the Steam-grade build.

## 8. Performance note
In the headless software-rendered test browser, both the D-085 and D-086 builds run at about 10 fps. That is the test machine; real GPUs are unaffected. Worth profiling on target hardware before release.

## 9. Update — D-087 (2026-11-21): grounded, mature look
**Owner decision:** the gameplay and feel above are kept, but the look was too childish. Typel is mature, satirical and may use adult humour, so the art shifts to grounded fantasy. The wizard and typewriter are seen **from behind, over the wizard's shoulder (3/4 rear view)**, looking into the Ward with the player.

**This supersedes §5 (cartoon wizard design) and §6 (bright palette and fonts).** Reactions now play out through body language: head turning, leaning in, flinching, jumping on a breach, a raised fist, pipe smoke and the occasional grumble. Details in D-087.
