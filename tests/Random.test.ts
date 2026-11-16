import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/Random';

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    const a = new SeededRandom(12345);
    const b = new SeededRandom(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRandom(1);
    const b = new SeededRandom(2);
    expect(a.next()).not.toEqual(b.next());
  });

  it('can resume from a saved state', () => {
    const a = new SeededRandom(99);
    a.next();
    a.next();
    const resumed = new SeededRandom(a.getState());
    expect(resumed.next()).toEqual(a.next());
  });

  it('keeps next() within [0, 1) and int() within bounds', () => {
    const rng = new SeededRandom(7);
    for (let i = 0; i < 10_000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(3, 9);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(9);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('weighted() respects weights roughly and skips zero weights', () => {
    const rng = new SeededRandom(42);
    const counts = { common: 0, rare: 0, never: 0 };
    for (let i = 0; i < 20_000; i++) {
      counts[rng.weighted({ common: 3, rare: 1, never: 0 })]++;
    }
    expect(counts.never).toBe(0);
    const ratio = counts.common / counts.rare;
    expect(ratio).toBeGreaterThan(2.7);
    expect(ratio).toBeLessThan(3.3);
  });

  it('throws on invalid input', () => {
    const rng = new SeededRandom(1);
    expect(() => rng.pick([])).toThrow();
    expect(() => rng.int(5, 1)).toThrow();
    expect(() => rng.weighted({ a: 0 })).toThrow();
  });
});
