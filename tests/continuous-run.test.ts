import { describe, expect, it } from 'vitest';
import { GameEngine, type Command, type EngineOptions } from '../src/core/GameEngine';
import { SeededRandom } from '../src/core/Random';
import { WORDS } from '../src/data/wordList';
import {
  bossBaseline, DIRECTOR_TUNING, DifficultyDirector, endlessLevel, floorAt, mixAt, speedBandsAt, validateDirectorSpec, type DirectorSpec,
} from '../src/difficulty/DifficultyDirector';
import { eventDurations, eventGaps, percentile, simulate, typistAt, type Typist } from '../src/difficulty/DirectorSimulation';
import { WordGenerator } from '../src/gameplay/WordGenerator';
import {
  apprenticeshipEndless, apprenticeshipRun, BOSS_LEVEL, LEARN_CHECKPOINTS, learnedSpells, LEVELS_PER_TRIAL, sandboxRunConfig, TRIALS, trialLevel,
} from '../src/typel/apprenticeship';
import { RUN_RULESET, runRecordKey } from '../src/typel/runSave';

/**
 * D-102 acceptance tests: the continuous apprenticeship, persistent scoring,
 * the living Director and the ceiling-free Endless. They check structure and
 * shape. Numbers they compare against are labelled experimental tolerances.
 */

const PERFECT: Typist = { wpm: 140, reactionMs: 200, switchMs: 120, errorRate: 0, noticeMs: 0 };
const COUNTS = new WordGenerator(WORDS, { minWordLength: 2, maxWordLength: 12 }, new SeededRandom(1)).lengthCounts();
const options = (trial: number, mode: 'normal' | 'hardcore' = 'normal', seed = 5): EngineOptions => {
  const run = apprenticeshipRun(mode, trial);
  return { config: run.segments[0]!.config, run, seed, words: WORDS, hardcore: mode === 'hardcore', experimentalScoring: true };
};

/** A deterministic perfect bot driving a real engine; returns what happened at each checkpoint. */
function drive(engine: GameEngine, maxTicks: number, onTick?: (e: GameEngine) => void) {
  let wait = 0;
  for (let i = 0; i < maxTicks && engine.status === 'playing'; i++) {
    engine.step();
    onTick?.(engine);
    if (engine.status !== 'playing') break;
    if (wait-- > 0) continue;
    const s = engine.state;
    const target = [...s.words].sort((a, b) => b.y - a.y || a.id - b.id)[0];
    if (!target) continue;
    if (s.input === '') engine.selectTarget(target.id);
    const aimed = s.words.find((w) => w.id === s.pinnedId) ?? target;
    const ch = aimed.match[s.input.length];
    if (ch) engine.typeChar(ch);
    if (s.input === aimed.match) {
      engine.submit();
      wait = 6;
    } else wait = 2;
  }
}

