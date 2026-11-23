/**
 * TypeL Rune catalogue (prototype, D-085). Runes recognize moment-to-moment
 * feats that a player can learn to reproduce. They never alter word
 * generation (D-058). Names, thresholds and point values are PROVISIONAL.
 *
 * Spell Runes are "rune sequences": a cast opens its own opportunity window;
 * only what the player types inside that window can earn the Rune. Casting
 * alone never awards anything.
 */
import type { SpellId } from '../SpellManager';

/**
 * Participation Runes (2026-11-19 Rune design, Rounds 2–3): comedic mishaps,
 * collectible only, always worth zero points so failure is never farmed.
 */
export type RuneCategory = 'typing' | 'wordplay' | 'spellcraft' | 'participation';

export interface RuneDef {
  id: string;
  name: string;
  family: string;
  category: RuneCategory;
  /** Small fixed points, never multiplied (provisional). */
  points: number;
  /** Exact trigger, shown in the Codex (D-063: rules are inspectable). */
  how: string;
  spell?: SpellId;
  /** Higher tiers of the same family are rarer. */
  tier: 1 | 2 | 3;
  /** Emblem struck on the medal (D-089: every Rune has its own look). */
  glyph: string;
  /** Awarded by the mode (e.g. a whole apprenticeship), not inside a level. */
  modeAwarded?: boolean;
}

const r = (d: RuneDef) => d;

