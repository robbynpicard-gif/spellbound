# TypeL — Audio Bible

_Version 1 · 2026-11-21 · Status: **documentation of what exists**, plus specifications for future audio requests. Nothing here changes the current sound. Any change to a cue's character needs the owner's approval._

## 0. Principles (owner decisions; do not redesign)

- **Audio is core gameplay** (definitive creative direction 2026-11-20). Typing feedback is sacred: warm, weighty, magical mechanical keys, never brittle clicks or shrill beeps.
- **Sound effects stay as they are** (D-092, 2026-11-21). The music was replaced in D-092 by a relaxed Renaissance score that hurries only under danger. The clockwork music layer was removed (D-092 resolution).
- **No robotic text-to-speech** (D-052). The Grand Wizard uses a synthesized "babble" placeholder until recordings exist (D-090).
- **Independent persisted volume controls** for Music, Sound effects and Grand Wizard voice (D-053).
- Replacing or adding audio files must **never change gameplay timing or scoring**: every cue is triggered by an engine event after the fact, and no game logic waits on audio.

## 1. Architecture (as implemented)

| Item | Where | Notes |
|---|---|---|
| Engine | `src/typel/audio.ts` (`TypeLAudio`, exported as `sound`) | Web Audio API. **Everything is synthesized live**; there are no audio files in the TypeL build. |
| Unlock | `src/main.ts` | First `pointerdown`/`keydown` creates/resumes the `AudioContext` (browser autoplay rule). |
| Channels | `music`, `sfx`, `voice` buses → master → compressor (−14 dB threshold, 3:1) → output | Music bus runs at 0.55 × its slider. |
| Room | Convolver "warm stone-and-wood study", 2.4 s synthetic impulse, 3.8 kHz low-pass, send 0.28 | Shared by all buses. The music adds its own echo (below). |
| Settings | `localStorage` key `typel.audio.v1`; defaults music 0.6, sfx 0.8, voice 0.8, all on | Options screen in `src/typel/app.ts`. |
| Voice | `src/typel/voice.ts`, lines in `src/typel/voiceLines.ts`, script `docs/grand-wizard-voice-script.md` | Recorded lines plug in via `src/data/voice-manifest.json` (currently `[]`) + `public/assets/voice/<id>.mp3`. |
| Legacy | `src/audio/Audio.ts`, `Music.ts`, `synth.ts` | Production/legacy game audio. **Not used by the TypeL preview.** Leave alone. |

## 2. Sound-effect cue map (current, all synthesized)

| Cue (`sound.…`) | Triggered by | Character (as built) |
|---|---|---|
| `key(char)` | every typed letter | low thump (150→62 Hz) + band-passed wood knock (~620 Hz) + tiny tick + soft metallic shimmer; per-letter pitch offset and random variation; quick repeats get thinner, like a real machine |
| `backspace()` / `erase(len)` | Backspace / clearing | reverse "schwip" plus the carriage ratcheting back (D-086) |
| `typo()` | wrong letter | dull jammed key + small sour brass dyad (233/247 Hz) |
| `wrongEntry()` | Enter on a wrong word | crumpled sheet |
| `capture(step, volley, perfect)` | word captured | carriage ka-chunk, then a glockenspiel note that climbs the D major scale with the Combo; extra sparkle notes during Arcane Rush |
| `comboUp(mult)` | Combo multiplier rises | fanfare step |
| `volleyStep(m)` / `ignite()` / `volleyBreak()` | Arcane Rush progress / ignition / break | rising rush, boom and bright chord on ignition |
| `plunge(tier)` / `thunk()` / `swish()` | catch loop, rack knock, roll flight | slide whistle by urgency; wooden knock into the rack |
| `breach()` | a word reaches the Ward | cracking glass and a low blow |
| `spell(id)` | spell cast | Slow: chord sliding down + slowing clock ticks · Ice: climbing glassy bells + cold hiss · Fire: low whoosh + crackles + rumble · Shock: square-wave zaps + crack + sub · Wind: gust · Barrier: beating singing bowl · Alter: bubbling ink blips + pour · Harvest: sweep + glockenspiel run + low tone |
| `shockArc(depth)`, `gust(s)`, `wager()`, `heal()`, `focus(gain)`, `thaw()` | spell details | arcs; wind; All-In heartbeat/crack/riser; Ward heal; Ice Focus step; ice melt drips |
| `fizzle()`, `overflow()`, `collect()` | failed cast / charge overflow / charge collected | |
| `rune(tier)` | Rune awarded | tray carousel clack + chord by tier |
| `levelClear()`, `bossStart()`, `victory()`, `defeat()`, `tick(i)` | flow events | |
| `click()` | menu buttons | light tactile click |

