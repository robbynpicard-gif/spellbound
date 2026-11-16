import { describe, expect, it } from 'vitest';
import levelsData from '../src/data/levels.json';
import {
  averageWordLength,
  letterArrivalRate,
  validateLevels,
  type DifficultyConfig,
} from '../src/difficulty/DifficultyConfig';
import { CAMPAIGN_LEVELS } from '../src/difficulty/LevelDefinitions';
import { WORDS } from '../src/data/wordList';
import type { GameStats } from '../src/gameplay/ScoringSystem';
import { applyCampaignResult, emptyCampaignProgress } from '../src/modes/CampaignMode';
import { parseSave, SAVE_KEY, SaveManager, type StorageLike } from '../src/storage/SaveManager';

const levels = CAMPAIGN_LEVELS.all;

function stats(score: number, extra: Partial<GameStats> = {}): GameStats {
  return {
    score,
    completed: 10,
    missed: 0,
    correctChars: 50,
    errors: 0,
    accuracy: 1,
    wpm: 40,
    maxCombo: 10,
    elapsedMs: 60_000,
    averageCompletionMs: 3000,
    ...extra,
  };
}

class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('campaign level data', () => {
  it('has at least 10 valid, consecutively numbered levels', () => {
    expect(levels.length).toBeGreaterThanOrEqual(10);
    levels.forEach((l, i) => expect(l.level).toBe(i + 1));
  });

  it('converts JSON length-weight keys to numbers', () => {
    expect(levels[0]!.wordLengthWeights![3]).toBe(3);
  });

  it('has enough words for every level’s length range', () => {
    for (const l of levels) {
      const pool = WORDS.filter((w) => w.length >= l.minWordLength && w.length <= l.maxWordLength);
      expect(pool.length, `level ${l.level}`).toBeGreaterThanOrEqual(30);
    }
  });

  // Progressive difficulty (GDD §9): each level is at least as hard as the
  // previous one on every axis, and strictly harder overall.
  it('gets progressively harder', () => {
    for (let i = 1; i < levels.length; i++) {
      const prev = levels[i - 1]!;
      const cur = levels[i]!;
      const at = `level ${cur.level}`;
      expect(cur.initialFallSpeed, at).toBeGreaterThan(prev.initialFallSpeed);
      expect(cur.spawnInterval, at).toBeLessThan(prev.spawnInterval);
      expect(cur.maxActiveWords, at).toBeGreaterThanOrEqual(prev.maxActiveWords);
      expect(cur.requiredWords!, at).toBeGreaterThan(prev.requiredWords!);
      expect(cur.maxWordLength, at).toBeGreaterThanOrEqual(prev.maxWordLength);
      expect(averageWordLength(cur), at).toBeGreaterThanOrEqual(averageWordLength(prev));
      expect(letterArrivalRate(cur), at).toBeGreaterThan(letterArrivalRate(prev));
      expect(cur.instabilityPerMiss, at).toBeGreaterThanOrEqual(prev.instabilityPerMiss);
      expect(cur.errorAcceleration, at).toBeGreaterThanOrEqual(prev.errorAcceleration);
    }
  });

  it('rejects broken level data with a helpful message', () => {
    const broken = structuredClone(levelsData) as Record<string, unknown>[];
    broken[1]!.level = 7;
    broken[2]!.minWordLength = 9;
    delete broken[3]!.name;
    expect(() => validateLevels(broken)).toThrow(/level\[1\].*\n.*level\[2\].*\n.*level\[3\]/s);
    expect(() => validateLevels([])).toThrow();
  });

  it('LevelManager guards level numbers', () => {
    expect(CAMPAIGN_LEVELS.get(1).name).toBe('The First Ward');
    expect(CAMPAIGN_LEVELS.has(0)).toBe(false);
    expect(() => CAMPAIGN_LEVELS.get(levels.length + 1)).toThrow();
  });
});

