import { describe, expect, it } from 'vitest';
import { PhraseTracker } from './PhraseTracker';

describe('cosmetic grammatical phrase tracking', () => {
  it('recognizes ordered consecutive captures only', () => {
    const t = new PhraseTracker();
    expect(t.capture('dragon')).toBeNull();
    expect(t.capture('conjure')?.id).toBe('awakening');
    expect(t.capture('ancient')).toBeNull();
    expect(t.capture('wizard')?.id).toBe('illumination');
    expect(t.counts).toEqual({ awakening: 1, illumination: 1, incantation: 0 });
  });

  it('recognizes adverb then verb', () => {
    const t = new PhraseTracker();
    t.capture('quickly');
    expect(t.capture('summon')?.id).toBe('incantation');
  });

  it('breaks on unknown words and missed words', () => {
    const t = new PhraseTracker();
    t.capture('ancient');
    t.capture('scroll'); // ambiguous noun/verb, intentionally not classified
    expect(t.capture('wizard')).toBeNull();
    t.capture('ancient');
    t.breakChain();
    expect(t.capture('dragon')).toBeNull();
    expect(t.counts.illumination).toBe(0);
  });

  it('does not award phrases for incomplete or unrelated captures merely to raise reward frequency', () => {
    const t = new PhraseTracker();
    for (let i = 0; i < 50; i++) {
      expect(t.capture('dragon')).toBeNull();
      t.breakChain();
    }
    expect(t.counts).toEqual({ awakening: 0, illumination: 0, incantation: 0 });
    expect(t.capture('dragon')).toBeNull();
    expect(t.capture('conjure')?.id).toBe('awakening');
    expect(t.counts.awakening).toBe(1);
  });

  it('never carries sequences across sessions', () => {
    const first = new PhraseTracker();
    first.capture('dragon');
    const second = new PhraseTracker();
    expect(second.capture('conjure')).toBeNull();
  });
});
