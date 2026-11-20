import { describe, expect, it } from 'vitest';
import { classifyWord, emptyWordClassCounts } from './WordClasses';
import { WORDS } from '../data/wordList';

describe('curated word-class recognition', () => {
  it('recognizes four parts of speech without guessing suffixes', () => {
    expect(classifyWord('Dragon')).toBe('noun');
    expect(classifyWord('  conjure  ')).toBe('verb');
    expect(classifyWord('ancient')).toBe('adjective');
    expect(classifyWord('quickly')).toBe('adverb');
    expect(classifyWord('mysteryword')).toBeNull();
    expect(classifyWord('scroll')).toBeNull(); // noun or verb in context
  });

  it('only classifies words that actually exist in the shipped dictionary', () => {
    const bank = new Set(WORDS.map((word) => word.toLowerCase()));
    for (const word of ['dragon', 'conjure', 'ancient', 'quickly']) expect(bank.has(word)).toBe(true);
  });

  it('starts a fresh session counter without sharing mutable state', () => {
    const first = emptyWordClassCounts();
    first.noun++;
    expect(emptyWordClassCounts()).toEqual({ noun: 0, verb: 0, adjective: 0, adverb: 0 });
  });
});
