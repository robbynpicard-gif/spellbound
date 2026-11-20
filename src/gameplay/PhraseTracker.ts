import { classifyWord, type WordClass } from './WordClasses';

/** Cosmetic Wordcraft patterns across consecutive classified captures. */
export const PHRASE_PATTERNS = [
  { id: 'awakening', title: 'The Awakening', glyph: '⚔', first: 'noun', second: 'verb' },
  { id: 'illumination', title: 'The Illuminated Phrase', glyph: '✧', first: 'adjective', second: 'noun' },
  { id: 'incantation', title: 'The Precise Incantation', glyph: '✦', first: 'adverb', second: 'verb' },
] as const;
export type PhraseId = typeof PHRASE_PATTERNS[number]['id'];
export type PhraseCounts = Record<PhraseId, number>;
export const emptyPhraseCounts = (): PhraseCounts => ({ awakening: 0, illumination: 0, incantation: 0 });

/** A miss, unclassified word, or pause between sessions breaks the pattern.
 * Returns at most one pattern, and never alters the game's score. */
export class PhraseTracker {
  private previous: WordClass | null = null;
  readonly counts: PhraseCounts = emptyPhraseCounts();

  capture(word: string): typeof PHRASE_PATTERNS[number] | null {
    const current = classifyWord(word);
    const found = current && this.previous
      ? PHRASE_PATTERNS.find((p) => p.first === this.previous && p.second === current) ?? null
      : null;
    this.previous = current;
    if (found) this.counts[found.id]++;
    return found;
  }

  breakChain(): void { this.previous = null; }
}
