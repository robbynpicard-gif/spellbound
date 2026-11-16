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
import { emptyCharges, SPELL_IDS } from '../src/gameplay/SpellManager';
import {
  applyRunResult,
  emptyCampaignRecords,
  recordLevel,
  startRun,
  summarizeRun,
} from '../src/modes/CampaignMode';
import { parseSave, SAVE_KEY, SaveManager, type StorageLike } from '../src/storage/SaveManager';

const levels = CAMPAIGN_LEVELS.all;
const TOTAL = levels.length;

function stats(score: number, extra: Partial<GameStats> = {}): GameStats {
  return {
    score,
    completed: 10,
    missed: 1,
    correctChars: 50,
    errors: 5,
    accuracy: 50 / 55,
    wpm: 40,
    maxCombo: 7,
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
    expect(levels[0]!.wordLengthWeights![4]).toBe(3);
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

  it('introduces spells progressively and never removes one', () => {
    expect(levels[0]!.availableSpells).toEqual(['fire']);
    for (let i = 1; i < levels.length; i++) {
      for (const id of levels[i - 1]!.availableSpells) expect(levels[i]!.availableSpells).toContain(id);
    }
    expect([...levels.at(-1)!.availableSpells].sort()).toEqual([...SPELL_IDS].sort());
  });

  it('rejects broken level data with a helpful message', () => {
    const broken = structuredClone(levelsData) as Record<string, unknown>[];
    broken[1]!.level = 7;
    broken[2]!.minWordLength = 9;
    delete broken[3]!.name;
    broken[4]!.availableSpells = ['lightning'];
    expect(() => validateLevels(broken)).toThrow(/level\[1\].*\n.*level\[2\].*\n.*level\[3\].*\n.*lightning/s);
    expect(() => validateLevels([])).toThrow();
  });

  it('LevelManager guards level numbers', () => {
    expect(CAMPAIGN_LEVELS.get(1).name).toBe('The First Ward');
    expect(CAMPAIGN_LEVELS.has(0)).toBe(false);
    expect(() => CAMPAIGN_LEVELS.get(levels.length + 1)).toThrow();
  });
});

describe('campaign run', () => {
  it('always starts at level 1 with no score or spells', () => {
    const run = startRun();
    expect(run).toMatchObject({ level: 1, score: 0, levelsCleared: 0, spellCharges: emptyCharges() });
  });

  it('advances level by level, carrying score and spell charges', () => {
    const run = startRun();
    const r1 = recordLevel(run, 'won', stats(500), { ...emptyCharges(), fire: 2 }, TOTAL);
    expect(r1).toEqual({ runOver: false, victory: false });
    expect(run).toMatchObject({ level: 2, score: 500, levelsCleared: 1 });
    expect(run.spellCharges.fire).toBe(2);

    recordLevel(run, 'won', stats(700), { ...emptyCharges(), fire: 1, ice: 3 }, TOTAL);
    expect(run).toMatchObject({ level: 3, score: 1200, levelsCleared: 2 });
    expect(run.spellCharges).toMatchObject({ fire: 1, ice: 3 });
  });

  it('ends on a loss, keeping that level’s score', () => {
    const run = startRun();
    recordLevel(run, 'won', stats(500), emptyCharges(), TOTAL);
    const r = recordLevel(run, 'lost', stats(120), emptyCharges(), TOTAL);
    expect(r).toEqual({ runOver: true, victory: false });
    const summary = summarizeRun(run, false);
    expect(summary).toMatchObject({ score: 620, levelsCleared: 1, reachedLevel: 2, victory: false });
    expect(summary.accuracy).toBeCloseTo(100 / 110);
    expect(summary.wpm).toBeCloseTo(100 / 5 / 2);
  });

  it('clearing the last level wins the run', () => {
    const run = startRun();
    for (let i = 1; i < TOTAL; i++) recordLevel(run, 'won', stats(10), emptyCharges(), TOTAL);
    expect(run.level).toBe(TOTAL);
    expect(recordLevel(run, 'won', stats(10), emptyCharges(), TOTAL)).toEqual({ runOver: true, victory: true });
    expect(summarizeRun(run, true)).toMatchObject({ levelsCleared: TOTAL, reachedLevel: TOTAL, victory: true });
  });

  it('records best runs and the furthest level reached', () => {
    const records = emptyCampaignRecords();
    const run = startRun();
    recordLevel(run, 'won', stats(300), emptyCharges(), TOTAL);
    recordLevel(run, 'lost', stats(50), emptyCharges(), TOTAL);
    expect(applyRunResult(records, summarizeRun(run, false))).toEqual({ isNewBest: true, previousBest: null });
    expect(records.highestReached).toBe(2);

    const worse = startRun();
    recordLevel(worse, 'lost', stats(100), emptyCharges(), TOTAL);
    expect(applyRunResult(records, summarizeRun(worse, false))).toEqual({ isNewBest: false, previousBest: 350 });
    expect(records.bestRun!.score).toBe(350);
    expect(records.highestReached).toBe(2);
  });
});

describe('SaveManager', () => {
  it('persists records and reloads them (survives a page refresh)', () => {
    const storage = new MemoryStorage();
    const first = new SaveManager(storage, TOTAL);
    first.noteRunStarted();
    first.noteLevelReached(3);
    const run = startRun();
    recordLevel(run, 'lost', stats(900), emptyCharges(), TOTAL);
    first.recordRun(summarizeRun(run, false));

    const reloaded = new SaveManager(storage, TOTAL);
    expect(reloaded.campaign).toMatchObject({ highestReached: 3, runsStarted: 1 });
    expect(reloaded.campaign.bestRun!.score).toBe(900);
  });

  it('migrates a Milestone 2 (version 1) save', () => {
    const v1 = JSON.stringify({ version: 1, campaign: { highestUnlocked: 4, levels: { 1: { bestScore: 99 } } } });
    const save = parseSave(v1, TOTAL);
    expect(save.version).toBe(3);
    expect(save.campaign).toMatchObject({ highestReached: 4, bestRun: null });
  });

  it('works without storage (in-memory only)', () => {
    const save = new SaveManager(null, TOTAL);
    expect(save.persistent).toBe(false);
    save.noteLevelReached(2);
    expect(save.campaign.highestReached).toBe(2);
  });

  it('survives corrupt or tampered save data', () => {
    expect(parseSave('{not json', TOTAL).campaign.highestReached).toBe(1);
    expect(parseSave('{"version":99,"campaign":{}}', TOTAL).campaign.highestReached).toBe(1);
    const tampered = parseSave(
      JSON.stringify({ version: 2, campaign: { highestReached: 500, bestRun: { score: -5, accuracy: 7 } } }),
      TOTAL,
    );
    expect(tampered.campaign.highestReached).toBe(TOTAL);
    expect(tampered.campaign.bestRun).toMatchObject({ score: 0, accuracy: 1 });
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
    const save = new SaveManager(throwing, TOTAL);
    expect(() => save.noteLevelReached(2)).not.toThrow();
    expect(save.campaign.highestReached).toBe(2);
  });

  it('stores under a single namespaced key', () => {
    const storage = new MemoryStorage();
    new SaveManager(storage, TOTAL).noteRunStarted();
    expect([...storage.data.keys()]).toEqual([SAVE_KEY]);
  });
});

// Type-level check: the JSON file satisfies the config shape after validation.
const _typed: DifficultyConfig[] = validateLevels(levelsData);
void _typed;
