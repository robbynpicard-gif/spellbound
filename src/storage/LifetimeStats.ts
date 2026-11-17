import type { GameResult } from '../core/GameEvents';
import type { GameStats } from '../gameplay/ScoringSystem';
import { isWizardId, WIZARD_IDS, type WizardId } from '../gameplay/Wizards';
import type { RunSummary } from '../modes/CampaignMode';

/**
 * Everything the player has done, across every mode, kept in the save file
 * (decisions.md D-042). Pure functions so the rules can be tested.
 */
export interface WizardRecord {
  runs: number;
  victories: number;
  levelsCleared: number;
  wordsCaptured: number;
  powersUsed: number;
  bestRun: number;
}

export interface LifetimeStats {
  levelsPlayed: number;
  levelsWon: number;
  levelsLost: number;
  bossesBeaten: number;
  flawlessLevels: number;
  runsFinished: number;
  runsVictorious: number;
  practiceSessions: number;
  wordsCaptured: number;
  wordsMissed: number;
  lettersTyped: number;
  typos: number;
  timePlayedMs: number;
  pointsEarned: number;
  bestLevelScore: number;
  bestRunScore: number;
  bestCombo: number;
  bestMultiplier: number;
  /** Best words per minute over a level with at least MIN_WORDS_FOR_WPM words. */
  bestWpm: number;
  powersUsed: number;
  bonusCounts: Record<string, number>;
  spellsCast: Record<string, number>;
  wizards: Record<WizardId, WizardRecord>;
}

export const MIN_WORDS_FOR_WPM = 10;

export type PlayMode = 'campaign' | 'practice' | 'duel';

export function emptyWizardRecord(): WizardRecord {
  return { runs: 0, victories: 0, levelsCleared: 0, wordsCaptured: 0, powersUsed: 0, bestRun: 0 };
}

export function emptyLifetime(): LifetimeStats {
  return {
    levelsPlayed: 0,
    levelsWon: 0,
    levelsLost: 0,
    bossesBeaten: 0,
    flawlessLevels: 0,
    runsFinished: 0,
    runsVictorious: 0,
    practiceSessions: 0,
    wordsCaptured: 0,
    wordsMissed: 0,
    lettersTyped: 0,
    typos: 0,
    timePlayedMs: 0,
    pointsEarned: 0,
    bestLevelScore: 0,
    bestRunScore: 0,
    bestCombo: 0,
    bestMultiplier: 1,
    bestWpm: 0,
    powersUsed: 0,
    bonusCounts: {},
    spellsCast: {},
    wizards: Object.fromEntries(WIZARD_IDS.map((id) => [id, emptyWizardRecord()])) as Record<WizardId, WizardRecord>,
  };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);

function counts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (/^[a-zA-Z]{1,24}$/.test(k) && num(v) > 0) out[k] = num(v);
  return out;
}

/** Reads stored stats; anything missing or invalid becomes zero. */
export function parseLifetime(raw: unknown): LifetimeStats {
  const life = emptyLifetime();
  if (typeof raw !== 'object' || raw === null) return life;
  const r = raw as Record<string, unknown>;
  for (const key of Object.keys(life) as (keyof LifetimeStats)[]) {
    if (typeof life[key] === 'number') (life as unknown as Record<string, number>)[key] = num(r[key]);
  }
  life.bestMultiplier = Math.max(1, life.bestMultiplier);
  life.bonusCounts = counts(r.bonusCounts);
  life.spellsCast = counts(r.spellsCast);
  if (typeof r.wizards === 'object' && r.wizards !== null) {
    for (const [id, w] of Object.entries(r.wizards as Record<string, unknown>)) {
      if (!isWizardId(id) || typeof w !== 'object' || w === null) continue;
      const rec = emptyWizardRecord();
      for (const k of Object.keys(rec) as (keyof WizardRecord)[]) rec[k] = num((w as Record<string, unknown>)[k]);
      life.wizards[id] = rec;
    }
  }
  return life;
}

const add = (into: Record<string, number>, from: Partial<Record<string, number>> | undefined): void => {
  for (const [k, v] of Object.entries(from ?? {})) if (v) into[k] = (into[k] ?? 0) + v;
};

/** Adds one finished level (or Practice session / duel). Mutates `life`. */
export function recordLevelStats(
  life: LifetimeStats,
  stats: GameStats,
  result: GameResult,
  context: { mode: PlayMode; boss?: boolean; wizard?: WizardId },
): void {
  life.levelsPlayed++;
  if (result === 'won') life.levelsWon++;
  else life.levelsLost++;
  if (context.mode === 'practice') life.practiceSessions++;
  if (result === 'won' && context.boss) life.bossesBeaten++;
  if (result === 'won' && stats.missed === 0 && context.mode === 'campaign') life.flawlessLevels++;
  life.wordsCaptured += stats.completed;
  life.wordsMissed += stats.missed;
  life.lettersTyped += stats.correctChars;
  life.typos += stats.errors;
  life.timePlayedMs += stats.elapsedMs;
  life.pointsEarned += stats.score;
  life.bestLevelScore = Math.max(life.bestLevelScore, stats.score);
  life.bestCombo = Math.max(life.bestCombo, stats.maxCombo);
  life.bestMultiplier = Math.max(life.bestMultiplier, stats.peakMultiplier);
  if (stats.completed >= MIN_WORDS_FOR_WPM) life.bestWpm = Math.max(life.bestWpm, Math.round(stats.wpm));
  life.powersUsed += stats.powersUsed ?? 0;
  add(life.bonusCounts, stats.bonusCounts);
  add(life.spellsCast, stats.spellsCast);
  if (context.wizard) {
    const w = life.wizards[context.wizard];
    w.wordsCaptured += stats.completed;
    w.powersUsed += stats.powersUsed ?? 0;
    if (result === 'won') w.levelsCleared++;
  }
}

/** Adds a finished Campaign run. Mutates `life`. */
export function recordRunStats(life: LifetimeStats, summary: RunSummary): void {
  life.runsFinished++;
  if (summary.victory) life.runsVictorious++;
  life.bestRunScore = Math.max(life.bestRunScore, summary.score);
  const w = life.wizards[summary.wizard ?? 'apprentice'];
  w.runs++;
  if (summary.victory) w.victories++;
  w.bestRun = Math.max(w.bestRun, summary.score);
}
