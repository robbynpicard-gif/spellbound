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
  /** A wrong key. wordId is null when no word could be targeted at all. */
  typingError: { wordId: number | null; char: string };
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
