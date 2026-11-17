import { duelLevels } from './Stages';
import { LevelManager } from './LevelManager';

/**
 * Wizard Duels (and the duel server) choose from one flat list: the 100
 * Normal-mode levels, numbered 1–100. The Campaign itself is organised in
 * stages: see Stages.ts.
 */
export const CAMPAIGN_LEVELS = new LevelManager(duelLevels());
