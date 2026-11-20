import type { GameStats } from './ScoringSystem';

export type WordcraftArm = 'standard' | 'experimental';
export interface WordcraftRunRecord {
  arm: WordcraftArm;
  context: string;
  completed: number;
  missed: number;
  accuracy: number;
  wpm: number;
  phrases: number;
  phrasesPer100Captures: number;
}
const MAX_RUNS = 12;
/** Session-only lab data. Never writes to localStorage or lifetime stats. */
export class WordcraftRunComparison {
  private readonly history: WordcraftRunRecord[] = [];

  record(arm: WordcraftArm, context: string, stats: GameStats): WordcraftRunRecord {
    const phrases = Object.values(stats.phraseCounts ?? {}).reduce((sum, value) => sum + (value ?? 0), 0);
    const row: WordcraftRunRecord = {
      arm, context, completed: stats.completed, missed: stats.missed,
      accuracy: stats.accuracy, wpm: stats.wpm, phrases,
      phrasesPer100Captures: stats.completed > 0 ? 100 * phrases / stats.completed : 0,
    };
    this.history.push(row);
    if (this.history.length > MAX_RUNS) this.history.shift();
    return row;
  }

  get runs(): readonly WordcraftRunRecord[] {
    return this.history.map((row) => ({ ...row }));
  }
}
