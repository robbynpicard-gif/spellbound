import { describe, expect, it } from 'vitest';
import { emptyLifetime } from '../storage/LifetimeStats';
import { triumphProgress, TRIUMPH_DEFINITIONS } from './Triumphs';

describe('lifetime Triumphs', () => {
  it('starts locked with a Bronze target', () => {
    const progress = triumphProgress(emptyLifetime());
    expect(progress).toHaveLength(TRIUMPH_DEFINITIONS.length);
    expect(progress.every((t) => t.tier === 0 && t.next === t.targets[0])).toBe(true);
  });

  it('unlocks tiers at exact thresholds and stops at Gold', () => {
    const life = emptyLifetime();
    life.wordsCaptured = 100;
    expect(triumphProgress(life).find((t) => t.id === 'scribe')?.tier).toBe(1);
    life.wordsCaptured = 1000;
    expect(triumphProgress(life).find((t) => t.id === 'scribe')?.tier).toBe(2);
    life.wordsCaptured = 10000;
    const gold = triumphProgress(life).find((t) => t.id === 'scribe');
    expect(gold?.tier).toBe(3);
    expect(gold?.next).toBeNull();
  });

  it('reads Volley bonuses from lifetime bonus counts', () => {
    const life = emptyLifetime();
    life.bonusCounts.volley = 100;
    const volley = triumphProgress(life).find((t) => t.id === 'volley');
    expect(volley?.tier).toBe(2);
    expect(volley?.next).toBe(500);
  });

  it('does not mutate saved lifetime statistics', () => {
    const life = emptyLifetime();
    life.bestCombo = 25;
    triumphProgress(life);
    expect(life.bestCombo).toBe(25);
  });
});
