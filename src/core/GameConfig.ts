/**
 * Global, render-independent constants for Wizzy Type.
 *
 * Per-level difficulty does NOT belong here — it will live in
 * src/difficulty/ (DifficultyConfig + level definitions) from Milestone 2.
 */
export const GAME_TITLE = 'Wizzy Type';

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

/**
 * Shared colour palette: gritty, desaturated 16-bit (decisions.md D-028).
 * Numeric form for Phaser; CSS mirrors these in main.css; the pixel art in
 * public/assets uses the same values (tools/pixelart/pixelart.py).
 */
export const PALETTE = {
  midnight: 0x0a0908,
  charcoal: 0x1a1714,
  gold: 0xd6a040,
  arcane: 0x7a6096,
  parchment: 0xc8b78c,
  ink: 0x1e1610,
  rust: 0x9a3412,
  iron: 0x3a3834,
  fire: 0xce622e,
  ice: 0x6eaabe,
  wind: 0x6ea082,
  crimson: 0xb0402c,
  positive: 0x8ab05a,
  shield: 0x8c96b4,
  lightning: 0xd6c468,
  transmute: 0xba788c,
  harvest: 0xc4a056,
} as const;

/** Fonts (loaded from Google Fonts in index.html). Words on scrolls use the clearest one. */
export const FONTS = {
  /** Readouts, banners and the HUD: a pixel face. */
  heading: '"Pixelify Sans", "Courier New", monospace',
  /** Scroll words and the typewriter: a face built for legibility. */
  gameplay: '"Atkinson Hyperlegible", system-ui, "Segoe UI", Arial, sans-serif',
} as const;
