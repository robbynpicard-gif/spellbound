import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/Random';
import { ALL_WORDS, WORDS } from '../src/data/wordList';
import { editDistance, guessIntendedWord } from '../src/gameplay/TargetManager';
import type { WordState } from '../src/gameplay/Word';
import { instabilityStage, InstabilityManager } from '../src/gameplay/InstabilityManager';
import { accuracyOf, comboAfterWrongEntry, multiplierOf, scoreWord, wordPoints, wpmOf } from '../src/gameplay/ScoringSystem';
import { WordGenerator } from '../src/gameplay/WordGenerator';
import { CAMPAIGN_LEVELS } from '../src/difficulty/LevelDefinitions';

const PROTOTYPE_LEVEL = CAMPAIGN_LEVELS.get(3); // lengths 3–7

describe('word list', () => {
  it('one dictionary: letters only (capitals only for legend names), 2–12 letters, no duplicates', () => {
    expect(ALL_WORDS.length).toBeGreaterThan(6000);
    for (const w of ALL_WORDS) expect(w).toMatch(/^([a-z]{2,12}|[A-Z][a-z]{2,11})$/);
    expect(new Set(ALL_WORDS.map((w) => w.toLowerCase())).size).toBe(ALL_WORDS.length);
    expect(WORDS).toEqual([...ALL_WORDS]);
  });

  it('has no names from modern fiction', () => {
    const all = new Set(ALL_WORDS.map((w) => w.toLowerCase()));
    for (const name of ['frodo', 'gandalf', 'hogwarts', 'eragon', 'narnia', 'geralt', 'mithril', 'dementor', 'quidditch'])
      expect(all.has(name), name).toBe(false);
  });

  it('has plenty of words for every level', () => {
    for (const l of CAMPAIGN_LEVELS.all) {
      const fits = WORDS.filter((w) => w.length >= l.minWordLength && w.length <= l.maxWordLength);
      expect(fits.length, `level ${l.level}`).toBeGreaterThanOrEqual(450);
    }
  });

  it('never contains a spell incantation', () => {
    const lower = new Set(WORDS.map((w) => w.toLowerCase()));
    for (const spell of ['fire', 'ice', 'slow', 'wind', 'barrier', 'shock', 'alter', 'harvest']) expect(lower.has(spell)).toBe(false);
  });
});

describe('guessing the intended word on Enter', () => {
  const word = (id: number, text: string, y = 0) => ({ id, text, match: text.toLowerCase(), y }) as WordState;
  const field = [word(1, 'dragon', 100), word(2, 'drake', 200), word(3, 'Lancelot', 50)];

  it('edit distance basics', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3);
    expect(editDistance('', 'abc')).toBe(3);
  });

  it('prefers an exact prefix, then the more urgent word', () => {
    expect(guessIntendedWord(field, 'drag')!.id).toBe(1);
    expect(guessIntendedWord(field, 'dra')!.id).toBe(2); // both match; drake is lower
  });

  it('forgives typos', () => {
    expect(guessIntendedWord(field, 'dargon')!.id).toBe(1);
    expect(guessIntendedWord(field, 'lancelt')!.id).toBe(3);
  });

  it('refuses to guess for unrelated text', () => {
    expect(guessIntendedWord(field, 'qqqq')).toBeNull();
    expect(guessIntendedWord(field, '')).toBeNull();
  });
});

describe('WordGenerator', () => {
  it('only produces words within the level length range', () => {
    const gen = new WordGenerator(WORDS, PROTOTYPE_LEVEL, new SeededRandom(5));
    for (let i = 0; i < 500; i++) {
      const w = gen.next();
      expect(w.length).toBeGreaterThanOrEqual(PROTOTYPE_LEVEL.minWordLength);
      expect(w.length).toBeLessThanOrEqual(PROTOTYPE_LEVEL.maxWordLength);
    }
  });

  it('consecutive words (one field-full) avoid duplicate text and shared first letters', () => {
    // With up to ~8 words on screen there are enough first letters to keep them all
    // different; busier levels fall back to sharing a letter when they must.
    const level = { ...PROTOTYPE_LEVEL, maxActiveWords: 8 };
    const window = level.maxActiveWords; // window of previous words + the new one
    for (const seed of [9, 10, 11, 12]) {
      const gen = new WordGenerator(WORDS, level, new SeededRandom(seed));
      const seq = Array.from({ length: 60 }, () => gen.next().toLowerCase());
      for (let i = 0; i + window <= seq.length; i++) {
        const group = seq.slice(i, i + window);
        expect(new Set(group).size).toBe(window);
        expect(new Set(group.map((w) => w[0])).size).toBe(window);
      }
    }
  });

  it('the sequence depends only on the seed (same for every player)', () => {
    const a = new WordGenerator(WORDS, PROTOTYPE_LEVEL, new SeededRandom(42));
    const b = new WordGenerator(WORDS, PROTOTYPE_LEVEL, new SeededRandom(42));
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('respects length weights (zero weight never appears)', () => {
    const gen = new WordGenerator(
      WORDS,
      { minWordLength: 3, maxWordLength: 6, wordLengthWeights: { 3: 1, 6: 1 } },
      new SeededRandom(3),
    );
    for (let i = 0; i < 300; i++) expect([3, 6]).toContain(gen.next().length);
  });

  it('throws when no words fit the range', () => {
    expect(
      () => new WordGenerator(['owl'], { minWordLength: 5, maxWordLength: 6 }, new SeededRandom(1)),
    ).toThrow();
  });
});

describe('scoring', () => {
  it('multiplier tiers: ×1, ×2 at 5, ×3 at 12, ×5 at 25, ×10 at 45', () => {
    expect([0, 4, 5, 11, 12, 24, 25, 44, 45, 999].map(multiplierOf)).toEqual([1, 1, 2, 2, 3, 3, 5, 5, 10, 10]);
    expect(wordPoints(5, 1)).toBe(50);
    expect(wordPoints(5, 30)).toBe(250);
  });

  it('a wrong entry drops to the start of the tier below', () => {
    expect(comboAfterWrongEntry(3)).toBe(0);
    expect(comboAfterWrongEntry(9)).toBe(0);
    expect(comboAfterWrongEntry(14)).toBe(5);
    expect(comboAfterWrongEntry(60)).toBe(25);
  });

  it('bonus rates add to the base, flat bonuses are multiplied too', () => {
    expect(scoreWord(5, 1, [])).toBe(50);
    expect(scoreWord(5, 2, [{ id: 'perfect', rate: 0.25, count: 1, points: 0 }])).toBe(125);
    expect(scoreWord(5, 3, [{ id: 'sweep', rate: 0, count: 4, points: 100 }])).toBe(450);
  });

  it('computes accuracy and WPM', () => {
    expect(accuracyOf(0, 0)).toBe(1);
    expect(accuracyOf(90, 10)).toBeCloseTo(0.9);
    expect(wpmOf(300, 60_000)).toBe(60);
    expect(wpmOf(10, 0)).toBe(0);
  });
});

describe('instability', () => {
  it('maps values to the GDD visual stages', () => {
    expect([0, 24, 25, 49, 50, 74, 75, 99, 100].map(instabilityStage)).toEqual([
      0, 0, 1, 1, 2, 2, 3, 3, 4,
    ]);
  });

  it('clamps between 0 and 100', () => {
    const m = new InstabilityManager();
    m.add(150);
    expect(m.value).toBe(100);
    expect(m.collapsed).toBe(true);
    m.add(-500);
    expect(m.value).toBe(0);
  });
});
