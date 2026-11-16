/**
 * Basic scoring (Milestone 1). Longer words are worth more, and a combo of
 * clean consecutive words adds a bonus of up to +100%.
 *
 * The original game's exact scoring is not yet verified
 * (original-game-research.md #8), so these numbers are a starting point.
 */
export const SCORING = {
  pointsPerLetter: 10,
  /** Bonus per combo step after the first word. */
  comboBonusPerStep: 0.05,
  /** Bonus is capped at this (1.0 = double points). */
  maxComboBonus: 1.0,
} as const;

/** Points for completing a word of `length` letters as the `combo`-th clean word in a row. */
export function wordPoints(length: number, combo: number): number {
  const bonus = Math.min(Math.max(combo - 1, 0) * SCORING.comboBonusPerStep, SCORING.maxComboBonus);
  return Math.round(length * SCORING.pointsPerLetter * (1 + bonus));
}

export interface GameStats {
  score: number;
  completed: number;
  missed: number;
  correctChars: number;
  errors: number;
  /** 0–1. Correct keystrokes divided by all letter keystrokes. */
  accuracy: number;
  /** Words per minute, using the standard 5 characters = 1 word. */
  wpm: number;
  maxCombo: number;
  elapsedMs: number;
  /** Average time from a word appearing to being completed. */
  averageCompletionMs: number;
}

export function accuracyOf(correct: number, errors: number): number {
  const total = correct + errors;
  return total === 0 ? 1 : correct / total;
}

export function wpmOf(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return correctChars / 5 / (elapsedMs / 60_000);
}
