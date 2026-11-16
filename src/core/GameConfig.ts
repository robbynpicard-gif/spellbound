/**
 * Global, render-independent constants for Spellbound.
 *
 * Per-level difficulty does NOT belong here — it will live in
 * src/difficulty/ (DifficultyConfig + level definitions) from Milestone 2.
 */
export const GAME_TITLE = 'Spellbound';

/** Logical resolution of the playing field. Phaser scales this to fit the window. */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Size of the playing field in simulation units (used by game rules). */
export interface FieldConfig {
  width: number;
  /** Distance a word falls from the spawn line to the ward line. */
  height: number;
  /** Words never spawn closer than this to the left/right edge. */
  sideMargin: number;
  /** Approximate width of one gameplay character, used to keep words on screen. */
  approxCharWidth: number;
}

export const FIELD: FieldConfig = {
  width: GAME_WIDTH,
  height: 560,
  sideMargin: 32,
  approxCharWidth: 17,
};

/**
 * Fixed simulation rate. Gameplay logic advances in fixed steps so that the
 * same seed + inputs always produce the same result (needed for multiplayer
 * validation and reproducible tests). Rendering may run at any frame rate.
 */
export const SIMULATION_HZ = 60;
export const SIMULATION_STEP_MS = 1000 / SIMULATION_HZ;

/** Shared colour palette (numeric form for Phaser; CSS mirrors these in main.css). */
export const PALETTE = {
  midnight: 0x0f0d16,
  charcoal: 0x1a1724,
  gold: 0xd4af37,
  arcane: 0x8a5cf6,
  parchment: 0xefe6d2,
  fire: 0xe8642c,
  ice: 0x5ad1f0,
  wind: 0x6fd6b3,
  crimson: 0xc0392b,
  positive: 0x9be08a,
  shield: 0xa9b8ff,
  lightning: 0xf5e26b,
  transmute: 0xf08fb8,
  harvest: 0xe8bf62,
} as const;

/** Fonts. Gameplay words always use the most legible stack. */
export const FONTS = {
  heading: 'Georgia, "Times New Roman", serif',
  gameplay: 'system-ui, "Segoe UI", Roboto, Arial, sans-serif',
} as const;
