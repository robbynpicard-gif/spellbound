import { describe, expect, it } from 'vitest';
import levelsData from '../src/data/levels.json';
import {
  averageWordLength,
  isSurvival,
  letterArrivalRate,
  validateLevels,
  type DifficultyConfig,
} from '../src/difficulty/DifficultyConfig';
import { CAMPAIGN_LEVELS } from '../src/difficulty/LevelDefinitions';
import { WORDS } from '../src/data/wordList';
import { wordComplexity } from '../src/gameplay/WordGenerator';
import { GameEngine } from '../src/core/GameEngine';
import type { GameStats } from '../src/gameplay/ScoringSystem';
import { emptyCharges, SPELL_IDS, totalCharges } from '../src/gameplay/SpellManager';
import { SeededRandom } from '../src/core/Random';
import {
  applyRunResult,
  bossRewardChoices,
  claimBossReward,
  emptyCampaignRecords,
  HARDCORE_BOSS_HEAL,
  knownSpellsAt,
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
  it('has 20 valid, consecutively numbered levels in 4 chapters', () => {
    expect(levels.length).toBe(20);
    levels.forEach((l, i) => {
      expect(l.level).toBe(i + 1);
      expect(l.chapter).toBe(Math.floor(i / 5) + 1);
    });
  });

  it('ends every chapter with a survival boss (60/75/90/120 s), and only there', () => {
    expect(levels.filter(isSurvival).map((l) => [l.level, l.survivalMs])).toEqual([
      [5, 60_000],
      [10, 75_000],
      [15, 90_000],
      [20, 120_000],
    ]);
    for (const boss of levels.filter(isSurvival)) {
      expect(boss.requiredWords).toBeNull();
      expect(boss.introducesSpell ?? null).toBeNull();
      // The boss starts at the previous level's pace and ramps up from there.
      const prev = levels[boss.level - 2]!;
      expect(boss.initialFallSpeed).toBe(prev.initialFallSpeed);
      expect(boss.ramp!.initialFallSpeed).toBeGreaterThan(boss.initialFallSpeed);
      expect(boss.ramp!.spawnInterval).toBeLessThan(boss.spawnInterval);
      expect(boss.ramp!.maxActiveWords).toBeGreaterThan(boss.maxActiveWords);
    }
  });

  it('keeps a full run near 20 minutes', () => {
    let ms = 0;
    for (const l of levels) ms += isSurvival(l) ? l.survivalMs! : l.requiredWords! * l.spawnInterval + 4000;
    expect(ms / 60_000).toBeGreaterThan(14);
    expect(ms / 60_000).toBeLessThan(24);
  });

  it("ends at the old level 10's difficulty", () => {
    const last = levels.filter((l) => !isSurvival(l)).at(-1)!;
    expect(last).toMatchObject({ initialFallSpeed: 108, spawnInterval: 1000, maxActiveWords: 15 });
  });

  it('converts JSON length-weight keys to numbers', () => {
    expect(levels[0]!.wordLengthWeights![4]).toBe(11);
  });

  it('uses short, simple words early and longer, harder words later', () => {
    const normal = levels.filter((l) => !isSurvival(l));
    for (let i = 1; i < normal.length; i++) {
      expect(normal[i]!.minWordLength).toBeGreaterThanOrEqual(normal[i - 1]!.minWordLength);
      expect(normal[i]!.maxWordLength).toBeGreaterThanOrEqual(normal[i - 1]!.maxWordLength);
      const cap = (l: DifficultyConfig) => l.maxComplexity ?? Infinity;
      expect(cap(normal[i]!)).toBeGreaterThanOrEqual(cap(normal[i - 1]!));
    }
    expect(levels[0]).toMatchObject({ minWordLength: 3, maxWordLength: 5, maxComplexity: 0.5 });
    expect(levels[19]).toMatchObject({ minWordLength: 6, maxWordLength: 12 });
    // Level 1 only ever spawns short words without rare letters, clusters or names.
    const engine = new GameEngine({ config: { ...levels[0]!, spawnInterval: 50, maxActiveWords: 200 }, seed: 3, words: WORDS });
    const seen: string[] = [];
    engine.events.on('wordSpawned', ({ word }) => seen.push(word.text));
    for (let i = 0; i < 3000; i++) engine.step();
    expect(seen.length).toBeGreaterThan(100);
    for (const w of seen) {
      expect(w.length).toBeLessThanOrEqual(5);
      expect(wordComplexity(w), w).toBeLessThanOrEqual(0.5);
    }
  });

  it('has enough words for every level’s length range', () => {
    for (const l of levels) {
      const pool = WORDS.filter((w) => w.length >= l.minWordLength && w.length <= l.maxWordLength);
      expect(pool.length, `level ${l.level}`).toBeGreaterThanOrEqual(30);
    }
  });

  // Progressive difficulty (GDD §9): each level is at least as hard as the
  // previous one on every axis, and strictly harder overall.
  it('gets progressively harder (normal levels)', () => {
    const normal = levels.filter((l) => !isSurvival(l));
    for (let i = 1; i < normal.length; i++) {
      const prev = normal[i - 1]!;
      const cur = normal[i]!;
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

  it('introduces Fire first, then the rest from least to most powerful, never removing one', () => {
    expect(levels[0]!.availableSpells).toEqual(['fire']);
    const intros = levels.filter((l) => l.introducesSpell).map((l) => [l.level, l.introducesSpell]);
    expect(intros).toEqual([
      [1, 'fire'],
      [3, 'slow'],
      [6, 'ice'],
      [8, 'barrier'],
      [11, 'shock'],
      [13, 'alter'],
      [16, 'wind'],
      [18, 'harvest'],
    ]);
    for (let i = 1; i < levels.length; i++) {
      for (const id of levels[i - 1]!.availableSpells) expect(levels[i]!.availableSpells).toContain(id);
      const added = levels[i]!.availableSpells.filter((id) => !levels[i - 1]!.availableSpells.includes(id));
      expect(added).toEqual(levels[i]!.introducesSpell ? [levels[i]!.introducesSpell] : []);
    }
    expect([...levels.at(-1)!.availableSpells].sort()).toEqual([...SPELL_IDS].sort());
  });

  it('knows which spells are unlocked at each level', () => {
    expect(knownSpellsAt(levels, 1)).toEqual(['fire']);
    expect(knownSpellsAt(levels, 7)).toEqual(['slow', 'ice', 'fire']);
    expect(knownSpellsAt(levels, 20)).toEqual([...SPELL_IDS]);
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

describe('Normal and Hardcore', () => {
  it('Normal resets instability every level', () => {
    const run = startRun('normal');
    recordLevel(run, 'won', stats(10), emptyCharges(), TOTAL, 70, levels[0]);
    expect(run.instability).toBe(0);
  });

  it('Hardcore carries instability from level to level', () => {
    const run = startRun('hardcore');
    recordLevel(run, 'won', stats(10), emptyCharges(), TOTAL, 30, levels[0]);
    expect(run.instability).toBe(30);
    recordLevel(run, 'won', stats(10), emptyCharges(), TOTAL, 55, levels[1]);
    expect(run.instability).toBe(55);
  });

  it(`Hardcore heals ${HARDCORE_BOSS_HEAL}% after surviving a boss`, () => {
    const run = startRun('hardcore');
    for (let i = 0; i < 4; i++) recordLevel(run, 'won', stats(10), emptyCharges(), TOTAL, 40, levels[i]);
    expect(run.level).toBe(5);
    recordLevel(run, 'won', stats(10), emptyCharges(), TOTAL, 60, levels[4]);
    expect(run.instability).toBe(60 - HARDCORE_BOSS_HEAL);
    const low = startRun('hardcore');
    recordLevel(low, 'won', stats(10), emptyCharges(), TOTAL, 10, levels[4]);
    expect(low.instability).toBe(0);
  });

  it('a Hardcore run passes its instability into the engine', () => {
    const engine = new GameEngine({ config: levels[0]!, seed: 1, words: WORDS, hardcore: true, initialInstability: 45 });
    expect(engine.state.instability).toBe(45);
  });
});

describe('boss rewards', () => {
  it('offer 3 different spells from those unlocked', () => {
    const rng = new SeededRandom(4);
    for (let i = 0; i < 50; i++) {
      const known = knownSpellsAt(levels, 10);
      const choices = bossRewardChoices(known, () => rng.next());
      expect(choices).toHaveLength(3);
      expect(new Set(choices).size).toBe(3);
      for (const id of choices) expect(known).toContain(id);
    }
    expect(bossRewardChoices(['slow', 'ice'], Math.random)).toEqual(['slow', 'ice']);
  });

  it('offer rare spells less often', () => {
    const rng = new SeededRandom(8);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 2000; i++)
      for (const id of bossRewardChoices([...SPELL_IDS], () => rng.next())) seen[id] = (seen[id] ?? 0) + 1;
    expect(seen.slow!).toBeGreaterThan(seen.harvest! * 1.5);
  });

  it('add a charge, or with a full pool swap one out (or can’t be taken)', () => {
    const run = startRun();
    expect(claimBossReward(run, 'shock')).toBe(true);
    expect(run.spellCharges.shock).toBe(1);

    run.spellCharges = { ...emptyCharges(), slow: 8 };
    expect(claimBossReward(run, 'fire')).toBe(false);
    expect(run.spellCharges.fire).toBe(0);
    expect(claimBossReward(run, 'fire', 'ice')).toBe(false); // nothing to give up
    expect(claimBossReward(run, 'fire', 'slow')).toBe(true);
    expect(run.spellCharges).toMatchObject({ slow: 7, fire: 1 });
    expect(totalCharges(run.spellCharges)).toBe(8);
  });
});

describe('SaveManager', () => {
  it('keeps Hardcore records apart from Normal', () => {
    const storage = new MemoryStorage();
    const save = new SaveManager(storage, TOTAL);
    save.noteRunStarted('hardcore');
    save.noteLevelReached(7, 'hardcore');
    const run = startRun('hardcore');
    recordLevel(run, 'lost', stats(400), emptyCharges(), TOTAL);
    save.recordRun(summarizeRun(run, false), 'hardcore');

    const reloaded = new SaveManager(storage, TOTAL);
    expect(reloaded.hardcore).toMatchObject({ highestReached: 7, runsStarted: 1 });
    expect(reloaded.hardcore.bestRun!.score).toBe(400);
    expect(reloaded.campaign).toMatchObject({ highestReached: 1, runsStarted: 0, bestRun: null });
    // Practice unlocks follow the furthest level in either mode.
    expect(reloaded.highestReached).toBe(7);
  });

  it('ignores old word-bank settings (one dictionary now)', () => {
    const old = parseSave(JSON.stringify({ version: 4, campaign: {}, settings: { wordBanks: { fantasy: false, modern: true } } }), TOTAL);
    expect(old.settings).toEqual({});
  });

  it('migrates a version 3 save (Hardcore starts empty)', () => {
    const v3 = JSON.stringify({
      version: 3,
      campaign: { highestReached: 6, bestRun: null, runsStarted: 2, runsCompleted: 0 },
      practice: { records: {}, lastLevel: 2, lastFilter: 'none' },
    });
    const save = parseSave(v3, TOTAL);
    expect(save.version).toBe(4);
    expect(save.campaign).toMatchObject({ highestReached: 6, runsStarted: 2 });
    expect(save.hardcore).toEqual(emptyCampaignRecords());
    expect(save.practice.lastFilter).toBe('none');
  });

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
    expect(save.version).toBe(4);
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
