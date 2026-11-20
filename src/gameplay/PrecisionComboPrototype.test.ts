import { describe, expect, it } from 'vitest';
import {
  newPrecisionCombo, precisionComboMultiplier, precisionComboOnCapture,
  precisionComboOnMiss, precisionComboOnTypo, proposedWordScore,
} from './PrecisionComboPrototype';

describe('offline strict-precision Combo proposal', () => {
  it('gains one multiplier tier for each ten perfect captures', () => {
    let state = newPrecisionCombo();
    for (let i = 1; i <= 30; i++) {
      state = precisionComboOnCapture(state);
      expect(precisionComboMultiplier(state.perfectWords)).toBe(1 + Math.floor(i / 10));
    }
  });

  it('immediately resets a Combo on the first wrong keystroke even if corrected', () => {
    let state = newPrecisionCombo();
    for (let i = 0; i < 25; i++) state = precisionComboOnCapture(state);
    expect(precisionComboMultiplier(state.perfectWords)).toBe(3);
    state = precisionComboOnTypo(state);
    expect(state.perfectWords).toBe(0);
    expect(precisionComboMultiplier(state.perfectWords)).toBe(1);
    // Correcting the input and capturing that same word does not restore Combo.
    state = precisionComboOnCapture(state);
    expect(state).toEqual({ perfectWords: 0, currentWordHasTypo: false });
    state = precisionComboOnCapture(state);
    expect(state.perfectWords).toBe(1);
  });

  it('resets on a missed word and does not mutate input state', () => {
    const previous = Object.freeze({ perfectWords: 12, currentWordHasTypo: false });
    expect(precisionComboOnMiss()).toEqual(newPrecisionCombo());
    expect(precisionComboOnTypo(previous)).toEqual({ perfectWords: 0, currentWordHasTypo: true });
    expect(previous.perfectWords).toBe(12);
  });

  it('keeps the proposed base × Combo × Volley equation transparent', () => {
    expect(proposedWordScore(6, 3, 2)).toBe(360);
    expect(proposedWordScore(6, 1, 1)).toBe(60);
  });
});
