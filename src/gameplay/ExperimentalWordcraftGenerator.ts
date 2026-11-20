import { SeededRandom } from '../core/Random';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { classifyWord, type WordClass } from './WordClasses';
import { PHRASE_PATTERNS } from './PhraseTracker';
import { WordGenerator, wordComplexity } from './WordGenerator';

/** Testing-only counterfactual generator. NEVER use in production or duels.
 * The baseline generator still makes every length/complexity-eligible draw.
 * An independent seeded stream occasionally replaces the draw with a
 * grammar-compatible word of identical length and permitted complexity.
 * Decisions depend on spawned words, never captures or misses. */
export class ExperimentalWordcraftGenerator extends WordGenerator {
  private readonly alternate: SeededRandom;
  private readonly buckets = new Map<number, string[]>();
  private readonly recentCandidate: string[] = [];
  private readonly windowSize: number;
  private previousClass: WordClass | null = null;

  constructor(words: readonly string[], config: DifficultyConfig, rng: SeededRandom, seed: number) {
    super(words, config, rng);
    this.alternate = new SeededRandom((seed ^ 0x7a1c5eed) >>> 0);
    this.windowSize = Math.max(1, config.maxActiveWords - 1);
    for (const word of words) {
      if (word.length < config.minWordLength || word.length > config.maxWordLength) continue;
      if (typeof config.maxComplexity === 'number' && wordComplexity(word) > config.maxComplexity) continue;
      const bucket = this.buckets.get(word.length) ?? [];
      bucket.push(word);
      this.buckets.set(word.length, bucket);
    }
  }

  override next(): string {
    const ordinary = super.next();
    const preferred: WordClass[] = PHRASE_PATTERNS.filter((p) => p.first === this.previousClass).map((p) => p.second);
    let chosen = ordinary;
    if (preferred.length && this.alternate.chance(0.2)) {
      const eligible = (this.buckets.get(ordinary.length) ?? []).filter((word) => {
        const lower = word.toLowerCase();
        return preferred.includes(classifyWord(word)!)
          && !this.recentCandidate.includes(lower)
          && !this.recentCandidate.some((recent) => recent[0] === lower[0]);
      });
      if (eligible.length) chosen = this.alternate.pick(eligible);
    }
    this.previousClass = classifyWord(chosen);
    this.recentCandidate.push(chosen.toLowerCase());
    if (this.recentCandidate.length > this.windowSize) this.recentCandidate.shift();
    return chosen;
  }
}
