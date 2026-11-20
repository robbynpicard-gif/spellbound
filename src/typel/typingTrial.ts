/**
 * Typing Trials (prototype, D-085): raw-speed tests on predetermined phrases,
 * in the spirit of dedicated typing-test sites. Phrases are original text.
 */
export const PHRASES: readonly string[] = [
  'the candle burned low while the apprentice copied the last page of the old grimoire',
  'brass gears turned behind the glass and the typewriter hummed with patient light',
  'every scroll that falls is a word someone could not hold for long enough',
  'ink dries slowly in the cellar where the alchemist keeps his rarest salts',
  'the master said that rhythm is a promise you keep with your own two hands',
  'a quiet room and a steady breath will carry you further than haste ever could',
  'the wax seal cracked open and a small gold spark escaped into the night air',
  'moonlight fell across the desk and silvered the edge of every waiting page',
  'she counted the keys by touch and never once looked down at the machine',
  'the ward shimmered like a soap bubble whenever a stray word drifted near it',
  'old books smell of dust and leather and the faint ghost of someone else thinking',
  'he wrote the same line a hundred times until his hand forgot how to falter',
  'the tower bell rang twice and the lamps along the stair lit themselves in turn',
  'a careful scholar reads the margins first because that is where the truth hides',
  'quick fingers are useful but accurate fingers are what the masters remember',
  'the storm outside rattled the leaded windows and the scrolls began to fall faster',
  'copper wires ran from the crystal to the keys and sang a single steady note',
  'the library has no end that anyone has found and no beginning worth the search',
  'wind moved through the study and every page lifted as if to listen',
  'she harvested the field of words in one long sweep and smiled at the tally',
];

export interface TypingStats {
  wpm: number;
  raw: number;
  accuracy: number;
  correct: number;
  errors: number;
  seconds: number;
}

/** Net WPM counts only correctly typed characters (5 per word). */
export function typingStats(correct: number, typed: number, errors: number, ms: number): TypingStats {
  const minutes = Math.max(ms, 1) / 60000;
  return {
    wpm: correct / 5 / minutes,
    raw: typed / 5 / minutes,
    accuracy: typed + errors === 0 ? 1 : correct / Math.max(1, typed),
    correct,
    errors,
    seconds: ms / 1000,
  };
}

/** A seeded text of at least `chars` characters built from whole phrases. */
export function trialText(seed: number, chars: number): string {
  const out: string[] = [];
  let s = seed >>> 0;
  let len = 0;
  while (len < chars) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const p = PHRASES[s % PHRASES.length]!;
    if (out.at(-1) === p) continue;
    out.push(p);
    len += p.length + 1;
  }
  return out.join(' ');
}
