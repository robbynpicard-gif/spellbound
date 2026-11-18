import type { WordState } from '../gameplay/Word';
import type { GameResult } from '../core/GameEvents';
import { accuracyOf, wpmOf, type GameStats } from '../gameplay/ScoringSystem';
import {
  addCharge,
  emptyCharges,
  sanitizeCharges,
  type SpellCharges,
} from '../gameplay/SpellManager';
import { spellsOfStage, STAGE_LEVELS } from '../difficulty/Stages';

/**
 * Campaign (decisions.md D-047, docs/design.md §4): two modes, each with five
 * stages. A **run is one stage**: 20 levels, 19 standard and a boss at level
 * 20. Losing ends the run (the stage starts again from level 1). Beating the
 * boss clears the stage, unlocks the next one and teaches a new spell.
 * Score, spell charges, combo and Clean Streak carry from level to level
 * within the stage; a new stage starts fresh.
 *
 * - Normal: the ward is restored at the start of each level.
 * - Hardcore: ward damage carries through the stage; clearing levels 5, 10
 *   and 15 heals some of it, and Arcane Purge only halves it.
 */
export type CampaignMode = 'normal' | 'hardcore';
export const CAMPAIGN_MODES: readonly CampaignMode[] = ['normal', 'hardcore'];

export function isCampaignMode(value: unknown): value is CampaignMode {
  return value === 'normal' || value === 'hardcore';
}

/** Hardcore: instability removed after clearing each of these levels. */
export const HARDCORE_HEAL_LEVELS: readonly number[] = [5, 10, 15];
export const HARDCORE_HEAL = 25;
export interface RunTotals {
  completed: number;
  missed: number;
  correctChars: number;
  errors: number;
  elapsedMs: number;
  maxCombo: number;
}

export interface CampaignRun {
  mode: CampaignMode;
  /** The stage being played (1–5). */
  stage: number;
  /** Level currently being played (or about to be). */
  level: number;
  /** Instability carried into the next level (always 0 in Normal). */
  instability: number;
  /** Total score so far across all levels of this run. */
  score: number;
  levelsCleared: number;
  /** Spell charges carried into the next level. */
  spellCharges: SpellCharges;
  /** Words left on the field at the end of the last level: they carry on (D-055). */
  carryWords?: WordState[];
  /** Combo carried into the next level (D-040): a run's streak continues across levels. */
  combo: number;
  /** Clean Streak carried into the next level (D-046): it lasts the whole stage. */
  cleanStreak: number;
  totals: RunTotals;
}

export interface RunSummary {
  /** Stage played (runs recorded before D-047 have none). */
  stage?: number;
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

/** Long-term records for one stage of one mode, kept in the save file. */
export interface CampaignRecords {
  /** Furthest level of the stage ever reached (unlocks levels for Practice). */
  highestReached: number;
  bestRun: RunSummary | null;
  runsStarted: number;
  /** Times the stage was cleared (beating its boss). Over 0 unlocks the next stage. */
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

/**
 * A fresh run of one stage. From stage 2 on, the run starts with one charge of
 * the spell won from the previous stage's boss (D-047).
 */
export function startRun(mode: CampaignMode = 'normal', stage = 1): CampaignRun {
  const charges = emptyCharges();
  const gift = stage > 1 ? spellsOfStage(stage - 1).fromBoss : null;
  if (gift) addCharge(charges, gift);
  return {
    mode,
    stage,
    instability: 0,
    level: 1,
    score: 0,
    levelsCleared: 0,
    spellCharges: charges,
    combo: 0,
    cleanStreak: 0,
    totals: { completed: 0, missed: 0, correctChars: 0, errors: 0, elapsedMs: 0, maxCombo: 0 },
  };
}

/**
 * Adds a finished level to the run. Mutates `run`. On a win that isn't the
 * last level, advances `run.level` to the next level.
 *
 * `instabilityAfter` is the instability at the end of the level. Hardcore
 * carries it on (minus the boss heal after a boss level); Normal resets it.
 * `cleared` is the level just played (to know whether it was a boss).
 */
export function recordLevel(
  run: CampaignRun,
  result: GameResult,
  stats: GameStats,
  chargesAfter: SpellCharges,
  instabilityAfter = 0,
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
  const won = result === 'won';
  run.combo = won ? Math.max(0, stats.endCombo ?? 0) : 0;
  run.cleanStreak = won ? Math.max(0, stats.endCleanStreak ?? 0) : 0;
  if (run.mode === 'hardcore') {
    const heal = won && HARDCORE_HEAL_LEVELS.includes(run.level) ? HARDCORE_HEAL : 0;
    run.instability = Math.max(0, Math.min(100, instabilityAfter) - heal);
  } else run.instability = 0;

  if (!won) return { runOver: true, victory: false };
  run.levelsCleared++;
  if (run.level >= STAGE_LEVELS) return { runOver: true, victory: true };
  run.level++;
  return { runOver: false, victory: false };
}

export function summarizeRun(run: CampaignRun, victory: boolean): RunSummary {
  const t = run.totals;
  return {
    score: run.score,
    levelsCleared: run.levelsCleared,
    reachedLevel: run.level,
    stage: run.stage,
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
