import { SeededRandom } from '../core/Random';
import { SPELL_IDS, type SpellId } from './SpellManager';

/**
 * OFFLINE DESIGN EXPERIMENT ONLY — NOT A LIVE GAMEPLAY SYSTEM.
 *
 * Arcane Gambit: a separate emergency slot-machine summon. The player spends
 * one hypothetical gambit charge to call down one random spell-bearing scroll.
 * They must still type the falling scroll to claim its spell. This module does
 * not spawn words, award charges, alter the existing spell pool or touch the
 * GameEngine's RNG. No production code imports it.
 */
export interface GambitState {
  charges: number;
  readyAtTick: number;
}

export type GambitResult =
  | { outcome: 'unavailable'; reason: 'cooldown' | 'no-charge'; state: GambitState }
  | { outcome: 'summoned'; spell: SpellId; state: GambitState };

export const GAMBIT_COOLDOWN_TICKS = 90 * 60; // provisional 90 active-play seconds

export function attemptArcaneGambit(
  state: Readonly<GambitState>,
  tick: number,
  rng: SeededRandom,
  cooldownTicks: number = GAMBIT_COOLDOWN_TICKS,
): GambitResult {
  if (!Number.isInteger(tick) || tick < 0 || !Number.isInteger(cooldownTicks) || cooldownTicks < 1) {
    throw new RangeError('tick must be nonnegative and cooldown must be positive');
  }
  if (!Number.isInteger(state.charges) || state.charges < 0 || !Number.isInteger(state.readyAtTick) || state.readyAtTick < 0) {
    throw new RangeError('invalid gambit state');
  }
  if (tick < state.readyAtTick) return { outcome: 'unavailable', reason: 'cooldown', state: { ...state } };
  if (state.charges === 0) return { outcome: 'unavailable', reason: 'no-charge', state: { ...state } };
  return {
    outcome: 'summoned',
    spell: rng.pick(SPELL_IDS),
    state: { charges: state.charges - 1, readyAtTick: tick + cooldownTicks },
  };
}
