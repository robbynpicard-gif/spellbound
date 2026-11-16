import { SPELL_IDS } from '../gameplay/SpellManager';
import coreWords from './words.json';
import referenceWords from './words-references.json';

/**
 * Word pools. Matching is always case-insensitive; words keep their written
 * case only for display (so names show as "Frodo").
 *
 * - words.json: original themed vocabulary (lowercase).
 * - words-references.json: names from fantasy fiction and mythology.
 *   Several are trademarks of their owners (e.g. Tolkien, Harry Potter,
 *   Eragon). Fine for a personal/hobby game; set INCLUDE_REFERENCES to
 *   false before any commercial release (decisions.md D-021).
 *
 * Cast words (the spell ids: slow, ice, barrier, shock, alter, fire, wind,
 * harvest) are reserved: a falling word may not equal a cast word, start
 * with one, or be the start of one, so typing a spell is never ambiguous.
 * The word files are kept clean of these (a test checks); the filter below
 * is a safety net.
 */
export const INCLUDE_REFERENCES = true;

export const CORE_WORDS: readonly string[] = coreWords;
export const REFERENCE_WORDS: readonly string[] = referenceWords;

/** True if `word` clashes with a cast word (equal to one, starts with one, or is the start of one). */
export function clashesWithCastWord(word: string): boolean {
  const w = word.toLowerCase();
  return SPELL_IDS.some((cast) => w.startsWith(cast) || cast.startsWith(w));
}

export const WORDS: readonly string[] = (INCLUDE_REFERENCES ? [...CORE_WORDS, ...REFERENCE_WORDS] : CORE_WORDS).filter(
  (w) => !clashesWithCastWord(w),
);
