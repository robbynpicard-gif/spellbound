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
  readonly text: string;
  x: number;
  y: number;
  /** y on the previous tick — lets the renderer interpolate smooth motion. */
  prevY: number;
  /** Current fall speed in field pixels per second. */
  speed: number;
  /** How many leading characters have been typed correctly. */
  typed: number;
  isTarget: boolean;
  readonly lengthClass: LengthClass;
  /** Special modifier id (volatile, cursed…). Always null until Milestone 6. */
  readonly modifier: string | null;
  readonly spawnTick: number;
  /** Wrong keystrokes made while this word was the target. */
  errors: number;
}

export function lengthClassOf(length: number): LengthClass {
  if (length <= 4) return 'short';
  if (length <= 7) return 'medium';
  return 'long';
}
