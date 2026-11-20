import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../core/Random';
import { SPELL_IDS } from './SpellManager';
import { attemptArcaneGambit, GAMBIT_COOLDOWN_TICKS } from './ArcaneGambitPrototype';

describe('offline Arcane Gambit viability prototype (D-058)', () => {
  it('is deterministic for the same seed and does not modify caller state', () => {
    const state = Object.freeze({ charges: 2, readyAtTick: 0 });
    const a = attemptArcaneGambit(state, 100, new SeededRandom(123));
    const b = attemptArcaneGambit(state, 100, new SeededRandom(123));
    expect(a).toEqual(b);
    expect(state).toEqual({ charges: 2, readyAtTick: 0 });
    expect(a.outcome).toBe('summoned');
    if (a.outcome === 'summoned') {
      expect(SPELL_IDS).toContain(a.spell);
      expect(a.state).toEqual({ charges: 1, readyAtTick: 100 + GAMBIT_COOLDOWN_TICKS });
    }
  });

  it('refuses repeated requests during cooldown without consuming a charge or RNG draw', () => {
    const rng = new SeededRandom(77);
    const first = attemptArcaneGambit({ charges: 2, readyAtTick: 0 }, 1, rng);
    expect(first.outcome).toBe('summoned');
    const before = rng.getState();
    const second = attemptArcaneGambit(first.state, 2, rng);
    expect(second).toEqual({ outcome: 'unavailable', reason: 'cooldown', state: first.state });
    expect(rng.getState()).toBe(before);
    const third = attemptArcaneGambit(first.state, 1 + GAMBIT_COOLDOWN_TICKS, rng);
    expect(third.outcome).toBe('summoned');
  });

  it('does not create free scrolls when out of charges', () => {
    const rng = new SeededRandom(12);
    const before = rng.getState();
    expect(attemptArcaneGambit({ charges: 0, readyAtTick: 0 }, 10, rng))
      .toEqual({ outcome: 'unavailable', reason: 'no-charge', state: { charges: 0, readyAtTick: 0 } });
    expect(rng.getState()).toBe(before);
  });

  it('never guarantees a particular rescue spell', () => {
    const results = new Set(Array.from({ length: 64 }, (_, seed) => {
      const result = attemptArcaneGambit({ charges: 1, readyAtTick: 0 }, 0, new SeededRandom(seed));
      return result.outcome === 'summoned' ? result.spell : 'none';
    }));
    expect(results.size).toBeGreaterThan(1);
  });
});
