import { describe, expect, it } from 'vitest';
import { resolveElementalReaction } from './ElementalReactions';
import { activeElementalStatus, applyElementalStatus } from './ElementalStatus';
import { SPELL_IDS, addCharge, emptyCharges, poolSizeFor, totalCharges } from './SpellManager';

describe('D-058 existing spell economy and elemental behavior', () => {
  it('keeps the accepted eight-spell roster and shared charge pool', () => {
    expect(SPELL_IDS).toEqual(['slow', 'barrier', 'wind', 'fire', 'ice', 'shock', 'alter', 'harvest']); // D-115 curriculum order
    const charges = emptyCharges();
    expect(poolSizeFor(0)).toBe(8);
    expect(poolSizeFor(25)).toBe(9);
    expect(poolSizeFor(50)).toBe(10);
    expect(poolSizeFor(100)).toBe(11);
    expect(poolSizeFor(200)).toBe(12);
    for (let i = 0; i < 8; i++) expect(addCharge(charges, 'fire')).toBe(true);
    expect(addCharge(charges, 'fire')).toBe(false);
    expect(totalCharges(charges)).toBe(8);
  });

  it('preserves intuitive elemental reaction definitions without inventing new spells', () => {
    expect(resolveElementalReaction('fire', 'water').reaction).toBe('extinguish');
    expect(resolveElementalReaction('water', 'fire').reaction).toBe('steam');
    expect(resolveElementalReaction('ice', 'fire').reaction).toBe('melt');
    expect(resolveElementalReaction('water', 'shock').reaction).toBe('conduct');
    expect(resolveElementalReaction('fire', 'wind').reaction).toBe('fan');
    expect(resolveElementalReaction('ice', 'ice').reaction).toBe('none');
    expect(resolveElementalReaction(null, 'fire').reaction).toBe('none');
  });

  it('expires status at a deterministic simulation tick, preventing stale reactions', () => {
    const first = applyElementalStatus(null, 'fire', 100, 30);
    expect(activeElementalStatus(first.next, 129)?.element).toBe('fire');
    expect(activeElementalStatus(first.next, 130)).toBeNull();
    expect(applyElementalStatus(first.next, 'water', 129, 30).outcome.reaction).toBe('extinguish');
    expect(applyElementalStatus(first.next, 'water', 130, 30).outcome.reaction).toBe('none');
  });
});
