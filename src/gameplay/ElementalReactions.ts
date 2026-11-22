/**
 * TypeL elemental reaction rules.
 * Pure, deterministic gameplay logic: callers apply the returned effects to
 * enemies, spell visuals and sound. No rendering or timing dependencies.
 */
export type Element = 'water' | 'fire' | 'ice' | 'wind' | 'shock' | 'earth' | 'void';
export type Reaction = 'steam' | 'extinguish' | 'freeze' | 'melt' | 'conduct' | 'shatter' | 'fan' | 'smother' | 'disperse' | 'none';

export interface ElementalOutcome {
  reaction: Reaction;
  /** Damage multiplier for the incoming element. */
  damageMultiplier: number;
  /** Whether the existing elemental status is consumed. */
  consumesStatus: boolean;
}

/**
 * Existing target status first, incoming spell element second.
 * These rules deliberately favor familiar physical intuition. Status effects
 * should only be removed when consumesStatus is true.
 */
export function resolveElementalReaction(existing: Element | null, incoming: Element): ElementalOutcome {
  const none: ElementalOutcome = { reaction: 'none', damageMultiplier: 1, consumesStatus: false };
  if (existing === null || existing === incoming) return none;
  const pair = `${existing}:${incoming}`;
  switch (pair) {
    case 'fire:water': return { reaction: 'extinguish', damageMultiplier: 1.25, consumesStatus: true };
    case 'water:fire': return { reaction: 'steam', damageMultiplier: 0.75, consumesStatus: true };
    case 'water:ice': return { reaction: 'freeze', damageMultiplier: 1.25, consumesStatus: true };
    case 'ice:fire': return { reaction: 'melt', damageMultiplier: 1.5, consumesStatus: true };
    case 'water:shock': return { reaction: 'conduct', damageMultiplier: 1.5, consumesStatus: false };
    case 'ice:earth': return { reaction: 'shatter', damageMultiplier: 1.5, consumesStatus: true };
    case 'fire:wind': return { reaction: 'fan', damageMultiplier: 1.25, consumesStatus: false };
    case 'fire:earth': return { reaction: 'smother', damageMultiplier: 0.75, consumesStatus: true };
    case 'wind:void': return { reaction: 'disperse', damageMultiplier: 1, consumesStatus: true };
    default: return none;
  }
}
