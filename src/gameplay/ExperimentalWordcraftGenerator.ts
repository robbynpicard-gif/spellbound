import { SeededRandom } from '../core/Random';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { classifyWord, type WordClass } from './WordClasses';
import { PHRASE_PATTERNS } from './PhraseTracker';
import { WordGenerator, wordComplexity } from './WordGenerator';

export interface WordcraftPolicy { starterChance: number; followupChance: number }
export const DEFAULT_WORDCRAFT_POLICY: Readonly<WordcraftPolicy> = { starterChance: 0.45, followupChance: 0.8 };

/** Testing-only counterfactual generator. NEVER use in production or duels.
 * The baseline generator still makes every length/complexity-eligible draw.
 * An independent seeded stream occasionally replaces the draw with a
 * grammar-compatible word of identical length and permitted complexity.
 * Starter-class nudges make the eligible follow-up more likely on the next spawn.
 * Decisions depend on spawned words, never captures or misses. */
export class ExperimentalWordcraftGenerator extends WordGenerator {
  private readonly alternate: SeededRandom;
  private readonly buckets = new Map<number, string[]>();
  private readonly recentCandidate: string[] = [];
  private readonly windowSize: number;
  private previousClass: WordClass | null = null;
  /** Experimental knobs, isolated from the live generator. */
  private readonly policy: Readonly<WordcraftPolicy>;

  constructor(words: readonly string[], config: DifficultyConfig, rng: SeededRandom, seed: number, policy: Readonly<WordcraftPolicy> = DEFAULT_WORDCRAFT_POLICY) {
    super(words, config, rng);
    if (![policy.starterChance, policy.followupChance].every((n) => Number.isFinite(n) && n >= 0 && n <= 1))
      throw new RangeError('Wordcraft probabilities must be between 0 and 1');
    this.policy = policy;
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
    const preferred: WordClass[] = this.previousClass
      ? PHRASE_PATTERNS.filter((p) => p.first === this.previousClass).map((p) => p.second)
      : [];
    // When no follow-up is pending, encourage a possible first word.
    // Avoid forcing the same phrase repeatedly by sampling all starter classes.
    const starters: WordClass[] = ['noun', 'adjective', 'adverb'];
    const targets = preferred.length ? preferred : starters;
    const chance = preferred.length ? this.policy.followupChance : this.policy.starterChance;
    let chosen = ordinary;
    if (this.alternate.chance(chance)) {
      const eligible = (this.buckets.get(ordinary.length) ?? []).filter((word) => {
        const lower = word.toLowerCase();
        return targets.includes(classifyWord(word)!)
          && !this.recentCandidate.includes(lower)
          && !this.recentCandidate.some((recent) => recent[0] === lower[0]);
      });
      if (eligible.length) chosen = this.alternate.pick(eligible);
    }
    // Reject a baseline draw that collides with the candidate's actual recent
    // spawns when a same-length safe alternative exists. No extra main RNG draws.
    const lower = chosen.toLowerCase();
    if (this.recentCandidate.includes(lower)
      || this.recentCandidate.some((recent) => recent[0] === lower[0])) {
      const safe = (this.buckets.get(ordinary.length) ?? []).filter((word) => {
        const text = word.toLowerCase();
        return !this.recentCandidate.includes(text)
          && !this.recentCandidate.some((recent) => recent[0] === text[0]);
      });
      if (safe.length) chosen = this.alternate.pick(safe);
    }
    this.previousClass = classifyWord(chosen);
    this.recentCandidate.push(chosen.toLowerCase());
    if (this.recentCandidate.length > this.windowSize) this.recentCandidate.shift();
    return chosen;
  }
}
