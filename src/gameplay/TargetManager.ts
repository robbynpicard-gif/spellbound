import type { WordState } from './Word';

/**
 * Targeting rules for the typing console (decisions.md D-020).
 * All comparisons use lowercase (`word.match`), so the game is case-insensitive.
 */

/** The most urgent word: closest to the ward line (largest y); ties → oldest. */
export function mostUrgent(words: readonly WordState[]): WordState | null {
  let best: WordState | null = null;
  for (const word of words) {
    if (!best || word.y > best.y || (word.y === best.y && word.id < best.id)) best = word;
  }
  return best;
}

/** Words whose text starts with the console input. */
export function wordsMatching(words: readonly WordState[], input: string): WordState[] {
  return words.filter((w) => w.match.startsWith(input));
}

export function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Classic edit distance (insertions, deletions, substitutions). */
export function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = prev[j]!;
      prev[j] = Math.min(above + 1, prev[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return prev[b.length]!;
}

/**
 * When Enter is pressed on text that isn't a complete word, work out which
 * falling word the player was most likely attempting.
 *
 * Each word is compared with the input using the edit distance between the
 * input and the start of the word (so "drag" → "dragon" scores 0 and
 * "dargon" → "dragon" scores 2). Lowest distance wins; ties go to the longer
 * shared prefix, then to the most urgent word. A guess is only made when the
 * distance is at most half the input length, so random text matches nothing.
 */
export function guessIntendedWord(words: readonly WordState[], input: string): WordState | null {
  if (input.length === 0) return null;
  const limit = Math.max(1, Math.floor(input.length / 2));
  let best: { word: WordState; distance: number; prefix: number } | null = null;

  for (const word of words) {
    const distance = Math.min(
      editDistance(input, word.match.slice(0, input.length)),
      editDistance(input, word.match),
    );
    if (distance > limit) continue;
    const prefix = commonPrefixLength(input, word.match);
    const better =
      !best ||
      distance < best.distance ||
      (distance === best.distance && prefix > best.prefix) ||
      (distance === best.distance && prefix === best.prefix && mostUrgent([best.word, word]) === word);
    if (better) best = { word, distance, prefix };
  }
  return best?.word ?? null;
}
