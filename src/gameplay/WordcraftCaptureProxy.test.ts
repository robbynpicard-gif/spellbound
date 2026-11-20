import { describe, expect, it } from 'vitest';
import { simulateCaptureOrder } from './WordcraftCaptureProxy';

describe('Wordcraft capture-order proxy', () => {
  const oldest = { fieldSize: 1, missChance: 0, target: 'oldest' as const };

  it('recognizes captured phrases in sequence and respects session boundaries', () => {
    const result = simulateCaptureOrder(['dragon', 'conjure', '', 'ancient', 'castle'], oldest, 42);
    expect(result).toEqual({ captured: 4, missed: 0, classifiedCaptures: 4, phrases: 2 });
  });

  it('does not credit missed words and breaks grammatical chains', () => {
    const result = simulateCaptureOrder(['dragon', 'conjure', 'ancient'], { ...oldest, missChance: 1 }, 42);
    expect(result).toEqual({ captured: 0, missed: 3, classifiedCaptures: 0, phrases: 0 });
  });

  it('is seeded and models multiple target-selection strategies', () => {
    const words = ['dragon', 'conjure', 'ancient', 'castle', 'quickly', 'summon'];
    const scenario = { fieldSize: 4, missChance: 0.2, target: 'random' as const };
    expect(simulateCaptureOrder(words, scenario, 7)).toEqual(simulateCaptureOrder(words, scenario, 7));
    const result = simulateCaptureOrder(words, scenario, 7);
    expect(result.captured + result.missed).toBe(words.length);
  });

  it('rejects invalid scenario parameters', () => {
    expect(() => simulateCaptureOrder(['dragon'], { ...oldest, fieldSize: 0 }, 1)).toThrow();
    expect(() => simulateCaptureOrder(['dragon'], { ...oldest, missChance: 2 }, 1)).toThrow();
  });
});
