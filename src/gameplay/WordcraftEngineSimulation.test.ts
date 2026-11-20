import { describe, expect, it } from 'vitest';
import { WORDS } from '../data/wordList';
import { stageLevel } from '../difficulty/Stages';
import { simulateEngineWordcraft } from './WordcraftEngineSimulation';

describe('real-engine Wordcraft evaluation', () => {
  it('replays the same seeded commands and preserves actual engine events', () => {
    const config = stageLevel('normal', 2, 10);
    const result = simulateEngineWordcraft(WORDS, config, 1873, 900, 2);
    expect(result.replayMatched).toBe(true);
    expect(result.spawned).toBeGreaterThan(0);
    expect(result.captured).toBeGreaterThan(0);
    expect(result.maxConcurrentWords).toBeGreaterThan(0);
    expect(result.phrases).toBeLessThanOrEqual(result.captured);
    expect(simulateEngineWordcraft(WORDS, config, 1873, 900, 2)).toEqual(result);
  });

  it('compares slow and fast typists without changing the word generator', () => {
    const config = stageLevel('normal', 3, 10);
    const fast = simulateEngineWordcraft(WORDS, config, 101, 1200, 2);
    const slow = simulateEngineWordcraft(WORDS, config, 101, 1200, 9);
    for (const result of [fast, slow]) {
      expect(result.replayMatched).toBe(true);
      expect(result.spawned).toBeGreaterThan(0);
      console.info('WORDCRAFT_ENGINE_AUDIT', JSON.stringify({ speedTicksPerChar: result === fast ? 2 : 9, ...result }));
    }
  });

  it('rejects invalid simulated typing rates and tick budgets', () => {
    const config = stageLevel('normal', 1, 10);
    expect(() => simulateEngineWordcraft(WORDS, config, 1, 0)).toThrow();
    expect(() => simulateEngineWordcraft(WORDS, config, 1, 10, 0)).toThrow();
  });
});
