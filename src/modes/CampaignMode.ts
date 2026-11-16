import type { GameResult } from '../core/GameEvents';
import { accuracyOf, wpmOf, type GameStats } from '../gameplay/ScoringSystem';
import { isSurvival, type DifficultyConfig } from '../difficulty/DifficultyConfig';
import {
  addCharge,
  emptyCharges,
  poolFull,
  sanitizeCharges,
  SPELL_IDS,
  type SpellCharges,
  type SpellId,
} from '../gameplay/SpellManager';
import { SPELLS } from '../spells/SpellRegistry';

/**
 * Campaign = one continuous run (decisions.md D-016, docs/plans/campaign-v2.md):
 * always starts at level 1 and plays straight through 4 chapters. Losing
 * ends the run. Score and spell charges carry from level to level.
 *
 * Two modes:
 * - Normal: instability resets to 0% at the start of each level.
 * - Hardcore: instability carries through the whole run; clearing a boss
 *   heals some of it, and Arcane Purge only halves it.
 *
 * Choosing a level is only possible in Endless Practice.
 */
export type CampaignMode = 'normal' | 'hardcore';
export const CAMPAIGN_MODES: readonly CampaignMode[] = ['normal', 'hardcore'];

export function isCampaignMode(value: unknown): value is CampaignMode {
  return value === 'normal' || value === 'hardcore';
}

/** Hardcore: instability removed after surviving a boss level. */
export const HARDCORE_BOSS_HEAL = 25;
/** Boss levels offer this many spells to choose one free charge from. */
export const BOSS_REWARD_CHOICES = 3;
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
  /** Level currently being played (or about to be). */
  level: number;
  /** Instability carried into the next level (always 0 in Normal). */
  instability: number;
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

export function startRun(mode: CampaignMode = 'normal'): CampaignRun {
  return {
    mode,
    instability: 0,
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
  totalLevels: number,
  instabilityAfter = 0,
  cleared?: DifficultyConfig,
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
  if (run.mode === 'hardcore') {
    const heal = cleared && isSurvival(cleared) && result === 'won' ? HARDCORE_BOSS_HEAL : 0;
    run.instability = Math.max(0, Math.min(100, instabilityAfter) - heal);
  } else run.instability = 0;

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

/** Spells unlocked by the time a level is played (every spell available on it or earlier). */
export function knownSpellsAt(levels: readonly DifficultyConfig[], level: number): SpellId[] {
  const known = new Set<SpellId>();
  for (const config of levels) if (config.level <= level) for (const id of config.availableSpells) known.add(id);
  return SPELL_IDS.filter((id) => known.has(id));
}

/**
 * The boss reward: up to `count` different spells from those unlocked,
 * picked by drop weight (rarer spells are offered less often). `random`
 * returns a float in [0, 1) — Math.random in the game, a seeded source in tests.
 */
export function bossRewardChoices(
  known: readonly SpellId[],
  random: () => number,
  count = BOSS_REWARD_CHOICES,
): SpellId[] {
  const pool = [...known];
  const chosen: SpellId[] = [];
  while (chosen.length < count && pool.length > 0) {
    const total = pool.reduce((sum, id) => sum + SPELLS[id].dropWeight, 0);
    let roll = random() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      roll -= SPELLS[pool[i]!].dropWeight;
      if (roll < 0) {
        index = i;
        break;
      }
    }
    chosen.push(pool.splice(index, 1)[0]!);
  }
  return SPELL_IDS.filter((id) => chosen.includes(id));
}

/**
 * Takes a boss reward (mutates `run`). If the pool is full, `discard` names
 * a held spell to give up for it; without one the reward can't be taken.
 * Returns whether the reward was added.
 */
export function claimBossReward(run: CampaignRun, spell: SpellId, discard?: SpellId): boolean {
  const charges = run.spellCharges;
  if (poolFull(charges)) {
    if (!discard || charges[discard] <= 0) return false;
    charges[discard]--;
  }
  return addCharge(charges, spell);
}
