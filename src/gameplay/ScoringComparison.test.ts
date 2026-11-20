import { describe, expect, it } from 'vitest';
import { compareScoring, experimentalVolleyMultiplier, type ScoringEvent } from './ScoringComparison';

const scenario = (count: number, letters: number, paceWpm: number, typoAt: readonly number[] = []): ScoringEvent[] =>
  Array.from({ length: count }, (_, i) => ({ letters, paceWpm, typo: typoAt.includes(i) }));

describe('offline scoring comparison — no gameplay changes', () => {
  it('keeps the current and proposed formulas distinct for a normal player', () => {
    const result = compareScoring(scenario(20, 5, 45));
    expect(result.currentTotal).toBeGreaterThan(0);
    expect(result.proposedTotal).toBeGreaterThan(0);
    expect(result.proposedFinalCombo).toBe(20);
    expect(result.proposedPeakVolley).toBe(1);
  });

  it('gives exceptional clean flow a temporary Volley multiplier', () => {
    const normal = compareScoring(scenario(30, 6, 45));
    const expert = compareScoring(scenario(30, 6, 110));
    expect(expert.proposedTotal).toBe(3 * normal.proposedTotal);
    expect(expert.currentTotal).toBe(normal.currentTotal);
    expect(expert.proposedPeakVolley).toBe(3);
  });

  it('makes a corrected typo reset proposed Combo, but not the current Combo', () => {
    const events = scenario(25, 6, 85, [19]);
    const result = compareScoring(events);
    expect(result.currentFinalCombo).toBe(25);
    expect(result.proposedFinalCombo).toBe(5);
    expect(result.proposedTotal).toBeLessThan(compareScoring(scenario(25, 6, 85)).proposedTotal);
  });

  it('normalizes Volley thresholds by character pace rather than short-word count', () => {
    expect(experimentalVolleyMultiplier(84.9)).toBe(1.5);
    expect(experimentalVolleyMultiplier(85)).toBe(2);
    expect(experimentalVolleyMultiplier(110)).toBe(3);
    expect(experimentalVolleyMultiplier(45)).toBe(1);
  });

  it('is deterministic and does not mutate event input', () => {
    const events = Object.freeze(scenario(15, 4, 65, [8]).map((e) => Object.freeze(e)));
    expect(compareScoring(events)).toEqual(compareScoring(events));
  });

  it('rejects impossible inputs', () => {
    expect(() => experimentalVolleyMultiplier(-1)).toThrow(RangeError);
    expect(() => compareScoring([{ letters: 0, paceWpm: 50, typo: false }])).toThrow(RangeError);
  });
});
