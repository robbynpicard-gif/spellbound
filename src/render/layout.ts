import { FIELD, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../core/GameConfig';
import type { SpellId } from '../gameplay/SpellManager';

/** The backdrop is 640x360 pixel art shown at this scale (decisions.md D-031). */
export const ART_SCALE = 2;

/**
 * Screen layout of the gameplay view (1280x720), matched to the gothic
 * backdrop (public/assets/backgrounds/gothic.png): words fall through the
 * window area above the typewriter; the spell rack is on the right and the
 * status bar along the bottom.
 */
export const LAYOUT = {
  /** Nothing covers the top of the screen. */
  hudHeight: 0,
  /** Screen y of simulation y = 0 (where words appear). */
  spawnY: 28,
  /** Screen y of the ward line (simulation y = FIELD.height), just above the typewriter. */
  wardY: 418,
  /** Screen x range words fall in (simulation x 0..FIELD.width is mapped onto it). */
  fieldLeft: 24,
  fieldRight: 1084,
  get fieldScale(): number {
    return (this.wardY - this.spawnY) / FIELD.height;
  },
  get fieldScaleX(): number {
    return (this.fieldRight - this.fieldLeft) / FIELD.width;
  },
  /** Just below the ward line, for "+1 scroll" style messages. */
  get panelY(): number {
    return this.wardY + 10;
  },
  /** Parchment roll on the typewriter: progress segments + the typing line. */
  roll: { x: 462, y: 438, width: 286, height: 70 },
  /** Brass score counter wheels, and the combo plate under them. */
  counter: { x: 780, y: 482, width: 138, height: 48 },
  combo: { x: 780, y: 540, width: 138, height: 42 },
  /** Inside of the spell rack. */
  rack: { x: 1098, y: 126, width: 174, height: 484 },
  /** Status bar panels (x0, x1) and their vertical extent. */
  status: { y: 654, height: 54, panels: [[40, 358], [376, 664], [688, 966], [990, 1250]] as const },
  /** The runic seal on the wall behind the typewriter (shows ward health). */
  seal: { x: 655, y: 398, radius: 150 },
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
} as const;

/** Screen y of a simulation y. */
export const screenY = (simY: number): number => LAYOUT.spawnY + simY * LAYOUT.fieldScale;
/** Screen x of a simulation x. */
export const screenX = (simX: number): number => LAYOUT.fieldLeft + simX * LAYOUT.fieldScaleX;

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
  /** The chapter's backdrop, or its boss version (decisions.md D-033). */
  backdrop: (chapter = 1, boss = false) => `bg-${boss ? 'boss' : 'ch'}${Math.min(4, Math.max(1, chapter))}`,
  icons: 'spell-icons',
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
