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
 * The spell incantations (fire, ice, slow, wind) are reserved and never
 * appear as falling words.
 */
export const INCLUDE_REFERENCES = true;

export const CORE_WORDS: readonly string[] = coreWords;
export const REFERENCE_WORDS: readonly string[] = referenceWords;

export const WORDS: readonly string[] = INCLUDE_REFERENCES ? [...CORE_WORDS, ...REFERENCE_WORDS] : CORE_WORDS;
