import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { WORDS } from '../src/data/wordList';
import { CAMPAIGN_LEVELS } from '../src/difficulty/LevelDefinitions';
import type { GameStats } from '../src/gameplay/ScoringSystem';
import {
  applyPracticeResult,
  MIN_WORDS_FOR_RATE_RECORDS,
  practiceConfig,
  practiceKey,
  practiceLevels,
  type PracticeRecord,
} from '../src/modes/PracticeMode';
import { parseSave, SaveManager, type StorageLike } from '../src/storage/SaveManager';

const TOTAL = CAMPAIGN_LEVELS.count;

function stats(extra: Partial<GameStats> = {}): GameStats {
  return {
    score: 1000,
    completed: 20,
    missed: 3,
    correctChars: 120,
    errors: 6,
    accuracy: 0.95,
    wpm: 40,
    maxCombo: 9,
    elapsedMs: 90_000,
    averageCompletionMs: 4000,
    endCombo: 0,
    peakMultiplier: 1,
    bonusCounts: {},
    levelBonuses: [],
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

describe('practice difficulty matches campaign exactly (GDD §14)', () => {
  // Every field that sets difficulty must be copied unchanged.
  const DIFFICULTY_FIELDS = [
    'level',
    'initialFallSpeed',
    'spawnInterval',
    'maxActiveWords',
    'minWordLength',
    'maxWordLength',
    'wordLengthWeights',
    'instabilityPerMiss',
    'errorAcceleration',
  ] as const;

  for (const level of CAMPAIGN_LEVELS.all) {
    it(`level ${level.level}: same parameters, endless`, () => {
      for (const filter of ['all', 'original', 'none'] as const) {
        const practice = practiceConfig(level, filter);
        for (const field of DIFFICULTY_FIELDS) expect(practice[field], `${filter}.${field}`).toEqual(level[field]);
        expect(practice.requiredWords).toBeNull();
      }
    });
  }

  it('"original" keeps spell scrolls exactly as in Campaign; "none" removes all specials', () => {
    const level = CAMPAIGN_LEVELS.get(5);
    const original = practiceConfig(level, 'original');
    expect(original.availableSpells).toEqual(level.availableSpells);
    expect(original.spellDropChance).toBe(level.spellDropChance);
    const none = practiceConfig(level, 'none');
    expect(none.availableSpells).toEqual([]);
    expect(none.spellDropChance).toBe(0);
    expect(none.modifierProbabilities).toEqual({});
  });

  it('boss levels become endless at their starting pace (no timer, no ramp)', () => {
    const boss = CAMPAIGN_LEVELS.get(5);
    const practice = practiceConfig(boss, 'original');
    expect(practice.survivalMs).toBeNull();
    expect(practice.ramp).toBeNull();
    const engine = new GameEngine({ config: practice, seed: 2, words: WORDS });
    for (let i = 0; i < 5000; i++) engine.step();
    expect(engine.pace.fallSpeed).toBe(boss.initialFallSpeed);
    expect(engine.status).not.toBe('won');
  });

  it('never changes the campaign level object', () => {
    const level = CAMPAIGN_LEVELS.get(3);
    const before = structuredClone(level);
    practiceConfig(level, 'none');
    expect(level).toEqual(before);
  });

  it('a practice game produces the same words and speeds as the campaign level with the same seed', () => {
    const level = CAMPAIGN_LEVELS.get(4);
    const camp = new GameEngine({ config: level, seed: 9, words: WORDS });
    const prac = new GameEngine({ config: practiceConfig(level, 'original'), seed: 9, words: WORDS });
    for (let i = 0; i < 3000; i++) {
      camp.step();
      prac.step();
    }
    const view = (e: GameEngine) => e.state.words.map((w) => [w.text, w.x, w.y, w.speed, w.spell]);
    expect(view(prac)).toEqual(view(camp));
  });

  it('endless: never wins, however many words are destroyed', () => {
    const engine = new GameEngine({
      config: { ...practiceConfig(CAMPAIGN_LEVELS.get(1), 'none'), spawnInterval: 50 },
      seed: 1,
      words: WORDS,
    });
    for (let i = 0; i < 20_000 && engine.state.completed < 120; i++) {
      engine.step();
      const w = engine.state.words[0];
      if (w) {
        for (const ch of w.match) engine.typeChar(ch);
        engine.submit();
      }
    }
    expect(engine.state.completed).toBeGreaterThan(CAMPAIGN_LEVELS.get(19).requiredWords!);
    expect(engine.status).toBe('playing');
  });
});

describe('practice levels', () => {
  it('offers levels reached in Campaign only', () => {
    expect(practiceLevels(1, TOTAL)).toEqual([1]);
    expect(practiceLevels(5, TOTAL)).toEqual([1, 2, 3, 4, 5]);
    expect(practiceLevels(99, TOTAL)).toHaveLength(TOTAL);
  });
});

describe('practice records', () => {
  it('first session sets records without "new best" noise', () => {
    const records: Record<string, PracticeRecord> = {};
    const out = applyPracticeResult(records, '3:original', stats());
    expect(out.firstSession).toBe(true);
    expect(out.improved).toEqual([]);
    expect(out.record).toMatchObject({ sessions: 1, bestScore: 1000, longestMs: 90_000, fastestAverageMs: 4000 });
  });

  it('reports exactly which records improved', () => {
    const records: Record<string, PracticeRecord> = {};
    applyPracticeResult(records, 'k', stats());
    const out = applyPracticeResult(records, 'k', stats({ score: 500, wpm: 55, averageCompletionMs: 3000 }));
    expect(out.improved.sort()).toEqual(['bestWpm', 'fastestAverageMs']);
    expect(out.record.bestScore).toBe(1000);
    expect(out.record.sessions).toBe(2);
  });

  it('ignores accuracy and average time for very short sessions', () => {
    const records: Record<string, PracticeRecord> = {};
    applyPracticeResult(records, 'k', stats({ completed: MIN_WORDS_FOR_RATE_RECORDS - 1, accuracy: 1 }));
    expect(records.k!.bestAccuracy).toBe(0);
    expect(records.k!.fastestAverageMs).toBe(0);
  });

  it('keys records by level and specials setting', () => {
    expect(practiceKey(4, 'none')).toBe('4:none');
  });

  it('are stored separately from Campaign and survive a reload', () => {
    const storage = new MemoryStorage();
    const save = new SaveManager(storage, TOTAL);
    save.notePracticeChoice(3, 'none');
    save.recordPractice(3, 'none', stats());

    const reloaded = new SaveManager(storage, TOTAL);
    expect(reloaded.practice.records['3:none']!.bestScore).toBe(1000);
    expect(reloaded.practice).toMatchObject({ lastLevel: 3, lastFilter: 'none' });
    expect(reloaded.campaign.bestRun).toBeNull();
    expect(reloaded.campaign.highestReached).toBe(1);
  });

  it('migrates a version 2 save, keeping campaign records', () => {
    const v2 = JSON.stringify({
      version: 2,
      campaign: { highestReached: 5, bestRun: null, runsStarted: 6, runsCompleted: 0 },
    });
    const save = parseSave(v2, TOTAL);
    expect(save.version).toBe(4);
    expect(save.campaign).toMatchObject({ highestReached: 5, runsStarted: 6 });
    expect(save.practice.records).toEqual({});
  });

  it('drops malformed practice entries', () => {
    const raw = JSON.stringify({
      version: 3,
      campaign: {},
      practice: { lastFilter: 'bogus', lastLevel: 77, records: { nonsense: { bestScore: 5 }, '2:none': { bestScore: -4, bestAccuracy: 3 } } },
    });
    const save = parseSave(raw, TOTAL);
    expect(save.practice.lastFilter).toBe('original');
    expect(save.practice.lastLevel).toBe(TOTAL);
    expect(Object.keys(save.practice.records)).toEqual(['2:none']);
    expect(save.practice.records['2:none']).toMatchObject({ bestScore: 0, bestAccuracy: 1 });
  });
});
