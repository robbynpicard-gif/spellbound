/**
 * Ward capacity, Wind scars and the All-In wager (D-083 prototype, D-084).
 *
 * Pure, deterministic state transitions. The engine keeps instability
 * (0 = fully stable, 100 = collapsed); here we speak in *stability*
 * (100 − instability) because that is what the player sees.
 *
 * EXPERIMENTAL TUNING: every number below is a prototype value for owner
 * playtesting, not an approved balance figure. See
 * docs/wind-apprenticeship-prototype-2026-11-20.md.
 */

export const WARD_TUNING = {
  /** Stability left after an All-In wager (25% = the critical threshold). */
  wagerStability: 25,
  /** Scar taken from the recoverable maximum by the first wager... */
  firstScar: 15,
  /** ...and how much bigger each later wager's scar is. */
  scarGrowth: 5,
  /** A wager is only possible if the maximum stays at or above this afterwards. */
  minCapAfterWager: 40,
  /** Defensive Wind restores up to this much stability (capped by the scarred maximum). */
  windHeal: 100,
  /** All-In score multiplier on eligible typed captures and spell cash-outs. */
  allInMultiplier: 2,
  /** All-In window length in simulation ticks (60 Hz): 10 seconds. */
  allInTicks: 600,
} as const;

export type WardTuning = { -readonly [K in keyof typeof WARD_TUNING]: number };

export interface WardScarState {
  /** Recoverable maximum stability, 0–100. Starts at 100. */
  cap: number;
  /** Wagers taken in the current scope (Normal: level, Hardcore: stage). */
  wagers: number;
  /** Ticks left in the All-In window (0 = inactive). */
  allInTicks: number;
}

export const freshWard = (): WardScarState => ({ cap: 100, wagers: 0, allInTicks: 0 });

export function scarFor(wagersTaken: number, t: WardTuning = WARD_TUNING): number {
  return t.firstScar + Math.max(0, wagersTaken) * t.scarGrowth;
}

/** Whether a wager is physically possible at this cap (ignoring current stability). */
export function canWagerAt(state: Readonly<WardScarState>, t: WardTuning = WARD_TUNING): boolean {
  return state.cap - scarFor(state.wagers, t) >= t.minCapAfterWager;
}

export type WindOutcome = 'wager' | 'heal' | 'calm';

export interface WindResult {
  outcome: WindOutcome;
  ward: WardScarState;
  /** Stability after the cast. */
  stability: number;
  /** Scar taken by this cast (wager only). */
  scar: number;
  /** True if an active All-In ended because the cast healed. */
  endedAllIn: boolean;
}

/**
 * The single authoritative Wind decision.
 * - Below the current maximum: heal toward it (never above). Healing ends an
 *   active All-In: the power is drawn back into the Ward.
 * - At the current maximum and a wager is viable: All-In. Stability drops to
 *   the critical threshold, the maximum is scarred, and the window opens.
 *   It replaces (never stacks with) any earlier window.
 * - At the maximum but too scarred to wager: a calm gust (no heal needed,
 *   no wager). Word-speed reset still happens in the engine.
 */
export function castWind(state: Readonly<WardScarState>, stability: number, t: WardTuning = WARD_TUNING): WindResult {
  const current = clamp(stability, 0, state.cap);
  if (current < state.cap) {
    const healed = Math.min(state.cap, current + t.windHeal);
    return { outcome: 'heal', ward: { ...state, allInTicks: 0 }, stability: healed, scar: 0, endedAllIn: state.allInTicks > 0 };
  }
  if (!canWagerAt(state, t)) return { outcome: 'calm', ward: { ...state }, stability: current, scar: 0, endedAllIn: false };
  const scar = scarFor(state.wagers, t);
  const cap = state.cap - scar;
  return {
    outcome: 'wager',
    ward: { cap, wagers: state.wagers + 1, allInTicks: t.allInTicks },
    stability: Math.min(t.wagerStability, cap),
    scar,
    endedAllIn: false,
  };
}

/** Any heal from any source obeys the scarred maximum. */
export function clampHeal(stability: number, heal: number, cap: number): number {
  return clamp(stability + Math.max(0, heal), 0, cap);
}

export function tickAllIn(state: Readonly<WardScarState>): WardScarState {
  return state.allInTicks > 0 ? { ...state, allInTicks: state.allInTicks - 1 } : (state as WardScarState);
}

export function allInMultiplier(state: Readonly<WardScarState>, t: WardTuning = WARD_TUNING): number {
  return state.allInTicks > 0 ? t.allInMultiplier : 1;
}

/** Scope boundary: Normal clears scars every level; Hardcore keeps them for the stage. */
export function wardForNextLevel(state: Readonly<WardScarState>, hardcore: boolean): WardScarState {
  return hardcore ? { cap: state.cap, wagers: state.wagers, allInTicks: 0 } : freshWard();
}

/** Safe restore of saved fields (older saves have none). */
export function parseWard(cap: unknown, wagers: unknown): WardScarState {
  const c = typeof cap === 'number' && Number.isFinite(cap) ? clamp(Math.round(cap), 1, 100) : 100;
  const w = typeof wagers === 'number' && Number.isFinite(wagers) ? clamp(Math.floor(wagers), 0, 20) : 0;
  return { cap: c, wagers: w, allInTicks: 0 };
}

/**
 * Shared deterministic score rule for the Arcane preview: one rounding, at the end.
 * Typed captures pass Combo × Volley × All-In; cash-outs pass what they are allowed.
 */
export function arcaneScore(basePoints: number, comboMult: number, volleyMult: number, allInMult: number): number {
  const parts = [basePoints, comboMult, volleyMult, allInMult];
  if (!parts.every(Number.isFinite) || basePoints < 0 || comboMult < 1 || volleyMult < 1 || allInMult < 1)
    throw new RangeError('invalid scoring inputs');
  return Math.round(basePoints * comboMult * volleyMult * allInMult);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
