import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../core/Random';
import { SPELL_IDS } from './SpellManager';
import { attemptArcaneGambit, startGambitStage } from './ArcaneGambitPrototype';

describe('offline one-use-per-stage Arcane Gambit prototype (D-058)', () => {
  it('makes one deterministic random scroll roll without mutating its state', () => {
    const initial = Object.freeze(startGambitStage(3));
    const a = attemptArcaneGambit(initial, new SeededRandom(123));
    const b = attemptArcaneGambit(initial, new SeededRandom(123));
    expect(a).toEqual(b);
    expect(initial).toEqual({ stage: 3, available: true });
    expect(a.outcome).toBe('summoned');
    if (a.outcome === 'summoned') {
      expect(SPELL_IDS).toContain(a.spell);
      expect(a.state).toEqual({ stage: 3, available: false });
    }
  });

  it('cannot be used twice in one stage or consume RNG when unavailable', () => {
    const rng = new SeededRandom(77);
    const first = attemptArcaneGambit(startGambitStage(2), rng);
    expect(first.outcome).toBe('summoned');
    const before = rng.getState();
    const second = attemptArcaneGambit(first.state, rng);
    expect(second).toEqual({ outcome: 'unavailable', reason: 'already-used', state: first.state });
    expect(rng.getState()).toBe(before);
  });

  it('resets only when explicitly beginning another stage', () => {
    const used = attemptArcaneGambit(startGambitStage(1), new SeededRandom(3));
    expect(used.state.available).toBe(false);
    expect(startGambitStage(2)).toEqual({ stage: 2, available: true });
  });

  it('keeps the emergency roll uncertain rather than guaranteeing a rescue', () => {
    const results = new Set(Array.from({ length: 64 }, (_, seed) => {
      const result = attemptArcaneGambit(startGambitStage(1), new SeededRandom(seed));
      return result.outcome === 'summoned' ? result.spell : 'none';
    }));
    expect(results.size).toBeGreaterThan(1);
  });

  it('rejects invalid stage identifiers', () => {
    expect(() => startGambitStage(0)).toThrow(RangeError);
    expect(() => startGambitStage(1.5)).toThrow(RangeError);
  });
});
