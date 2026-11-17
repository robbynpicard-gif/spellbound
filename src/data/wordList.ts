import { SPELL_IDS } from '../gameplay/SpellManager';
import allWords from './words.json';

/**
 * The dictionary (decisions.md D-036): one combined list of medieval,
 * magical and everyday words, plus names from public-domain myth, folklore,
 * Arthurian legend and Shakespeare. No brand names and no names from modern
 * books, films or games. Matching is always case-insensitive; words keep
 * their written case only for display (so names show as "Merlin").
 *
 * Cast words (the spell ids: slow, ice, barrier, shock, alter, fire, wind,
 * harvest) are reserved: a falling word may not equal a cast word, start
 * with one, or be the start of one, so typing a spell is never ambiguous.
 * The word file is kept clean of these (a test checks); the filter below
 * is a safety net.
 */
export const ALL_WORDS: readonly string[] = allWords;

/** True if `word` clashes with a cast word (equal to one, starts with one, or is the start of one). */
export function clashesWithCastWord(word: string): boolean {
  const w = word.toLowerCase();
  return SPELL_IDS.some((cast) => w.startsWith(cast) || cast.startsWith(w));
}

function buildPool(): string[] {
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const word of ALL_WORDS) {
    const lower = word.toLowerCase();
    if (seen.has(lower) || clashesWithCastWord(lower)) continue;
    seen.add(lower);
    pool.push(word);
  }
  return pool;
}

/** Every word that can fall, in every mode (Wizard Duels and the server share it). */
export const WORDS: readonly string[] = buildPool();
