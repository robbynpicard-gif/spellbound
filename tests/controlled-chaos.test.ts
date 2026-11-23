import { describe, expect, it } from 'vitest';
import { GameEngine } from '../src/core/GameEngine';
import { WORDS } from '../src/data/wordList';
import { simulate, typistAt, type RunReport } from '../src/difficulty/DirectorSimulation';
import { PRESSURE_CONTROL, PressureController } from '../src/difficulty/PressureController';
import { apprenticeshipEndless, apprenticeshipRun, openingRun, SPELL_ORDER, TRIALS } from '../src/typel/apprenticeship';
import { startingBank } from '../src/typel/progression';

/** D-116: controlled chaos inside the Academy itself. Simulations are diagnostic, not proof of fun. */
const academy = (trial: number, wpm: number, o: { control?: false; seed?: number; mode?: 'normal' | 'hardcore'; maxSeconds?: number } = {}): RunReport => {
  const spells = SPELL_ORDER.slice(0, Math.min(8, trial));
  return simulate({
    plan: apprenticeshipRun(o.mode ?? 'normal', trial, 'learn', { spells }), hardcore: o.mode === 'hardcore', words: WORDS, seed: o.seed ?? 1000,
    typist: { ...typistAt(wpm), casts: true }, maxSeconds: o.maxSeconds ?? 900, sampleEvery: 0.5, pressureControl: o.control,
    initialSpells: startingBank(TRIALS[trial - 1]!, spells),
  });
};
const idleShare = (r: RunReport) => r.timeline.filter((s) => s.words === 0).length / r.timeline.length;
const longestIdle = (r: RunReport) => {
  let run = 0;
  let best = 0;
  for (const s of r.timeline) best = Math.max(best, (run = s.words === 0 ? run + 1 : 0));
  return best * 0.5;
};
const meanActive = (r: RunReport) => r.timeline.reduce((a, s) => a + s.words, 0) / r.timeline.length;

describe('D-116 pressure controller (unit)', () => {
  const field = (n: number, y = 100, speed = 30) => Array.from({ length: n }, () => ({ match: 'ember', typed: 0, y, speed }));
  const calm = { slowFactor: 1, slowStacks: 0, frozen: false };
  const feed = (c: PressureController, from: number, to: number, words: ReturnType<typeof field>, cps: number, errorsPerSample = 0) => {
    for (let t = from; t <= to; t += 30) c.sample({ tick: t, correctChars: Math.round((t / 60) * cps), errors: Math.round((t / 30) * errorsPerSample), missed: 0, words, time: calm });
  };

  it('rises for a fast typist facing a quiet field, within its authored ceiling', () => {
    const c = new PressureController('both', 'run', 0);
    feed(c, 0, 60 * 120, field(2), 10);
    expect(c.snapshot.offset).toBeGreaterThan(0.5);
    expect(c.snapshot.offset).toBeLessThanOrEqual(PRESSURE_CONTROL.bounds.run.hi[0] + 1e-9);
  });

  it('eases for a struggling typist and never below its floor', () => {
    const c = new PressureController('both', 'run', 0);
    feed(c, 0, 60 * 120, field(9, 380), 2, 1);
    expect(c.snapshot.offset).toBeLessThan(0);
    expect(c.snapshot.offset).toBeGreaterThanOrEqual(PRESSURE_CONTROL.bounds.run.lo - 1e-9);
  });

  it("'up' never eases below zero and 'off' does nothing", () => {
    const up = new PressureController('up', 'endless', 1);
    feed(up, 0, 60 * 60, field(9, 380), 2, 1);
    expect(up.snapshot.offset).toBe(0);
    const off = new PressureController('off', 'run', 0);
    feed(off, 0, 60 * 60, field(1), 10);
    expect(off.effect()).toEqual({ spawnScale: 1, extraWords: 0, pressureBias: 0 });
  });

  it('holds steady inside its dead band (no oscillation on a balanced field)', () => {
    const c = new PressureController('both', 'run', 0.5);
    feed(c, 0, 60 * 20, field(2), 10);
    const before = c.snapshot.offset;
    // A field that asks for about the target share of a 4 letters/s typist.
    const words = Array.from({ length: 3 }, (_, i) => ({ match: 'lantern', typed: 0, y: 200 + i * 40, speed: 40 }));
    let reversals = 0;
    let last = before;
    let dir = 0;
    for (let t = 60 * 21; t <= 60 * 140; t += 30) {
      c.sample({ tick: t, correctChars: Math.round((t / 60) * 4), errors: 0, missed: 0, words, time: calm });
      const d = c.snapshot.offset - last;
      if (Math.abs(d) > 1e-9) {
        if (dir !== 0 && Math.sign(d) !== dir) reversals++;
        dir = Math.sign(d);
      }
      last = c.snapshot.offset;
    }
    expect(reversals).toBeLessThanOrEqual(1);
  });
});

