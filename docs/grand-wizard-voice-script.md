# The Grand Wizard — voice script for recording
_Generated from `src/typel/voiceLines.ts` (D-090). Every line is a placeholder: rewrite anything in your own words and personality. Keep the **ID** so the game can find your recording._

## Who he is
A mischievous magical mentor. Playful, witty, occasionally sarcastic, **never mean**. He uses the darkness to train apprentices, and starts out teasing you. He becomes genuinely impressed as you earn bigger Runes. In play he speaks **only when a Rune is awarded** (the Rune-only rule): never on spell casts, captures or misses. Pick a voice you can sustain: deep, theatrical, a little gravelly, with comic timing.

## How the game uses these
- **Callout:** the Rune's name. Spoken for every tier-2/3 Rune and every fumble, and about half the tier-1 Runes.
- **Remark:** an optional line after the callout. Praise follows good Runes about 30% of the time, and later praise lines unlock as your career grows. Mockery follows fumbles about 50% of the time. The specials are fixed.
- He never talks over himself. Lines queue, the more important line wins, and there's a short pause between lines.

## Recording notes
- One line per file, named by its ID: for example `rune.frost-5.mp3`. Drop the files in `public/assets/voice/` and add each ID to `src/data/voice-manifest.json`; that line then plays your recording instead of the babble.
- **Format:** WAV or high-quality MP3, 48 kHz, mono. Leave about 0.2 s of silence before and after.
- **Takes:** record 2–3 takes of the important lines (the specials and all tier-3 Runes) with different energy. We'll pick the best and may rotate them.
- **Processing comes later:** pitch, EQ, compression, a little saturation, room reverb. Record clean and dry, close to the mic, with no music.
- Exclamation marks mean energy, not shouting into the mic: stay a hand's width away.

## 1. Rune callouts
### Typing mastery
| ID (file name) | Line | Direction |
|---|---|---|
| `rune.quill-10` | Steady Quill! | Brisk, approving. |
| `rune.quill-25` | Golden Quill! | Pleased, a little theatrical. |
| `rune.quill-50` | Unblotted Hand! | Big. Genuinely impressed despite himself. |
| `rune.first-light` | First Light! | Brisk, approving. |
| `rune.by-a-thread` | By a Thread! | Pleased, a little theatrical. |
| `rune.tome-reader` | Tome Reader! | Brisk, approving. |
| `rune.clean-desk` | Clean Desk! | Pleased, a little theatrical. |
| `rune.saving-grace` | Saving Grace! | Brisk, approving. |
| `rune.daring-rescue` | Daring Rescue! | Pleased, a little theatrical. |
| `rune.flawless` | Flawless! | Big. Genuinely impressed despite himself. |
| `rune.flawless-perfection` | Flawless Perfection! | Big. Genuinely impressed despite himself. |

### Wordplay
| ID (file name) | Line | Direction |
|---|---|---|
| `rune.noun-2` | Double Noun! | Brisk, approving. |
| `rune.noun-3` | Triple Noun! | Pleased, a little theatrical. |
| `rune.noun-5` | Nountacular! | Big. Genuinely impressed despite himself. |
| `rune.alliterator` | Alliterator! | Brisk, approving. |
| `rune.alphabetist` | Alphabetist! | Pleased, a little theatrical. |

### Spellcraft
| ID (file name) | Line | Direction |
|---|---|---|
| `rune.borrowed-time` | Borrowed Time! | Pleased, a little theatrical. |
| `rune.frost-3` | Frostscribe! | Brisk, approving. |
| `rune.frost-5` | Frostweaver! | Pleased, a little theatrical. |
| `rune.frost-8` | Frostmaster! | Big. Genuinely impressed despite himself. |
| `rune.phoenix-ash` | Phoenix Ash! | Brisk, approving. |
| `rune.pyre` | Pyre! | Pleased, a little theatrical. |
| `rune.unbroken` | Unbroken! | Pleased, a little theatrical. |
| `rune.chain-5` | Chain Reaction! | Pleased, a little theatrical. |
| `rune.chain-8` | Storm Caller! | Big. Genuinely impressed despite himself. |
| `rune.adaptation` | Adaptation! | Pleased, a little theatrical. |
| `rune.final-wager` | Final Wager! | Pleased, a little theatrical. |
| `rune.thrice-scarred` | Thrice Scarred! | Big. Genuinely impressed despite himself. |
| `rune.reap` | Reap What You Sow! | Big. Genuinely impressed despite himself. |