## 3. Music (D-092, current)

- **Gameplay:** lilting 6/8 dance in D Dorian, 16 bars: lute arpeggios, recorder melody, soft viol consort, bass viol. Tempo ~50 dotted-quarter BPM calm → ~90 at full stress.
- **Menu:** slow 3/4 air in G Mixolydian (~62 BPM). **Boss:** the dance in B♭ / phrygian-leaning, higher stress floor (56–94).
- **Echo:** tempo-synced stereo ping-pong (dotted eighth, each repeat darker) and a 4.2 s stone hall, music only.
- **Stress comes from danger, not progress:** lowest word's distance to the Ward, field crowding, Ward damage. Rises within ~1.5 s, relaxes over ~6 s. Layers: hand drum (0.22+), tambourine/driving bass/crumhorn (0.5+), lute sixteenths (0.68+), trembling viols and B♭ darkening (Ward < 40 %).
- **Arcane Rush:** shimmering harp, high glockenspiel, more echo, tempo +3 only: magical, not stressful.
- All composition is original; the synthesized instruments are **stand-ins**. D-086 says a full-scale release (Steam) needs real orchestral/period-instrument production.

## 4. Missing audio (known gaps, not yet requested)

| Gap | Why it matters | Status |
|---|---|---|
| Recorded Grand Wizard lines | D-090: owner wants to record his own personality; 65 scripted lines | Waiting on owner recordings (no request needed from Claude; script exists) |
| Final music recording / production | Synth stand-ins are prototype quality | PLANNED, not requested |
| Recorded typewriter/foley layer (optional) | Could deepen key, carriage, bell, paper sounds | PLANNED, only if the owner wants to move beyond synthesis |
| Ambient workshop bed (candles, distant gears, wind) | Definitive direction mentions ambient workshop sounds | PLANNED |
| Sounds for new visual elements (Ward gauge needle, drum roll, rack crest) | When those animate | Covered by existing synthesized cues for now |

## 5. Specification for future audio requests

Every audio request in `ASSET_MANIFEST.md` must state: audio ID; triggering event; desired character; the cue it replaces or complements; duration; one-shot or loop; seamless requirement; variations needed; format and sample rate; loudness/headroom; layering and priority; destination; tests.

**Default technical spec (unless a request says otherwise):**

| Property | Default |
|---|---|
| Delivery format | WAV, 48 kHz, 24-bit (or 44.1 kHz / 16-bit if that is what the tool produces) |
| Shipped format | OGG Vorbis q6 (+ M4A/AAC fallback for Safari if needed); voice lines MP3 to match the existing loader |
| One-shot loudness | peak ≤ −3 dBFS; short UI/typing cues around −20 LUFS-S; big moments (ignite, victory) up to −14 LUFS-S |
| Music loops | −18 to −16 LUFS integrated, peak ≤ −1 dBTP, sample-accurate loop points, no fade at the loop seam |
| Silence | trim leading silence to < 5 ms on any cue tied to a keystroke (latency is felt) |
| Variations | rapid-repeat cues (keys, captures) need 4–8 variations, or one clean source the engine pitch-varies |
| Priority | typing cues > capture > Ward/breach > spells > Rune/announcer > ambience; music ducks briefly (≈ −3 dB) only for Grand Wizard lines |
| Concurrency | the engine limits overlapping instances; recorded cues must stay short so fast typing never smears |

**Provenance and licensing:** every recorded or third-party sound needs a provenance entry (who made it, tool or library, licence, commercial-distribution right). A third-party sound is **not shippable** until the owner confirms its licence covers commercial game distribution. Originals are kept in `assets-src/audio/<ID>/`; processed game files in `public/assets/typel/audio/`.

**Comparing options:** when the owner supplies several takes, Claude compares them against this bible (warm, wooden/brass, magical resonance, not shrill, short attack) and the live mix (played over the D-092 music at calm and full stress), and recommends one with reasons.

## Change log

| Version | Date | Change |
|---|---|---|
| 1 | 2026-11-21 | Documented the D-085/D-092 synthesized audio as implemented; defined request spec. No sound changed. |
