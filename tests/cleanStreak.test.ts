import { describe, expect, it } from 'vitest';
import { GameEngine, type EngineOptions } from '../src/core/GameEngine';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import {
  multiplierOf,
  nextStreakMilestone,
  scoreWord,
  streakAfterTypo,
  streakMultiplierOf,
  streakTierOf,
  STREAK_MILESTONES,
  type Bonus,
  type GameStats,
} from '../src/gameplay/ScoringSystem';
import { emptyCharges } from '../src/gameplay/SpellManager';
import type { WordState } from '../src/gameplay/Word';
import { recordLevel, startRun } from '../src/modes/CampaignMode';

// Words that never start with x, so typing 'x' is always a typo.
const WORDS = ['ember', 'frost', 'wand', 'rune', 'owl', 'gale', 'quill', 'mist', 'lantern', 'bramble', 'cauldron', 'moth'];

const CONFIG: DifficultyConfig = {
  speedVariance: 0,
  speedRamp: 0,
  level: 0,
  name: 'Test',
  requiredWords: null,
  initialFallSpeed: 10,
  spawnInterval: 100,
  maxActiveWords: 8,
  minWordLength: 3,
  maxWordLength: 9,
  modifierProbabilities: {},
  instabilityPerMiss: 10,
  errorAcceleration: 30,
  availableSpells: [],
  spellDropChance: 0,
};

function engine(over: Partial<EngineOptions> = {}, config: Partial<DifficultyConfig> = {}): GameEngine {
  return new GameEngine({ config: { ...CONFIG, ...config }, seed: 7, words: WORDS, ...over });
}

function nextWord(e: GameEngine): WordState {
  for (let i = 0; i < 2000 && e.state.words.length === 0; i++) e.step();
  return e.state.words[0]!;
}

/** Types a word correctly and presses Enter; returns the points it scored. */
function capture(e: GameEngine): number {
  const before = e.state.score;
  const w = nextWord(e);
  for (const ch of w.match) e.typeChar(ch);
  e.submit();
  return e.state.score - before;
}

/** A corrected typo: a wrong letter, then Backspace. */
function correctedTypo(e: GameEngine): void {
  e.typeChar('x');
  e.backspace();
}

const MILESTONES: [number, number][] = [
  [0, 1],
  [5, 1.2],
  [15, 1.4],
  [25, 1.65],
  [50, 2],
  [100, 2.75],
  [200, 3.5],
];

describe('Clean Streak: milestones (D-046)', () => {
  it('the table matches the design: thresholds and provisional multipliers', () => {
    expect(STREAK_MILESTONES.map((m) => [m.at, m.multiplier])).toEqual(MILESTONES);
  });

  it.each(MILESTONES)('%i clean captures give ×%f', (at: number, mult: number) => {
    expect(streakMultiplierOf(at)).toBe(mult);
    if (at > 0) expect(streakMultiplierOf(at - 1)).toBeLessThan(mult);
  });

  it('starts at zero with ×1.00 and climbs through real captures', () => {
    const e = engine();
    expect(e.state.cleanStreak).toBe(0);
    expect(streakMultiplierOf(e.state.cleanStreak)).toBe(1);
    const seen: number[] = [];
    e.events.on('cleanStreakChanged', ({ count, multiplier }) => seen.push(count) && void multiplier);
    for (let i = 0; i < 25; i++) capture(e);
    expect(e.state.cleanStreak).toBe(25);
    expect(streakMultiplierOf(e.state.cleanStreak)).toBe(1.65);
    expect(seen).toEqual(Array.from({ length: 25 }, (_, i) => i + 1));
  });

  it.each([
    [49, 50, 2],
    [99, 100, 2.75],
    [199, 200, 3.5],
  ] as [number, number, number][])('from %i, one more clean capture reaches %i (×%f)', (start: number, end: number, mult: number) => {
    const e = engine({ initialCleanStreak: start });
    capture(e);
    expect(e.state.cleanStreak).toBe(end);
    expect(streakMultiplierOf(e.state.cleanStreak)).toBe(mult);
  });

  it('keeps counting past the last milestone', () => {
    expect(nextStreakMilestone(250)).toBeNull();
    expect(streakMultiplierOf(250)).toBe(3.5);
  });
});

