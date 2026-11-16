import type { DifficultyConfig } from './DifficultyConfig';

/** Read-only access to an ordered list of levels (numbered from 1). */
export class LevelManager {
  constructor(private readonly levels: readonly DifficultyConfig[]) {}

  get count(): number {
    return this.levels.length;
  }

  get all(): readonly DifficultyConfig[] {
    return this.levels;
  }

  has(level: number): boolean {
    return Number.isInteger(level) && level >= 1 && level <= this.levels.length;
  }

  get(level: number): DifficultyConfig {
    if (!this.has(level)) throw new RangeError(`No level ${level} (have 1–${this.levels.length})`);
    return this.levels[level - 1]!;
  }
}
