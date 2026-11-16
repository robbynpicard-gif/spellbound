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
export class WordGenerator {
  private readonly byLength = new Map<number, string[]>();
  private readonly lengthWeights: Record<string, number>;
  private readonly recent: string[] = [];
  private readonly window: number;

  constructor(
    words: readonly string[],
    config: Pick<DifficultyConfig, 'minWordLength' | 'maxWordLength' | 'wordLengthWeights'> &
      Partial<Pick<DifficultyConfig, 'maxActiveWords'>>,
    private readonly rng: SeededRandom,
  ) {
    for (const word of words) {
      if (word.length < config.minWordLength || word.length > config.maxWordLength) continue;
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

  next(): string {
    // All comparisons ignore case ("Merlin" and "merlin" are the same word).
    const usedText = new Set(this.recent);
    const usedFirst = new Set(this.recent.map((w) => w[0]));
    let chosen: string | null = null;
    let fallback: string | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS && !chosen; attempt++) {
      const length = Number(this.rng.weighted(this.lengthWeights));
      const word = this.rng.pick(this.byLength.get(length)!);
      const lower = word.toLowerCase();
      if (usedText.has(lower)) continue;
      if (!usedFirst.has(lower[0])) chosen = word;
      else fallback ??= word;
    }
    // Crowded first letters: accept a shared first letter.
    const word = chosen ?? fallback ?? this.rng.pick(this.byLength.values().next().value!);
    this.recent.push(word.toLowerCase());
    if (this.recent.length > this.window) this.recent.shift();
    return word;
  }
}
