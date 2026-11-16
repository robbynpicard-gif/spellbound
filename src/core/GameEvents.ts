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
  wordCompleted: { word: WordState; points: number; combo: number };
  wordMissed: { word: WordState; instability: number };
  /** Words destroyed by Incineration (not typed). */
  wordsBurned: { words: WordState[]; points: number };
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
  /** A tome was completed. `stored` is false when that spell was already full. */
  spellCollected: { spell: SpellId; stored: boolean; charges: SpellCharges };
  spellCast: { spell: SpellId; charges: SpellCharges };
  /** Tried to cast with no charges left. */
  spellFizzled: { spell: SpellId };
  /** A timed spell (Frostbinding, Temporal Distortion) wore off. */
  spellEnded: { spell: SpellId };
  gameOver: { result: GameResult; stats: GameStats };
}