describe('D-102 continuous apprenticeship structure', () => {
  it('is one run: Learn (≈30 %), Master (≈70 %), then the boss — no visible levels', () => {
    for (let t = 1; t <= 9; t++) {
      const run = apprenticeshipRun('normal', t);
      expect(run.segments).toHaveLength(BOSS_LEVEL);
      const phases = run.segments.map((s) => s.phase);
      expect(phases.filter((p) => p === 'learn')).toHaveLength(LEARN_CHECKPOINTS);
      expect(phases.filter((p) => p === 'master')).toHaveLength(LEVELS_PER_TRIAL - LEARN_CHECKPOINTS);
      expect(phases.at(-1)).toBe('boss');
      expect(LEARN_CHECKPOINTS / LEVELS_PER_TRIAL).toBeGreaterThan(0.25);
      expect(LEARN_CHECKPOINTS / LEVELS_PER_TRIAL).toBeLessThan(0.36);
      // Supporting levers come from the established level configs; the boss keeps its duration and ramp.
      expect(run.segments.at(-1)!.config.survivalMs).toBe(trialLevel('normal', t, BOSS_LEVEL).survivalMs);
      expect(run.segments.at(-1)!.config.ramp).toEqual(trialLevel('normal', t, BOSS_LEVEL).ramp);
      for (const seg of run.segments) {
        expect(validateDirectorSpec(seg.config.director)).toEqual([]);
        // Spell unlocks unchanged: the same learned spells and the same introduced spell.
        expect(seg.config.availableSpells).toEqual(learnedSpells(t));
        expect(seg.config.introducesSpell).toBe(TRIALS[t - 1]!.spell);
      }
    }
  });

  it('passes every checkpoint without stopping: status stays playing, phases advance in order, the boss ends the run', () => {
    const engine = new GameEngine(options(1));
    const seen: string[] = [];
    engine.events.on('checkpoint', ({ phase }) => {
      seen.push(phase);
      expect(engine.status).toBe('playing');
    });
    drive(engine, 60 * 60 * 20);
    expect(engine.status).toBe('won');
    expect(seen).toHaveLength(BOSS_LEVEL - 1);
    expect(seen.slice(0, LEARN_CHECKPOINTS - 1).every((p) => p === 'learn')).toBe(true);
    expect(seen[LEARN_CHECKPOINTS - 1]).toBe('master');
    expect(seen.at(-1)).toBe('boss');
  });

  it('starting at Master or the boss is a shorter run with the same structure (testing convenience)', () => {
    expect(apprenticeshipRun('normal', 3, 'master').segments[0]!.phase).toBe('master');
    expect(apprenticeshipRun('normal', 3, 'master').firstLevelIndex).toBe(LEARN_CHECKPOINTS);
    expect(apprenticeshipRun('normal', 3, 'boss').segments).toHaveLength(1);
  });
});

