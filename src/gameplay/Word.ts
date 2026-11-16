import type { SpellId } from './SpellManager';

/** Rough difficulty bucket of a word, by length. */
export type LengthClass = 'short' | 'medium' | 'long';

/**
 * One falling word, in simulation (field) coordinates.
 *
 * x is the horizontal centre of the word. y grows downward from 0 (spawn line)
 * to the field height (the tower's ward line). Positions are plain numbers so
 * the same state can be rendered by Phaser, checked by tests or sent over the
 * network.
 */
export interface WordState {
  readonly id: number;
  /** Text as displayed (may contain capitals, e.g. "Frodo"). Transmutation can change it. */
  text: string;
  /** Lowercase text used for all matching (the game is case-insensitive). */
  match: string;
  x: number;
  y: number;
  /** y on the previous tick — lets the renderer interpolate smooth motion. */
  prevY: number;
  /** Current fall speed in field pixels per second. */
  speed: number;
  /** How many leading characters of this word the console input currently matches. */
  typed: number;
  isTarget: boolean;
  lengthClass: LengthClass;
  /** Special modifier id (volatile, cursed…). Always null until Milestone 6. */
  readonly modifier: string | null;
  /** Spell scroll carried by this word: completing it grants a charge. */
  readonly spell: SpellId | null;
  readonly spawnTick: number;
  /** Wrong keystrokes made while this word was the target. */
  errors: number;
}

export function lengthClassOf(length: number): LengthClass {
  if (length <= 4) return 'short';
  if (length <= 7) return 'medium';
  return 'long';
}
