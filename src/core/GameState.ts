import type { WordState } from '../gameplay/Word';

export type GameStatus = 'playing' | 'won' | 'lost';

/** The complete, serialisable state of one player's game. */
export interface GameState {
  tick: number;
  status: GameStatus;
  words: WordState[];
  targetId: number | null;
  nextWordId: number;
  /** Time until the next spawn is allowed. */
  spawnTimerMs: number;
  score: number;
  combo: number;
  maxCombo: number;
  completed: number;
  missed: number;
  correctChars: number;
  errors: number;
  instability: number;
  /** Sum over completed words of (completion tick − spawn tick). */
  completionTicksTotal: number;
}

/** Delay before the very first word appears, so the player can get ready. */
export const FIRST_SPAWN_DELAY_MS = 600;

export function createInitialState(): GameState {
  return {
    tick: 0,
    status: 'playing',
    words: [],
    targetId: null,
    nextWordId: 1,
    spawnTimerMs: FIRST_SPAWN_DELAY_MS,
    score: 0,
    combo: 0,
    maxCombo: 0,
    completed: 0,
    missed: 0,
    correctChars: 0,
    errors: 0,
    instability: 0,
    completionTicksTotal: 0,
  };
}
