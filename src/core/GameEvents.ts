import type { Bonus } from '../gameplay/ScoringSystem';
import type { WordState } from '../gameplay/Word';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import type { GameStats } from '../gameplay/ScoringSystem';
import type { SpellCharges, SpellId } from '../gameplay/SpellManager';

export type GameResult = 'won' | 'lost';

/** Everything the simulation announces. Rendering, audio and UI listen to these. */
export interface GameEvents {
  wordSpawned: { word: WordState };
  /** A correct character was typed on the target word. */
  wordProgress: { word: WordState };
  wordCompleted: {
    word: WordState;
    points: number;
    combo: number;
    multiplier: number;
    bonuses: Bonus[];
    /** Clean Streak multiplier applied to this word (D-046). */
    streakMultiplier: number;
  };
  /** The combo multiplier moved to another tier (up on a streak; down on a wrong entry or a miss). */
  tierChanged: { tier: number; multiplier: number; up: boolean };
  /** End-of-level bonuses (Flawless, Under Par, Comeback), already added to the score. */
  levelBonuses: { bonuses: Bonus[]; total: number };
  wordMissed: { word: WordState; instability: number };
  /** Words destroyed by Incineration (not typed; no points, no progress). */
  wordsBurned: { words: WordState[]; points: number };
  /** Words destroyed by Chain Lightning, in strike order (first = the most urgent). */
  wordsShocked: { words: WordState[]; points: number };
  /** Words claimed by Harvest. */
  wordsHarvested: { words: WordState[]; points: number };
  /** Words changed by Transmutation (their text is already the new text). */
  wordsTransmuted: { words: WordState[] };
  /** A word reached the ward line but Arcane Shield stopped it. */
  wordBlocked: { word: WordState; barrierLeft: number };
  /** Arcane Shield blocks left changed (cast or used). */
  barrierChanged: { remaining: number };
  /** Temporal Distortion stacks changed (cast, or one wore off). */
  slowChanged: { stacks: number; factor: number };
  /** Alter's easy-word window: ticks left (0 when it ends). */
  easyChanged: { ticks: number };
  /** Frostbinding time left changed by a cast. */
  freezeChanged: { ticks: number };
  /**
   * A keystroke that made the console text match nothing. wordId is the word
   * that was being attempted (it speeds up), or null if none.
   */
  typingError: { wordId: number | null; char: string };
  /** The typing console text changed. `valid` = it still matches a word or spell. */
  inputChanged: { input: string; valid: boolean; targetId: number | null };
  /**
   * Enter on text that isn't a complete word or spell. wordId is the word the
   * game guessed was intended (it speeds up), or null if no guess was possible.
   */
  submitMissed: { input: string; wordId: number | null };
  targetChanged: { previousId: number | null; currentId: number | null };
  instabilityChanged: { value: number; stage: InstabilityStage };
  /** Fired whenever completed-word progress changes. */
  progressChanged: { completed: number; required: number | null };
  scoreChanged: { score: number; combo: number };
  /** A scroll was completed. `stored` is false when the spell pool was already full. */
  /** A scroll claimed. With a full pool the charge is not stored: it fizzles at (x, y) for `overflowPoints`. */
  spellCollected: { spell: SpellId; stored: boolean; charges: SpellCharges; overflowPoints: number; x: number; y: number };
  /** A surge of extra words started or ended. */
  surgeChanged: { active: boolean };
  spellCast: { spell: SpellId; charges: SpellCharges };
  /** Tried to cast with no charges left. */
  spellFizzled: { spell: SpellId };
  /** A timed spell (Frostbinding, or the last Temporal Distortion stack) wore off. */
  spellEnded: { spell: SpellId };
  gameOver: { result: GameResult; stats: GameStats };
  /**
   * Clean Streak moved (D-046). `reason`: a clean 'capture', a corrected 'typo'
   * (one milestone down), a 'wrongEntry' or a 'miss' (both reset to 0).
   */
  cleanStreakChanged: {
    count: number;
    previous: number;
    tier: number;
    multiplier: number;
    previousMultiplier: number;
    reason: 'capture' | 'typo' | 'wrongEntry' | 'miss';
  };
  /** Rewind: the last miss was undone (`undone`) and every word pushed back up. */
  rewound: { undone: boolean };
}
