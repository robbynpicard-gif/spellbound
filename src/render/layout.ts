import { FIELD, GAME_HEIGHT, GAME_WIDTH, PALETTE } from '../core/GameConfig';
import type { SpellId } from '../gameplay/SpellManager';

/** The backdrop is 640x360 pixel art shown at this scale (decisions.md D-031). */
export const ART_SCALE = 2;

/**
 * Screen layout of the gameplay view (1280x720), matched to the art from
 * tools/pixelart/v5 (decisions.md D-037): a zoomed-out study; words fall past
 * the arched windows down to the sill; the wizard sits at lower left, the
 * typewriter faces the player at bottom centre with the counter beside it;
 * the spell rack is on the right and the status bar along the bottom.
 */
export const LAYOUT = {
  /** Nothing covers the top of the screen. */
  hudHeight: 0,
  /** Screen y of simulation y = 0 (where words appear). */
  spawnY: 20,
  /** Screen y of the ward line (simulation y = FIELD.height): the window sill, just above the typewriter. */
  wardY: 506,
  /** Screen x range words fall in (simulation x 0..FIELD.width is mapped onto it). */
  fieldLeft: 150,
  fieldRight: 1076,
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
  roll: { x: 472, y: 512, width: 256, height: 60 },
  /** Brass score counter wheels, and the combo plate under them. */
  counter: { x: 772, y: 528, width: 128, height: 44 },
  combo: { x: 772, y: 580, width: 128, height: 36 },
  /** Small brass plates above the counter and the rack. */
  scorePlate: { x: 836, y: 510 },
  rackPlate: { x: 1186, y: 98 },
  /** Inside of the spell rack. */
  rack: { x: 1098, y: 126, width: 174, height: 484 },
  /** Status bar panels (x0, x1) and their vertical extent. */
  status: { y: 654, height: 54, panels: [[40, 358], [376, 664], [688, 966], [990, 1250]] as const },
  /** The rune seal glowing behind the wizard (shows ward health). */
  seal: { x: 600, y: 500, radius: 150 },
  /** Top-left of the wizard sprite (seated at lower left, turned toward the typewriter). */
  wizard: { x: 36, y: 388 },
  /** The arched windows: weather and the deepening night show only here. */
  window: { left: 184, right: 1072 },
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
  /** A wizard seated at the desk, lit by the room. */
  wizard: (id = 'apprentice', look: string = 'a') => `wizard-${id}-${look}`,
  /** A wizard's own study for chapter 1 (D-044); the Apprentice's is the original. */
  domain: (wizard: string, boss = false) => `bg-${boss ? 'bossdom' : 'dom'}-${wizard}`,
  menu: 'bg-menu',
  library: 'bg-library',
  icons: 'spell-icons',
  /** Familiars (D-043): 24×24 frames, two per familiar (idle, cheer). */
  familiars: 'familiars',
  themes: ['ch1', 'ch2', 'ch3', 'ch4', 'boss1', 'boss2', 'boss3', 'boss4'] as const,
} as const;

export const hex = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
