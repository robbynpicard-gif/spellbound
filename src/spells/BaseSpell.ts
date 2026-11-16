import type { SpellId } from '../gameplay/SpellManager';

/** Display and tuning data for a spell, loaded from src/data/spells.json. */
export interface SpellData {
  id: SpellId;
  /** Wizzy Type name, e.g. "Incineration". */
  name: string;
  /** Short book name, e.g. "Fire". The word typed to cast it is the id ("fire"). */
  book: string;
  /** One short line, shown in game (pop-ups, boss rewards). */
  summary: string;
  /** The full explanation, for the spellbook. */
  description: string;
  /** How often this spell's scroll drops, relative to the other spells on the level. */
  dropWeight: number;
  durationMs?: number;
  speedFactor?: number;
  /** Arcane Shield: misses blocked per cast. */
  blocks?: number;
  /** Chain Lightning: extra words struck after the first. */
  arcs?: number;
  /** Transmutation: words at least this long are changed. */
  minLength?: number;
  /** Arcane Purge in Hardcore: fraction of current instability removed. */
  hardcoreHeal?: number;
}

/**
 * What a spell is allowed to do to the game. The engine provides this;
 * spells never touch engine internals directly, so new spells can be added
 * without changing the engine.
 */
export interface SpellContext {
  /** Incineration: destroy every word on the field, for no points or progress. */
  burnAllWords(): void;
  /** Stop all movement and spawning for this many more ticks (adds to any freeze left). */
  freeze(ticks: number): void;
  /** Add a slow stack: fall speed × `factor` for this many ticks, multiplied with other stacks. */
  slow(ticks: number, factor: number): void;
  /** Arcane Shield: the next `count` words to reach the ward line do no harm. */
  addBarrier(count: number): void;
  /** Chain Lightning: destroy the most urgent word and the `arcs` words nearest it, scoring them. */
  chainLightning(arcs: number): void;
  /** Transmutation: words of `minLength`+ letters become 3–4 letter words. */
  transmute(minLength: number): void;
  /** Harvest: every word on the field counts toward the quota, at half points. */
  harvestAll(): void;
  /** Arcane Purge: instability to 0% (Normal) or reduced by `hardcoreFraction` of itself (Hardcore). */
  purgeInstability(hardcoreFraction: number): void;
  /** Remove extra speed that mistakes added to words. */
  resetWordSpeeds(): void;
  /** Converts milliseconds to simulation ticks. */
  ticks(ms: number): number;
}

export interface SpellDefinition extends SpellData {
  cast(ctx: SpellContext): void;
}
