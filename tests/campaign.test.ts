import { describe, expect, it } from 'vitest';
import { isSurvival, letterArrivalRate, validateLevels } from '../src/difficulty/DifficultyConfig';
import { CAMPAIGN_LEVELS } from '../src/difficulty/LevelDefinitions';
import {
  BOSS_NAMES,
  duelLevels,
  knownSpells,
  levelWpm,
  spellsOfStage,
  STAGE_COUNT,
  STAGE_LEVELS,
  STAGE_NAMES,
  stageLevel,
  stageLevels,
  STAGE_TUNING,
} from '../src/difficulty/Stages';
import { WORDS } from '../src/data/wordList';
import { GameEngine } from '../src/core/GameEngine';
import type { GameStats } from '../src/gameplay/ScoringSystem';
import { emptyCharges, SPELL_IDS } from '../src/gameplay/SpellManager';
import {
  HARDCORE_HEAL,
  HARDCORE_HEAL_LEVELS,
  recordLevel,
  startRun,
  summarizeRun,
  type CampaignMode,
} from '../src/modes/CampaignMode';
import { parseSave, SAVE_KEY, SAVE_VERSION, SaveManager, type StorageLike } from '../src/storage/SaveManager';

const TOTAL = CAMPAIGN_LEVELS.count;
const MODES: CampaignMode[] = ['normal', 'hardcore'];
const STAGES = [1, 2, 3, 4, 5];

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

/** Plays a whole stage, winning every level. */
function clearStage(save: SaveManager, mode: CampaignMode, stage: number): void {
  const run = startRun(mode, stage);
  save.noteRunStarted(mode, stage);
  for (let l = 1; l <= STAGE_LEVELS; l++) recordLevel(run, 'won', stats(100), emptyCharges(), 0);
  save.recordRun(summarizeRun(run, true), mode);
}

describe('stage structure (D-047)', () => {
  it('has 2 modes × 5 stages × 20 levels, each ending in one boss', () => {
    for (const mode of MODES)
      for (const stage of STAGES) {
        const levels = stageLevels(mode, stage);
        expect(levels.length).toBe(STAGE_LEVELS);
        levels.forEach((l, i) => {
          expect(l.level).toBe(i + 1);
          expect(l.stage).toBe(stage);
          expect(isSurvival(l)).toBe(i === STAGE_LEVELS - 1);
        });
        const boss = levels.at(-1)!;
        expect(boss.name).toBe(BOSS_NAMES[stage - 1]);
        expect(boss.requiredWords).toBeNull();
        expect(boss.ramp!.spawnInterval).toBeLessThan(boss.spawnInterval);
        expect(levels[0]!.name).toBe(STAGE_NAMES[stage - 1]);
      }
  });

  it('uses the agreed WPM targets', () => {
    expect(STAGE_TUNING.normal.targetWpm).toEqual([18, 22, 26, 30, 35]);
    expect(STAGE_TUNING.hardcore.targetWpm).toEqual([25, 30, 35, 40, 45]);
    expect(levelWpm('normal', 1, 1)).toBe(12);
    expect(levelWpm('hardcore', 1, 1)).toBe(18);
    expect(levelWpm('normal', 3, 20)).toBe(26);
    // Each stage starts where the previous stage's target was.
    expect(levelWpm('normal', 2, 1)).toBe(18);
  });

  it('gets harder within each stage, and Hardcore is harder than Normal', () => {
    for (const mode of MODES)
      for (const stage of STAGES) {
        const normal = stageLevels(mode, stage).filter((l) => !isSurvival(l));
        for (let i = 1; i < normal.length; i++) {
          const at = `${mode} ${stage}-${i + 1}`;
          expect(letterArrivalRate(normal[i]!), at).toBeGreaterThanOrEqual(letterArrivalRate(normal[i - 1]!));
          expect(normal[i]!.initialFallSpeed, at).toBeGreaterThanOrEqual(normal[i - 1]!.initialFallSpeed);
          expect(normal[i]!.maxWordLength, at).toBeGreaterThanOrEqual(normal[i - 1]!.maxWordLength);
        }
        expect(levelWpm(mode, stage, 19)).toBeGreaterThan(levelWpm(mode, stage, 1));
      }
    for (const stage of STAGES)
      for (const level of [1, 10, 20])
        expect(letterArrivalRate(stageLevel('hardcore', stage, level))).toBeGreaterThan(
          letterArrivalRate(stageLevel('normal', stage, level)),
        );
  });

  it('has enough words for every level’s length range', () => {
    for (const mode of MODES)
      for (const stage of STAGES)
        for (const l of stageLevels(mode, stage)) {
          const pool = WORDS.filter((w) => w.length >= l.minWordLength && w.length <= l.maxWordLength);
          expect(pool.length, `${mode} ${stage}-${l.level}`).toBeGreaterThanOrEqual(30);
        }
  });

  it('keeps a stage run roughly 20–30 minutes', () => {
    for (const mode of MODES)
      for (const stage of STAGES) {
        let ms = 0;
        for (const l of stageLevels(mode, stage)) ms += isSurvival(l) ? l.survivalMs! : l.requiredWords! * l.spawnInterval + 4000;
        expect(ms / 60_000).toBeGreaterThan(18);
        expect(ms / 60_000).toBeLessThan(32);
      }
  });
});

