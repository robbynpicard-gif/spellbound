import { describe, expect, it } from 'vitest';
import type { GameStats } from '../src/gameplay/ScoringSystem';
import { emptyLifetime, parseLifetime, recordLevelStats, recordRunStats } from '../src/storage/LifetimeStats';
import { parseSave, SaveManager, type StorageLike } from '../src/storage/SaveManager';

const stats = (over: Partial<GameStats> = {}): GameStats => ({
  score: 1000,
  completed: 20,
  missed: 0,
  correctChars: 100,
  errors: 4,
  accuracy: 0.96,
  wpm: 61.4,
  maxCombo: 18,
  endCombo: 18,
  peakMultiplier: 3,
  bonusCounts: { perfect: 15, clutch: 2 },
  levelBonuses: [],
  elapsedMs: 60_000,
  averageCompletionMs: 2000,
  powersUsed: 2,
  spellsCast: { fire: 1 },
  ...over,
});

describe('Lifetime stats (D-042)', () => {
  it('adds levels up and keeps the bests', () => {
    const life = emptyLifetime();
    recordLevelStats(life, stats(), 'won', { mode: 'campaign', boss: true, wizard: 'pyromancer' });
    recordLevelStats(life, stats({ score: 400, missed: 3, maxCombo: 5, wpm: 90, completed: 5 }), 'lost', { mode: 'practice' });
    expect(life.levelsPlayed).toBe(2);
    expect(life.levelsWon).toBe(1);
    expect(life.bossesBeaten).toBe(1);
    expect(life.flawlessLevels).toBe(1);
    expect(life.practiceSessions).toBe(1);
    expect(life.pointsEarned).toBe(1400);
    expect(life.bestLevelScore).toBe(1000);
    expect(life.bestCombo).toBe(18);
    expect(life.bestWpm).toBe(61); // 90 WPM over 5 words doesn't count
    expect(life.bonusCounts.perfect).toBe(30);
    expect(life.spellsCast.fire).toBe(2);
    expect(life.wizards.pyromancer.levelsCleared).toBe(1);
    expect(life.wizards.pyromancer.powersUsed).toBe(2);
  });

  it('records runs per wizard', () => {
    const life = emptyLifetime();
    const run = { score: 5000, levelsCleared: 3, reachedLevel: 4, victory: false, accuracy: 0.9, wpm: 50, completed: 80, missed: 4, maxCombo: 30, elapsedMs: 1, wizard: 'warden' as const };
    recordRunStats(life, run);
    recordRunStats(life, { ...run, score: 9000, victory: true });
    expect(life.runsFinished).toBe(2);
    expect(life.bestRunScore).toBe(9000);
    expect(life.wizards.warden).toMatchObject({ runs: 2, victories: 1, bestRun: 9000 });
  });

  it('survives junk in storage and old saves without stats', () => {
    expect(parseLifetime({ levelsPlayed: -3, bonusCounts: { '<x>': 4 }, wizards: { nobody: {} } })).toEqual(emptyLifetime());
    const old = JSON.stringify({ version: 4, campaign: { highestReached: 2 } });
    const save = parseSave(old, 20);
    expect(save.lifetime).toEqual(emptyLifetime());
    expect(save.lastWizard).toBe('apprentice');
  });

  it('SaveManager keeps stats and the last wizard between visits', () => {
    const store = new Map<string, string>();
    const storage: StorageLike = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) };
    const a = new SaveManager(storage, 20);
    a.recordLevelStats(stats(), 'won', { mode: 'campaign', wizard: 'archivist' });
    a.setLastWizard('archivist');
    const b = new SaveManager(storage, 20);
    expect(b.lifetime.wordsCaptured).toBe(20);
    expect(b.lastWizard).toBe('archivist');
  });
});
