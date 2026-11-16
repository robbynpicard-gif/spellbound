import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/Random';
import { WORDS } from '../src/data/wordList';
import { instabilityStage, InstabilityManager } from '../src/gameplay/InstabilityManager';
import { accuracyOf, wordPoints, wpmOf } from '../src/gameplay/ScoringSystem';
import { WordGenerator } from '../src/gameplay/WordGenerator';
import { PROTOTYPE_LEVEL } from '../src/difficulty/LevelDefinitions';

describe('word list', () => {
  it('contains only lowercase a–z words of 3–12 letters, without duplicates', () => {
    expect(WORDS.length).toBeGreaterThan(300);
    for (const w of WORDS) expect(w).toMatch(/^[a-z]{3,12}$/);
    expect(new Set(WORDS).size).toBe(WORDS.length);
  });
});

describe('WordGenerator', () => {
  it('only produces words within the level length range', () => {
    const gen = new WordGenerator(WORDS, PROTOTYPE_LEVEL, new SeededRandom(5));
    for (let i = 0; i < 500; i++) {
      const w = gen.next([]);
      expect(w.length).toBeGreaterThanOrEqual(PROTOTYPE_LEVEL.minWordLength);
      expect(w.length).toBeLessThanOrEqual(PROTOTYPE_LEVEL.maxWordLength);
    }
  });

  it('avoids duplicate text and shared first letters when possible', () => {
    const gen = new WordGenerator(WORDS, PROTOTYPE_LEVEL, new SeededRandom(9));
    const active: { text: string }[] = [];
    for (let i = 0; i < 6; i++) active.push({ text: gen.next(active) });
    expect(new Set(active.map((w) => w.text)).size).toBe(6);
    expect(new Set(active.map((w) => w.text[0])).size).toBe(6);
  });

  it('respects length weights (zero weight never appears)', () => {
    const gen = new WordGenerator(
      WORDS,
      { minWordLength: 3, maxWordLength: 6, wordLengthWeights: { 3: 1, 6: 1 } },
      new SeededRandom(3),
    );
    for (let i = 0; i < 300; i++) expect([3, 6]).toContain(gen.next([]).length);
  });

  it('throws when no words fit the range', () => {
    expect(
      () => new WordGenerator(['owl'], { minWordLength: 5, maxWordLength: 6 }, new SeededRandom(1)),
    ).toThrow();
  });
});

describe('scoring', () => {
  it('rewards length and caps the combo bonus at double', () => {
    expect(wordPoints(5, 1)).toBe(50);
    expect(wordPoints(5, 2)).toBe(53); // +5%
    expect(wordPoints(5, 21)).toBe(100);
    expect(wordPoints(5, 999)).toBe(100);
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
