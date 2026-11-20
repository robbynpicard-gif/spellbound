import { classifyWord, WORD_CLASSES, type WordClass } from './WordClasses';
import { PHRASE_PATTERNS, type PhraseId } from './PhraseTracker';

/** Dictionary-level estimate, not a claim about live spawn rates.
 * Assumes independent uniformly sampled words; gameplay weights and capture
 * skill may produce different frequencies. Never changes word selection. */
export interface WordcraftAudit {
  total: number;
  classified: number;
  counts: Record<WordClass, number>;
  coverage: number;
  expectedPatternsPer100Pairs: Record<PhraseId, number>;
}

export function auditWordcraftDictionary(words: readonly string[]): WordcraftAudit {
  const counts = { noun: 0, verb: 0, adjective: 0, adverb: 0 };
  const seen = new Set<string>();
  for (const word of words) {
    const normalized = word.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    const part = classifyWord(normalized);
    if (part) counts[part]++;
  }
  const total = seen.size;
  const classified = WORD_CLASSES.reduce((sum, part) => sum + counts[part], 0);
  const expectedPatternsPer100Pairs = { awakening: 0, illumination: 0, incantation: 0 };
  for (const pattern of PHRASE_PATTERNS) {
    expectedPatternsPer100Pairs[pattern.id] = total
      ? Math.round((10000 * counts[pattern.first] * counts[pattern.second]) / (total * total)) / 100
      : 0;
  }
  return { total, classified, counts, coverage: total ? classified / total : 0, expectedPatternsPer100Pairs };
}
