import type { GameResult } from '../core/GameEvents';
import type { GameStats } from '../gameplay/ScoringSystem';

/** Best results on one campaign level (from completed runs only). */
export interface LevelRecord {
  bestScore: number;
  bestWpm: number;
  bestAccuracy: number;
  bestCombo: number;
  completions: number;
  attempts: number;
}

export interface CampaignProgress {
  /** Highest level the player may start. Starts at 1. */
  highestUnlocked: number;
  /** Keyed by level number as a string (JSON-friendly). */
  levels: Record<string, LevelRecord>;
}

export interface CampaignOutcome {
  /** True when this run beat the previous best score on a completed run. */
  isNewBest: boolean;
  /** Best completed score before this run, or null if never completed. */
  previousBest: number | null;
  /** Level number newly unlocked by this run, if any. */
  unlockedLevel: number | null;
  /** Whether a further level exists after this one. */
  hasNextLevel: boolean;
}

export function emptyCampaignProgress(): CampaignProgress {
  return { highestUnlocked: 1, levels: {} };
}

function emptyRecord(): LevelRecord {
  return { bestScore: 0, bestWpm: 0, bestAccuracy: 0, bestCombo: 0, completions: 0, attempts: 0 };
}

/**
 * Campaign rules for what a finished run changes. Mutates `progress`.
 *
 * - Every run counts as an attempt.
 * - Only completed (won) runs set personal bests, so a long losing run can't
 *   outrank a real clear.
 * - Winning level N unlocks level N+1, if it exists.
 */
export function applyCampaignResult(
  progress: CampaignProgress,
  level: number,
  result: GameResult,
  stats: GameStats,
  totalLevels: number,
): CampaignOutcome {
  const key = String(level);
  const record = (progress.levels[key] ??= emptyRecord());
  record.attempts++;

  const hadCompletion = record.completions > 0;
  const previousBest = hadCompletion ? record.bestScore : null;
  let isNewBest = false;
  let unlockedLevel: number | null = null;

  if (result === 'won') {
    record.completions++;
    isNewBest = !hadCompletion || stats.score > record.bestScore;
    record.bestScore = Math.max(record.bestScore, stats.score);
    record.bestWpm = Math.max(record.bestWpm, stats.wpm);
    record.bestAccuracy = Math.max(record.bestAccuracy, stats.accuracy);
    record.bestCombo = Math.max(record.bestCombo, stats.maxCombo);

    const next = level + 1;
    if (next <= totalLevels && progress.highestUnlocked < next) {
      progress.highestUnlocked = next;
      unlockedLevel = next;
    }
  }

  return { isNewBest, previousBest, unlockedLevel, hasNextLevel: level < totalLevels };
}
