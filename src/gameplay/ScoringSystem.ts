/**
 * Scoring (decisions.md D-040). A word is worth 10 points per letter, plus
 * bonuses, times the combo multiplier. The multiplier climbs in tiers as clean
 * words chain together:
 *   ×1 → ×2 at 5 words → ×3 at 12 → ×5 at 25 → ×10 at 45.
 * Mistakes cost different amounts:
 *   - a typo fixed before Enter: the combo continues (the word just isn't "Perfect");
 *   - Enter on a wrong or misspelled word: down one tier;
 *   - a word breaking through the ward: the combo resets.
 */
export const SCORING = {
  pointsPerLetter: 10,
} as const;

export const TIERS = [
  { at: 0, mult: 1 },
  { at: 5, mult: 2 },
  { at: 12, mult: 3 },
  { at: 25, mult: 5 },
  { at: 45, mult: 10 },
] as const;

/** Tier index (0–4) for a combo count. */
export function tierOf(combo: number): number {
  let t = 0;
  for (let i = 0; i < TIERS.length; i++) if (combo >= TIERS[i]!.at) t = i;
  return t;
}

export function multiplierOf(combo: number): number {
  return TIERS[tierOf(combo)]!.mult;
}

/** The combo after a wrong entry: the start of the tier below (0 from the first tier). */
export function comboAfterWrongEntry(combo: number): number {
  const t = tierOf(combo);
  return t === 0 ? 0 : TIERS[t - 1]!.at;
}

/** Points for a `length`-letter word at `combo`, before bonuses. */
export function wordPoints(length: number, combo: number): number {
  return length * SCORING.pointsPerLetter * multiplierOf(combo);
}

export type BonusId =
  | 'perfect'
  | 'quick'
  | 'clutch'
  | 'arcane'
  | 'long'
  | 'name'
  | 'volley'
  | 'alliteration'
  | 'librarian'
  | 'metronome'
  | 'sweep'
  | 'flawless'
  | 'underPar'
  | 'comeback';

export const BONUS_IDS: readonly BonusId[] = [
  'perfect', 'quick', 'clutch', 'arcane', 'long', 'name', 'volley', 'alliteration', 'librarian', 'metronome', 'sweep',
  'flawless', 'underPar', 'comeback',
];

/** A bonus earned on a word (`rate` is a fraction of the base) or at the end of a level (`points`). */
export interface Bonus {
  id: BonusId;
  /** Chain length for chained bonuses (Volley, Alliteration, Librarian); 1 otherwise. */
  count: number;
  rate: number;
  points: number;
}

export const BONUS_RATES = {
  perfect: 0.25,
  quick: 0.2,
  clutch: 0.5,
  /** Per point of word complexity (rare letters, consonant clusters). */
  arcanePerPoint: 0.15,
  arcaneMax: 0.6,
  long: 0.2,
  /** Long means at least this many letters. */
  longFrom: 9,
  name: 0.3,
  volleyPer: 0.1,
  volleyMax: 0.5,
  alliterationPer: 0.15,
  alliterationMax: 0.6,
  librarianPer: 0.1,
  librarianMax: 0.5,
  metronome: 0.15,
  /** Clean Sweep: flat points (× multiplier) for emptying the screen after 3+ captures. */
  sweepPoints: 100,
  /** End-of-level bonuses, as fractions of the points scored in the level. */
  flawless: 0.25,
  underPar: 0.15,
  comeback: 0.2,
} as const;

/** Quick: captured in the top part of the field; Clutch: in the last part, just before the ward. */
export const QUICK_ZONE = 0.3;
export const CLUTCH_ZONE = 0.85;
/** Volley: captures within this many ticks of each other (2 s). */
export const VOLLEY_TICKS = 120;
/** Metronome: this many recent keystrokes with even spacing (coefficient of variation below the limit). */
export const METRONOME_KEYS = 16;
export const METRONOME_CV = 0.3;

