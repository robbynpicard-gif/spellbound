import { FIELD, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../core/GameConfig';
import type { SpellId } from '../gameplay/SpellManager';

/** Screen layout of the gameplay view, in Phaser pixels (1280×720). */
export const LAYOUT = {
  hudHeight: 52,
  /** Screen y of simulation y = 0 (where words appear). */
  spawnY: 76,
  /** Screen y of the ward line (simulation y = FIELD.height). */
  get wardY(): number {
    return this.spawnY + FIELD.height;
  },
  /** Top of the bottom panel (progress, spells, instability). */
  get panelY(): number {
    return this.wardY + 10;
  },
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
} as const;

export const SPELL_COLORS: Record<SpellId, number> = {
  fire: PALETTE.fire,
  ice: PALETTE.ice,
  slow: PALETTE.arcane,
  wind: PALETTE.wind,
};

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
