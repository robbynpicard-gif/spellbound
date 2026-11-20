import { describe, expect, it } from 'vitest';
import { advanceTemporalFlow, emptyTemporalFlowClock } from './TemporalFlow';
import { arcaneVolleyCapture, arcaneVolleyMultiplier, emptyArcaneVolley } from './ArcaneVolley';

describe('Temporal Flow sandbox time', () => {
  it('advances monotonically and gives exactly 25% more capture opportunity under Slow', () => {
    let normal = emptyTemporalFlowClock();
    let slow = emptyTemporalFlowClock();
    for (let i = 0; i < 100; i++) {
      normal = advanceTemporalFlow(normal, false, false);
      slow = advanceTemporalFlow(slow, true, false);
    }
    expect(normal.tick).toBe(100);
    expect(slow.tick).toBe(80);
    expect(slow.fifths).toBe(0);
  });

  it('pauses during Ice or an empty field without rewinding', () => {
    let clock = emptyTemporalFlowClock();
    clock = advanceTemporalFlow(clock, true, false);
    const held = clock;
    for (let i = 0; i < 500; i++) clock = advanceTemporalFlow(clock, true, true);
    expect(clock).toEqual(held);
    clock = advanceTemporalFlow(clock, true, false);
    expect(clock.tick).toBeGreaterThanOrEqual(held.tick);
  });

  it('preserves fractional time across Slow expiry without a discontinuity', () => {
    let clock = emptyTemporalFlowClock();
    clock = advanceTemporalFlow(clock, true, false);
    expect(clock).toEqual({ tick: 0, fifths: 4 });
    clock = advanceTemporalFlow(clock, false, false);
    expect(clock).toEqual({ tick: 1, fifths: 4 });
    clock = advanceTemporalFlow(clock, false, false);
    expect(clock).toEqual({ tick: 2, fifths: 4 });
  });

  it('does not grant free Volley and allows two captures during Slow', () => {
    let clock = emptyTemporalFlowClock();
    let volley = arcaneVolleyCapture(emptyArcaneVolley(), clock.tick, 5, false);
    expect(arcaneVolleyMultiplier(volley, clock.tick, false)).toBe(1);
    for (let i = 0; i < 140; i++) clock = advanceTemporalFlow(clock, true, false);
    volley = arcaneVolleyCapture(volley, clock.tick, 5, false);
    expect(clock.tick).toBe(112);
    expect(arcaneVolleyMultiplier(volley, clock.tick, false)).toBe(1.2);
  });

  it('is deterministic and Slow stacking does not compound Volley slowdown', () => {
    const run = () => {
      let clock = emptyTemporalFlowClock();
      for (let i = 0; i < 120; i++) {
        clock = advanceTemporalFlow(clock, true, i % 11 === 0);
      }
      return clock;
    };
    expect(run()).toEqual(run());
    expect(run().tick).toBeLessThan(120);
  });
});
