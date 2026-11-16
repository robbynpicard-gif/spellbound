import { SPELL_IDS } from '../gameplay/SpellManager';
import fantasyWords from './words-fantasy.json';
import modernWords from './words-modern.json';

/**
 * Word banks (decisions.md D-027). Matching is always case-insensitive;
 * words keep their written case only for display (so names show as "Merlin").
 *
 * - words-fantasy.json: medieval life, wizardry, magic and alchemy, plus
 *   names from public-domain myth, folklore, Arthurian legend and
 *   Shakespeare. No names from modern books, films or games.
 * - words-modern.json: everyday modern words (home, school, food, sport…).
 *   No brand names.
 *
 * The player picks which banks to use in Options (at least one is always on).
 *
 * Cast words (the spell ids: slow, ice, barrier, shock, alter, fire, wind,
 * harvest) are reserved: a falling word may not equal a cast word, start
 * with one, or be the start of one, so typing a spell is never ambiguous.
 * The word files are kept clean of these (a test checks); the filter below
 * is a safety net.
 */
export type WordBank = 'fantasy' | 'modern';
export const WORD_BANKS: readonly WordBank[] = ['fantasy', 'modern'];
export type WordBankSettings = Record<WordBank, boolean>;

/** Fantasy only: the game's theme, and what Wizard Duels always use (both players must share a list). */
export const DEFAULT_WORD_BANKS: Readonly<WordBankSettings> = { fantasy: true, modern: false };

export const FANTASY_WORDS: readonly string[] = fantasyWords;
export const MODERN_WORDS: readonly string[] = modernWords;

const BANK_WORDS: Record<WordBank, readonly string[]> = { fantasy: FANTASY_WORDS, modern: MODERN_WORDS };

/** True if `word` clashes with a cast word (equal to one, starts with one, or is the start of one). */
export function clashesWithCastWord(word: string): boolean {
  const w = word.toLowerCase();
  return SPELL_IDS.some((cast) => w.startsWith(cast) || cast.startsWith(w));
}

/** Makes sure at least one bank is on (falls back to the default). */
export function normalizeWordBanks(settings?: Partial<Record<string, unknown>> | null): WordBankSettings {
  const result = { ...DEFAULT_WORD_BANKS };
  for (const bank of WORD_BANKS) {
    const value = settings?.[bank];
    if (typeof value === 'boolean') result[bank] = value;
  }
  return WORD_BANKS.some((b) => result[b]) ? result : { ...DEFAULT_WORD_BANKS };
}

/** The words to play with for these settings: the chosen banks combined, without duplicates or clashes. */
export function wordPool(settings?: Partial<WordBankSettings> | null): string[] {
  const banks = normalizeWordBanks(settings);
  const seen = new Set<string>();
  const pool: string[] = [];
  for (const bank of WORD_BANKS) {
    if (!banks[bank]) continue;
    for (const word of BANK_WORDS[bank]) {
      const lower = word.toLowerCase();
      if (seen.has(lower) || clashesWithCastWord(lower)) continue;
      seen.add(lower);
      pool.push(word);
    }
  }
  return pool;
}

/** The default pool (fantasy). Used by Wizard Duels and the server so both players share one list. */
export const WORDS: readonly string[] = wordPool(DEFAULT_WORD_BANKS);
