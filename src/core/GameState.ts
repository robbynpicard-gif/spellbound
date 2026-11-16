import type { WordState } from '../gameplay/Word';
import { emptyCharges, type SpellCharges } from '../gameplay/SpellManager';

export type GameStatus = 'playing' | 'won' | 'lost';

/** The complete, serialisable state of one player's game. */
export interface GameState {
  tick: number;
  status: GameStatus;
  words: WordState[];
  /** Text in the typing console (lowercase). */
  input: string;
  /** Word the console input is currently aimed at (or was last aimed at). */
  targetId: number | null;
  /** Word the player clicked: input is matched only against it until cleared. */
  pinnedId: number | null;
  /**
   * Word already penalised during the current console entry, so a typo
   * followed by Enter costs one speed-up, not two.
   */
  penalizedId: number | null;
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
  /** Spell charges held. */
  spells: SpellCharges;
  /** Times each spell was cast this game (for statistics). */
  spellsCast: SpellCharges;
  /** Ticks left of Frostbinding (no movement, no spawning). */
  freezeTicks: number;
  /** Ticks left of Temporal Distortion. */
  slowTicks: number;
  /** Fall-speed multiplier while slowed. */
  slowFactor: number;
}

/** Delay before the very first word appears, so the player can get ready. */
export const FIRST_SPAWN_DELAY_MS = 600;

export function createInitialState(spells: SpellCharges = emptyCharges()): GameState {
  return {
    tick: 0,
    status: 'playing',
    words: [],
    input: '',
    targetId: null,
    pinnedId: null,
    penalizedId: null,
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
    spells,
    spellsCast: emptyCharges(),
    freezeTicks: 0,
    slowTicks: 0,
    slowFactor: 1,
  };
}
