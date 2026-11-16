import type { WordState } from '../gameplay/Word';
import type { InstabilityStage } from '../gameplay/InstabilityManager';
import type { GameStats } from '../gameplay/ScoringSystem';

export type GameResult = 'won' | 'lost';

/** Everything the simulation announces. Rendering, audio and UI listen to these. */
export interface GameEvents {
  wordSpawned: { word: WordState };
  /** A correct character was typed on the target word. */
  wordProgress: { word: WordState };
  wordCompleted: { word: WordState; points: number; combo: number };
  wordMissed: { word: WordState; instability: number };
  /** A wrong key. wordId is null when no word could be targeted at all. */
  typingError: { wordId: number | null; char: string };
  targetChanged: { previousId: number | null; currentId: number | null };
  instabilityChanged: { value: number; stage: InstabilityStage };
  scoreChanged: { score: number; combo: number };
  gameOver: { result: GameResult; stats: GameStats };
}