describe('D-102 persistent scoring', () => {
  it('score never drops and Combo, Arcane Rush, spells, field and Ward carry through every checkpoint', () => {
    const engine = new GameEngine(options(2, 'hardcore', 9));
    type Snap = { score: number; combo: number; rush: number; spells: string; words: string; missed: number };
    const snap = (e: GameEngine): Snap => ({ score: e.state.score, combo: e.state.combo, rush: e.volleyMultiplier,
      spells: JSON.stringify(e.state.spells), words: e.state.words.map((w) => w.id).join(), missed: e.state.missed });
    let before: Snap | null = null;
    let atCheckpoint: Snap | null = null;
    let lastScore = 0;
    let checks = 0;
    engine.events.on('checkpoint', () => {
      checks++;
      atCheckpoint = snap(engine);
      // The capture that met the quota just landed: nothing was taken away for passing the checkpoint.
      expect(atCheckpoint.score).toBeGreaterThanOrEqual(before!.score);
      expect(atCheckpoint.combo).toBeGreaterThanOrEqual(before!.combo);
      // Rush is not ended by the checkpoint (the capture can only keep or raise it), and the field stays.
      expect(atCheckpoint.rush).toBeGreaterThanOrEqual(before!.rush);
      const kept = before!.words.split(',').filter((id) => atCheckpoint!.words.split(',').includes(id));
      expect(kept.length).toBeGreaterThanOrEqual(before!.words.split(',').filter(Boolean).length - 1);
    });
    drive(engine, 60 * 60 * 6, (e) => {
      expect(e.state.score).toBeGreaterThanOrEqual(lastScore);
      lastScore = e.state.score;
      if (atCheckpoint) {
        // One tick later (before any new input), score, Combo, Rush and the field's existing words are untouched.
        const now = snap(e);
        expect(now.score).toBe(atCheckpoint.score);
        if (now.missed === atCheckpoint.missed) expect(now.combo).toBe(atCheckpoint.combo);
        expect(now.spells).toBe(atCheckpoint.spells);
        atCheckpoint = null;
      }
      before = snap(e);
    });
    expect(checks).toBeGreaterThan(3);
  });

  it('Rush is neither granted nor ended by a checkpoint, and a long Combo survives phase changes', () => {
    const r = simulate({ plan: apprenticeshipRun('normal', 1), words: WORDS, seed: 31, typist: PERFECT, maxSeconds: 900 });
    expect(r.status).toBe('won');
    // A perfect typist keeps one streak across the whole run.
    expect(r.maxCombo).toBeGreaterThan(150);
    const learnToMaster = r.checkpoints.find((c) => c.phase === 'master')!;
    expect(learnToMaster.combo).toBeGreaterThan(40);
  });

  it('Normal restores the Ward at each checkpoint; Hardcore carries it (with its scheduled recoveries)', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      const engine = new GameEngine({ ...options(4, mode, 3) });
      let atCheckpoint: number | null = null;
      let damagedBefore = false;
      engine.events.on('checkpoint', () => {
        if (atCheckpoint === null) atCheckpoint = engine.state.instability;
      });
      // Let the low opening words through, then play perfectly until the first checkpoint.
      for (let i = 0; i < 60 * 14 && engine.state.instability === 0; i++) engine.step();
      for (let i = 0; i < 60; i++) engine.step();
      damagedBefore = engine.state.instability > 0;
      drive(engine, 60 * 240, () => {});
      expect(damagedBefore).toBe(true);
      if (mode === 'normal') expect(atCheckpoint).toBe(0);
      else expect(atCheckpoint).toBeGreaterThan(0);
    }
  });

  it('Barrier keeps its rule: its layers last until the end of the checkpoint (the old level)', () => {
    const engine = new GameEngine({ ...options(4, 'normal', 2), initialSpells: { barrier: 1 } });
    for (let i = 0; i < 30; i++) engine.step();
    expect(engine.quickCast('barrier')).toBe(true);
    expect(engine.state.barrier).toBeGreaterThan(0);
    let atCheckpoint: number | null = null;
    engine.events.on('checkpoint', () => (atCheckpoint ??= engine.state.barrier));
    drive(engine, 60 * 200);
    expect(atCheckpoint).toBe(0);
  });

  it('records for the continuous ruleset are versioned and never overwrite the old level-based keys', () => {
    expect(runRecordKey('normal', 3)).toBe(`normal:3:${RUN_RULESET}`);
    expect(runRecordKey('normal', 3)).not.toBe('normal:3');
    expect(runRecordKey('hardcore', 3)).not.toBe('hardcore:3:director');
  });
});