describe('Clean Streak: corrected typos', () => {
  it('step back to the start of the milestone below the one reached', () => {
    expect(streakAfterTypo(3)).toBe(0); // before the first milestone: stays at the start
    expect(streakAfterTypo(5)).toBe(0); // reached 5 → starting tier
    expect(streakAfterTypo(17)).toBe(5); // reached 15 → start of the 5 milestone
    expect(streakAfterTypo(50)).toBe(25); // reached 50 → start of the 25 milestone
    expect(streakAfterTypo(73)).toBe(25);
    expect(streakAfterTypo(0)).toBe(0); // never below ×1.00
  });

  it('in play: one typo knocks back one milestone; repeated typos keep stepping down', () => {
    const e = engine({ initialCleanStreak: 50 });
    nextWord(e);
    correctedTypo(e);
    expect(e.state.cleanStreak).toBe(25);
    expect(streakMultiplierOf(e.state.cleanStreak)).toBe(1.65);
    e.clearInput();
    correctedTypo(e);
    expect(e.state.cleanStreak).toBe(15);
    e.clearInput();
    correctedTypo(e);
    expect(e.state.cleanStreak).toBe(5);
    e.clearInput();
    correctedTypo(e);
    expect(e.state.cleanStreak).toBe(0);
    e.clearInput();
    correctedTypo(e);
    expect(e.state.cleanStreak).toBe(0);
  });

  it('a run of wrong letters is one slip, so it costs one milestone', () => {
    const e = engine({ initialCleanStreak: 50 });
    nextWord(e);
    e.typeChar('x');
    e.typeChar('x');
    e.typeChar('x');
    expect(e.state.cleanStreak).toBe(25);
  });

  it('does not touch the combo, and the word typed with the typo is not a clean capture', () => {
    const e = engine({ initialCleanStreak: 15 });
    for (let i = 0; i < 6; i++) capture(e);
    const combo = e.state.combo;
    const w = nextWord(e);
    e.typeChar(w.match[0]!);
    e.typeChar('x');
    e.backspace();
    expect(e.state.combo).toBe(combo);
    expect(e.state.cleanStreak).toBe(5); // 21 (milestone II) → start of milestone I
    for (const ch of w.match.slice(1)) e.typeChar(ch);
    e.submit();
    expect(e.state.combo).toBe(combo + 1);
    expect(e.state.cleanStreak).toBe(5); // captured, but not clean
    capture(e);
    expect(e.state.cleanStreak).toBe(6);
  });
});

describe('Clean Streak: wrong Enter and misses', () => {
  it('a wrong Enter resets the streak to 0 and still drops the combo one tier', () => {
    const e = engine({ initialCleanStreak: 60 });
    for (let i = 0; i < 13; i++) capture(e); // combo 13 (×3), streak 73
    expect(e.state.cleanStreak).toBe(73);
    const w = nextWord(e);
    e.typeChar(w.match[0]!);
    e.submit();
    expect(e.state.cleanStreak).toBe(0);
    expect(streakMultiplierOf(e.state.cleanStreak)).toBe(1);
    expect(e.state.combo).toBe(5); // ×3 → ×2 (existing rule)
  });

  it('a miss resets the streak and the combo, and still damages the ward', () => {
    const e = engine({ initialCleanStreak: 30 }, { initialFallSpeed: 600 });
    capture(e);
    capture(e);
    const missesBefore = e.state.missed;
    for (let i = 0; i < 5000 && e.state.missed === missesBefore; i++) e.step();
    expect(e.state.cleanStreak).toBe(0);
    expect(e.state.combo).toBe(0);
    expect(e.state.instability).toBe(10);
  });

  it('the ward still breaks at 100% (game over unchanged)', () => {
    const e = engine({}, { initialFallSpeed: 900, instabilityPerMiss: 50 });
    for (let i = 0; i < 20000 && e.status === 'playing'; i++) e.step();
    expect(e.status).toBe('lost');
    expect(e.state.cleanStreak).toBe(0);
  });
});

