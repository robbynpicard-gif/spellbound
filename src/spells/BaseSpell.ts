import type { SpellId } from '../gameplay/SpellManager';

/** Display and tuning data for a spell, loaded from src/data/spells.json. */
export interface SpellData {
  id: SpellId;
  /** Spellbound name, e.g. "Incineration". */
  name: string;
  /** Short book name shown in the HUD, e.g. "Fire". */
  book: string;
  /** Keyboard shortcut. */
  key: string;
  description: string;
  durationMs?: number;
  speedFactor?: number;
}

/**
 * What a spell is allowed to do to the game. The engine provides this;
 * spells never touch engine internals directly, so new spells can be added
 * without changing the engine.
 */
export interface SpellContext {
  /** Destroy every word on the field, scoring base points for each. */
  burnAllWords(): void;
  /** Stop all movement and spawning for this many ticks (extends, never shortens). */
  freeze(ticks: number): void;
  /** Multiply fall speed by `factor` for this many ticks. */
  slow(ticks: number, factor: number): void;
  /** Instability back to 0%. */
  resetInstability(): void;
  /** Remove extra speed that mistakes added to words. */
  resetWordSpeeds(): void;
  /** Converts milliseconds to simulation ticks. */
  ticks(ms: number): number;
}

export interface SpellDefinition extends SpellData {
  cast(ctx: SpellContext): void;
}