describe('D-102 save, resume and determinism', () => {
  it('a checkpoint save (seed + command log) resumes to exactly the same state, and play continues identically', () => {
    const opts = options(3, 'normal', 77);
    const live = new GameEngine(opts);
    let saved: { tick: number; commands: Command[]; state: string } | null = null;
    live.events.on('checkpoint', ({ segment }) => {
      if (segment === 3 && !saved) saved = { tick: live.state.tick, commands: live.commands.filter((c) => c.tick <= live.state.tick), state: JSON.stringify(live.state) };
    });
    drive(live, 60 * 60 * 3);
    expect(saved).not.toBeNull();
    const resumed = GameEngine.replay(opts, saved!.commands, saved!.tick);
    expect(JSON.stringify(resumed.state)).toBe(saved!.state);
    expect(resumed.runInfo).toEqual(GameEngine.replay(opts, live.commands, saved!.tick).runInfo);
    // A full replay reproduces the whole run.
    const full = GameEngine.replay(opts, live.commands, live.state.tick);
    expect(full.state).toEqual(live.state);
    expect(full.stats()).toEqual(live.stats());
  });

  it('the same seed and actions give the same run; a different seed differs', () => {
    const a = simulate({ plan: apprenticeshipRun('normal', 5), words: WORDS, seed: 12, typist: typistAt(90), maxSeconds: 200 });
    const b = simulate({ plan: apprenticeshipRun('normal', 5), words: WORDS, seed: 12, typist: typistAt(90), maxSeconds: 200 });
    const c = simulate({ plan: apprenticeshipRun('normal', 5), words: WORDS, seed: 13, typist: typistAt(90), maxSeconds: 200 });
    expect(b.spawns).toEqual(a.spawns);
    expect(b.score).toBe(a.score);
    expect(c.spawns).not.toEqual(a.spawns);
  });

  it('the Director reads only seed, spec, progress, the clock and the bounded D-116 bias', () => {
    const keys = new Set<string>();
    const ctx = new Proxy({ progress: 0.3, seconds: 40 }, { get: (o, k) => (keys.add(String(k)), (o as Record<string | symbol, unknown>)[k]) });
    new DifficultyDirector(apprenticeshipRun('normal', 2).segments[0]!.config.director!, 1, COUNTS).next(ctx);
    for (const k of keys) expect(['progress', 'seconds', 'endlessSeconds', 'phase', 'opening', 'bias']).toContain(k);
    // D-116: Normal adapts, Hardcore is a fixed profile, Endless only adds.
    expect(apprenticeshipRun('normal', 2).segments[0]!.config.director!.adaptive).toBe('both');
    expect(apprenticeshipRun('hardcore', 2).segments[0]!.config.director!.adaptive).toBe('off');
    expect(apprenticeshipEndless('normal', 2).director!.adaptive).toBe('up');
  });
});