describe('Clean Streak: scoring', () => {
  const perfectQuick: Bonus[] = [
    { id: 'perfect', rate: 0.25, points: 0, count: 1 },
    { id: 'quick', rate: 0.2, points: 0, count: 1 },
  ];

  it('the design example: LANTERN at ×3 with Perfect + Quick', () => {
    expect(scoreWord(7, 3, perfectQuick, 2)).toBe(609);
    expect(scoreWord(7, 3, perfectQuick, 3.5)).toBe(Math.round(1065.75)); // 1066, rounded once
    expect(scoreWord(7, 3, perfectQuick)).toBe(305); // no streak: as before
  });

  it('multiplies flat bonuses too (Clean Sweep), and is applied once', () => {
    const sweep: Bonus[] = [{ id: 'sweep', rate: 0, points: 100, count: 1 }];
    expect(scoreWord(4, 2, sweep, 1.5)).toBe(Math.round((40 + 100) * 2 * 1.5));
  });

  it('in play: the capture that reaches a milestone already scores at its multiplier', () => {
    const plain = engine();
    const streaked = engine({ initialCleanStreak: 4 });
    const a = capture(plain); // streak 1: ×1
    const b = capture(streaked); // streak 5: ×1.20
    expect(b).toBe(Math.round(a * 1.2));
  });

  it('word bonuses and the combo still work under a streak', () => {
    const e = engine({ initialCleanStreak: 50 });
    let last = 0;
    for (let i = 0; i < 6; i++) last = capture(e);
    expect(multiplierOf(e.state.combo)).toBe(2);
    expect(e.state.bonusCounts.perfect).toBe(6);
    expect(last).toBeGreaterThan(0);
  });

  it('stats report the streak at the end and its peak', () => {
    const e = engine({ initialCleanStreak: 10 });
    capture(e);
    nextWord(e);
    correctedTypo(e);
    const s = e.stats();
    expect(s.peakCleanStreak).toBe(11);
    expect(s.endCleanStreak).toBe(0); // 11 (milestone I) → the starting tier
  });
});

describe('Clean Streak: carried within a chapter, reset at a new chapter', () => {
  const stats = (endCleanStreak: number, endCombo = 20): GameStats => ({
    score: 100,
    completed: 10,
    missed: 0,
    correctChars: 50,
    errors: 0,
    accuracy: 1,
    wpm: 40,
    maxCombo: endCombo,
    endCombo,
    peakMultiplier: 3,
    bonusCounts: {},
    levelBonuses: [],
    elapsedMs: 1000,
    averageCompletionMs: 1000,
    endCleanStreak,
    peakCleanStreak: endCleanStreak,
  });
  const play = (run: ReturnType<typeof startRun>, streak: number) =>
    recordLevel(run, 'won', stats(streak), emptyCharges(), 0);

  it('carries across all 20 levels of a stage, including into the boss', () => {
    const run = startRun('normal', 2);
    play(run, 8); // level 1 → 2
    expect(run.cleanStreak).toBe(8);
    for (let n = 2; n < 20; n++) play(run, 8 + n * 10);
    expect(run.level).toBe(20);
    expect(run.cleanStreak).toBe(198);
    expect(run.combo).toBe(20); // combo carry is unchanged
    // The next stage is a new run, so its streak starts at 0.
    expect(startRun('normal', 3).cleanStreak).toBe(0);
  });

  it('Normal and Hardcore runs keep their own streaks', () => {
    const normal = startRun('normal');
    const hardcore = startRun('hardcore');
    play(normal, 12);
    play(hardcore, 3);
    expect(normal.cleanStreak).toBe(12);
    expect(hardcore.cleanStreak).toBe(3);
  });

  it('a lost level ends the run with no streak to carry', () => {
    const run = startRun('normal');
    recordLevel(run, 'lost', stats(9), emptyCharges(), 0);
    expect(run.cleanStreak).toBe(0);
  });

  it('a carried streak starts the next level where it left off', () => {
    const e = engine({ initialCleanStreak: 14 });
    expect(streakTierOf(e.state.cleanStreak)).toBe(1);
    capture(e);
    expect(e.state.cleanStreak).toBe(15);
  });
});
