/**
 * OFFLINE scoring proposal, not wired into GameEngine.
 * One wrong keystroke ends the precision chain immediately, even if corrected.
 * Every ten consecutive error-free captures adds +1 to the Combo multiplier.
 */
export interface PrecisionComboState {
  perfectWords: number;
  currentWordHasTypo: boolean;
}

export function newPrecisionCombo(): PrecisionComboState {
  return { perfectWords: 0, currentWordHasTypo: false };
}

export function precisionComboMultiplier(perfectWords: number): number {
  if (!Number.isInteger(perfectWords) || perfectWords < 0) throw new RangeError('perfectWords must be nonnegative');
  return 1 + Math.floor(perfectWords / 10);
}

export function precisionComboOnTypo(_state: Readonly<PrecisionComboState>): PrecisionComboState {
  return { perfectWords: 0, currentWordHasTypo: true };
}

export function precisionComboOnCapture(state: Readonly<PrecisionComboState>): PrecisionComboState {
  return state.currentWordHasTypo
    ? { perfectWords: 0, currentWordHasTypo: false }
    : { perfectWords: state.perfectWords + 1, currentWordHasTypo: false };
}

export function precisionComboOnMiss(): PrecisionComboState {
  return newPrecisionCombo();
}

/** Hypothetical scoring formula; Volley multiplier is intentionally an input,
 * because its pace-based thresholds have not yet been approved. */
export function proposedWordScore(letters: number, comboMultiplier: number, volleyMultiplier: number): number {
  if (![letters, comboMultiplier, volleyMultiplier].every(Number.isFinite) || letters < 0 || comboMultiplier < 1 || volleyMultiplier < 1) {
    throw new RangeError('invalid scoring inputs');
  }
  return Math.round(letters * 10 * comboMultiplier * volleyMultiplier);
}
