import { FIELD, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../core/GameConfig';
import type { SpellId } from '../gameplay/SpellManager';

/** The backdrop is 640x360 pixel art shown at this scale (decisions.md D-031). */
export const ART_SCALE = 2;

/**
 * Screen layout of the gameplay view (1280x720), matched to the v4 art
 * (tools/pixelart/v4, decisions.md D-035): words fall past the arched windows
 * down to the sill; the wizard sits behind the typewriter facing the player;
 * the spell rack is on the right and the status bar along the bottom.
 */
export const LAYOUT = {
  /** Nothing covers the top of the screen. */
  hudHeight: 0,
  /** Screen y of simulation y = 0 (where words appear). */
  spawnY: 28,
  /** Screen y of the ward line (simulation y = FIELD.height): the window sill, just above the typewriter. */
  wardY: 470,
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
  roll: { x: 462, y: 482, width: 286, height: 64 },
  /** Brass score counter wheels, and the combo plate under them. */
  counter: { x: 794, y: 492, width: 136, height: 48 },
  combo: { x: 794, y: 548, width: 136, height: 42 },
  /** Small brass plates above the counter and the rack. */
  scorePlate: { x: 862, y: 470 },
  rackPlate: { x: 1186, y: 98 },
  /** Inside of the spell rack. */
  rack: { x: 1098, y: 126, width: 174, height: 484 },
  /** Status bar panels (x0, x1) and their vertical extent. */
  status: { y: 654, height: 54, panels: [[40, 358], [376, 664], [688, 966], [990, 1250]] as const },
  /** The rune seal glowing behind the wizard (shows ward health). */
  seal: { x: 604, y: 452, radius: 140 },
  /** Top-left of the wizard sprite (behind the typewriter). */
  wizard: { x: 450, y: 238 },
  /** The arched windows: weather and the deepening night show only here. */
  window: { left: 224, right: 940 },
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
const theme = (chapter: number, boss: boolean): string => `${boss ? 'boss' : 'ch'}${Math.min(4, Math.max(1, chapter))}`;

export const ART = {
  /** The study and the chapter's view through its windows, or the boss version (D-033, D-035). */
  backdrop: (chapter = 1, boss = false) => `bg-${theme(chapter, boss)}`,
  /** The typewriter and score counter, drawn in front of the wizard, lit to match. */
  front: (chapter = 1, boss = false) => `front-${theme(chapter, boss)}`,
  /** A wizard at the typewriter (in game) or their portrait (front). */
  wizard: (id = 'apprentice', look: 'a' | 'b' = 'a', view: 'game' | 'front' = 'game') => `wizard-${id}-${look}-${view}`,
  menu: 'bg-menu',
  library: 'bg-library',
  icons: 'spell-icons',
  themes: ['ch1', 'ch2', 'ch3', 'ch4', 'boss1', 'boss2', 'boss3', 'boss4'] as const,
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
