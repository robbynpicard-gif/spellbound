import type { DifficultyConfig } from './DifficultyConfig';

/**
 * Temporary single level for the Milestone 1 prototype. Milestone 2 replaces
 * this with at least 10 data-driven campaign levels.
 *
 * Tuning intent: comfortable for a beginner — a word takes ~15 s to fall,
 * a new one appears every ~2.2 s, and ten misses collapse the wards.
 */
export const PROTOTYPE_LEVEL: DifficultyConfig = {
  level: 1,
  name: 'Prototype',
  requiredWords: 40,
  initialFallSpeed: 40,
  spawnInterval: 2200,
  maxActiveWords: 6,
  minWordLength: 3,
  maxWordLength: 7,
  wordLengthWeights: { 3: 2, 4: 3, 5: 3, 6: 2, 7: 1 },
  modifierProbabilities: {},
  instabilityPerMiss: 10,
  errorAcceleration: 12,
};
