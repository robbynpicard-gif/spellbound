/**
 * Everything that makes one level harder or easier than another.
 *
 * Campaign, Practice and multiplayer all read these same objects; no mode
 * calculates its own difficulty. Milestone 2 adds the full set of levels and
 * the remaining fields the GDD lists (available spells, etc.).
 */
export interface DifficultyConfig {
  level: number;
  name: string;
  /** Words to complete to clear the level. null = endless. */
  requiredWords: number | null;
  /** Fall speed of a newly spawned word, in field pixels per second. */
  initialFallSpeed: number;
  /** Milliseconds between spawns (when there is room for another word). */
  spawnInterval: number;
  /** Most words allowed on the field at once. */
  maxActiveWords: number;
  minWordLength: number;
  maxWordLength: number;
  /**
   * Relative chance of each word length, e.g. { 3: 1, 4: 2, 5: 2 }.
   * Omitted lengths in range get weight 0; omit the whole table for an even spread.
   */
  wordLengthWeights?: Readonly<Partial<Record<number, number>>>;
  /** Chance per spawn of each special modifier. Unused until Milestone 6. */
  modifierProbabilities: Readonly<Record<string, number>>;
  /** Instability (out of 100) added when a word reaches the ward line. */
  instabilityPerMiss: number;
  /**
   * Fall speed (px/s) added to the targeted word for each wrong keystroke.
   * Based on reports of the original game; see original-game-research.md #4–5.
   */
  errorAcceleration: number;
}
