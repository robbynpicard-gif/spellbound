import { describe, expect, it } from 'vitest';
import { resolveElementalReaction, type Element } from '../src/gameplay/ElementalReactions';

describe('TypeL elemental interaction contract', () => {
  it.each([
    ['fire', 'water', 'extinguish', 1.25, true],
    ['water', 'fire', 'steam', 0.75, true],
    ['water', 'ice', 'freeze', 1.25, true],
    ['ice', 'fire', 'melt', 1.5, true],
    ['water', 'shock', 'conduct', 1.5, false],
    ['ice', 'earth', 'shatter', 1.5, true],
    ['fire', 'wind', 'fan', 1.25, false],
    ['fire', 'earth', 'smother', 0.75, true],
    ['wind', 'void', 'disperse', 1, true],
  ] as const)('%s followed by %s produces %s', (existing, incoming, reaction, multiplier, consumed) => {
    expect(resolveElementalReaction(existing, incoming)).toEqual({
      reaction, damageMultiplier: multiplier, consumesStatus: consumed,
    });
  });

  it('does not react with an absent status', () => {
    const elements: Element[] = ['water', 'fire', 'ice', 'wind', 'shock', 'earth', 'void'];
    for (const element of elements) {
      expect(resolveElementalReaction(null, element)).toEqual({
        reaction: 'none', damageMultiplier: 1, consumesStatus: false,
      });
    }
  });

  it('does not react with the same element', () => {
    const elements: Element[] = ['water', 'fire', 'ice', 'wind', 'shock', 'earth', 'void'];
    for (const element of elements) {
      expect(resolveElementalReaction(element, element).reaction).toBe('none');
    }
  });

  it('preserves directionality: water on fire differs from fire on water', () => {
    expect(resolveElementalReaction('fire', 'water').reaction).toBe('extinguish');
    expect(resolveElementalReaction('water', 'fire').reaction).toBe('steam');
  });
});
