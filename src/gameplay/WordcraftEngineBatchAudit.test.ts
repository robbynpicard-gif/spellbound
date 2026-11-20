import { describe, expect, it } from 'vitest';
import { WORDS } from '../data/wordList';
import { stageLevel } from '../difficulty/Stages';
import { auditEngineWordcraftBatch } from './WordcraftEngineBatchAudit';

describe('real-engine Wordcraft batch evaluation', () => {
  const scenarios = [
    { name: 'early-fast', config: stageLevel('normal', 1, 10), ticksPerCharacter: 2 },
    { name: 'middle-standard', config: stageLevel('normal', 3, 10), ticksPerCharacter: 4 },
    { name: 'late-slow', config: stageLevel('normal', 5, 10), ticksPerCharacter: 9 },
  ];
  const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010, 1111, 1212];

  it('compares multiple seeds, stages and typing speeds with replay validation', () => {
    const rows = auditEngineWordcraftBatch(WORDS, scenarios, seeds, 1200);
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      console.info('WORDCRAFT_ENGINE_BATCH', JSON.stringify(row));
      expect(row.trials).toBe(seeds.length);
      expect(row.replayFailures).toBe(0);
      expect(['insufficient-data', 'reject', 'review']).toContain(row.decision);
      expect(Number.isFinite(row.rates.experimentalPhrasesPer100Captures)).toBe(true);
      expect(row.baseline.spawned).toBeGreaterThan(0);
      expect(row.experimental.spawned).toBeGreaterThan(0);
      expect(row.baseline.phrases).toBeLessThanOrEqual(row.baseline.captured);
      expect(row.experimental.phrases).toBeLessThanOrEqual(row.experimental.captured);
      expect(row.experimental.recentDuplicates).toBeGreaterThanOrEqual(0);
      expect(row.experimental.meanSpawnLength).toBeGreaterThan(0);
    }
    expect(auditEngineWordcraftBatch(WORDS, scenarios.slice(0, 1), seeds.slice(0, 2), 300))
      .toEqual(auditEngineWordcraftBatch(WORDS, scenarios.slice(0, 1), seeds.slice(0, 2), 300));
  });
});