### Participation (fumbles)
| ID (file name) | Line | Direction |
|---|---|---|
| `rune.fumble-10` | Butterfingers! | Mock-solemn, as if announcing a tragedy. |
| `rune.fumble-25` | Spectacular Fumble! | Mock-solemn, as if announcing a tragedy. |
| `rune.fumble-50` | Generational Fumble! | Mock-solemn, as if announcing a tragedy. |

## 2. Praise (after good Runes)
| ID (file name) | Line | Direction |
|---|---|---|
| `praise.01` | Hm. Not bad. | Grudging. |
| `praise.02` | Do not let it go to your hat. |  |
| `praise.03` | Adequate. Barely. | Dry, a smile hidden. |
| `praise.04` | Oh, now you are showing off. |  |
| `praise.05` | I have seen worse. From myself, once. |  |
| `praise.06` | Well, well. The apprentice has teeth. |  |
| `praise.07` | Keep that up and I may have to learn your name. |  |
| `praise.08` | Again! Do it again! ...I mean. Acceptable. | Slips into delight, catches himself. |
| `praise.09` | The scrolls fear you. Good. |  |
| `praise.10` | That one I will tell the other Masters about. |  |
| `praise.11` | Ha! Splendid! | Unguarded joy. |
| `praise.12` | Careful. That almost looked like talent. |  |

## 3. Mockery (after fumbles)
| ID (file name) | Line | Direction |
|---|---|---|
| `mock.01` | Majestic. | Deadpan. |
| `mock.02` | I will pretend I did not see that. |  |
| `mock.03` | The scrolls are laughing at you. |  |
| `mock.04` | Was that... on purpose? |  |
| `mock.05` | And there it goes. Gone. Like my patience. |  |
| `mock.06` | Somewhere, a Master just felt a disturbance. |  |
| `mock.07` | Beautiful streak. Was. | Pause before "Was." |
| `mock.08` | Breathe. Then never do that again. |  |

## 4. Specials
| ID (file name) | Line | Direction |
|---|---|---|
| `special.ha-fail` | HA! FAIL! | Explosive, delighted. The signature line. |
| `special.legacy` | A legacy, of sorts. | Mock-respectful. |
| `special.flawless` | Flawless! Not a blot on the page. | Proud. |
| `special.flawless-perfection` | Flawless Perfection! ...Fine. I am impressed. Do not tell anyone. | Rare. The biggest line in the game. |

## 5. Optional: outside play (menus and the apprenticeship)
Not used yet. During play he stays Rune-only. Record these if you'd like him present in the menus.
| ID (file name) | Line | Direction |
|---|---|---|
| `menu.welcome` | Ah. You came back. Sit. Type. |  |
| `menu.welcome-2` | The darkness waits. So do I. Impatiently. |  |
| `menu.apprenticeship` | Choose a Master. Try not to embarrass me. |  |
| `menu.trial-won` | Another Master survives your education. |  |
| `menu.defeat` | The Ward fell. Pick it up. Again. |  |
| `menu.final-exam` | Eight Masters taught you. Now you face me. |  |
| `menu.graduated` | You are an apprentice no longer. Insufferable, but no longer an apprentice. |  |
| `menu.typing-trial` | No spells, no scrolls. Just your fingers and my judgement. |  |
| `menu.sandbox` | Here nothing is at stake. Break things. I will not look. |  |

## Write your own
Add new remarks in the same style: short (under ~10 words), punchy, teasing or grudgingly impressed. Satire and adult-leaning wit are welcome; cruelty isn't. Send them over and I'll add them with new IDs.
