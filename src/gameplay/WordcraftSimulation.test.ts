import { describe, expect, it } from 'vitest';
import { WORDS } from '../data/wordList';
import { stageLevel } from '../difficulty/Stages';
import { simulateWordcraftSelection } from './WordcraftSimulation';

describe('offline Wordcraft selection experiment', () => {
  it('is reproducible with identical seeded trials', () => {
    const config = stageLevel('normal', 3, 10);
    const first = simulateWordcraftSelection(WORDS, config, 8, 80);
    expect(simulateWordcraftSelection(WORDS, config, 8, 80)).toEqual(first);
  });

  it('preserves the exact length histogram across both experimental arms', () => {
    for (const stage of [1, 3, 5]) {
      const config = stageLevel('normal', stage, 10);
      const result = simulateWordcraftSelection(WORDS, config, 6, 70);
      expect(result.candidate.lengths).toEqual(result.baseline.lengths);
      expect(result.baseline.classified).toBeGreaterThanOrEqual(0);
      expect(result.candidate.phrases).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not modify the supplied word pool or game configuration', () => {
    const pool = ['dragon', 'conjure', 'ancient', 'castle', 'quickly', 'summon'];
    const config = { minWordLength: 5, maxWordLength: 7 };
    const before = [...pool];
    simulateWordcraftSelection(pool, config, 2, 12);
    expect(pool).toEqual(before);
    expect(config).toEqual({ minWordLength: 5, maxWordLength: 7 });
  });
});
