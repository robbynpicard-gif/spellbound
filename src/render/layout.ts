import { FIELD, GAME_HEIGHT, GAME_WIDTH } from '../core/GameConfig';

/** Screen layout of the gameplay view, in Phaser pixels (1280×720). */
export const LAYOUT = {
  hudHeight: 52,
  /** Screen y of simulation y = 0 (where words appear). */
  spawnY: 76,
  /** Screen y of the ward line (simulation y = FIELD.height). */
  get wardY(): number {
    return this.spawnY + FIELD.height;
  },
  meterY: GAME_HEIGHT - 22,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
