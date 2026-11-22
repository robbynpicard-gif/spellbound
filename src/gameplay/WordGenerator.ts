import type { SeededRandom } from '../core/Random';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';

const MAX_ATTEMPTS = 12;

/**
 * Chooses the next word to spawn.
 *
 * The sequence depends ONLY on the seed and the words already spawned —
 * never on what the player has typed or destroyed. Two players with the same
 * seed and level therefore get the same words in the same order, whatever
 * they do (GDD §15.1, decisions.md D-024).
 *
 * Fairness rules:
 * - Lengths follow the level's length weights (even spread if none given).
 * - Not the same text as any of the last few spawned words.
 * - Prefer a first letter none of the last few words start with, so a first
 *   keystroke usually points at one word. "Last few" = maxActiveWords − 1,
 *   i.e. the words most likely to still be on the field.
 */
/**
 * How hard a word is to type, apart from its length: rare letters
 * (j k q x z = 1, v w y = ½), each run of 3+ consonants (+1), and capitalised
 * names (+2). "ash" = 0, "quill" = 1, "Yggdrasil" = 6.5.
 */
export function wordComplexity(word: string): number {
  const w = word.toLowerCase();
  let score = word[0] !== w[0] ? 2 : 0;
  for (const ch of w) {
    if ('jkqxz'.includes(ch)) score += 1;
    else if ('vwy'.includes(ch)) score += 0.5;
  }
  return score + (w.match(/[^aeiou]{3,}/g)?.length ?? 0);
}

export class WordGenerator {
  private readonly byLength = new Map<number, string[]>();
  private readonly lengthWeights: Record<string, number>;
  private readonly recent: string[] = [];
  private readonly window: number;

  constructor(
    words: readonly string[],
    config: Pick<DifficultyConfig, 'minWordLength' | 'maxWordLength' | 'wordLengthWeights'> &
      Partial<Pick<DifficultyConfig, 'maxActiveWords' | 'maxComplexity'>>,
    private readonly rng: SeededRandom,
  ) {
    for (const word of words) {
      if (word.length < config.minWordLength || word.length > config.maxWordLength) continue;
      if (typeof config.maxComplexity === 'number' && wordComplexity(word) > config.maxComplexity) continue;
      const bucket = this.byLength.get(word.length);
      if (bucket) bucket.push(word);
      else this.byLength.set(word.length, [word]);
    }
    if (this.byLength.size === 0) {
      throw new Error(`No words between ${config.minWordLength} and ${config.maxWordLength} letters`);
    }

    this.lengthWeights = {};
    for (const length of this.byLength.keys()) {
      const weight = config.wordLengthWeights ? (config.wordLengthWeights[length] ?? 0) : 1;
      if (weight > 0) this.lengthWeights[String(length)] = weight;
    }
    if (Object.keys(this.lengthWeights).length === 0) {
      throw new Error('wordLengthWeights gives no weight to any available word length');
    }
    this.window = Math.max(1, (config.maxActiveWords ?? 5) - 1);
  }

  /** Words available per length (after the length and complexity filters). */
  lengthCounts(): Record<number, number> {
    return Object.fromEntries([...this.byLength].map(([len, words]) => [len, words.length]));
  }

  /**
   * Difficulty Director (D-097): a word of exactly `length` letters (the
   * nearest available length if none), with the same fairness rules as
   * next(). Only called when a level has a director; next() is unchanged.
   */
  nextOfLength(length: number): string {
    let len = length;
    if (!this.byLength.has(len)) {
      const lengths = [...this.byLength.keys()].sort((a, b) => Math.abs(a - length) - Math.abs(b - length) || a - b);
      len = lengths[0]!;
    }
    return this.choose(() => len);
  }

  next(): string {
    return this.choose(() => Number(this.rng.weighted(this.lengthWeights)));
  }

  private choose(pickLength: () => number): string {
    // All comparisons ignore case ("Merlin" and "merlin" are the same word).
    const usedText = new Set(this.recent);
    const usedFirst = new Set(this.recent.map((w) => w[0]));
    let chosen: string | null = null;
    let fallback: string | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt++) {
      const length = pickLength();
      const word = this.rng.pick(this.byLength.get(length)!);
      const lower = word.toLowerCase();
      if (usedText.has(lower)) continue;
      if (!usedFirst.has(lower[0])) chosen = word;
      else fallback ??= word;
    }
    // Crowded first letters: accept a shared first letter.
    // Exhausted attempts must still respect the configured length distribution.
    // Previously this always fell back to the shortest bucket (often 2 letters).
    const word = chosen ?? fallback ?? this.rng.pick(this.byLength.get(pickLength())!);
    this.recent.push(word.toLowerCase());
    if (this.recent.length > this.window) this.recent.shift();
    return word;
  }
}