describe('spell schedule: 2 per stage, at level 10 and from the boss', () => {
  it('follows the agreed order', () => {
    expect(STAGES.map(spellsOfStage)).toEqual([
      { atLevel10: 'slow', fromBoss: 'ice' },
      { atLevel10: 'barrier', fromBoss: 'shock' },
      { atLevel10: 'alter', fromBoss: 'fire' },
      { atLevel10: 'wind', fromBoss: 'harvest' },
      { atLevel10: null, fromBoss: null },
    ]);
  });

  it('introduces the level-10 spell at level 10 and the boss spell at the next stage’s level 1', () => {
    expect(stageLevel('normal', 1, 9).availableSpells).toEqual([]);
    expect(stageLevel('normal', 1, 10).introducesSpell).toBe('slow');
    expect(stageLevel('normal', 1, 10).availableSpells).toEqual(['slow']);
    expect(stageLevel('normal', 1, 20).availableSpells).not.toContain('ice');
    expect(stageLevel('normal', 2, 1).introducesSpell).toBe('ice');
    expect(knownSpells(2, 1).sort()).toEqual(['ice', 'slow']);
    expect(knownSpells(5, 1).sort()).toEqual([...SPELL_IDS].sort());
  });

  it('starts a later stage with 1 charge of the spell its previous boss gave', () => {
    expect(startRun('normal', 1).spellCharges).toEqual(emptyCharges());
    expect(startRun('normal', 2).spellCharges.ice).toBe(1);
    expect(startRun('hardcore', 4).spellCharges.fire).toBe(1);
    expect(startRun('normal', 5).spellCharges.harvest).toBe(1);
  });
});

describe('stage run', () => {
  it('advances level by level, carrying score, spells, combo and Clean Streak', () => {
    const run = startRun('normal', 2);
    const r = recordLevel(run, 'won', stats(500, { endCombo: 6, endCleanStreak: 30 }), { ...emptyCharges(), ice: 2 });
    expect(r).toEqual({ runOver: false, victory: false });
    expect(run).toMatchObject({ level: 2, score: 500, combo: 6, cleanStreak: 30 });
    expect(run.spellCharges.ice).toBe(2);
  });

  it('ends on a loss (restart the stage)', () => {
    const run = startRun();
    recordLevel(run, 'won', stats(100), emptyCharges());
    expect(recordLevel(run, 'lost', stats(40), emptyCharges())).toEqual({ runOver: true, victory: false });
    expect(run.score).toBe(140);
    expect(summarizeRun(run, false)).toMatchObject({ stage: 1, levelsCleared: 1 });
  });

  it('beating the level-20 boss clears the stage', () => {
    const run = startRun('normal', 3);
    for (let l = 1; l < STAGE_LEVELS; l++) expect(recordLevel(run, 'won', stats(1), emptyCharges()).runOver).toBe(false);
    expect(run.level).toBe(20);
    expect(recordLevel(run, 'won', stats(1), emptyCharges())).toEqual({ runOver: true, victory: true });
  });

  it('Normal resets instability every level; Hardcore carries it', () => {
    const n = startRun('normal');
    recordLevel(n, 'won', stats(10), emptyCharges(), 70);
    expect(n.instability).toBe(0);
    const h = startRun('hardcore');
    recordLevel(h, 'won', stats(10), emptyCharges(), 30);
    expect(h.instability).toBe(30);
  });

  it(`Hardcore heals ${HARDCORE_HEAL}% after levels ${HARDCORE_HEAL_LEVELS.join(', ')}`, () => {
    const run = startRun('hardcore');
    const seen: number[] = [];
    for (let l = 1; l < STAGE_LEVELS; l++) {
      recordLevel(run, 'won', stats(10), emptyCharges(), 60);
      seen.push(run.instability);
    }
    expect(seen.filter((v) => v === 60 - HARDCORE_HEAL).length).toBe(3);
    expect(seen[4]).toBe(35);
    expect(seen[9]).toBe(35);
    expect(seen[14]).toBe(35);
    expect(seen[5]).toBe(60);
    // A new stage starts with a fresh ward.
    expect(startRun('hardcore', 2).instability).toBe(0);
  });

  it('a Hardcore run passes its instability into the engine', () => {
    const engine = new GameEngine({ config: stageLevel('hardcore', 1, 1), seed: 1, words: WORDS, hardcore: true, initialInstability: 45 });
    expect(engine.state.instability).toBe(45);
  });
});

