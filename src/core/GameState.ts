import type { BonusId } from '../gameplay/ScoringSystem';
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
  /** Surges already started this level, and ticks left of the current one. */
  surgesStarted: number;
  /** Scrolls claimed with a full pool. */
  overflows: number;
  surgeTicks: number;
  /** Endless Practice: which lap of the level the surges belong to. */
  surgeLap: number;
  /** Clean captures in a row for the mana pool (D-057): typos keep it, misses reset it. */
  manaStreak: number;
  /** Boss timer is over: no new words, the level ends when the field is clear. */
  windingDown: boolean;
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
  /** Ticks left of Frostbinding (no movement, no spawning). Each cast adds more. */
  freezeTicks: number;
  /** Ice casts since the field last thawed: each adds less time (ICE_STACK_DECAY). */
  iceCasts: number;
  /**
   * Active Temporal Distortion stacks: ticks left on each. Every stack has its
   * own timer, and fall speed is multiplied by the slow factor once per
   * stack. Stacks don't tick down while frozen.
   */
  slowStacks: number[];
  /** Ticks left of Alter's easy-word window: new words are short and simple. */
  easyTicks: number;
  /** Fall-speed multiplier of one slow stack. */
  slowFactor: number;
  /** Arcane Shield: misses still to be blocked this level. */
  barrier: number;
  /** Words stopped by Arcane Shield (they did no harm). */
  blocked: number;
  // ── scoring chains (decisions.md D-040) ──
  /** Ticks of recent captures (Volley). */
  recentCaptures: number[];
  /** First letter and length of the current Alliteration chain. */
  alliterationLetter: string;
  alliterationChain: number;
  /** Last captured word and length of the current alphabetical (Librarian) chain. */
  lastCaptured: string;
  librarianChain: number;
  /** Ticks of recent keystrokes (Metronome). */
  keyTicks: number[];
  /** Captures since the screen was last empty (Clean Sweep). */
  sweepCount: number;
  peakMultiplier: number;
  /** Highest instability reached this level (Comeback). */
  peakInstability: number;
  bonusCounts: Partial<Record<BonusId, number>>;
  // ── Clean Streak (D-046) ──
  /** Words captured in a row without a typo (stepped back by typos, reset by wrong Enters and misses). */
  cleanStreak: number;
  peakCleanStreak: number;
  /** A typo happened in the current entry (cleared when the console is emptied). */
  entryTypo: boolean;
}

/** Delay before the very first word appears, so the player can get ready. */
export const FIRST_SPAWN_DELAY_MS = 600;

export function createInitialState(spells: SpellCharges = emptyCharges(), instability = 0): GameState {
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
    surgesStarted: 0,
    overflows: 0,
    surgeTicks: 0,
    surgeLap: 0,
    manaStreak: 0,
    windingDown: false,
    score: 0,
    combo: 0,
    maxCombo: 0,
    completed: 0,
    missed: 0,
    correctChars: 0,
    errors: 0,
    instability,
    completionTicksTotal: 0,
    spells,
    spellsCast: emptyCharges(),
    freezeTicks: 0,
    iceCasts: 0,
    slowStacks: [],
    easyTicks: 0,
    slowFactor: 1,
    barrier: 0,
    blocked: 0,
    recentCaptures: [],
    alliterationLetter: '',
    alliterationChain: 0,
    lastCaptured: '',
    librarianChain: 0,
    keyTicks: [],
    sweepCount: 0,
    peakMultiplier: 1,
    peakInstability: instability,
    bonusCounts: {},
    cleanStreak: 0,
    peakCleanStreak: 0,
    entryTypo: false,
  };
}
