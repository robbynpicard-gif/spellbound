import { describe, expect, it } from 'vitest';
import { WORDS } from '../data/wordList';
import { stageLevel } from '../difficulty/Stages';
import { simulateWordcraftSelection } from './WordcraftSimulation';

describe('offline Wordcraft selection experiment', () => {
  it('is reproducible with identical seeded trials', () => {
    const config = stageLevel('normal', 3, 10);
    const first = simulateWordcraftSelection(WORDS, config, 8, 80);
    expect(simulateWordcraftSelection(WORDS, config, 8, 80)).toEqual(first);
  });

  it('preserves the exact length histogram across both experimental arms', () => {
    for (const stage of [1, 3, 5]) {
      const config = stageLevel('normal', stage, 10);
      const result = simulateWordcraftSelection(WORDS, config, 6, 70);
      expect(result.candidate.lengths).toEqual(result.baseline.lengths);
      expect(result.baseline.classified).toBeGreaterThanOrEqual(0);
      expect(result.candidate.phrases).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports a seeded comparison across early, middle and late campaign stages', () => {
    const stages = [1, 3, 5] as const;
    for (const stage of stages) {
      const config = stageLevel('normal', stage, 10);
      const result = simulateWordcraftSelection(WORDS, config, 20, 120);
      const { baseline, candidate } = result;
      const report = {
        stage,
        baselinePhrases: baseline.phrases,
        candidatePhrases: candidate.phrases,
        baselineClassified: baseline.classified,
        candidateClassified: candidate.classified,
        baselineComplexity: Number(baseline.averageComplexity.toFixed(3)),
        candidateComplexity: Number(candidate.averageComplexity.toFixed(3)),
        baselineRecentDuplicates: baseline.recentDuplicateViolations,
        candidateRecentDuplicates: candidate.recentDuplicateViolations,
        baselineFirstLetterCollisions: baseline.recentFirstLetterCollisions,
        candidateFirstLetterCollisions: candidate.recentFirstLetterCollisions,
      };
      console.info('WORDCRAFT_STAGE_AUDIT', JSON.stringify(report));
      for (const comparison of result.captureComparisons) {
        console.info('WORDCRAFT_CAPTURE_AUDIT', JSON.stringify({
          stage, scenario: comparison.scenario,
          baseline: comparison.baseline, candidate: comparison.candidate,
        }));
        expect(comparison.baseline.captured + comparison.baseline.missed).toBe(result.trials * result.wordsPerTrial);
        expect(comparison.candidate.captured + comparison.candidate.missed).toBe(result.trials * result.wordsPerTrial);
        expect(comparison.baseline.phrases).toBeLessThanOrEqual(comparison.baseline.captured);
        expect(comparison.candidate.phrases).toBeLessThanOrEqual(comparison.candidate.captured);
      }
      expect(candidate.lengths).toEqual(baseline.lengths);
      expect(candidate.recentDuplicateViolations).toBeLessThanOrEqual(baseline.recentDuplicateViolations);
      expect(Number.isFinite(candidate.averageComplexity)).toBe(true);
      expect(candidate.averageComplexity).toBeLessThanOrEqual(config.maxComplexity ?? Infinity);
    }
  });

  it('does not modify the supplied word pool or game configuration', () => {
    const pool = ['dragon', 'conjure', 'ancient', 'castle', 'quickly', 'summon'];
    const config = { minWordLength: 5, maxWordLength: 7 };
    const before = [...pool];
    simulateWordcraftSelection(pool, config, 2, 12);
    expect(pool).toEqual(before);
    expect(config).toEqual({ minWordLength: 5, maxWordLength: 7 });
  });
});
