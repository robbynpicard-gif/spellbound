import { describe, expect, it } from 'vitest';
import { GameEngine, ICE_FOCUS_STEPS, type EngineOptions } from '../src/core/GameEngine';
import type { DifficultyConfig } from '../src/difficulty/DifficultyConfig';
import {
  allInMultiplier,
  arcaneScore,
  canWagerAt,
  castWind,
  clampHeal,
  freshWard,
  parseWard,
  scarFor,
  tickAllIn,
  WARD_TUNING,
  wardForNextLevel,
} from '../src/gameplay/WardScar';
import { recordLevel, startRun } from '../src/modes/CampaignMode';
import type { GameStats } from '../src/gameplay/ScoringSystem';

const WORDS = ['ember', 'frost', 'wand', 'rune', 'owl', 'gale', 'quill', 'mist', 'labyrinth', 'phantasmal', 'yew', 'orb', 'elk'];
const CONFIG: DifficultyConfig = {
  speedVariance: 0,
  speedRamp: 0,
  level: 0,
  name: 'Test',
  requiredWords: null,
  initialFallSpeed: 20,
  spawnInterval: 200,
  maxActiveWords: 6,
  minWordLength: 3,
  maxWordLength: 10,
  modifierProbabilities: {},
  instabilityPerMiss: 10,
  errorAcceleration: 0,
  availableSpells: [],
  spellDropChance: 0,
};

function arcane(extra: Partial<EngineOptions> = {}, cfg: Partial<DifficultyConfig> = {}): GameEngine {
  return new GameEngine({ config: { ...CONFIG, ...cfg }, seed: 7, words: WORDS, experimentalScoring: true, ...extra });
}
function fill(e: GameEngine, n: number): void {
  for (let i = 0; i < 20_000 && e.state.words.length < n; i++) e.step();
  expect(e.state.words.length).toBeGreaterThanOrEqual(n);
}
function type(e: GameEngine, text: string): void {
  for (const ch of text) e.typeChar(ch);
}
function cast(e: GameEngine, spell: string): void {
  e.clearInput();
  type(e, spell);
  e.submit();
}
/** Score without the fixed Rune points (Runes are tested separately). */
const pts = (e: GameEngine) => e.state.score - (e.stats().runePoints ?? 0);
function capture(e: GameEngine): number {
  const w = [...e.state.words].sort((a, b) => b.y - a.y)[0]!;
  const before = pts(e);
  type(e, w.match);
  e.submit();
  return pts(e) - before;
}

/** Type the first letter, slip, Backspace, finish: a corrected capture. */
function correctedCapture(e: GameEngine): void {
  const w = [...e.state.words].sort((a, b) => b.y - a.y)[0]!;
  e.typeChar(w.match[0]!);
  e.typeChar('z');
  e.backspace();
  type(e, w.match.slice(1));
  e.submit();
}

