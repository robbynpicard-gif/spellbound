import { SeededRandom } from '../core/Random';
import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import { wordComplexity, WordGenerator } from './WordGenerator';
import { classifyWord, type WordClass } from './WordClasses';
import { PHRASE_PATTERNS } from './PhraseTracker';

/** OFFLINE EXPERIMENT ONLY. This module is never called by live word spawning.
 * Both arms use seeded draws, the same length, complexity and playable bank.
 * This estimates potential; it does not simulate human capture order, misses,
 * concurrent falling words or full game-engine timing. Candidate redraws
 * additionally avoid recent duplicate texts and first letters, but are not
 * identical to the generator's twelve-attempt fallback algorithm. */
export interface SimulationArm {
  classified: number;
  phrases: number;
  lengths: Record<number, number>;
  averageComplexity: number;
  recentDuplicateViolations: number;
  recentFirstLetterCollisions: number;
}

export interface WordcraftSimulation {
  baseline: SimulationArm;
  candidate: SimulationArm;
  wordsPerTrial: number;
  trials: number;
}

function measure(words: readonly string[], window: number): SimulationArm {
  let previous: ReturnType<typeof classifyWord> = null;
  let classified = 0;
  let phrases = 0;
  const lengths: Record<number, number> = {};
  let complexity = 0;
  let count = 0;
  let recentDuplicateViolations = 0;
  let recentFirstLetterCollisions = 0;
  const recent: string[] = [];
  for (const word of words) {
    if (!word) { recent.length = 0; previous = null; continue; }
    const lower = word.toLowerCase();
    if (recent.includes(lower)) recentDuplicateViolations++;
    if (recent.some((w) => w[0] === lower[0])) recentFirstLetterCollisions++;
    recent.push(lower);
    if (recent.length > window) recent.shift();
    complexity += wordComplexity(word);
    count++;
    lengths[word.length] = (lengths[word.length] ?? 0) + 1;
    const current = classifyWord(word);
    if (current) classified++;
    if (previous && current && PHRASE_PATTERNS.some((p) => p.first === previous && p.second === current)) phrases++;
    previous = current;
  }
  return { classified, phrases, lengths, averageComplexity: count ? complexity / count : 0, recentDuplicateViolations, recentFirstLetterCollisions };
}

export function simulateWordcraftSelection(
  words: readonly string[],
  config: Pick<DifficultyConfig, 'minWordLength' | 'maxWordLength' | 'wordLengthWeights'> &
    Partial<Pick<DifficultyConfig, 'maxActiveWords' | 'maxComplexity'>>,
  trials = 40,
  wordsPerTrial = 120,
): WordcraftSimulation {
  const baseline: string[] = [];
  const candidate: string[] = [];
  const buckets = new Map<number, string[]>();
  for (const word of words) {
    if (word.length < config.minWordLength || word.length > config.maxWordLength) continue;
    if (typeof config.maxComplexity === 'number' && wordComplexity(word) > config.maxComplexity) continue;
    const bucket = buckets.get(word.length) ?? [];
    bucket.push(word);
    buckets.set(word.length, bucket);
  }
  for (let seed = 1; seed <= trials; seed++) {
    const generator = new WordGenerator(words, config, new SeededRandom(seed * 7919));
    const alternate = new SeededRandom(seed * 104729);
    let previous: ReturnType<typeof classifyWord> = null;
    const recent: string[] = [];
    const window = Math.max(1, (config.maxActiveWords ?? 5) - 1);
    for (let i = 0; i < wordsPerTrial; i++) {
      const ordinary = generator.next();
      baseline.push(ordinary);
      const pool = buckets.get(ordinary.length)!;
      const preferred: WordClass[] = PHRASE_PATTERNS.filter((p) => p.first === previous).map((p) => p.second);
      // Candidate policy: at most one optional redraw with 20% probability.
      // Both choices have exactly the baseline word's length and eligibility.
      let chosen = ordinary;
      if (preferred.length && alternate.chance(0.2)) {
        const matches = pool.filter((w) => preferred.includes(classifyWord(w)!) && !recent.includes(w.toLowerCase()) && !recent.some((r) => r[0] === w[0]?.toLowerCase()));
        if (matches.length) chosen = alternate.pick(matches);
      }
      candidate.push(chosen);
      recent.push(chosen.toLowerCase());
      if (recent.length > window) recent.shift();
      previous = classifyWord(chosen);
    }
    // Prevent phrase pairs crossing simulated trial boundaries.
    baseline.push('');
    candidate.push('');
  }
  const window = Math.max(1, (config.maxActiveWords ?? 5) - 1);
  const base = measure(baseline, window);
  const proposed = measure(candidate, window);
  delete base.lengths[0];
  delete proposed.lengths[0];
  return { baseline: base, candidate: proposed, wordsPerTrial, trials };
}
