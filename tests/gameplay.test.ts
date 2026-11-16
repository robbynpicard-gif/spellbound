import { describe, expect, it } from 'vitest';
import { SeededRandom } from '../src/core/Random';
import { CORE_WORDS, REFERENCE_WORDS, WORDS } from '../src/data/wordList';
import { editDistance, guessIntendedWord } from '../src/gameplay/TargetManager';
import type { WordState } from '../src/gameplay/Word';
import { instabilityStage, InstabilityManager } from '../src/gameplay/InstabilityManager';
import { accuracyOf, wordPoints, wpmOf } from '../src/gameplay/ScoringSystem';
import { WordGenerator } from '../src/gameplay/WordGenerator';
import { CAMPAIGN_LEVELS } from '../src/difficulty/LevelDefinitions';

const PROTOTYPE_LEVEL = CAMPAIGN_LEVELS.get(3); // lengths 3–7

describe('word lists', () => {
  it('core words: lowercase a–z, 3–12 letters, no duplicates', () => {
    expect(CORE_WORDS.length).toBeGreaterThan(800);
    for (const w of CORE_WORDS) expect(w).toMatch(/^[a-z]{3,12}$/);
    expect(new Set(CORE_WORDS).size).toBe(CORE_WORDS.length);
  });

  it('reference words: letters only (capitals allowed), 3–12 letters', () => {
    expect(REFERENCE_WORDS.length).toBeGreaterThan(100);
    for (const w of REFERENCE_WORDS) expect(w).toMatch(/^[A-Za-z]{3,12}$/);
    expect(REFERENCE_WORDS).toEqual(expect.arrayContaining(['Frodo', 'Eragon']));
  });

  it('no duplicates across lists, ignoring case', () => {
    const lower = WORDS.map((w) => w.toLowerCase());
    expect(new Set(lower).size).toBe(WORDS.length);
  });

  it('never contains a spell incantation', () => {
    const lower = new Set(WORDS.map((w) => w.toLowerCase()));
    for (const spell of ['fire', 'ice', 'slow', 'wind']) expect(lower.has(spell)).toBe(false);
  });
});

describe('guessing the intended word on Enter', () => {
  const word = (id: number, text: string, y = 0) => ({ id, text, match: text.toLowerCase(), y }) as WordState;
  const field = [word(1, 'dragon', 100), word(2, 'drake', 200), word(3, 'Gandalf', 50)];

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
    expect(guessIntendedWord(field, 'gandlf')!.id).toBe(3);
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
