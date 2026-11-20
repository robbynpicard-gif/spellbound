/** Deterministic Volley-only clock: player input and world spawning are separate.
 * One real tick yields one Volley tick normally, or four fifths during Slow.
 * Remainder is preserved through spell expiry so no timing is lost or gained.
 */
export interface TemporalFlowClock { tick: number; fifths: number }
export const emptyTemporalFlowClock = (): TemporalFlowClock => ({ tick: 0, fifths: 0 });
export function advanceTemporalFlow(clock: TemporalFlowClock, slow: boolean, paused: boolean): TemporalFlowClock {
  if (paused) return clock;
  const fifths = clock.fifths + (slow ? 4 : 5);
  return { tick: clock.tick + Math.floor(fifths / 5), fifths: fifths % 5 };
}
