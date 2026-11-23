import { FIELD } from '../core/GameConfig';

/**
 * D-113 battlefield pressure: a deterministic, read-only measure of how much
 * the field is asking of the player right now. It is a MEASUREMENT for
 * simulations, tests and tuning; nothing in gameplay reads it.
 *
 * The idea (owner, D-113): difficulty is the typing work competing inside a
 * limited time window, not the length of any single word or the raw number
 * of scrolls on screen.
 *
 *   active     scrolls on the field
 *   urgent     scrolls that will reach the Ward within `urgentSeconds`
 *   workload   letters still to type on the scrolls that land within
 *              `windowSeconds` (the work competing for that window)
 *   required   the typing rate (letters/s) needed to save every scroll,
 *              nearest first, with a fixed cost to move between targets:
 *              max over k of (letters of the k nearest + k·switch·rate) / time
 *              until the k-th lands. Above the player's rate means something
 *              will land unless a spell or a choice changes the picture.
 *   impacts    pairs of scrolls that would reach the Ward within
 *              `impactGapSeconds` of each other (simultaneous impacts)
 *
 * Time to the Ward accounts for active Slow stacks and Ice (frozen: never).
 */
export interface FieldWord {
  y: number;
  speed: number;
  match: string;
  typed: number;
}

export interface FieldTime {
  slowFactor: number;
  slowStacks: number;
  frozen: boolean;
}

export interface PressureOptions {
  urgentSeconds: number;
  windowSeconds: number;
  switchSeconds: number;
  impactGapSeconds: number;
}

export const PRESSURE_DEFAULTS: PressureOptions = { urgentSeconds: 4, windowSeconds: 6, switchSeconds: 0.25, impactGapSeconds: 0.45 };

export interface BattlefieldPressure {
  active: number;
  urgent: number;
  workload: number;
  /** Letters per second needed (see above), at a reference switching cost. */
  requiredLps: number;
  impacts: number;
}

/** Seconds until each word reaches the Ward at its current effective speed (Infinity while frozen). */
export function timesToWard(words: readonly FieldWord[], time: FieldTime = { slowFactor: 1, slowStacks: 0, frozen: false }): number[] {
  const factor = time.frozen ? 0 : time.slowFactor ** time.slowStacks;
  return words.map((w) => (w.speed * factor > 0 ? Math.max(0, (FIELD.height - w.y) / (w.speed * factor)) : Infinity));
}

export function measurePressure(words: readonly FieldWord[], time?: FieldTime, o: PressureOptions = PRESSURE_DEFAULTS): BattlefieldPressure {
  const ttw = timesToWard(words, time);
  const rows = words.map((w, i) => ({ t: ttw[i]!, letters: Math.max(0, w.match.length - w.typed) })).filter((r) => Number.isFinite(r.t)).sort((a, b) => a.t - b.t);
  let urgent = 0;
  let workload = 0;
  let letters = 0;
  let required = 0;
  let impacts = 0;
  rows.forEach((r, k) => {
    if (r.t <= o.urgentSeconds) urgent++;
    if (r.t <= o.windowSeconds) workload += r.letters;
    letters += r.letters;
    // letters + k switches, expressed in letters at the needed rate: solve rate ≥ letters / (t − (k+1)·switch)
    const time = Math.max(0.05, r.t - (k + 1) * o.switchSeconds);
    required = Math.max(required, letters / time);
    const next = rows[k + 1];
    if (next && next.t - r.t < o.impactGapSeconds) impacts++;
  });
  return { active: words.length, urgent, workload, requiredLps: required, impacts };
}