describe('D-102 living difficulty', () => {
  // The authored event schedule (D-102); the D-116 controller is tested in controlled-chaos.test.ts.
  const runReport = simulate({ plan: apprenticeshipRun('normal', 5), words: WORDS, seed: 21, typist: PERFECT, maxSeconds: 1200, pressureControl: false });
  const preBoss = runReport.timeline.filter((s) => s.phase === 'learn' || s.phase === 'master');

  it('short pressure events arrive every ~8–15 s and last ~3–7 s (experimental targets)', () => {
    const gaps = eventGaps(preBoss.filter((s) => s.phase === 'master'), 'pressure');
    const durations = eventDurations(preBoss, 'pressure');
    expect(gaps.length).toBeGreaterThan(10);
    expect(percentile(gaps, 0.5)).toBeGreaterThanOrEqual(7);
    expect(percentile(gaps, 0.5)).toBeLessThanOrEqual(16);
    expect(percentile(durations, 0.5)).toBeGreaterThanOrEqual(2);
    expect(percentile(durations, 0.5)).toBeLessThanOrEqual(7);
  });

  it('major surges arrive every ~25–40 s, with short recoveries that keep words coming', () => {
    const gaps = eventGaps(preBoss, 'surge');
    expect(gaps.length).toBeGreaterThan(5);
    expect(percentile(gaps, 0.5)).toBeGreaterThanOrEqual(24);
    expect(percentile(gaps, 0.5)).toBeLessThanOrEqual(42);
    const recoveries = eventDurations(preBoss, 'recovery');
    expect(Math.max(...recoveries)).toBeLessThanOrEqual(4);
    // Words keep spawning during recovery: nearly every recovery window has new words arriving.
    const windows: [number, number][] = [];
    let open: number | null = null;
    for (const s of preBoss) {
      if (s.event === 'recovery' && open === null) open = s.t - 1;
      if (s.event !== 'recovery' && open !== null) (windows.push([open, s.t]), (open = null));
    }
    const fed = windows.filter(([a, b]) => runReport.spawns.some((x) => x.seconds >= a && x.seconds <= b)).length;
    expect(fed / windows.length).toBeGreaterThanOrEqual(0.8);
  });

  it('the spawn schedule never leaves a long empty stretch that could starve Combo or Rush', () => {
    const times = runReport.spawns.filter((s) => s.phase === 'learn' || s.phase === 'master').map((s) => s.seconds);
    const longest = Math.max(...times.slice(1).map((t, i) => t - times[i]!));
    expect(longest).toBeLessThan(5);
  });

  it('recovery is about half as deep and ~40 % shorter than before (0.45 → 0.22; ~5 s → ~3 s)', () => {
    expect(DIRECTOR_TUNING.recovery.depth).toBeCloseTo(0.22, 2);
    expect(DIRECTOR_TUNING.recovery.duration[1]).toBeLessThanOrEqual(3.5);
  });

  it('the boss builds to its climax: last recovery done by 85 %, then pressure rises smoothly to its maximum at the end', () => {
    const b = DIRECTOR_TUNING.boss;
    const lastRecoveryEnd = Math.max(...b.surges.map((at) => at + b.surgeLength + b.recoveryLength));
    expect(lastRecoveryEnd).toBeLessThanOrEqual(0.85);
    for (const mode of ['normal', 'hardcore'] as const)
      for (let t = 1; t <= 9; t++) {
        const spec = apprenticeshipRun(mode, t).segments.at(-1)!.config.director!;
        const d = new DifficultyDirector(spec, 4, COUNTS);
        const at = (p: number) => d.envelope({ progress: p, seconds: 1000 + p * 90, phase: 'boss' }).pressure;
        const tail = Array.from({ length: 16 }, (_, i) => at(0.85 + (i * 0.15) / 15));
        for (let i = 1; i < tail.length; i++) expect(tail[i]!).toBeGreaterThanOrEqual(tail[i - 1]! - 1e-9);
        const all = Array.from({ length: 101 }, (_, i) => at(i / 100));
        expect(at(1)).toBeGreaterThanOrEqual(Math.max(...all) - 1e-9);
        expect(bossBaseline(spec, 1)).toBeGreaterThan(bossBaseline(spec, 0));
      }
  });

  it('the floor rises across apprenticeships, and Hardcore starts higher and falls faster than Normal', () => {
    let last = -1;
    for (let t = 1; t <= 9; t++) {
      const a = (t - 1) / 8;
      expect(floorAt({ mode: 'normal', apprenticeship: a })).toBeGreaterThanOrEqual(last);
      last = floorAt({ mode: 'normal', apprenticeship: a });
      expect(floorAt({ mode: 'hardcore', apprenticeship: a })).toBeGreaterThan(floorAt({ mode: 'normal', apprenticeship: a }));
      expect(speedBandsAt({ mode: 'hardcore', apprenticeship: a }).fast[1]).toBeLessThan(speedBandsAt({ mode: 'normal', apprenticeship: a }).fast[1]);
    }
    expect(DIRECTOR_TUNING.endless.growthPerMinute.hardcore).toBeGreaterThan(DIRECTOR_TUNING.endless.growthPerMinute.normal);
  });

  it('words vary in timing: gaps between spawns are not mechanically uniform', () => {
    const times = runReport.spawns.slice(20, 120).map((s) => s.seconds);
    const gaps = times.slice(1).map((t, i) => t - times[i]!);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - mean) ** 2, 0) / gaps.length);
    expect(sd / mean).toBeGreaterThan(0.2);
  });
});