describe('Ward scar rules (pure)', () => {
  it('wagers only at the current maximum, scarring it progressively', () => {
    let w = freshWard();
    let r = castWind(w, 100);
    expect(r.outcome).toBe('wager');
    expect(r.ward.cap).toBe(100 - WARD_TUNING.firstScar);
    expect(r.stability).toBe(WARD_TUNING.wagerStability);
    expect(r.ward.allInTicks).toBe(WARD_TUNING.allInTicks);
    w = r.ward;
    r = castWind(w, r.stability);
    expect(r.outcome).toBe('heal');
    expect(r.stability).toBe(w.cap); // heals to the scar, never above
    expect(r.endedAllIn).toBe(true);
    r = castWind(r.ward, r.stability);
    expect(r.outcome).toBe('wager');
    expect(r.scar).toBe(WARD_TUNING.firstScar + WARD_TUNING.scarGrowth); // later wagers scar more
  });

  it('becomes a calm gust once the Ward is too scarred to wager, with no repeat ban before that', () => {
    let w = freshWard();
    let stability = 100;
    const outcomes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = castWind(w, stability);
      outcomes.push(r.outcome);
      w = r.ward;
      stability = r.stability;
    }
    expect(outcomes.filter((o) => o === 'wager').length).toBe(3); // 100→85→65→40
    expect(w.cap).toBeGreaterThanOrEqual(WARD_TUNING.minCapAfterWager);
    expect(outcomes.at(-1)).toBe('calm');
    expect(canWagerAt(w)).toBe(false);
  });

  it('clamps every heal to the scarred maximum and handles 0/100 boundaries', () => {
    expect(clampHeal(30, 100, 65)).toBe(65);
    expect(clampHeal(0, -5, 65)).toBe(0);
    expect(castWind(freshWard(), 0).outcome).toBe('heal');
    expect(castWind({ cap: 65, wagers: 2, allInTicks: 0 }, 30).stability).toBe(65);
    expect(castWind({ cap: 65, wagers: 2, allInTicks: 0 }, 90).outcome).toBe('wager'); // above the cap counts as at it
  });

  it('never stacks All-In multipliers and expires on time', () => {
    let w = castWind(freshWard(), 100).ward;
    expect(allInMultiplier(w)).toBe(WARD_TUNING.allInMultiplier);
    for (let i = 0; i < WARD_TUNING.allInTicks; i++) w = tickAllIn(w);
    expect(allInMultiplier(w)).toBe(1);
    expect(arcaneScore(50, 3, 1.2, 2)).toBe(360);
  });

  it('Normal clears scars at the next level; Hardcore keeps them; saves restore safely', () => {
    const scarred = { cap: 65, wagers: 2, allInTicks: 100 };
    expect(wardForNextLevel(scarred, false)).toEqual(freshWard());
    expect(wardForNextLevel(scarred, true)).toEqual({ cap: 65, wagers: 2, allInTicks: 0 });
    expect(parseWard(undefined, undefined)).toEqual(freshWard());
    expect(parseWard(250, -3)).toEqual({ cap: 100, wagers: 0, allInTicks: 0 });
    expect(scarFor(0)).toBe(WARD_TUNING.firstScar);
  });
});

describe('Wind in the engine (Arcane preview)', () => {
  it('a wager at full Ward drops to critical without collapsing, and doubles typed scores', () => {
    const e = arcane({ initialSpells: { wind: 1 } });
    fill(e, 2);
    cast(e, 'wind');
    expect(e.wardInfo.stability).toBe(WARD_TUNING.wagerStability);
    expect(e.wardInfo.cap).toBe(85);
    expect(e.status).toBe('playing');
    const w = [...e.state.words].sort((a, b) => b.y - a.y)[0]!;
    expect(capture(e)).toBe(w.text.length * 10 * 1 * 2);
    expect(e.stats().allInWagers).toBe(1);
  });

  it('a Ward breach ends All-In in Normal; a typo ends it only in Hardcore', () => {
    const normal = arcane({ initialSpells: { wind: 1 } });
    fill(normal, 1);
    cast(normal, 'wind');
    type(normal, 'z');
    normal.clearInput();
    expect(normal.wardInfo.allInTicks).toBeGreaterThan(0);
    while (normal.state.missed === 0 && normal.status === 'playing') normal.step();
    expect(normal.wardInfo.allInTicks).toBe(0);

    const hard = arcane({ initialSpells: { wind: 1 }, hardcore: true });
    fill(hard, 1);
    cast(hard, 'wind');
    type(hard, 'z');
    expect(hard.wardInfo.allInTicks).toBe(0);
  });

  it('starts a scarred level at or below its maximum and keeps legacy Wind unchanged', () => {
    expect(arcane({ initialWard: { cap: 60, wagers: 2 } }).wardInfo.stability).toBe(60);
    const legacy = new GameEngine({ config: CONFIG, seed: 7, words: WORDS, initialSpells: { wind: 1 }, initialInstability: 80 });
    cast(legacy, 'wind');
    expect(legacy.state.instability).toBe(30);
    expect(legacy.wardInfo.cap).toBe(100);
  });
});

