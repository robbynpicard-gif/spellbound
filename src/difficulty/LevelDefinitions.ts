import levelsData from '../data/levels.json';
import { validateLevels } from './DifficultyConfig';
import { LevelManager } from './LevelManager';

/**
 * The campaign levels, loaded from src/data/levels.json and validated at
 * start-up. To add a level, append an entry to that file — no code changes.
 * Endless Practice (Milestone 4) will reuse these exact objects.
 */
export const CAMPAIGN_LEVELS = new LevelManager(validateLevels(levelsData));
