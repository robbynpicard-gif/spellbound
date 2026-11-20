/**
 * Global, render-independent constants for Wizzy Type.
 *
 * Per-level difficulty does NOT belong here — it will live in
 * src/difficulty/ (DifficultyConfig + level definitions) from Milestone 2.
 */
export const GAME_TITLE = 'Typal';

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
  height: 760,
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
  midnight: 0x0b0a10,
  charcoal: 0x18141a,
  gold: 0xe6a03c,
  /** Primary arcane magic: muted magenta (docs/art-direction.md). */
  arcane: 0xb4409c,
  magentaGlow: 0xe25cc4,
  /** Secondary magic: muted teal. */
  teal: 0x3aa49a,
  parchment: 0xe6d6b4,
  paper: 0xd6ba8c,
  ink: 0x22180f,
  rust: 0xa8348c,
  iron: 0x3a2a20,
  fire: 0xd2692e,
  ice: 0x3aa49a,
  wind: 0x6a9a5a,
  crimson: 0xc0392b,
  positive: 0x8ab05a,
  shield: 0x9aa4b8,
  lightning: 0xc8a640,
  transmute: 0xc07890,
  harvest: 0xb48c48,
} as const;

/** Fonts (loaded from Google Fonts in index.html). Words on scrolls use the clearest one. */
export const FONTS = {
  /** Readouts, banners and the HUD: a pixel face. */
  heading: '"Pixelify Sans", "Courier New", monospace',
  /** Scroll words and the typewriter: a face built for legibility. */
  gameplay: '"Atkinson Hyperlegible", system-ui, "Segoe UI", Arial, sans-serif',
} as const;