describe('D-116 controlled chaos in the Academy (simulation)', () => {
  it('keeps a strong typist busy: far less idle time than the fixed curve, and no long empty stretches', () => {
    const on = academy(1, 120);
    const off = academy(1, 120, { control: false });
    expect(on.status).toBe('won');
    expect(idleShare(on)).toBeLessThan(idleShare(off) / 2);
    expect(longestIdle(on)).toBeLessThanOrEqual(3);
    expect(meanActive(on)).toBeGreaterThan(meanActive(off) * 3);
  });

  it('gives a beginner meaningful but manageable pressure', () => {
    const r = academy(1, 45);
    expect(r.status).toBe('won');
    expect(longestIdle(r)).toBeLessThanOrEqual(3);
    expect(meanActive(r)).toBeGreaterThan(2);
  });

  it('strong typing still earns a genuine advantage: the same exam clears faster at higher speed', () => {
    const mid = academy(5, 90);
    const fast = academy(5, 160);
    expect(mid.status).toBe('won');
    expect(fast.status).toBe('won');
    expect(fast.seconds).toBeLessThan(mid.seconds);
    expect(fast.score).toBeGreaterThan(mid.score);
  });

  it('the Opening Trial adapts too, and stays clearable by a capable typist', () => {
    const r = simulate({ plan: openingRun('normal'), words: WORDS, seed: 3, typist: typistAt(90), maxSeconds: 600, sampleEvery: 0.5 });
    expect(r.status).toBe('won');
    expect(r.timeline.some((s) => (s.offset ?? 0) > 0)).toBe(true);
  });

  it('Hardcore is a fixed profile: the controller is off, so the same seed and play give the same run', () => {
    const a = academy(3, 120, { mode: 'hardcore' });
    const b = academy(3, 120, { mode: 'hardcore', control: false });
    expect(a.timeline.every((s) => s.offset === null)).toBe(true);
    expect(a.score).toBe(b.score);
    expect(a.seconds).toBe(b.seconds);
  });

  it('adaptive runs replay exactly from their command log (saves and resume stay valid)', () => {
    const spells = SPELL_ORDER.slice(0, 3);
    const plan = apprenticeshipRun('normal', 3, 'learn', { spells });
    const options = { config: plan.segments[0]!.config, run: plan, seed: 77, words: WORDS, experimentalScoring: true, initialSpells: startingBank(TRIALS[2]!, spells) };
    const e = new GameEngine(options);
    // Type a little, badly and well, so the controller moves.
    for (let t = 0; t < 60 * 90 && e.status === 'playing'; t++) {
      if (t % 45 === 0 && e.state.words.length > 0) {
        const w = [...e.state.words].sort((a, b) => b.y - a.y)[0]!;
        for (const ch of w.match) e.typeChar(ch);
        e.submit();
      }
      if (t % 400 === 0) (e.typeChar('q'), e.clearInput());
      e.step();
    }
    const r = GameEngine.replay(options, e.commands, e.state.tick);
    expect(r.pressureControl).toEqual(e.pressureControl);
    expect(r.state.score).toBe(e.state.score);
    expect(r.state.words.map((w) => w.id)).toEqual(e.state.words.map((w) => w.id));
  });

  it('Endless still overwhelms a strong typist, and the controller only adds pressure there', () => {
    const r = simulate({ config: apprenticeshipEndless('normal', 5, SPELL_ORDER.slice(0, 5)), words: WORDS, seed: 9, typist: { ...typistAt(160), casts: true }, maxSeconds: 3600, sampleEvery: 1 });
    expect(r.status).toBe('lost');
    expect(r.timeline.every((s) => (s.offset ?? 0) >= 0)).toBe(true);
  });
});
