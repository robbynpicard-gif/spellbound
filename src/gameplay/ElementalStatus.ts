import { resolveElementalReaction, type Element, type ElementalOutcome } from './ElementalReactions';

/** Fixed-tick elemental status. No wall-clock dependencies: safe for replays. */
export interface ElementalStatus {
  element: Element;
  expiresAtTick: number;
}
export interface ElementalTransition {
  previous: Element | null;
  next: ElementalStatus;
  outcome: ElementalOutcome;
  /** Damage multiplier is returned for the eventual combat resolver; no damage is dealt here. */
  damageMultiplier: number;
}

/** Apply a spell to a status-bearing target, refreshing its lifetime.
 * The previous status only reacts while it is still active.
 */
export function applyElementalStatus(
  previous: ElementalStatus | null,
  incoming: Element,
  tick: number,
  durationTicks: number,
): ElementalTransition {
  if (!Number.isInteger(tick) || tick < 0) throw new RangeError('tick must be a nonnegative integer');
  if (!Number.isInteger(durationTicks) || durationTicks < 1) throw new RangeError('durationTicks must be positive');
  const existing = previous && previous.expiresAtTick > tick ? previous.element : null;
  const outcome = resolveElementalReaction(existing, incoming);
  return {
    previous: existing,
    next: { element: incoming, expiresAtTick: tick + durationTicks },
    outcome,
    damageMultiplier: outcome.damageMultiplier,
  };
}

export function activeElementalStatus(status: ElementalStatus | null, tick: number): ElementalStatus | null {
  return status && status.expiresAtTick > tick ? status : null;
}
