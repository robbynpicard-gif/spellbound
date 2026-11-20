import { describe, expect, it } from 'vitest';
import type { GameStats } from './ScoringSystem';
import { WordcraftRunComparison } from './WordcraftRunComparison';

const stats = (completed: number, phrases: number): GameStats => ({
  completed, missed: 2, accuracy: 0.94, wpm: 52,
  phraseCounts: { awakening: phrases },
} as GameStats);

describe('Wordcraft Lab session comparison', () => {
  it('separates standard and experimental results and normalizes phrases', () => {
    const history = new WordcraftRunComparison();
    history.record('standard', 'Practice · Stage 3', stats(20, 1));
    history.record('experimental', 'Practice · Stage 3', stats(25, 4));
    expect(history.runs.map((run) => run.arm)).toEqual(['standard', 'experimental']);
    expect(history.runs.map((run) => run.phrasesPer100Captures)).toEqual([5, 16]);
  });
  it('handles empty runs and limits memory to twelve records', () => {
    const history = new WordcraftRunComparison();
    expect(history.record('standard', 'empty', stats(0, 0)).phrasesPer100Captures).toBe(0);
    for (let i = 0; i < 20; i++) history.record('experimental', String(i), stats(5, 1));
    expect(history.runs).toHaveLength(12);
    expect(history.runs[0].context).toBe('8');
  });
});
