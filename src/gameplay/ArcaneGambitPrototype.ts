import { SeededRandom } from '../core/Random';
import { SPELL_IDS, type SpellId } from './SpellManager';

/**
 * OFFLINE PROTOTYPE ONLY — not wired into live gameplay.
 * A single speculative emergency roll per Campaign stage, with no cooldown,
 * secondary recharge system, or change to the normal spell economy.
 */
export interface GambitState {
  stage: number;
  available: boolean;
}

export type GambitResult =
  | { outcome: 'unavailable'; reason: 'already-used'; state: GambitState }
  | { outcome: 'summoned'; spell: SpellId; state: GambitState };

/** Start each new stage with one possible emergency summon. */
export function startGambitStage(stage: number): GambitState {
  if (!Number.isInteger(stage) || stage < 1) throw new RangeError('stage must be a positive integer');
  return { stage, available: true };
}

/**
 * The outcome is only a hypothetical spell-bearing scroll ID. No actual word
 * is spawned and no spell is awarded; players would still have to capture it.
 * An independent RNG ensures this roll cannot perturb ordinary word spawning.
 */
export function attemptArcaneGambit(state: Readonly<GambitState>, rng: SeededRandom): GambitResult {
  if (!Number.isInteger(state.stage) || state.stage < 1 || typeof state.available !== 'boolean') {
    throw new RangeError('invalid gambit state');
  }
  if (!state.available) return { outcome: 'unavailable', reason: 'already-used', state: { ...state } };
  return {
    outcome: 'summoned',
    spell: rng.pick(SPELL_IDS),
    state: { stage: state.stage, available: false },
  };
}
