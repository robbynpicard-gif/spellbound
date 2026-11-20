import { scoreWord, multiplierOf, streakMultiplierOf, type Bonus } from './ScoringSystem';
import {
  newPrecisionCombo, precisionComboMultiplier, precisionComboOnCapture,
  precisionComboOnTypo, proposedWordScore, type PrecisionComboState,
} from './PrecisionComboPrototype';

/**
 * OFFLINE COMPARISON ONLY. Synthetic identical capture/typo events are replayed
 * through the current score formula and the proposed precision/flow formula.
 * No word generator, GameEngine, UI, save, or production behavior is changed.
 */
export interface ScoringEvent {
  letters: number;
  /** Whether a wrong keystroke occurred before this capture, even if corrected. */
  typo: boolean;
  /** Pace measured across a fixed recent window, expressed as equivalent WPM. */
  paceWpm: number;
  /** Existing optional bonus awards (kept separate to reveal migration cost). */
  bonuses?: readonly Bonus[];
}
export interface ScoringComparison {
  currentTotal: number;
  proposedTotal: number;
  currentPeakWord: number;
  proposedPeakWord: number;
  currentFinalCombo: number;
  proposedFinalCombo: number;
  proposedPeakVolley: number;
}

/** Provisional, deliberately conservative flow tiers. These are not approved values.
 * A pace measured in characters/5 per minute is word-length normalized. */
export function experimentalVolleyMultiplier(paceWpm: number): number {
  if (!Number.isFinite(paceWpm) || paceWpm < 0) throw new RangeError('invalid pace');
  if (paceWpm >= 110) return 3;
  if (paceWpm >= 85) return 2;
  if (paceWpm >= 65) return 1.5;
  return 1;
}

export function compareScoring(events: readonly ScoringEvent[]): ScoringComparison {
  let currentTotal = 0;
  let proposedTotal = 0;
  let currentPeakWord = 0;
  let proposedPeakWord = 0;
  let currentCombo = 0;
  let currentCleanStreak = 0;
  let proposed: PrecisionComboState = newPrecisionCombo();
  let proposedPeakVolley = 1;
  for (const event of events) {
    if (!Number.isInteger(event.letters) || event.letters < 1) throw new RangeError('invalid word length');
    // Current combo tolerates a corrected typo, while current Clean Streak steps
    // down one tier; this is a focused model, not a complete engine replay.
    if (event.typo) {
      const milestones = [0, 5, 15, 25, 50, 100, 200];
      const currentTier = milestones.reduce((t, at, i) => currentCleanStreak >= at ? i : t, 0);
      currentCleanStreak = milestones[Math.max(0, currentTier - 1)]!;
      proposed = precisionComboOnTypo(proposed);
    }
    currentCombo++;
    if (!event.typo) currentCleanStreak++;
    const currentPoints = scoreWord(event.letters, multiplierOf(currentCombo), event.bonuses ?? [], streakMultiplierOf(currentCleanStreak));
    currentTotal += currentPoints;
    currentPeakWord = Math.max(currentPeakWord, currentPoints);
    proposed = precisionComboOnCapture(proposed);
    // A typo interrupts Volley for the current capture, even if typing pace is high.
    const volley = event.typo ? 1 : experimentalVolleyMultiplier(event.paceWpm);
    proposedPeakVolley = Math.max(proposedPeakVolley, volley);
    const proposedPoints = proposedWordScore(event.letters, precisionComboMultiplier(proposed.perfectWords), volley);
    proposedTotal += proposedPoints;
    proposedPeakWord = Math.max(proposedPeakWord, proposedPoints);
  }
  return {
    currentTotal, proposedTotal, currentPeakWord, proposedPeakWord,
    currentFinalCombo: currentCombo, proposedFinalCombo: proposed.perfectWords, proposedPeakVolley,
  };
}