/** Total points for a word: base × (1 + bonus rates) × multiplier, plus flat bonuses × multiplier. */
/**
 * Points for a captured word (D-046):
 *   (base × (1 + bonus %) + flat bonuses) × combo multiplier × Clean Streak multiplier,
 * rounded once at the end. The Clean Streak multiplier covers the whole word
 * score, flat bonuses (Clean Sweep) included.
 */
export function scoreWord(length: number, multiplier: number, bonuses: readonly Bonus[], streakMultiplier = 1): number {
  const base = length * SCORING.pointsPerLetter;
  const rate = bonuses.reduce((sum, b) => sum + b.rate, 0);
  const flat = bonuses.reduce((sum, b) => sum + b.points, 0);
  return Math.round((base * (1 + rate) + flat) * multiplier * streakMultiplier);
}

// ───────────────────────── Clean Streak (D-046) ─────────────────────────

/**
 * Clean Streak: the third scoring layer, for mastery. Every word captured
 * without a typo adds one; milestones raise a multiplier on the whole word
 * score. Tune here: thresholds must start at 0 and rise.
 */
export const STREAK_MILESTONES: readonly { at: number; multiplier: number }[] = [
  { at: 0, multiplier: 1 },
  { at: 5, multiplier: 1.2 },
  { at: 15, multiplier: 1.4 },
  { at: 25, multiplier: 1.65 },
  { at: 50, multiplier: 2 },
  { at: 100, multiplier: 2.75 },
  { at: 200, multiplier: 3.5 },
];

/** The milestone reached (0 = none yet) for a Clean Streak count. */
export function streakTierOf(count: number): number {
  let tier = 0;
  for (let i = 0; i < STREAK_MILESTONES.length; i++) if (count >= STREAK_MILESTONES[i]!.at) tier = i;
  return tier;
}

export function streakMultiplierOf(count: number): number {
  return STREAK_MILESTONES[streakTierOf(count)]!.multiplier;
}

/**
 * A corrected typo: back to the start of the milestone below the one reached
 * (at 50 → 25, at 37 → 15, at 3 → 0). Repeated typos step down one at a time.
 */
export function streakAfterTypo(count: number): number {
  return STREAK_MILESTONES[Math.max(0, streakTierOf(count) - 1)]!.at;
}

/** The next milestone above a count, or null past the last. */
export function nextStreakMilestone(count: number): { at: number; multiplier: number } | null {
  return STREAK_MILESTONES[streakTierOf(count) + 1] ?? null;
}

export interface GameStats {
  score: number;
  completed: number;
  missed: number;
  correctChars: number;
  errors: number;
  /** 0–1. Correct keystrokes divided by all letter keystrokes. */
  accuracy: number;
  /** Words per minute, using the standard 5 characters = 1 word. */
  wpm: number;
  maxCombo: number;
  /** Combo at the end of the level (carried into the next level of a Campaign run). */
  endCombo: number;
  /** Clean Streak at the end of the level, and its peak (D-046). */
  endCleanStreak?: number;
  peakCleanStreak?: number;
  /** Highest multiplier reached. */
  peakMultiplier: number;
  /** How many times each bonus was earned. */
  bonusCounts: Partial<Record<BonusId, number>>;
  /** End-of-level bonuses awarded (already included in `score`). */
  levelBonuses: Bonus[];
  elapsedMs: number;
  /** Average time from a word appearing to being completed. */
  averageCompletionMs: number;
  /** Wizard powers fired this level (sigil scrolls captured, D-042). */
  powersUsed?: number;
  /** Times each spell was cast this level. */
  spellsCast?: Partial<Record<string, number>>;
}

export function accuracyOf(correct: number, errors: number): number {
  const total = correct + errors;
  return total === 0 ? 1 : correct / total;
}

export function wpmOf(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  return correctChars / 5 / (elapsedMs / 60_000);
}
