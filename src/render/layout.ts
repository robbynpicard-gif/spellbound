import { FIELD, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../core/GameConfig';
import type { SpellId } from '../gameplay/SpellManager';

/** Pixel art is drawn at 1x (320x180) and shown at this scale (decisions.md D-028). */
export const ART_SCALE = 4;

/**
 * Screen layout of the gameplay view, in Phaser pixels (1280x720), matched
 * to the pixel-art backdrop: iron HUD plate on top, the field, the ward
 * line, then the wizard's study.
 */
export const LAYOUT = {
  /** Height of the iron HUD plate. */
  hudHeight: 16 * ART_SCALE,
  /** Screen y of simulation y = 0 (where words appear). */
  spawnY: 22 * ART_SCALE,
  /** Screen y of the ward line (simulation y = FIELD.height). */
  wardY: 126 * ART_SCALE,
  /** Screen pixels per simulation pixel, vertically. The simulation keeps its own field height. */
  get fieldScale(): number {
    return (this.wardY - this.spawnY) / FIELD.height;
  },
  /** Just below the ward line, for "+1 scroll" style messages. */
  get panelY(): number {
    return this.wardY + 10;
  },
  /** The sheet of paper in the alchemic typewriter (the typing console). */
  paper: { x: 132 * ART_SCALE, y: 131 * ART_SCALE, width: 64 * ART_SCALE, height: 16 * ART_SCALE },
  /** Brass plaque on the desk front (accuracy and WPM). */
  plaque: { x: 160 * ART_SCALE, y: 163 * ART_SCALE },
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
} as const;

/** Screen y of a simulation y. */
export const screenY = (simY: number): number => LAYOUT.spawnY + simY * LAYOUT.fieldScale;

export const SPELL_COLORS: Record<SpellId, number> = {
  slow: PALETTE.arcane,
  ice: PALETTE.ice,
  barrier: PALETTE.shield,
  shock: PALETTE.lightning,
  alter: PALETTE.transmute,
  fire: PALETTE.fire,
  wind: PALETTE.wind,
  harvest: PALETTE.harvest,
};

/** Texture keys for the pixel art (loaded in BootScene). */
export const ART = {
  chapter: (chapter: number) => `bg-chapter${Math.min(4, Math.max(1, chapter))}`,
  menu: 'bg-menu',
  icons: 'spell-icons',
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