describe('Harvest, Shock, Ice, Barrier, Alter (Arcane preview)', () => {
  it('Harvest pays full base × Combo × Volley × All-In, consumes Volley and keeps Combo', () => {
    const e = arcane({ initialSpells: { harvest: 1, wind: 1 }, initialCombo: 20 });
    fill(e, 5);
    capture(e);
    capture(e); // two flawless captures ignite Volley ×1.2
    expect(e.volleyMultiplier).toBeCloseTo(1.2);
    cast(e, 'wind'); // All-In ×2
    const base = e.state.words.reduce((sum, w) => sum + w.text.length * 10, 0);
    const combo = e.state.combo;
    const completed = e.state.completed;
    const before = pts(e);
    cast(e, 'harvest');
    expect(pts(e) - before).toBe(Math.round(base * 3 * 1.2 * 2));
    expect(e.state.combo).toBe(combo);
    expect(e.volleyMultiplier).toBe(1);
    expect(e.state.completed).toBe(completed + 3);
    expect(e.stats().allInHarvests).toBe(1);
  });

  it('Shock cashes out base × Combo × All-In without adding Combo', () => {
    const e = arcane({ initialSpells: { shock: 1 }, initialCombo: 10 });
    fill(e, 3);
    const combo = e.state.combo;
    const before = e.state.score;
    cast(e, 'shock');
    expect(e.state.combo).toBe(combo);
    expect(e.state.score - before).toBeGreaterThan(0);
    expect((e.state.score - before) % 2).toBe(0); // ×2 Combo multiplier on whole base points
  });

  it('Ice Frostbound Focus adds +2, +4, +8, +8 and resets when the freeze ends', () => {
    const e = arcane({ initialSpells: { ice: 1 } });
    fill(e, 5);
    cast(e, 'ice');
    const gains: number[] = [];
    for (let i = 0; i < 4; i++) {
      const c = e.state.combo;
      capture(e);
      gains.push(e.state.combo - c);
    }
    expect(gains).toEqual([...ICE_FOCUS_STEPS, ICE_FOCUS_STEPS.at(-1)]);
    while (e.state.freezeTicks > 0) e.step();
    fill(e, 1);
    const c = e.state.combo;
    capture(e);
    expect(e.state.combo - c).toBe(1);
  });

  it('Volley time keeps running during Ice (D-077)', () => {
    const e = arcane({ initialSpells: { ice: 1 } });
    fill(e, 3);
    capture(e);
    cast(e, 'ice');
    const armed = e.volleyArmedProgress;
    for (let i = 0; i < 30; i++) e.step();
    expect(e.volleyArmedProgress).toBeLessThan(armed);
  });

  it('Barrier insures one corrected typo: Combo kept, capture not perfect', () => {
    const e = arcane({ initialSpells: { barrier: 1 }, initialCombo: 15 });
    fill(e, 2);
    cast(e, 'barrier');
    const layers = e.state.barrier;
    correctedCapture(e);
    expect(e.state.barrier).toBe(layers - 1);
    expect(e.state.combo).toBe(15); // kept, but no +1 for a corrected capture
    const bare = arcane({ initialCombo: 15 });
    fill(bare, 2);
    correctedCapture(bare);
    expect(bare.state.combo).toBe(0);
  });

  it('Alter keeps the original word base value', () => {
    const e = arcane({ initialSpells: { alter: 1 } }, { minWordLength: 9, maxWordLength: 10 });
    fill(e, 2);
    cast(e, 'alter');
    const changed = e.state.words.find((w) => w.originalLength !== undefined)!;
    expect(changed.text.length).toBeLessThan(changed.originalLength!);
    const before = pts(e);
    type(e, changed.match);
    e.submit();
    expect(pts(e) - before).toBe(changed.originalLength! * 10);
  });
});

describe('campaign carry of Wind scars', () => {
  const stats = (extra: Partial<GameStats>): GameStats =>
    ({ score: 0, completed: 0, missed: 0, correctChars: 0, errors: 0, accuracy: 1, wpm: 0, maxCombo: 0, endCombo: 0, peakMultiplier: 1, bonusCounts: {}, levelBonuses: [], elapsedMs: 0, averageCompletionMs: 0, ...extra }) as GameStats;

  it('Hardcore keeps the scarred maximum and caps milestone healing; Normal resets', () => {
    const hard = startRun('hardcore', 1);
    hard.level = 5;
    recordLevel(hard, 'won', stats({ wardCap: 65, wardWagers: 2 }), hard.spellCharges, 50);
    expect(hard.wardCap).toBe(65);
    expect(hard.instability).toBe(35); // 50 − 25 heal would be 25, but the Ward cannot exceed 65%
    const normal = startRun('normal', 1);
    recordLevel(normal, 'won', stats({ wardCap: 40, wardWagers: 3 }), normal.spellCharges, 60);
    expect(normal.instability).toBe(0);
    expect(normal.wardCap).toBeUndefined();
  });
});
