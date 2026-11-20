import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../core/Random';
import { stageLevel } from '../difficulty/Stages';
import { classifyWord } from './WordClasses';
import { ExperimentalWordcraftGenerator } from './ExperimentalWordcraftGenerator';

describe('offline experimental Wordcraft generator policy', () => {
  const bank = ['dragon', 'castle', 'ancient', 'summon', 'conjure', 'quickly', 'silver', 'bright', 'gentle', 'wander', 'garden', 'shield', 'crown', 'mirror', 'storm', 'shadow', 'flame', 'scroll'];
  const config = { ...stageLevel('normal', 3, 10), minWordLength: 6, maxWordLength: 7, maxComplexity: null };

  it('is deterministic, uses only supplied eligible words, and avoids recent first-letter clashes when possible', () => {
    const generate = () => {
      const generator = new ExperimentalWordcraftGenerator(bank, config, new SeededRandom(71), 71);
      return Array.from({ length: 70 }, () => generator.next());
    };
    const sequence = generate();
    expect(generate()).toEqual(sequence);
    for (const word of sequence) {
      expect(bank).toContain(word);
      expect(word.length).toBeGreaterThanOrEqual(config.minWordLength);
      expect(word.length).toBeLessThanOrEqual(config.maxWordLength);
    }
    expect(sequence.some((word) => classifyWord(word) !== null)).toBe(true);
  });

  it('does not depend on capture outcomes or player actions', () => {
    const a = new ExperimentalWordcraftGenerator(bank, config, new SeededRandom(9), 9);
    const b = new ExperimentalWordcraftGenerator(bank, config, new SeededRandom(9), 9);
    for (let i = 0; i < 30; i++) expect(a.next()).toBe(b.next());
  });
});