describe('duel levels', () => {
  it('flatten the 100 Normal levels, numbered 1–100', () => {
    const all = duelLevels();
    expect(all.length).toBe(STAGE_COUNT * STAGE_LEVELS);
    expect(TOTAL).toBe(100);
    all.forEach((l, i) => expect(l.level).toBe(i + 1));
    expect(all[20]!.name).toBe('Stage 2 · Level 1');
    expect(all[19]!.name).toBe(`Stage 1 · ${BOSS_NAMES[0]}`);
    expect(CAMPAIGN_LEVELS.has(0)).toBe(false);
    expect(() => CAMPAIGN_LEVELS.get(TOTAL + 1)).toThrow();
  });

  it('rejects broken level data with a helpful message', () => {
    const broken = structuredClone(stageLevels('normal', 1)) as unknown as Record<string, unknown>[];
    broken[2]!.minWordLength = 99;
    expect(() => validateLevels(broken)).toThrow(/level\[2\]/);
    expect(() => validateLevels([])).toThrow();
  });
});

describe('SaveManager (stages)', () => {
  it('opens stages one at a time, per mode', () => {
    const storage = new MemoryStorage();
    const save = new SaveManager(storage, TOTAL);
    expect(STAGES.map((s) => save.stageUnlocked('normal', s))).toEqual([true, false, false, false, false]);
    clearStage(save, 'normal', 1);
    const reloaded = new SaveManager(storage, TOTAL);
    expect(STAGES.map((s) => reloaded.stageUnlocked('normal', s))).toEqual([true, true, false, false, false]);
    expect(reloaded.stageUnlocked('hardcore', 2)).toBe(false);
    expect(reloaded.records('normal', 1).runsCompleted).toBe(1);
    expect(reloaded.bestScore()).toBe(2000);
  });

  it('a lost run does not open the next stage', () => {
    const save = new SaveManager(null, TOTAL);
    const run = startRun('hardcore');
    save.noteLevelReached('hardcore', 1, 7);
    recordLevel(run, 'lost', stats(400), emptyCharges());
    save.recordRun(summarizeRun(run, false), 'hardcore');
    expect(save.records('hardcore', 1)).toMatchObject({ highestReached: 7 });
    expect(save.records('hardcore', 1).bestRun!.score).toBe(400);
    expect(save.records('normal', 1).bestRun).toBeNull();
    expect(save.stageUnlocked('hardcore', 2)).toBe(false);
  });

  it('saves a run in progress and continues it after a reload', () => {
    const storage = new MemoryStorage();
    const save = new SaveManager(storage, TOTAL);
    const run = startRun('normal', 2);
    recordLevel(run, 'won', stats(321, { endCleanStreak: 12 }), { ...emptyCharges(), ice: 1 });
    save.setSavedRun(run);
    run.score = 0; // the saved copy is independent
    const back = new SaveManager(storage, TOTAL).savedRun!;
    expect(back).toMatchObject({ mode: 'normal', stage: 2, level: 2, score: 321, cleanStreak: 12 });
    expect(back.spellCharges.ice).toBe(1);
    save.setSavedRun(null);
    expect(new SaveManager(storage, TOTAL).savedRun).toBeNull();
  });

  it('resets old campaign records once, keeping settings, profile and stats', () => {
    const old = JSON.stringify({
      version: 4,
      campaign: { highestReached: 12 },
      settings: { music: false, sfx: true },
      profile: { name: 'Robbyn', duelLevel: 7 },
      lifetime: { wordsTyped: 900 },
    });
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, old);
    const save = new SaveManager(storage, TOTAL);
    expect(save.records('normal', 1).highestReached).toBe(1);
    expect(save.audio).toEqual({ music: false, sfx: true });
    expect(save.profile.name).toBe('Robbyn');
    expect(save.takeResetNotice()).toBe(true);
    expect(save.takeResetNotice()).toBe(false);
    expect(new SaveManager(storage, TOTAL).takeResetNotice()).toBe(false);
    expect(parseSave(old, TOTAL).version).toBe(SAVE_VERSION);
  });

  it('survives corrupt or tampered save data', () => {
    expect(parseSave('{not json', TOTAL).stages.normal[0]!.highestReached).toBe(1);
    expect(parseSave('{"version":99}', TOTAL).resetNotice).toBe(false);
    const tampered = parseSave(
      JSON.stringify({
        version: SAVE_VERSION,
        stages: { normal: [{ highestReached: 500, bestRun: { score: -5, accuracy: 7 } }] },
        savedRun: { mode: 'sideways' },
      }),
      TOTAL,
    );
    expect(tampered.stages.normal[0]!.highestReached).toBe(STAGE_LEVELS);
    expect(tampered.stages.normal[0]!.bestRun).toMatchObject({ score: 0, accuracy: 1 });
    expect(tampered.savedRun).toBeNull();
  });

  it('keeps working if storage throws, or without storage', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    const save = new SaveManager(throwing, TOTAL);
    expect(() => save.noteLevelReached('normal', 1, 2)).not.toThrow();
    expect(save.records('normal', 1).highestReached).toBe(2);
    expect(new SaveManager(null, TOTAL).persistent).toBe(false);
  });

  it('stores under a single namespaced key', () => {
    const storage = new MemoryStorage();
    new SaveManager(storage, TOTAL).noteRunStarted('normal', 1);
    expect([...storage.data.keys()]).toEqual([SAVE_KEY]);
  });
});