describe('D-101 vocabulary identity in the continuous run', () => {
  const lengths = (trial: number, mode: 'normal' | 'hardcore', phase: string, seeds = 4) =>
    Array.from({ length: seeds }, (_, i) => simulate({ plan: apprenticeshipRun(mode, trial), words: WORDS, seed: 400 + i, typist: PERFECT, maxSeconds: 900 }))
      .flatMap((r) => r.spawns.filter((s) => s.phase === phase).map((s) => s.length));
  const share = (ls: number[], f: (l: number) => boolean) => ls.filter(f).length / ls.length;

  it('Slow opens in its familiar 3–6 range; 7+ stays extremely rare', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      const ls = lengths(1, mode, 'learn');
      expect(ls.length).toBeGreaterThan(300);
      expect(share(ls, (l) => l >= 3 && l <= 6)).toBeGreaterThanOrEqual(0.95);
      expect(share(ls, (l) => l >= 7)).toBeLessThanOrEqual(0.02);
    }
  });

  it('Harvest is dominated by 6+ letters with occasional shorter relief', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      const ls = lengths(8, mode, 'master', 2);
      expect(share(ls, (l) => l >= 6)).toBeGreaterThanOrEqual(0.85);
      expect(share(ls, (l) => l <= 4)).toBeLessThanOrEqual(0.03);
      expect(share(ls, (l) => l <= 5)).toBeGreaterThan(0.01);
    }
  });

  it('all four length × speed combinations appear in the first apprenticeship, far from equally often', () => {
    const r = simulate({ plan: apprenticeshipRun('normal', 1), words: WORDS, seed: 8, typist: PERFECT, maxSeconds: 900 });
    const corner = (l: string, v: string) => r.spawns.filter((s) => s.lengthBand === l && s.speedBand === v).length / r.spawns.length;
    for (const [l, v] of [['short', 'slow'], ['long', 'slow'], ['short', 'fast'], ['long', 'fast']] as const) expect(corner(l, v)).toBeGreaterThan(0.01);
    expect(corner('short', 'slow')).toBeGreaterThan(3 * corner('long', 'fast'));
    expect(mixAt(1)[0][0]).toBeGreaterThanOrEqual(DIRECTOR_TUNING.reliefReserve - 1e-9);
  });
});

describe('D-102 Endless has no permanent ceiling', () => {
  const spec = (mode: 'normal' | 'hardcore', trial: number): DirectorSpec => apprenticeshipEndless(mode, trial).director!;

  it('the Endless level keeps rising forever, while each lever it drives stays bounded and readable', () => {
    for (const mode of ['normal', 'hardcore'] as const) {
      const d = new DifficultyDirector(spec(mode, 1), 3, COUNTS);
      let last = -Infinity;
      for (const min of [0, 5, 10, 30, 60, 120, 600]) {
        const env = d.envelope({ progress: 0, seconds: 0, endlessSeconds: min * 60 });
        expect(env.endlessLevel!).toBeGreaterThan(last);
        last = env.endlessLevel!;
        expect(env.pressure).toBeLessThanOrEqual(1);
        expect(env.overdrive).toBeLessThanOrEqual(DIRECTOR_TUNING.endless.overdriveMax[mode] + 1e-9);
        expect(env.speedBands.fast[1]).toBeGreaterThanOrEqual(DIRECTOR_TUNING.minFallSeconds - 1e-9);
        expect(env.spawnFloorMs).toBeGreaterThan(0);
      }
      expect(endlessLevel(spec(mode, 1), 3600)).toBeGreaterThan(endlessLevel(spec(mode, 1), 600));
    }
  });

  it('every typist eventually falls, the faster ones much later, and Hardcore sooner than Normal (200 WPM included)', () => {
    const minutes = (mode: 'normal' | 'hardcore', wpm: number) => {
      const r = simulate({ config: apprenticeshipEndless(mode, 1), hardcore: mode === 'hardcore', words: WORDS, seed: 78, typist: typistAt(wpm), maxSeconds: 3600, sampleEvery: 2 });
      expect(r.status).toBe('lost');
      return r.seconds / 60;
    };
    const slow = minutes('normal', 45);
    const fast = minutes('normal', 200);
    expect(fast).toBeGreaterThan(slow * 5);
    expect(minutes('hardcore', 200)).toBeLessThan(fast);
  });

  it('the Sandbox plays the Endless of its apprenticeship', () => {
    expect(sandboxRunConfig('normal', 1).director?.kind).toBe('endless');
    expect(sandboxRunConfig('hardcore', 5).director?.apprenticeship).toBe(1);
  });
});