describe('campaign progression', () => {
  it('starts with only level 1 unlocked', () => {
    expect(emptyCampaignProgress().highestUnlocked).toBe(1);
  });

  it('winning unlocks the next level once; losing unlocks nothing', () => {
    const p = emptyCampaignProgress();
    expect(applyCampaignResult(p, 1, 'lost', stats(500), 10).unlockedLevel).toBeNull();
    expect(p.highestUnlocked).toBe(1);

    const first = applyCampaignResult(p, 1, 'won', stats(800), 10);
    expect(first.unlockedLevel).toBe(2);
    expect(p.highestUnlocked).toBe(2);

    const again = applyCampaignResult(p, 1, 'won', stats(900), 10);
    expect(again.unlockedLevel).toBeNull();
    expect(p.levels['1']!.attempts).toBe(3);
    expect(p.levels['1']!.completions).toBe(2);
  });

  it('tracks personal bests from completed runs only', () => {
    const p = emptyCampaignProgress();
    applyCampaignResult(p, 1, 'lost', stats(5000), 10);
    expect(p.levels['1']!.bestScore).toBe(0);

    const first = applyCampaignResult(p, 1, 'won', stats(800, { wpm: 30 }), 10);
    expect(first).toMatchObject({ isNewBest: true, previousBest: null });

    const worse = applyCampaignResult(p, 1, 'won', stats(600, { wpm: 50 }), 10);
    expect(worse).toMatchObject({ isNewBest: false, previousBest: 800 });
    expect(p.levels['1']!.bestScore).toBe(800);
    expect(p.levels['1']!.bestWpm).toBe(50); // each best is tracked separately

    const better = applyCampaignResult(p, 1, 'won', stats(1200), 10);
    expect(better).toMatchObject({ isNewBest: true, previousBest: 800 });
  });

  it('the last level unlocks nothing and reports no next level', () => {
    const p = emptyCampaignProgress();
    p.highestUnlocked = 10;
    const out = applyCampaignResult(p, 10, 'won', stats(100), 10);
    expect(out).toMatchObject({ unlockedLevel: null, hasNextLevel: false });
    expect(p.highestUnlocked).toBe(10);
  });
});

describe('SaveManager', () => {
  it('persists progress and reloads it (survives a page refresh)', () => {
    const storage = new MemoryStorage();
    const first = new SaveManager(storage, 10);
    first.recordCampaignResult(1, 'won', stats(700));
    first.recordCampaignResult(2, 'won', stats(900));

    const reloaded = new SaveManager(storage, 10);
    expect(reloaded.campaign.highestUnlocked).toBe(3);
    expect(reloaded.campaign.levels['2']!.bestScore).toBe(900);
  });

  it('works without storage (in-memory only)', () => {
    const save = new SaveManager(null, 10);
    expect(save.persistent).toBe(false);
    save.recordCampaignResult(1, 'won', stats(10));
    expect(save.campaign.highestUnlocked).toBe(2);
  });

  it('survives corrupt or tampered save data', () => {
    expect(parseSave('{not json', 10).campaign.highestUnlocked).toBe(1);
    expect(parseSave('{"version":99}', 10).campaign.highestUnlocked).toBe(1);
    const tampered = parseSave(
      JSON.stringify({ version: 1, campaign: { highestUnlocked: 500, levels: { 1: { bestScore: -5, bestAccuracy: 7 } } } }),
      10,
    );
    expect(tampered.campaign.highestUnlocked).toBe(10);
    expect(tampered.campaign.levels['1']).toMatchObject({ bestScore: 0, bestAccuracy: 1 });
  });

  it('keeps working if storage throws', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const save = new SaveManager(throwing, 10);
    expect(() => save.recordCampaignResult(1, 'won', stats(1))).not.toThrow();
    expect(save.campaign.highestUnlocked).toBe(2);
  });

  it('stores under a single namespaced key', () => {
    const storage = new MemoryStorage();
    new SaveManager(storage, 10).recordCampaignResult(1, 'lost', stats(1));
    expect([...storage.data.keys()]).toEqual([SAVE_KEY]);
  });
});

// Type-level check: the JSON file satisfies the config shape after validation.
const _typed: DifficultyConfig[] = validateLevels(levelsData);
void _typed;
