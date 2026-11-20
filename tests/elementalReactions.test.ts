import { describe, expect, it } from 'vitest';
import { resolveElementalReaction } from '../src/gameplay/ElementalReactions';

describe('intuitive elemental reactions', () => {
  it('extinguishes fire with water', () => {
    expect(resolveElementalReaction('fire', 'water')).toEqual({
      reaction: 'extinguish', damageMultiplier: 1.25, consumesStatus: true,
    });
  });
  it('melts ice with fire', () => {
    expect(resolveElementalReaction('ice', 'fire').reaction).toBe('melt');
  });
  it('conducts shock through water without consuming the wet status', () => {
    expect(resolveElementalReaction('water', 'shock')).toEqual({
      reaction: 'conduct', damageMultiplier: 1.5, consumesStatus: false,
    });
  });
  it('leaves unrelated elements unchanged', () => {
    expect(resolveElementalReaction('earth', 'ice').reaction).toBe('none');
    expect(resolveElementalReaction(null, 'fire').damageMultiplier).toBe(1);
    expect(resolveElementalReaction('fire', 'fire').consumesStatus).toBe(false);
  });
});
