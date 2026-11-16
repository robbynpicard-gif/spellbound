import type { SeededRandom } from '../core/Random';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';

const MAX_ATTEMPTS = 12;

/**
 * Chooses the next word to spawn.
 *
 * Fairness rules:
 * - Lengths follow the level's length weights (even spread if none given).
 * - Never the same text as a word already on the field.
 * - Prefer a first letter no active word starts with, so the first keystroke
 *   points at exactly one word (makes auto-targeting predictable).
 */
export class WordGenerator {
  private readonly byLength = new Map<number, string[]>();
  private readonly lengthWeights: Record<string, number>;

  constructor(
    words: readonly string[],
    config: Pick<DifficultyConfig, 'minWordLength' | 'maxWordLength' | 'wordLengthWeights'>,
    private readonly rng: SeededRandom,
  ) {
    for (const word of words) {
      if (word.length < config.minWordLength || word.length > config.maxWordLength) continue;
      const bucket = this.byLength.get(word.length);
      if (bucket) bucket.push(word);
      else this.byLength.set(word.length, [word]);
    }
    if (this.byLength.size === 0) {
      throw new Error(
        `No words between ${config.minWordLength} and ${config.maxWordLength} letters`,
      );
    }

    this.lengthWeights = {};
    for (const length of this.byLength.keys()) {
      const weight = config.wordLengthWeights ? (config.wordLengthWeights[length] ?? 0) : 1;
      if (weight > 0) this.lengthWeights[String(length)] = weight;
    }
    if (Object.keys(this.lengthWeights).length === 0) {
      throw new Error('wordLengthWeights gives no weight to any available word length');
    }
  }

  next(active: readonly { text: string }[]): string {
    // All comparisons ignore case ("Frodo" and "frodo" are the same word).
    const usedText = new Set(active.map((w) => w.text.toLowerCase()));
    const usedFirst = new Set(active.map((w) => w.text[0]!.toLowerCase()));
    let fallback: string | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const length = Number(this.rng.weighted(this.lengthWeights));
      const word = this.rng.pick(this.byLength.get(length)!);
      const lower = word.toLowerCase();
      if (usedText.has(lower)) continue;
      if (!usedFirst.has(lower[0]!)) return word;
      fallback ??= word;
    }
    // Field is crowded with first letters: accept a shared first letter.
    return fallback ?? this.rng.pick(this.byLength.values().next().value!);
  }
}
