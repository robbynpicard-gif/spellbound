import type { GameResult } from '../core/GameEvents';
import { accuracyOf, wpmOf, type GameStats } from '../gameplay/ScoringSystem';
import { emptyCharges, sanitizeCharges, type SpellCharges } from '../gameplay/SpellManager';

/**
 * Campaign = one continuous run (decisions.md D-016): always starts at
 * level 1 and plays straight through. Score and spell charges carry from
 * level to level; instability resets each level. The run ends when the
 * wards fall or the last level is cleared. Choosing a level is only
 * possible in Endless Practice.
 */
export interface RunTotals {
  completed: number;
  missed: number;
  correctChars: number;
  errors: number;
  elapsedMs: number;
  maxCombo: number;
}

export interface CampaignRun {
  /** Level currently being played (or about to be). */
  level: number;
  /** Total score so far across all levels of this run. */
  score: number;
  levelsCleared: number;
  /** Spell charges carried into the next level. */
  spellCharges: SpellCharges;
  totals: RunTotals;
}

export interface RunSummary {
  score: number;
  levelsCleared: number;
  /** Level the run ended on (the last level reached). */
  reachedLevel: number;
  victory: boolean;
  accuracy: number;
  wpm: number;
  completed: number;
  missed: number;
  maxCombo: number;
  elapsedMs: number;
}

/** Long-term campaign records kept in the save file. */
export interface CampaignRecords {
  /** Furthest level ever reached in a run (unlocks levels for Practice). */
  highestReached: number;
  bestRun: RunSummary | null;
  runsStarted: number;
  runsCompleted: number;
}

export interface RunOutcome {
  isNewBest: boolean;
  /** Best run score before this run, or null if there was none. */
  previousBest: number | null;
}

export function emptyCampaignRecords(): CampaignRecords {
  return { highestReached: 1, bestRun: null, runsStarted: 0, runsCompleted: 0 };
}

export function startRun(): CampaignRun {
  return {
    level: 1,
    score: 0,
    levelsCleared: 0,
    spellCharges: emptyCharges(),
    totals: { completed: 0, missed: 0, correctChars: 0, errors: 0, elapsedMs: 0, maxCombo: 0 },
  };
}

/**
 * Adds a finished level to the run. Mutates `run`. On a win that isn't the
 * last level, advances `run.level` to the next level.
 */
export function recordLevel(
  run: CampaignRun,
  result: GameResult,
  stats: GameStats,
  chargesAfter: SpellCharges,
  totalLevels: number,
): { runOver: boolean; victory: boolean } {
  const t = run.totals;
  t.completed += stats.completed;
  t.missed += stats.missed;
  t.correctChars += stats.correctChars;
  t.errors += stats.errors;
  t.elapsedMs += stats.elapsedMs;
  t.maxCombo = Math.max(t.maxCombo, stats.maxCombo);
  run.score += stats.score;
  run.spellCharges = sanitizeCharges(chargesAfter);

  if (result === 'lost') return { runOver: true, victory: false };
  run.levelsCleared++;
  if (run.level >= totalLevels) return { runOver: true, victory: true };
  run.level++;
  return { runOver: false, victory: false };
}

export function summarizeRun(run: CampaignRun, victory: boolean): RunSummary {
  const t = run.totals;
  return {
    score: run.score,
    levelsCleared: run.levelsCleared,
    reachedLevel: run.level,
    victory,
    accuracy: accuracyOf(t.correctChars, t.errors),
    wpm: wpmOf(t.correctChars, t.elapsedMs),
    completed: t.completed,
    missed: t.missed,
    maxCombo: t.maxCombo,
    elapsedMs: t.elapsedMs,
  };
}

export function noteLevelReached(records: CampaignRecords, level: number): void {
  records.highestReached = Math.max(records.highestReached, level);
}

/** Records a finished run. Mutates `records`. Abandoned runs are not recorded. */
export function applyRunResult(records: CampaignRecords, summary: RunSummary): RunOutcome {
  const previousBest = records.bestRun?.score ?? null;
  noteLevelReached(records, summary.reachedLevel);
  if (summary.victory) records.runsCompleted++;
  const isNewBest = previousBest === null || summary.score > previousBest;
  if (isNewBest) records.bestRun = { ...summary };
  return { isNewBest, previousBest };
}
