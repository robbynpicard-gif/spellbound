import { describe, expect, it } from 'vitest';
import { WORDS } from '../data/wordList';
import { stageLevel } from '../difficulty/Stages';
import { auditEngineWordcraftBatch } from './WordcraftEngineBatchAudit';
import type { WordcraftPolicy } from './ExperimentalWordcraftGenerator';

describe('Wordcraft policy sweep (offline only)', () => {
  it('compares conservative, current and aggressive phrase nudges across identical seeds', () => {
    const scenarios = [
      { name: 'early', config: stageLevel('normal', 1, 10), ticksPerCharacter: 2 },
      { name: 'middle', config: stageLevel('normal', 3, 10), ticksPerCharacter: 4 },
      { name: 'late', config: stageLevel('normal', 5, 10), ticksPerCharacter: 9 },
    ];
    const seeds = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010, 1111, 1212];
    const policies: { name: string; policy: WordcraftPolicy }[] = [
      { name: 'conservative', policy: { starterChance: 0.25, followupChance: 0.5 } },
      { name: 'current', policy: { starterChance: 0.45, followupChance: 0.8 } },
      { name: 'aggressive', policy: { starterChance: 0.65, followupChance: 0.95 } },
    ];
    for (const { name, policy } of policies) {
      const rows = auditEngineWordcraftBatch(WORDS, scenarios, seeds, 1200, policy);
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row.replayFailures).toBe(0);
        expect(row.experimental.phrases).toBeLessThanOrEqual(row.experimental.captured);
        expect(row.experimental.meanSpawnLength).toBe(row.baseline.meanSpawnLength);
        console.info('WORDCRAFT_POLICY_SWEEP', JSON.stringify({ policy: name, ...row }));
      }
    }
  });
});
