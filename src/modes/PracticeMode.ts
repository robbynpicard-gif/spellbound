import type { DifficultyConfig } from '../difficulty/DifficultyConfig';
import type { GameStats } from '../gameplay/ScoringSystem';

/**
 * Endless Practice (GDD §14, decisions.md D-023).
 *
 * The player picks any level they've reached in Campaign (mode, stage and
 * level, D-047) and plays it forever at exactly that level's difficulty.
 * Records are kept per level and per "specials" setting, apart from Campaign.
 */

/**
 * GDD §14 modifier options:
 * - 'all'      — spell scrolls + alchemical modifiers (modifiers arrive in Milestone 6)
 * - 'original' — spell scrolls only (the level's spells), no modifiers
 * - 'none'     — no specials at all: pure typing
 */
export type ModifierFilter = 'all' | 'original' | 'none';
export const MODIFIER_FILTERS: readonly ModifierFilter[] = ['all', 'original', 'none'];

/** Whether a filter can be chosen yet (alchemical modifiers don't exist until Milestone 6). */
export const FILTER_AVAILABLE: Record<ModifierFilter, boolean> = { all: false, original: true, none: true };

export function isModifierFilter(value: unknown): value is ModifierFilter {
  return typeof value === 'string' && (MODIFIER_FILTERS as readonly string[]).includes(value);
}

/**
 * The practice version of a campaign level. Everything that sets difficulty
 * (speed, spawn rate, words on screen, word lengths, penalties) is copied
 * unchanged — practice never applies its own multiplier (GDD §14). Only the
 * quota (or a boss level's survival timer) is removed and specials are filtered.
 */
export function practiceConfig(level: DifficultyConfig, filter: ModifierFilter): DifficultyConfig {
  // Boss levels become endless at their starting pace (no timer, no ramp).
  // Speeds ramp over the Campaign level's word count, so they match the Campaign exactly.
  const config: DifficultyConfig = {
    ...level,
    requiredWords: null,
    survivalMs: null,
    ramp: null,
    rampWords: level.rampWords ?? level.requiredWords,
  };
  if (filter === 'original') {
    config.modifierProbabilities = {};
  } else if (filter === 'none') {
    config.modifierProbabilities = {};
    config.availableSpells = [];
    config.spellDropChance = 0;
  }
  return config;
}

/** Levels of a stage the player may practise: those reached in Campaign (1 … highestReached). */
export function practiceLevels(highestReached: number, totalLevels: number): number[] {
  const top = Math.min(Math.max(1, highestReached), totalLevels);
  return Array.from({ length: top }, (_, i) => i + 1);
}

/** Record key for one level of one stage of one mode, e.g. "normal:2:7:original". */
export function practiceKey(pick: { mode: string; stage: number; level: number }, filter: ModifierFilter): string {
  return `${pick.mode}:${pick.stage}:${pick.level}:${filter}`;
}

/**
 * Minimum completed words before accuracy and average completion time can
 * set a record — otherwise one perfect word would be an unbeatable 100%.
 */
export const MIN_WORDS_FOR_RATE_RECORDS = 10;

export interface PracticeRecord {
  sessions: number;
  bestScore: number;
  mostWords: number;
  longestMs: number;
  bestWpm: number;
  bestCombo: number;
  /** 0 = not yet set (needs MIN_WORDS_FOR_RATE_RECORDS). */
  bestAccuracy: number;
  /** 0 = not yet set. Lower is better. */
  fastestAverageMs: number;
}

export type RecordField = Exclude<keyof PracticeRecord, 'sessions'>;

export interface PracticeOutcome {
  /** Fields this session improved (empty on a first session — nothing to beat). */
  improved: RecordField[];
  firstSession: boolean;
  /** The record after this session. */
  record: PracticeRecord;
}

export function emptyPracticeRecord(): PracticeRecord {
  return {
    sessions: 0,
    bestScore: 0,
    mostWords: 0,
    longestMs: 0,
    bestWpm: 0,
    bestCombo: 0,
    bestAccuracy: 0,
    fastestAverageMs: 0,
  };
}

/** Records a finished session. Mutates `records`. */
export function applyPracticeResult(
  records: Record<string, PracticeRecord>,
  key: string,
  stats: GameStats,
): PracticeOutcome {
  const record = (records[key] ??= emptyPracticeRecord());
  const firstSession = record.sessions === 0;
  const improved: RecordField[] = [];
  const raise = (field: RecordField, value: number) => {
    if (value > record[field]) {
      if (record[field] > 0 || field === 'bestScore') improved.push(field);
      record[field] = value;
    }
  };

  record.sessions++;
  raise('bestScore', stats.score);
  raise('mostWords', stats.completed);
  raise('longestMs', stats.elapsedMs);
  raise('bestWpm', stats.wpm);
  raise('bestCombo', stats.maxCombo);
  if (stats.completed >= MIN_WORDS_FOR_RATE_RECORDS) {
    raise('bestAccuracy', stats.accuracy);
    const avg = stats.averageCompletionMs;
    if (avg > 0 && (record.fastestAverageMs === 0 || avg < record.fastestAverageMs)) {
      if (record.fastestAverageMs > 0) improved.push('fastestAverageMs');
      record.fastestAverageMs = avg;
    }
  }
  return { improved: firstSession ? [] : improved, firstSession, record: { ...record } };
}