export const RUNES: readonly RuneDef[] = [
  // ── Typing mastery ──
  r({ id: 'quill-10', name: 'Steady Quill', family: 'Quill', category: 'typing', points: 50, tier: 1, how: '10 perfect captures in a row.' , glyph: '✒' }),
  r({ id: 'quill-25', name: 'Golden Quill', family: 'Quill', category: 'typing', points: 150, tier: 2, how: '25 perfect captures in a row.' , glyph: '✍' }),
  r({ id: 'quill-50', name: 'Unblotted Hand', family: 'Quill', category: 'typing', points: 400, tier: 3, how: '50 perfect captures in a row.' , glyph: '☙' }),
  r({ id: 'first-light', name: 'First Light', family: 'Timing', category: 'typing', points: 50, tier: 1, how: 'Capture a word while it is still in the top tenth of the field.' , glyph: '☀' }),
  r({ id: 'by-a-thread', name: 'By a Thread', family: 'Timing', category: 'typing', points: 100, tier: 2, how: 'Perfectly capture a word in the last twentieth before the Ward.' , glyph: '⚖' }),
  r({ id: 'tome-reader', name: 'Tome Reader', family: 'Timing', category: 'typing', points: 75, tier: 1, how: 'Perfectly capture a word of 10 or more letters.' , glyph: '❡' }),
  r({ id: 'clean-desk', name: 'Clean Desk', family: 'Timing', category: 'typing', points: 150, tier: 2, how: 'Empty the whole field by typing, after 5 captures within 5 seconds.' , glyph: '✧' }),
  r({ id: 'saving-grace', name: 'Saving Grace', family: 'Catch', category: 'typing', points: 75, tier: 1, how: 'Catch a word that is plunging after a mistype.' , glyph: '⚓' }),
  r({ id: 'daring-rescue', name: 'Daring Rescue', family: 'Catch', category: 'typing', points: 200, tier: 2, how: 'Catch a word in a desperate (fastest) plunge.' , glyph: '⚔' }),
  // ── Wordplay (observed from real captures; spawning is never biased) ──
  r({ id: 'noun-2', name: 'Double Noun', family: 'Nouns', category: 'wordplay', points: 25, tier: 1, how: 'Capture 2 nouns in a row.' , glyph: 'Ⅱ' }),
  r({ id: 'noun-3', name: 'Triple Noun', family: 'Nouns', category: 'wordplay', points: 75, tier: 2, how: 'Capture 3 nouns in a row.' , glyph: 'Ⅲ' }),
  r({ id: 'noun-5', name: 'Nountacular', family: 'Nouns', category: 'wordplay', points: 250, tier: 3, how: 'Capture 5 nouns in a row.' , glyph: 'Ⅴ' }),
  r({ id: 'alliterator', name: 'Alliterator', family: 'Letters', category: 'wordplay', points: 75, tier: 1, how: 'Capture 3 words in a row that start with the same letter.' , glyph: 'ℵ' }),
  r({ id: 'alphabetist', name: 'Alphabetist', family: 'Letters', category: 'wordplay', points: 100, tier: 2, how: 'Capture 4 words in a row in alphabetical order.' , glyph: 'Ω' }),
  // ── Spellcraft rune sequences ──
  r({ id: 'borrowed-time', name: 'Borrowed Time', family: 'Slow', spell: 'slow', category: 'spellcraft', points: 150, tier: 2, how: 'During one Slow, raise Arcane Rush to ×2 or more.' , glyph: '⧗' }),
  r({ id: 'frost-3', name: 'Frostscribe', family: 'Ice', spell: 'ice', category: 'spellcraft', points: 50, tier: 1, how: '3 perfect captures during one freeze.' , glyph: '❄' }),
  r({ id: 'frost-5', name: 'Frostweaver', family: 'Ice', spell: 'ice', category: 'spellcraft', points: 150, tier: 2, how: '5 perfect captures during one freeze.' , glyph: '❅' }),
  r({ id: 'frost-8', name: 'Frostmaster', family: 'Ice', spell: 'ice', category: 'spellcraft', points: 400, tier: 3, how: '8 perfect captures during one freeze.' , glyph: '❆' }),
  r({ id: 'phoenix-ash', name: 'Phoenix Ash', family: 'Fire', spell: 'fire', category: 'spellcraft', points: 100, tier: 1, how: 'Within 4 seconds of a Fire, capture 3 of the words it spared.' , glyph: '♨' }),
  r({ id: 'pyre', name: 'Pyre', family: 'Fire', spell: 'fire', category: 'spellcraft', points: 150, tier: 2, how: 'One Fire spreads through 3 generations of words.' , glyph: '☄' }),
  r({ id: 'unbroken', name: 'Unbroken', family: 'Barrier', spell: 'barrier', category: 'spellcraft', points: 150, tier: 2, how: 'A Barrier layer saves a Combo of 20 or more from a slip.' , glyph: '⛨' }),
  r({ id: 'chain-5', name: 'Chain Reaction', family: 'Shock', spell: 'shock', category: 'spellcraft', points: 150, tier: 2, how: 'One Shock strikes 5 or more words.' , glyph: 'ϟ' }),
  r({ id: 'chain-8', name: 'Storm Caller', family: 'Shock', spell: 'shock', category: 'spellcraft', points: 400, tier: 3, how: 'One Shock strikes 8 or more words.' , glyph: '☈' }),
  r({ id: 'adaptation', name: 'Adaptation', family: 'Alter', spell: 'alter', category: 'spellcraft', points: 150, tier: 2, how: 'During one Alter, perfectly capture 4 words it changed.' , glyph: '✎' }),
  r({ id: 'final-wager', name: 'Final Wager', family: 'Wind', spell: 'wind', category: 'spellcraft', points: 250, tier: 2, how: 'Score 1,000 points inside one All-In.' , glyph: '⚜' }),
  r({ id: 'thrice-scarred', name: 'Thrice Scarred', family: 'Wind', spell: 'wind', category: 'spellcraft', points: 250, tier: 3, how: 'Go All-In a third time while carrying two scars.' , glyph: '✠' }),
  r({ id: 'reap', name: 'Reap What You Sow', family: 'Harvest', spell: 'harvest', category: 'spellcraft', points: 400, tier: 3, how: 'Harvest during All-In with an Arcane Rush of ×2 or more.' , glyph: '❦' }),
  // ── Flawless (2026-11-19 Round 2): zero typing mistakes, zero scrolls reaching the Ward, zero damage ──
  r({ id: 'flawless', name: 'Flawless', family: 'Flawless', category: 'typing', points: 300, tier: 3, glyph: '✪', how: 'Clear a level with no typing mistakes and no scroll reaching the Ward.' }),
  r({ id: 'flawless-perfection', name: 'Flawless Perfection', family: 'Flawless', category: 'typing', points: 0, tier: 3, glyph: '✺', modeAwarded: true, how: 'Complete a whole apprenticeship with every level Flawless.' }),
  // ── Participation (zero points; tiered by the streak you ruined) ──
  r({ id: 'fumble-10', name: 'Butterfingers', family: 'Fumble', category: 'participation', points: 0, tier: 1, glyph: '☂', how: 'Ruin a streak of 10+ perfect captures.' }),
  r({ id: 'fumble-25', name: 'Spectacular Fumble', family: 'Fumble', category: 'participation', points: 0, tier: 2, glyph: '☠', how: 'Ruin a streak of 25+ perfect captures.' }),
  r({ id: 'fumble-50', name: 'Generational Fumble', family: 'Fumble', category: 'participation', points: 0, tier: 3, glyph: '♛', how: 'Ruin a streak of 50+ perfect captures.' }),
];

export const RUNE_BY_ID: ReadonlyMap<string, RuneDef> = new Map(RUNES.map((d) => [d.id, d]));
