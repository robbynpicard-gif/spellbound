import { describe, expect, it } from 'vitest';
import { activeElementalStatus, applyElementalStatus } from '../src/gameplay/ElementalStatus';

describe('elemental status lifecycle', () => {
  it('applies a fresh status without a reaction', () => {
    const result = applyElementalStatus(null, 'fire', 10, 60);
    expect(result.next).toEqual({ element: 'fire', expiresAtTick: 70 });
    expect(result.outcome.reaction).toBe('none');
  });
  it('resolves interactions while the previous status is active', () => {
    const fire = applyElementalStatus(null, 'fire', 0, 60).next;
    const water = applyElementalStatus(fire, 'water', 30, 60);
    expect(water.outcome.reaction).toBe('extinguish');
    expect(water.damageMultiplier).toBe(1.25);
    expect(water.next.element).toBe('water');
  });
  it('does not react with expired statuses at the exact expiry tick', () => {
    const fire = applyElementalStatus(null, 'fire', 0, 60).next;
    expect(activeElementalStatus(fire, 59)).toEqual(fire);
    expect(activeElementalStatus(fire, 60)).toBeNull();
    expect(applyElementalStatus(fire, 'water', 60, 60).outcome.reaction).toBe('none');
  });
  it('refreshes status lifetime when the same element is reapplied', () => {
    const first = applyElementalStatus(null, 'ice', 0, 30).next;
    const second = applyElementalStatus(first, 'ice', 10, 30);
    expect(second.outcome.reaction).toBe('none');
    expect(second.next.expiresAtTick).toBe(40);
  });
  it('rejects invalid timing parameters', () => {
    expect(() => applyElementalStatus(null, 'fire', -1, 20)).toThrow(RangeError);
    expect(() => applyElementalStatus(null, 'fire', 0, 0)).toThrow(RangeError);
  });
});
