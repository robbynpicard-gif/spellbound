import { describe, expect, it } from 'vitest';
import { WORDS } from '../data/wordList';
import { auditWordcraftDictionary } from './WordcraftAudit';

describe('Wordcraft dictionary audit', () => {
  it('reports conservative category coverage of the shipped playable dictionary', () => {
    const audit = auditWordcraftDictionary(WORDS);
    expect(audit.total).toBe(WORDS.length);
    expect(audit.classified).toBe(Object.values(audit.counts).reduce((a, b) => a + b, 0));
    expect(audit.coverage).toBeGreaterThan(0);
    expect(audit.coverage).toBeLessThan(1);
    expect(audit.counts.noun).toBeGreaterThan(20);
  });

  it('reports zero rates for empty and unclassified dictionaries', () => {
    const empty = auditWordcraftDictionary([]);
    expect(empty.coverage).toBe(0);
    expect(empty.expectedPatternsPer100Pairs).toEqual({ awakening: 0, illumination: 0, incantation: 0 });
    const unknown = auditWordcraftDictionary(['xyzzy', 'xyzzy']);
    expect(unknown.total).toBe(1);
    expect(unknown.classified).toBe(0);
  });

  it('estimates ordered pair frequencies without modifying the dictionary', () => {
    const words = ['dragon', 'conjure', 'ancient', 'quickly'];
    const audit = auditWordcraftDictionary(words);
    expect(audit.expectedPatternsPer100Pairs).toEqual({ awakening: 6.25, illumination: 6.25, incantation: 6.25 });
    expect(words).toEqual(['dragon', 'conjure', 'ancient', 'quickly']);
  });
});
